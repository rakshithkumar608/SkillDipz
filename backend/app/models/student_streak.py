from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import date, datetime, timezone


class StudentStreak(Document):
    student_id: str
    current_streak: int = 0
    longest_streak: int = 0
    last_active: Optional[date] = None

    class Settings:
        name = "student_streaks"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "StudentStreak":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc 