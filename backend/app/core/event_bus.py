import json
import asyncio
import logging
import asyncio
import httpx
from beanie import PydanticObjectId
from datetime import datetime, timezone
from typing import Callable, Dict, List, Any


from app.models.employability_score import EmployabilityScore, ScoreHistory
from app.models.project import CompanyProject
from app.models.project import StudentProjectSubmission
from app.models.student_profile import StudentProfile

from app.services.notification_service import send_notification
from app.services.notification_service import send_notification

from app.core.ws_manager import ws_manager
from app.core.redis_client import get_redis



logger = logging.getLogger(__name__)


class EventBus:
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers.setdefault(event_type, []).append(handler)
        logger.info(f"EventBus: subscribed {handler.__name__} to {event_type}")

    async def publish(self, event_type: str, payload: Dict[str, Any]):
        """Publish event to Redis Stream and dispatch to local handlers."""
        stream_key = f"stream:{event_type}"
        rc = get_redis()
        if rc:
            await rc.xadd(
                stream_key,
                {"payload": json.dumps(payload, default=str)},
                maxlen=1000,
            )
        logger.info(f"EventBus: published {event_type}")

        for handler in self._handlers.get(event_type, []):
            asyncio.create_task(handler(payload))


event_bus = EventBus()


#  Register Target Company Event Handlers 

async def _handle_score_updated(payload: Dict[str, Any]):
    from app.services import recruiting_service
    student_id = payload.get("student_id")
    if student_id:
        await recruiting_service.on_score_or_profile_updated(student_id, event_bus)


async def _handle_profile_updated(payload: Dict[str, Any]):
    from app.services import recruiting_service
    student_id = payload.get("student_id")
    if student_id:
        await recruiting_service.on_score_or_profile_updated(student_id, event_bus)


async def _handle_company_registered(payload: Dict[str, Any]):
    from app.services import recruiting_service
    company_id = payload.get("company_id")
    if company_id:
        await recruiting_service.on_company_registered(company_id, event_bus)


async def _handle_company_gap_detected(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"Skill gap detected for {payload['company_name']}",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_gap",
    )


async def _handle_company_now_eligible(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"You're now eligible for {payload['company_name']}!",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_eligible",
    )


async def _handle_company_new_match(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"New company match: {payload['company_name']}",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_new_match",
    )


async def _handle_job_posted(payload: Dict[str, Any]):
    """When a company posts a job, notify students across the platform."""
    from app.models.student_profile import StudentProfile
    from app.models.employability_score import EmployabilityScore
    from app.models.user import User

    job_title = payload.get("title", "New Job Opening")
    company_name = payload.get("company_name", "A Hiring Partner")
    min_score = payload.get("min_score", 0.0)
    role_id = payload.get("role_id", "Engineering")

    # 1. Real-time Live WebSocket broadcast to all connected users
    await ws_manager.broadcast_all(
        "job_posted",
        {
            "job_title": job_title,
            "company_name": company_name,
            "role_id": role_id,
            "min_score": min_score,
            "action_url": "/student/jobs",
        },
    )

    # 2. Persist real-time notifications for all student accounts
    student_users = await User.find(User.role == "STUDENT").to_list()
    student_ids = [str(u.id) for u in student_users]

    profiles = await StudentProfile.find({"student_id": {"$in": student_ids}}).to_list() if student_ids else []
    profile_map = {p.student_id: p for p in profiles}

    scores = await EmployabilityScore.find({"student_id": {"$in": student_ids}}).to_list() if student_ids else []
    score_map = {s.student_id: s for s in scores}

    for sid in student_ids:
        score_doc = score_map.get(sid)
        student_score = score_doc.overall_score if score_doc else 0.0

        if min_score > 0 and student_score >= min_score:
            notif_title = f"New Job Opening: {job_title} at {company_name}"
            notif_body = f"{company_name} just posted a new vacancy for \"{job_title}\" ({role_id}). You meet the eligibility threshold ({student_score:.1f}% >= {min_score}%). Apply now!"
        elif min_score > 0:
            notif_title = f"New Job Opening: {job_title} at {company_name}"
            notif_body = f"{company_name} just posted a new vacancy for \"{job_title}\" ({role_id}). Check prerequisites and apply."
        else:
            notif_title = f"New Job Opening: {job_title} at {company_name}"
            notif_body = f"{company_name} is actively hiring for \"{job_title}\" ({role_id}). Review the posting and apply now!"

        await send_notification(
            student_id=sid,
            title=notif_title,
            body=notif_body,
            action_url="/student/jobs",
            notification_type="job_posted",
        )


async def _handle_job_applied(payload: Dict[str, Any]):
    """Log when a student applies to a job (company notifications TBD)."""
    logger.info(
        f"Student {payload.get('student_name')} (Score: {payload.get('student_score')}, "
        f"Match: {payload.get('profile_match_pct')}%) applied for "
        f"{payload.get('job_title')} at {payload.get('company_name')}"
    )


async def _handle_project_posted(payload: dict) -> None:
    target_roles = payload.get("target_roles", [])
    company_name = payload.get("company_name", "A company")
    project_title = payload.get("title", "New Project")
    
    all_profiles = await StudentProfile.find_all().to_list()
    for profile in all_profiles:
        student_role = (profile.target_roles or "").lower()
        if target_roles and student_role:
            if not any(student_role in r.lower() for r in target_roles):
                continue
        await send_notification(
            student_id=profile.student_id,
            title=f"New Project Brief from {company_name}",
            body=f"{company_name} uploaded: \"{project_title}\". View project brief!",
            action_url="/student/projects",
            notification_type="general",
        )
        
async def _handle_project_submitted(payload: dict) -> None:
    asyncio.create_task(_run_nlp_evaluation(payload))
    
async def _run_nlp_evaluation(payload: dict) -> None:

    submission_id = payload.get("submission_id")
    github_url = payload.get("github_url", "")
    required_skills = payload.get("required_skills", [])

    if not submission_id or not github_url:
        return

    try:
        parts = github_url.rstrip("/").replace("https://github.com/", "").split("/")
        if len(parts) < 2:
            raise ValueError("Invalid GitHub URL format")
        owner, repo = parts[0], parts[1]

        verified_skills = []
        quality_signals = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch repository README
            readme_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={"Accept": "application/vnd.github.raw"},
            )
            readme_text = readme_res.text.lower() if readme_res.status_code == 200 else ""

            # Fetch file tree
            tree_res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=0",
            )
            file_names = ""
            if tree_res.status_code == 200:
                tree = tree_res.json()
                file_names = " ".join(item["path"].lower() for item in tree.get("tree", []))

        combined_evidence = readme_text + " " + file_names

        for skill in required_skills:
            if skill.lower() in combined_evidence:
                verified_skills.append(skill)

        if len(readme_text) > 250:
            quality_signals.append("Comprehensive README")
        if "docker" in combined_evidence or "dockerfile" in file_names:
            quality_signals.append("Docker Configuration")
        if ".github" in file_names or "ci" in file_names:
            quality_signals.append("CI/CD Pipeline")
        if "test" in file_names or "spec" in file_names:
            quality_signals.append("Automated Test Suite")

        skill_match = len(verified_skills) / len(required_skills) if required_skills else 0.5
        quality_bonus = min(0.2, len(quality_signals) * 0.05)
        evidence_score = round(min(1.0, skill_match * 0.8 + quality_bonus), 2)

        sub = await StudentProjectSubmission.get(PydanticObjectId(submission_id))
        if sub:
            sub.nlp_score = evidence_score
            sub.verified_skills = verified_skills
            sub.quality_signals = quality_signals
            sub.evaluation_status = "evaluated"
            sub.evaluated_at = datetime.now(timezone.utc)
            await sub.save()

            await event_bus.publish("project.evaluated", {
                "submission_id": submission_id,
                "student_id": sub.student_id,
                "project_id": sub.project_id,
                "nlp_score": evidence_score,
                "verified_skills": verified_skills,
                "quality_signals": quality_signals,
            })

    except Exception as e:
        logger.error(f"NLP Evaluation failed for {submission_id}: {e}")
        sub = await StudentProjectSubmission.get(PydanticObjectId(submission_id))
        if sub:
            sub.evaluation_status = "failed"
            await sub.save()
            
            
async def _handle_project_evaluated(payload: dict) -> None:


    student_id = payload.get("student_id")
    nlp_score = payload.get("nlp_score", 0.0)
    project_id = payload.get("project_id", "")
    verified_skills = payload.get("verified_skills", [])

    if not student_id:
        return

    # Update Employability Score
    score_doc = await EmployabilityScore.get_or_create(student_id)
    new_strength = min(100.0, max(score_doc.components.project_strength, nlp_score * 100))
    score_doc.components.project_strength = new_strength
    new_overall = score_doc.compute_overall()
    score_doc.overall_score = new_overall
    score_doc.last_updated = datetime.now(timezone.utc)
    score_doc.history.append(ScoreHistory(score=new_overall))
    score_doc.history = score_doc.history[-7:]
    await score_doc.save()

    # Broadcast WebSocket update for real-time gauge animation
    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": score_doc.components.model_dump(),
            "last_updated": score_doc.last_updated.isoformat(),
        },
    )

    pct = int(nlp_score * 100)
    await send_notification(
        student_id=student_id,
        title=f"Your project scored {pct}%!",
        body=f"NLP Verified Skills: {', '.join(verified_skills[:3])}. Employability score updated!",
        action_url="/student/projects",
        notification_type="score_update",
    )

    # Notify Company
    try:
        project = await CompanyProject.get(PydanticObjectId(project_id))
        if project:
            from app.models.student_profile import StudentProfile
            profile = await StudentProfile.find_one(StudentProfile.student_id == student_id)
            student_name = profile.name if profile else "A student"
            await send_notification(
                student_id=project.company_id,
                title="New Project Submission Received",
                body=f"{student_name} submitted '{project.title}' (Score: {pct}%).",
                action_url=f"/company/projects/{project_id}/submissions",
                notification_type="general",
            )
    except Exception as e:
        logger.warning(f"Company notification error: {e}")

async def _handle_interview_completed(payload: Dict[str, Any]) -> None:
    student_id = payload.get("student_id")
    overall_score = payload.get("overall_score")
    feedback = payload.get("feedback", "")
    mode = payload.get("mode", "ai")
    company_name = payload.get("company_name", "SkillDipz AI")

    if not student_id or overall_score is None:
        return

    score_doc = await EmployabilityScore.get_or_create(student_id)
    new_readiness = min(100.0, max(score_doc.components.interview_readiness, float(overall_score)))
    score_doc.components.interview_readiness = new_readiness
    new_overall = score_doc.compute_overall()
    score_doc.overall_score = new_overall
    score_doc.last_updated = datetime.now(timezone.utc)
    score_doc.history.append(ScoreHistory(score=new_overall))
    score_doc.history = score_doc.history[-7:]
    await score_doc.save()

    await ws_manager.broadcast(
        student_id,
        "score_update",
        {
            "overall_score": new_overall,
            "components": score_doc.components.model_dump(),
            "last_updated": score_doc.last_updated.isoformat(),
        },
    )

    score_display = f"{overall_score:.0f}" if overall_score else "N/A"
    mode_label = "AI Practice" if mode == "ai" else "Company"

    try:
        from app.models.activity_log import ActivityLog
        await ActivityLog(
            student_id=student_id,
            type="interview",
            title=f"Completed {mode_label} Mock Interview",
            detail=f"{company_name} · Score: {score_display}/100",
        ).insert()
    except Exception as e:
        logger.warning(f"Could not log interview activity: {e}")

    await send_notification(
        student_id=student_id,
        title=f"Mock Interview Result: {score_display}/100",
        body=f"Your {mode_label} interview with {company_name} scored {score_display}/100. {feedback[:120]}",
        action_url="/student/mock-interview",
        notification_type="interview_result",
    )

async def _handle_interview_terminated(payload: Dict[str, Any]) -> None:
    logger.warning(
        f"Interview {payload.get('session_id')} terminated for student "
        f"{payload.get('student_id')}: {payload.get('reason')}"
    )


async def _handle_student_project_created(payload: Dict[str, Any]) -> None:
    """When a student creates a personal project group, notify all online users
    via WebSocket and persist a notification for offline users."""
    creator_id = payload.get("creator_id", "")
    creator_name = payload.get("creator_name", "A student")
    project_title = payload.get("title", "a new project")
    project_id = payload.get("project_id", "")

    # 1. Live push to every connected user (excluding the creator themselves)
    await ws_manager.broadcast_all(
        "new_project_group",
        {
            "creator_name": creator_name,
            "title": project_title,
            "project_id": project_id,
        },
        exclude_user_id=creator_id,
    )

    # 2. Persist notification for offline users (visible in the bell on next login)
    all_profiles = await StudentProfile.find_all().to_list()
    for profile in all_profiles:
        if profile.student_id == creator_id:
            continue
        await send_notification(
            student_id=profile.student_id,
            title=f"{creator_name} created a project group",
            body=f'"{project_title}" is looking for collaborators. Join now!',
            action_url="/student/projects",
            notification_type="general",
        )


async def _handle_student_project_joined(payload: Dict[str, Any]) -> None:
    """When a student joins a project group, notify existing members."""
    joiner_name = payload.get("joiner_name", "Someone")
    project_title = payload.get("title", "your project")
    project_id = payload.get("project_id", "")
    member_ids: list = payload.get("existing_member_ids", [])

    for member_id in member_ids:
        # Live push if they're online
        await ws_manager.broadcast(
            member_id,
            "member_joined_project",
            {
                "joiner_name": joiner_name,
                "title": project_title,
                "project_id": project_id,
            },
        )
        # Persist for offline
        await send_notification(
            student_id=member_id,
            title=f"{joiner_name} joined your project",
            body=f"{joiner_name} joined \"{project_title}\". You now have a new teammate!",
            action_url="/student/projects",
            notification_type="general",
        )

def register_target_company_handlers():
    event_bus.subscribe("score.updated", _handle_score_updated)
    event_bus.subscribe("profile.updated", _handle_profile_updated)
    event_bus.subscribe("company.registered", _handle_company_registered)
    event_bus.subscribe("company.gap_detected", _handle_company_gap_detected)
    event_bus.subscribe("company.now_eligible", _handle_company_now_eligible)
    event_bus.subscribe("company.new_match", _handle_company_new_match)
    event_bus.subscribe("job.posted", _handle_job_posted)
    event_bus.subscribe("job.applied", _handle_job_applied)
    event_bus.subscribe("project.posted", _handle_project_posted)
    event_bus.subscribe("project.submitted", _handle_project_submitted)
    event_bus.subscribe("project.evaluated", _handle_project_evaluated)
    event_bus.subscribe("interview.completed", _handle_interview_completed)
    event_bus.subscribe("interview.terminated", _handle_interview_terminated)
    # Student personal project group notifications
    event_bus.subscribe("student_project.created", _handle_student_project_created)
    event_bus.subscribe("student_project.joined", _handle_student_project_joined)