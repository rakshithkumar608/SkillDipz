from beanie import Document
from pydantic import Field
from typing import Literal
from datetime import datetime, timezone


class ActivityLog(Document):
    student_id: str
    type: Literal[
        "submission", "assessment", "shortlist",
        "module", "interview", "project"
    ]
    title: str
    detail: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "activity_logs"