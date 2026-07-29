
from beanie import Document
from pydantic import Field
from typing import Optional, List, Any
from datetime import datetime, timezone


class StudentRoadmap(Document):
    student_id: str
    role: Optional[str] = None
    progress_pct: int = 0
    total_skills: int = 0
    completed_skills: int = 0
    next_skill: Optional[str] = None
    last_regenerated: Optional[datetime] = None
    resume_uploaded: bool = False
    resume_file_path: Optional[str] = None
    phases: List[Any] = Field(default_factory=list)
    # Maps skill name (lowercase) → list of watched youtube_ids
    watched_videos: dict = Field(default_factory=dict)

    class Settings:
        name = "student_roadmaps"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "StudentRoadmap":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc
