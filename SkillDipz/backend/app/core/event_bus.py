import json
import asyncio
import logging
from typing import Callable, Dict, List, Any
from app.core.database import redis_client

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
        await redis_client.xadd(
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


def register_target_company_handlers():
    event_bus.subscribe("score.updated", _handle_score_updated)
    event_bus.subscribe("profile.updated", _handle_profile_updated)
    event_bus.subscribe("company.registered", _handle_company_registered)
    event_bus.subscribe("company.gap_detected", _handle_company_gap_detected)
    event_bus.subscribe("company.now_eligible", _handle_company_now_eligible)
    event_bus.subscribe("company.new_match", _handle_company_new_match)