import logging
import re
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.routes.auth import get_current_user
from app.core.youtube import fetch_youtube_videos
from app.models.employability_score import EmployabilityScore
from app.models.roadmap import StudentRoadmap
from app.models.skill_gap import RoleSkillBenchmark, StudentSkillLevel
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


class YoutubeVideo(BaseModel):
    youtube_id: str
    title: str
    channel: str
    thumbnail: str
    duration_label: str = ""

class RoadmapItemContent(BaseModel):
    youtube: List[YoutubeVideo] = []


class RoadmapItem(BaseModel):
    skill: str
    gap: int
    current_level: int
    required_level: int
    estimated_weeks: int
    status: str
    progress_pct: int
    content: RoadmapItemContent


# Phase 3 capstone items have a different shape — type="project"
class CapstoneItem(BaseModel):
    type: str = "project"
    title: str
    description: str
    status: str   # always "locked" until phases 1+2 complete


# RoadmapPhase items are either RoadmapItem (skills) or CapstoneItem (project)
# We use Any for the items list and discriminate on the frontend by checking item.type
class RoadmapPhase(BaseModel):
    phase: int
    label: str
    items: List[Any]


class RoadmapOut(BaseModel):
    role: str
    generated_from: str
    last_regenerated: Optional[datetime]
    progress_pct: int
    phases: List[RoadmapPhase]
    needs_setup: bool



def _estimate_weeks(gap: int) -> int:
    return max(1, gap)
    
async def _build_phases(role: str, student_id: str, existing_phases: list) -> list[dict]:
    student_skills = await StudentSkillLevel.find(
        StudentSkillLevel.student_id == student_id
    ).to_list()
    skill_map = {s.skill.lower(): s.current_level for s in student_skills}
    benchmarks = await RoleSkillBenchmark.find(
        {"role": {"$regex": f"^{re.escape(role)}$", "$options": "i"}}
    ).sort(RoleSkillBenchmark.priority).to_list()

    if not benchmarks:
        return []

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

    existing_status: dict[str, dict] = {}
    for phase in existing_phases:
        for item in phase.get("items", []):
            if item.get("type") == "project":
                continue  # skip capstone — it's always rebuilt
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
            "content": {"youtube": []},
        }

        if sd["gap"] >= 3:
            phase1_items.append(item)
        else:
            phase2_items.append(item)

    # Pre-fetch YouTube videos for the first skill in each skill phase
    for items_list in [phase1_items, phase2_items]:
        if items_list:
            videos = await fetch_youtube_videos(items_list[0]["skill"], role)
            items_list[0]["content"]["youtube"] = videos
    phases = []

    if phase1_items:
        phases.append({"phase": 1, "label": "Priority Skills (Largest Gaps)", "items": phase1_items})
    if phase2_items:
        phases.append({"phase": 2, "label": "Strengthen Skills", "items": phase2_items})

    # Phase 3 — Capstone Project (always appended if there are skill phases)
    if phases:
        # Determine all skill names from both phases for the description
        all_skills = [item["skill"] for p in phases for item in p["items"]]
        skills_preview = ", ".join(all_skills[:4])
        if len(all_skills) > 4:
            skills_preview += f" +{len(all_skills) - 4} more"
        capstone = {
            "type": "project",
            "title": f"Capstone Project — {role.capitalize()} Application",
            "description": (
                f"Build a complete {role} application using all skills acquired: {skills_preview}. "
                "Integrates everything learned across Phase 1 and Phase 2 into a deployable project."
            ),
            "status": "locked",  # Unlocks only after phases 1+2 are completed
        }
        phases.append({"phase": 3, "label": "Capstone Project", "items": [capstone]})
    return phases


@router.get("/me", response_model=RoadmapOut)
async def get_roadmap(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    role = roadmap.role or score_doc.target_role
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
        phases = await _build_phases(role, student_id, [])
        roadmap.phases = phases
        roadmap.last_regenerated = datetime.now(timezone.utc)
        # Exclude capstone from skill counts
        skill_items = [item for p in phases for item in p["items"] if item.get("type") != "project"]
        roadmap.total_skills = len(skill_items)
        roadmap.completed_skills = sum(1 for i in skill_items if i["status"] == "completed")
        roadmap.progress_pct = (
            round(roadmap.completed_skills / roadmap.total_skills * 100)
            if roadmap.total_skills else 0
        )
        roadmap.next_skill = next(
            (i["skill"] for i in skill_items if i["status"] == "in_progress"),
            None,
        )
        await roadmap.save()

    phases_out = []
    for p in roadmap.phases:
        items_out = []
        for item in p.get("items", []):
            # Phase 3 capstone items have type="project" — pass through as-is
            if item.get("type") == "project":
                items_out.append(item)  # raw dict — frontend discriminates on item.type
                continue
            content = item.get("content", {})
            yt_list = [YoutubeVideo(**v) for v in content.get("youtube", [])]
            items_out.append(RoadmapItem(
                skill=item["skill"],
                gap=item["gap"],
                current_level=item["current_level"],
                required_level=item["required_level"],
                estimated_weeks=item["estimated_weeks"],
                status=item["status"],
                progress_pct=item.get("progress_pct", 0),
                content=RoadmapItemContent(youtube=yt_list),
            ))
        phases_out.append(RoadmapPhase(phase=p["phase"], label=p["label"], items=items_out))
    return RoadmapOut(
        role=role,
        generated_from="resume_gap_analysis",
        last_regenerated=roadmap.last_regenerated,
        progress_pct=roadmap.progress_pct,
        phases=phases_out,
        needs_setup=False,
    )



@router.get("/me/videos")
async def get_skill_videos(skill: str, current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    role = roadmap.role or score_doc.target_role or "software engineer"
    videos = await fetch_youtube_videos(skill, role)
    return {"skill": skill, "videos": videos}

    
@router.post("/me/regenerate", response_model=RoadmapOut)
async def regenerate_roadmap(current_user: User = Depends(get_current_user)):
    student_id = str(current_user.id)
    roadmap = await StudentRoadmap.get_or_create(student_id)
    score_doc = await EmployabilityScore.get_or_create(student_id)
    role = roadmap.role or score_doc.target_role
    if not role:
        raise HTTPException(status_code=400, detail="No target role set.")
    if not roadmap.resume_uploaded:
        raise HTTPException(status_code=400, detail="Please upload your resume first.")
    phases = await _build_phases(role, student_id, roadmap.phases)
    roadmap.phases = phases
    roadmap.last_regenerated = datetime.now(timezone.utc)
    roadmap.total_skills = sum(len(p["items"]) for p in phases)
    roadmap.completed_skills = sum(
        1 for p in phases for item in p["items"] if item["status"] == "completed"
    )
    roadmap.progress_pct = (
        round(roadmap.completed_skills / roadmap.total_skills * 100)
        if roadmap.total_skills else 0
    )
    roadmap.next_skill = next(
        (item["skill"] for p in phases for item in p["items"] if item["status"] == "in_progress"),
        None,
    )
    await roadmap.save()
    return await get_roadmap(current_user)