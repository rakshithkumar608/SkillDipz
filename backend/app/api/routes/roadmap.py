from fastapi import Request
from app.core.redis_client import check_session_rate_limit
from app.core.config import settings
import logging
import re
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.routes.auth import get_current_user
from app.core.groq_service import get_or_generate_benchmarks
from app.core.youtube import fetch_youtube_videos, fetch_skill_videos_structured
from app.models.employability_score import EmployabilityScore
from app.models.roadmap import StudentRoadmap
from app.models.skill_gap import RoleSkillBenchmark, StudentSkillLevel
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class YoutubeVideo(BaseModel):
    youtube_id: str
    title: str
    channel: str
    thumbnail: str
    duration_label: str = ""
    category: str = "core"   # "core" or "reference"
    watched: bool = False     # injected at response time from watched_videos


class RoadmapItemContent(BaseModel):
    youtube: List[YoutubeVideo] = []   # legacy flat list (backward compat)
    core: List[YoutubeVideo] = []      # 2 core long-form videos
    reference: List[YoutubeVideo] = [] # 2 reference shorter videos


class RoadmapItem(BaseModel):
    skill: str
    gap: int
    current_level: int
    required_level: int
    estimated_weeks: int
    status: str
    progress_pct: int
    content: RoadmapItemContent


class PhaseProjectOut(BaseModel):
    phase: int
    title: str
    description: str
    level: str
    required_skills: List[str]
    status: str          # not_started | in_progress | completed
    github_url: Optional[str] = None
    submitted_at: Optional[datetime] = None


class CapstoneItem(BaseModel):
    type: str = "project"
    title: str
    description: str
    status: str


class RoadmapPhase(BaseModel):
    phase: int
    label: str
    items: List[Any]
    phase_status: str = "LOCKED"       # LOCKED | UNLOCKED | IN_PROGRESS | PROJECT_REQUIRED | COMPLETED
    phase_project: Optional[PhaseProjectOut] = None
    skills_completed: int = 0
    skills_total: int = 0
    project_completed: bool = False


class RoadmapOut(BaseModel):
    role: str
    generated_from: str
    last_regenerated: Optional[datetime]
    progress_pct: int
    phases: List[RoadmapPhase]
    needs_setup: bool


class SubmitProjectBody(BaseModel):
    github_url: str


class WatchVideoBody(BaseModel):
    youtube_id: str


# ─── Phase Project Templates ─────────────────────────────────────────────────

_PROJECT_TEMPLATES = {
    1: {
        "title_suffix": "Foundation Application",
        "level": "intermediate",
        "description_template": (
            "Apply the foundational skills you've mastered in Phase 1 — {skills} — "
            "to build a working project. Submit your GitHub repository URL to complete Phase 1 "
            "and unlock Phase 2."
        ),
    },
    2: {
        "title_suffix": "Production-Ready System",
        "level": "advanced",
        "description_template": (
            "Integrate your advanced skills — {skills} — into a production-ready system. "
            "This project should demonstrate real-world readiness. Submit your GitHub repository "
            "to complete Phase 2 and unlock the Capstone."
        ),
    },
    3: {
        "title_suffix": "Capstone Project",
        "level": "expert",
        "description_template": (
            "This is your final milestone. Combine everything you've learned — {skills} — "
            "into a complete, deployable application that showcases your full skill set. "
            "Submit your GitHub repository to complete your learning journey."
        ),
    },
}


def _build_phase_project_data(phase_num: int, role: str, skills: list[str]) -> dict:
    """Build the phase project descriptor dict (stored inside phase data)."""
    tpl = _PROJECT_TEMPLATES.get(phase_num, _PROJECT_TEMPLATES[2])
    skills_preview = ", ".join(skills[:6])
    if len(skills) > 6:
        skills_preview += f" and {len(skills) - 6} more"

    role_cap = role.replace("-", " ").title()
    title = f"Advanced Project — Level {phase_num}: {role_cap} {tpl['title_suffix']}"
    description = tpl["description_template"].format(skills=skills_preview)

    return {
        "phase": phase_num,
        "title": title,
        "description": description,
        "level": tpl["level"],
        "required_skills": skills,
    }


# ─── Phase State Computation ─────────────────────────────────────────────────

PhaseState = Literal["LOCKED", "UNLOCKED", "IN_PROGRESS", "PROJECT_REQUIRED", "COMPLETED"]


def _compute_phase_states(phases: list[dict], phase_projects: dict) -> dict[str, str]:
    """
    Compute state for each phase based on skill completion and project completion.

    Rules:
    - Phase 1 starts UNLOCKED (always accessible)
    - Phase N (N>1) is LOCKED until Phase N-1 is COMPLETED
    - Within an UNLOCKED phase:
        - If 0 skills done → UNLOCKED (not yet started)
        - If some skills done but not all → IN_PROGRESS
        - If all skills done but project not completed → PROJECT_REQUIRED
        - If all skills done AND project completed → COMPLETED
    """
    states: dict[str, str] = {}
    skill_phases = [p for p in phases if not _is_capstone_phase(p)]

    for idx, phase in enumerate(phases):
        phase_key = str(phase["phase"])
        prev_key = str(phases[idx - 1]["phase"]) if idx > 0 else None

        # Phase locking: phase N requires phase N-1 to be COMPLETED
        if prev_key and states.get(prev_key) != "COMPLETED":
            states[phase_key] = "LOCKED"
            continue

        # Count skill items (exclude capstone/project items)
        skill_items = [
            item for item in phase.get("items", [])
            if item.get("type") != "project"
        ]
        total = len(skill_items)
        completed_skills = sum(1 for i in skill_items if i.get("status") == "completed")

        # Get project state
        proj = phase_projects.get(phase_key, {})
        project_done = proj.get("status") == "completed"

        # Determine state
        if total == 0:
            # Capstone-only phase (phase 3)
            states[phase_key] = "COMPLETED" if project_done else "PROJECT_REQUIRED"
        elif completed_skills == 0:
            states[phase_key] = "UNLOCKED"
        elif completed_skills < total:
            states[phase_key] = "IN_PROGRESS"
        elif not project_done:
            states[phase_key] = "PROJECT_REQUIRED"
        else:
            states[phase_key] = "COMPLETED"

    return states


def _is_capstone_phase(phase: dict) -> bool:
    """Returns True if all items in phase are capstone/project type (no skill items)."""
    items = phase.get("items", [])
    return len(items) > 0 and all(item.get("type") == "project" for item in items)


# ─── Phase Building ──────────────────────────────────────────────────────────

def _estimate_weeks(gap: int) -> int:
    return max(1, gap)


async def _build_phases(role: str, student_id: str, existing_phases: list, existing_phase_projects: dict) -> list[dict]:
    student_skills = await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id
    ).to_list()
    skill_map = {s.skill.lower(): s.current_level for s in student_skills}

    # Fetch from DB or generate real-time with Groq API
    benchmarks = await get_or_generate_benchmarks(role)

    skill_data = []
    for bm in benchmarks:
        current = skill_map.get(bm.skill.lower(), 0)
        gap = max(0, bm.required_level - current)
        skill_data.append({
            "skill": bm.skill,
            "gap": gap,
            "current_level": current,
            "required_level": bm.required_level,
            "priority": bm.priority,
        })

    skill_data.sort(key=lambda x: (-x["gap"], x["priority"]))

    # Preserve existing skill status across regeneration
    existing_status: dict[str, dict] = {}
    for phase in existing_phases:
        for item in phase.get("items", []):
            if item.get("type") == "project":
                continue
            existing_status[item["skill"].lower()] = {
                "status": item.get("status", "locked"),
                "progress_pct": item.get("progress_pct", 0),
            }

    phase1_items = []
    phase2_items = []
    first_active_assigned = False

    for sd in skill_data:
        if sd["gap"] == 0:
            continue

        est_weeks = _estimate_weeks(sd["gap"])
        prev = existing_status.get(sd["skill"].lower(), {})
        status = prev.get("status", "locked")
        progress_pct = prev.get("progress_pct", 0)

        if not first_active_assigned and status == "locked":
            status = "in_progress"
            first_active_assigned = True

        item = {
            "skill": sd["skill"],
            "gap": sd["gap"],
            "current_level": sd["current_level"],
            "required_level": sd["required_level"],
            "estimated_weeks": est_weeks,
            "status": status,
            "progress_pct": progress_pct,
            "content": {"youtube": [], "core": [], "reference": []},
        }

        if sd["gap"] >= 3:
            phase1_items.append(item)
        else:
            phase2_items.append(item)

    # Pre-fetch YouTube videos for the first skill in each phase
    for items_list in [phase1_items, phase2_items]:
        if items_list:
            structured = await fetch_skill_videos_structured(items_list[0]["skill"], role)
            core_vids = structured.get("core", [])
            ref_vids = structured.get("reference", [])
            all_flat = core_vids + ref_vids
            items_list[0]["content"]["youtube"] = all_flat
            items_list[0]["content"]["core"] = core_vids
            items_list[0]["content"]["reference"] = ref_vids

    phases = []

    if phase1_items:
        skills_in_phase1 = [i["skill"] for i in phase1_items]
        phase1_project = _build_phase_project_data(1, role, skills_in_phase1)
        phases.append({
            "phase": 1,
            "label": "Foundation Skills",
            "items": phase1_items,
            "phase_project_def": phase1_project,
        })

    if phase2_items:
        skills_in_phase2 = [i["skill"] for i in phase2_items]
        phase2_project = _build_phase_project_data(2, role, skills_in_phase2)
        phases.append({
            "phase": 2,
            "label": "Advanced Skills",
            "items": phase2_items,
            "phase_project_def": phase2_project,
        })

    # Phase 3 — Capstone (project-only phase)
    if phases:
        all_skills = [item["skill"] for p in phases for item in p["items"]]
        capstone_project = _build_phase_project_data(3, role, all_skills)
        skills_preview = ", ".join(all_skills[:4])
        if len(all_skills) > 4:
            skills_preview += f" +{len(all_skills) - 4} more"
        capstone = {
            "type": "project",
            "title": capstone_project["title"],
            "description": capstone_project["description"],
            "status": "locked",
        }
        phases.append({
            "phase": 3,
            "label": "Capstone Project",
            "items": [capstone],
            "phase_project_def": capstone_project,
        })

    return phases


#  Route Helper

def _phase_project_out(phase_num: int, phase_def: dict, phase_projects: dict) -> PhaseProjectOut:
    """Build a PhaseProjectOut response object merging def + runtime state."""
    proj_state = phase_projects.get(str(phase_num), {})
    return PhaseProjectOut(
        phase=phase_num,
        title=phase_def.get("title", f"Advanced Project — Phase {phase_num}"),
        description=phase_def.get("description", ""),
        level=phase_def.get("level", "advanced"),
        required_skills=phase_def.get("required_skills", []),
        status=proj_state.get("status", "not_started"),
        github_url=proj_state.get("github_url"),
        submitted_at=proj_state.get("submitted_at"),
    )


def _build_roadmap_out(roadmap: StudentRoadmap, role: str) -> RoadmapOut:
    """Construct the full RoadmapOut response from a StudentRoadmap document."""
    phase_states = roadmap.phase_states
    phase_projects = roadmap.phase_projects

    phases_out = []
    for p in roadmap.phases:
        phase_num = p["phase"]
        phase_key = str(phase_num)
        p_status = phase_states.get(phase_key, "LOCKED")

        # Count skills (exclude project items)
        skill_items = [i for i in p.get("items", []) if i.get("type") != "project"]
        skills_total = len(skill_items)
        skills_completed = sum(1 for i in skill_items if i.get("status") == "completed")

        # Project completion
        proj_state = phase_projects.get(phase_key, {})
        project_completed = proj_state.get("status") == "completed"

        # Build phase project output
        phase_def = p.get("phase_project_def", {})
        phase_project = _phase_project_out(phase_num, phase_def, phase_projects) if phase_def else None

        items_out = []
        # Build set of watched video IDs for this iteration
        for item in p.get("items", []):
            if item.get("type") == "project":
                items_out.append(item)
                continue
            content = item.get("content", {})
            skill_watched = set(roadmap.watched_videos.get(item["skill"].lower(), []))

            def _make_vid(v: dict, watched_set: set) -> YoutubeVideo:
                return YoutubeVideo(
                    youtube_id=v.get("youtube_id", ""),
                    title=v.get("title", ""),
                    channel=v.get("channel", ""),
                    thumbnail=v.get("thumbnail", ""),
                    duration_label=v.get("duration_label", ""),
                    category=v.get("category", "core"),
                    watched=v.get("youtube_id", "") in watched_set,
                )

            core_vids = [_make_vid(v, skill_watched) for v in content.get("core", [])]
            ref_vids  = [_make_vid(v, skill_watched) for v in content.get("reference", [])]
            all_flat  = [_make_vid(v, skill_watched) for v in content.get("youtube", [])]
            if not all_flat:
                all_flat = core_vids + ref_vids

            skill_k = item["skill"].lower()
            watched_count = len(skill_watched)
            stored_pct = item.get("progress_pct", 0)
            is_completed = (
                item.get("status") == "completed"
                or stored_pct >= 100
                or watched_count >= 4
            )
            req_lvl = item.get("required_level", 4)
            curr_lvl = req_lvl if is_completed else max(item.get("current_level", 0), int(req_lvl * (stored_pct / 100.0)) if stored_pct > 0 else 0)
            calc_pct = 100 if is_completed else (min(100, max(stored_pct, watched_count * 25)))
            calc_status = "completed" if is_completed else item.get("status", "locked")
            calc_gap = 0 if is_completed else max(0, req_lvl - curr_lvl)

            items_out.append(RoadmapItem(
                skill=item["skill"],
                gap=calc_gap,
                current_level=curr_lvl,
                required_level=req_lvl,
                estimated_weeks=item["estimated_weeks"],
                status=calc_status,
                progress_pct=calc_pct,
                content=RoadmapItemContent(
                    youtube=all_flat,
                    core=core_vids,
                    reference=ref_vids,
                ),
            ))

        phases_out.append(RoadmapPhase(
            phase=phase_num,
            label=p["label"],
            items=items_out,
            phase_status=p_status,
            phase_project=phase_project,
            skills_completed=skills_completed,
            skills_total=skills_total,
            project_completed=project_completed,
        ))

    return RoadmapOut(
        role=role,
        generated_from="resume_gap_analysis",
        last_regenerated=roadmap.last_regenerated,
        progress_pct=roadmap.progress_pct,
        phases=phases_out,
        needs_setup=False,
    )


#  Endpoints 

@router.get("/me", response_model=RoadmapOut)
async def get_roadmap(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    role = (
        (prof.target_roles if prof and prof.target_roles else None)
        or roadmap.role
        or score_doc.target_role
    )
    if role and not roadmap.role:
        roadmap.role = role
        await roadmap.save()

    if not role or not roadmap.resume_uploaded:
        return RoadmapOut(
            role=role or "",
            generated_from="resume_gap_analysis",
            last_regenerated=roadmap.last_regenerated,
            progress_pct=0,
            phases=[],
            needs_setup=True,
        )

    if not roadmap.phases:
        phases = await _build_phases(role, student_id, [], roadmap.phase_projects)
        roadmap.phases = phases
        roadmap.last_regenerated = datetime.now(timezone.utc)
        # Count skills (exclude project items)
        skill_items = [item for p in phases for item in p["items"] if item.get("type") != "project"]
        roadmap.total_skills = len(skill_items)
        roadmap.completed_skills = sum(1 for i in skill_items if i["status"] == "completed")
        roadmap.progress_pct = (
            round(roadmap.completed_skills / roadmap.total_skills * 100)
            if roadmap.total_skills else 0
        )
        roadmap.next_skill = next(
            (i["skill"] for i in skill_items if i["status"] == "in_progress"), None
        )
        # Compute initial phase states
        roadmap.phase_states = _compute_phase_states(phases, roadmap.phase_projects)
        await roadmap.save()

    # Ensure phase_states is always current (handles existing docs without phase_states)
    roadmap_modified = False
    if not roadmap.phase_states:
        roadmap.phase_states = _compute_phase_states(roadmap.phases, roadmap.phase_projects)
        roadmap_modified = True

    # Ensure all completed skills in roadmap are synced to StudentSkillLevel
    if roadmap.phases:
        for phase in roadmap.phases:
            for item in phase.get("items", []):
                if item.get("type") == "project":
                    continue
                s_name = item.get("skill")
                if not s_name:
                    continue
                s_key = s_name.lower()
                watched_count = len(roadmap.watched_videos.get(s_key, []))
                is_completed = (
                    item.get("status") == "completed"
                    or item.get("progress_pct", 0) >= 100
                    or watched_count >= 4
                )
                if is_completed:
                    req_lvl = item.get("required_level", 4)
                    if item.get("current_level") != req_lvl or item.get("gap") != 0 or item.get("status") != "completed":
                        item["current_level"] = req_lvl
                        item["gap"] = 0
                        item["status"] = "completed"
                        item["progress_pct"] = 100
                        roadmap_modified = True

                    existing_skill = await StudentSkillLevel.find_one(
                        StudentSkillLevel.student_id == student_id,
                        {"skill": {"$regex": f"^{re.escape(s_name)}$", "$options": "i"}},
                    )
                    if existing_skill:
                        if existing_skill.current_level < req_lvl:
                            existing_skill.current_level = req_lvl
                            existing_skill.last_updated = datetime.now(timezone.utc)
                            await existing_skill.save()
                    else:
                        new_skill = StudentSkillLevel(
                            student_id=student_id,
                            skill=s_name,
                            current_level=req_lvl,
                            source="roadmap_completion",
                        )
                        await new_skill.insert()

    if roadmap_modified:
        await roadmap.save()

    return _build_roadmap_out(roadmap, role)


@router.get("/me/videos")
async def get_skill_videos(skill: str, current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    role = roadmap.role or score_doc.target_role or "software engineer"

    structured = await fetch_skill_videos_structured(skill, role)

    # Attach watched status per video
    watched = set(roadmap.watched_videos.get(skill.lower(), []))
    for category_list in [structured.get("core", []), structured.get("reference", [])]:
        for v in category_list:
            v["watched"] = v["youtube_id"] in watched

    # Legacy flat list
    all_videos = structured.get("core", []) + structured.get("reference", [])
    for v in all_videos:
        v["watched"] = v["youtube_id"] in watched

    return {
        "skill": skill,
        "videos": all_videos,
        "core": structured.get("core", []),
        "reference": structured.get("reference", []),
    }


@router.post("/me/skills/{skill}/watch-video")
async def mark_video_watched(
    skill: str,
    body: WatchVideoBody,
    current_user: User = Depends(get_current_user),
):
    """Mark a YouTube video as watched for a skill. Updates skill progress_pct and phase states."""
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)

    skill_key = skill.lower()
    watched = list(set(roadmap.watched_videos.get(skill_key, [])))
    if body.youtube_id not in watched:
        watched.append(body.youtube_id)
    roadmap.watched_videos[skill_key] = watched

    # Update progress_pct for this skill
    # Each watched video = 25% (4 videos = 100% = completed)
    new_pct = min(100, len(watched) * 25)
    new_status = "completed" if new_pct >= 100 else "in_progress"

    for phase in roadmap.phases:
        for item in phase.get("items", []):
            if item.get("type") == "project":
                continue
            if item.get("skill", "").lower() == skill_key:
                req_lvl = item.get("required_level") or 4
                item["progress_pct"] = new_pct
                item["status"] = new_status
                if new_status == "completed":
                    item["current_level"] = req_lvl
                    item["gap"] = 0
                else:
                    item["current_level"] = max(item.get("current_level", 0), int(req_lvl * (new_pct / 100.0)))
                    item["gap"] = max(0, req_lvl - item["current_level"])

    # If skill just reached 100% — do sequential unlock + update StudentSkillLevel
    if new_status == "completed":
        all_skills = [
            item for p in roadmap.phases
            for item in p.get("items", [])
            if item.get("type") != "project"
        ]
        for i, item in enumerate(all_skills):
            if item.get("skill", "").lower() == skill_key:
                required_lvl = item.get("required_level") or 4
                item["current_level"] = required_lvl
                item["gap"] = 0

                # Write back to StudentSkillLevel so Skill Gap page reflects completion.
                # Use case-insensitive regex — resume parsing often stores lowercase ("python")
                # while Groq benchmarks use proper case ("Python").
                skill_name = item.get("skill", skill)
                skill_level_doc = await StudentSkillLevel.find_one(
                    StudentSkillLevel.student_id == student_id,
                    {"skill": {"$regex": f"^{re.escape(skill_name)}$", "$options": "i"}},
                )
                if skill_level_doc:
                    skill_level_doc.current_level = required_lvl
                    skill_level_doc.last_updated = datetime.now(timezone.utc)
                    await skill_level_doc.save()
                    logger.info(f"Updated StudentSkillLevel for '{skill_name}' → level {required_lvl}")
                else:
                    # No existing record — create one (skill came from benchmarks, not resume)
                    new_doc = StudentSkillLevel(
                        student_id=student_id,
                        skill=skill_name,
                        current_level=required_lvl,
                        source="roadmap_completion",
                    )
                    await new_doc.insert()
                    logger.info(f"Created StudentSkillLevel for '{skill_name}' → level {required_lvl}")

                # Sequential unlock: open the next locked skill
                if i + 1 < len(all_skills) and all_skills[i + 1].get("status") == "locked":
                    all_skills[i + 1]["status"] = "in_progress"
                break

    # Recount overall progress (exclude project items)
    skill_items = [
        item for p in roadmap.phases
        for item in p.get("items", [])
        if item.get("type") != "project"
    ]
    completed = sum(1 for i in skill_items if i.get("status") == "completed")
    total = len(skill_items)
    roadmap.total_skills = total
    roadmap.completed_skills = completed
    roadmap.progress_pct = round(completed / total * 100) if total else 0
    roadmap.next_skill = next(
        (i["skill"] for i in skill_items if i.get("status") == "in_progress"), None
    )

    # Recompute phase states
    roadmap.phase_states = _compute_phase_states(roadmap.phases, roadmap.phase_projects)

    await roadmap.save()

    return {
        "skill": skill,
        "youtube_id": body.youtube_id,
        "watched_count": len(watched),
        "progress_pct": new_pct,
        "status": new_status,
        "overall_progress_pct": roadmap.progress_pct,
        "phase_states": roadmap.phase_states,
    }


@router.post("/me/phases/{phase_num}/project/start", response_model=PhaseProjectOut)
async def start_phase_project(
    phase_num: int,
    current_user: User = Depends(get_current_user),
):
    """
    Start a phase's advanced project.
    Backend validates that all skills in that phase are completed.
    Backend validates that the previous phase is COMPLETED (for phases > 1).
    """
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)

    # Ensure phase states are computed
    if not roadmap.phase_states:
        roadmap.phase_states = _compute_phase_states(roadmap.phases, roadmap.phase_projects)

    phase_key = str(phase_num)
    p_status = roadmap.phase_states.get(phase_key, "LOCKED")

    # Phase must not be LOCKED
    if p_status == "LOCKED":
        raise HTTPException(
            status_code=403,
            detail=f"Phase {phase_num} is locked. Complete Phase {phase_num - 1} first.",
        )

    # All skills must be completed before starting the project
    if p_status not in ("PROJECT_REQUIRED", "COMPLETED"):
        raise HTTPException(
            status_code=403,
            detail=f"Complete all skills in Phase {phase_num} before starting the advanced project.",
        )

    # Find phase data
    phase_data = next((p for p in roadmap.phases if p["phase"] == phase_num), None)
    if not phase_data:
        raise HTTPException(status_code=404, detail=f"Phase {phase_num} not found in roadmap.")

    # Update project state to in_progress if not already started
    proj_state = roadmap.phase_projects.get(phase_key, {})
    if proj_state.get("status") not in ("in_progress", "completed"):
        roadmap.phase_projects[phase_key] = {
            "status": "in_progress",
            "github_url": None,
            "submitted_at": None,
        }
        await roadmap.save()

    phase_def = phase_data.get("phase_project_def", {})
    proj = roadmap.phase_projects.get(phase_key, {})
    return PhaseProjectOut(
        phase=phase_num,
        title=phase_def.get("title", f"Advanced Project — Phase {phase_num}"),
        description=phase_def.get("description", ""),
        level=phase_def.get("level", "advanced"),
        required_skills=phase_def.get("required_skills", []),
        status=proj.get("status", "in_progress"),
        github_url=proj.get("github_url"),
        submitted_at=proj.get("submitted_at"),
    )


@router.post("/me/phases/{phase_num}/project/submit", response_model=RoadmapOut)
async def submit_phase_project(
    phase_num: int,
    body: SubmitProjectBody,
    current_user: User = Depends(get_current_user),
):
    """
    Submit a GitHub URL to complete a phase's advanced project.
    Backend enforces:
    1. Previous phase must be COMPLETED (for phase > 1)
    2. All skills in this phase must be completed
    3. github_url must be non-empty
    """
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    role = roadmap.role or score_doc.target_role or ""

    # Validate GitHub URL
    github_url = body.github_url.strip()
    if not github_url:
        raise HTTPException(status_code=400, detail="GitHub URL is required.")

    # Validate URL format (basic check)
    if not (github_url.startswith("https://github.com/") or github_url.startswith("http://github.com/")):
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid GitHub repository URL (e.g. https://github.com/username/repo).",
        )

    # Ensure phase states are computed
    if not roadmap.phase_states:
        roadmap.phase_states = _compute_phase_states(roadmap.phases, roadmap.phase_projects)

    phase_key = str(phase_num)
    p_status = roadmap.phase_states.get(phase_key, "LOCKED")

    # Phase must not be LOCKED
    if p_status == "LOCKED":
        raise HTTPException(
            status_code=403,
            detail=f"Phase {phase_num} is locked. Complete Phase {phase_num - 1} first.",
        )

    # All skills must be completed
    if p_status not in ("PROJECT_REQUIRED", "COMPLETED", "IN_PROGRESS"):
        raise HTTPException(
            status_code=403,
            detail=f"Complete all skills in Phase {phase_num} before submitting the project.",
        )

    # Check all skills done (defend against IN_PROGRESS edge case)
    phase_data = next((p for p in roadmap.phases if p["phase"] == phase_num), None)
    if phase_data:
        skill_items = [i for i in phase_data.get("items", []) if i.get("type") != "project"]
        all_done = all(i.get("status") == "completed" for i in skill_items)
        if skill_items and not all_done:
            raise HTTPException(
                status_code=403,
                detail=f"Complete all skills in Phase {phase_num} before submitting the project.",
            )

    # Mark project as completed
    roadmap.phase_projects[phase_key] = {
        "status": "completed",
        "github_url": github_url,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Recompute phase states — this will unlock next phase
    roadmap.phase_states = _compute_phase_states(roadmap.phases, roadmap.phase_projects)

    await roadmap.save()
    return _build_roadmap_out(roadmap, role)


@router.post("/me/regenerate", response_model=RoadmapOut)
async def regenerate_roadmap(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    role = (
        (prof.target_roles if prof and prof.target_roles else None)
        or roadmap.role
        or score_doc.target_role
    )
    if role:
        roadmap.role = role
        score_doc.target_role = role
        await roadmap.save()
        await score_doc.save()

    if not role:
        raise HTTPException(status_code=400, detail="No target role set.")
    if not roadmap.resume_uploaded:
        raise HTTPException(status_code=400, detail="Please upload your resume first.")

    # Auto-clean garbage skills
    all_skill_docs = await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id
    ).to_list()
    for s in all_skill_docs:
        if len(s.skill.strip()) <= 2:
            await s.delete()

    # Preserve existing phase_projects across regeneration!
    phases = await _build_phases(role, student_id, roadmap.phases, roadmap.phase_projects)
    roadmap.phases = phases
    roadmap.last_regenerated = datetime.now(timezone.utc)

    skill_items = [item for p in phases for item in p["items"] if item.get("type") != "project"]
    roadmap.total_skills = len(skill_items)
    roadmap.completed_skills = sum(1 for i in skill_items if i.get("status") == "completed")
    roadmap.progress_pct = (
        round(roadmap.completed_skills / roadmap.total_skills * 100)
        if roadmap.total_skills else 0
    )
    roadmap.next_skill = next(
        (i["skill"] for i in skill_items if i.get("status") == "in_progress"), None
    )

    # Recompute phase states (preserving project completion)
    roadmap.phase_states = _compute_phase_states(phases, roadmap.phase_projects)

    await roadmap.save()
    return _build_roadmap_out(roadmap, role)