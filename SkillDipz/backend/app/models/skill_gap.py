from beanie import Document
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

class StudentSkillLevel(Document):
    student_id: str
    skill: str
    current_level: int = 0
    source: str = "resume"
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "student_skill_levels"
        indexes = [
            [("student_id", 1), ("skill", 1)],
        ]

class RoleSkillBenchmark(Document):
    role: str
    skill: str
    required_level: int = 3
    priority: int = 1

    class Settings:
        name = "role_skill_benchmarks"
        indexes = [
            [("role", 1), ("skill", 1)],
        ]