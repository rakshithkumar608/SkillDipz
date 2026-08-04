import json
import asyncio
import logging
from typing import Callable, Dict, List, Any
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
    """When a company posts a job, notify matching students."""
    from app.models.student_profile import StudentProfile
    from app.models.employability_score import EmployabilityScore

    job_title = payload.get("title", "New Job")
    company_name = payload.get("company_name", "A company")
    min_score = payload.get("min_score", 0)
    role_id = payload.get("role_id", "")

    # Find students whose role matches and score meets minimum
    all_students = await StudentProfile.find_all().to_list()
    for student in all_students:
        student_role = getattr(student, "target_roles", "") or ""
        if role_id and student_role and student_role.lower() != role_id.lower():
            continue

        score_doc = await EmployabilityScore.find_one(
            EmployabilityScore.student_id == student.student_id
        )
        student_score = score_doc.overall_score if score_doc else 0.0

        if student_score >= min_score:
            from app.services.notification_service import send_notification
            await send_notification(
                student_id=student.student_id,
                title=f"New job at {company_name}",
                body=f"New job opening at {company_name} — {job_title}! You meet the score requirement.",
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


def register_target_company_handlers():
    event_bus.subscribe("score.updated", _handle_score_updated)
    event_bus.subscribe("profile.updated", _handle_profile_updated)
    event_bus.subscribe("company.registered", _handle_company_registered)
    event_bus.subscribe("company.gap_detected", _handle_company_gap_detected)
    event_bus.subscribe("company.now_eligible", _handle_company_now_eligible)
    event_bus.subscribe("company.new_match", _handle_company_new_match)
    event_bus.subscribe("job.posted", _handle_job_posted)
    event_bus.subscribe("job.applied", _handle_job_applied)