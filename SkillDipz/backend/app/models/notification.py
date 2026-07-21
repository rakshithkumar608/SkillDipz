from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class Notification(Document):
    student_id: str
    title: str
    body: str
    action_url: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"