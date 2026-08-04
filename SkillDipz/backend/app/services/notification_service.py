import logging
from datetime import datetime, timezone
from app.models.notification import Notification
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)


async def send_notification(
    student_id: str,
    title: str,
    body: str,
    action_url: str = "",
    notification_type: str = "general",
) -> None:
    """
    Persist a notification to MongoDB and push it via WebSocket.
    """
    try:
        notif = Notification(
            student_id=student_id,
            title=title,
            body=body,
            action_url=action_url,
            is_read=False,
        )
        await notif.insert()

        # Push via WebSocket if student is connected
        await ws_manager.broadcast(
            student_id=student_id,
            event_type="notification",
            payload={
                "id": str(notif.id),
                "title": title,
                "body": body,
                "action_url": action_url,
                "type": notification_type,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info(f"Notification sent to {student_id}: {title}")
    except Exception as e:
        logger.error(f"Failed to send notification to {student_id}: {e}")
