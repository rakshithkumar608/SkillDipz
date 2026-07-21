from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class ScoreHistory(BaseModel):
    score: float
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScoreComponents(BaseModel):
    resume_quality: float = 0.0
    assessment_score: float = 0.0
    project_strength: float =  0.0
    interview_readiness: float = 0.0
    activity_consistency: float = 0.0

class EmployabilityScore(Document):
    student_id: str
    overall_score: float = 0.0
    components: ScoreComponents = Field(default_factory=ScoreComponents)
    target_role: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    history: List[ScoreHistory] = []       # last 7 readings for sparkline

    class Settings:
        name = "employability_scores"

    @classmethod
    async def get_or_create(cls, student_id: str) -> "EmployabilityScore":
        doc = await cls.find_one(cls.student_id == student_id)
        if not doc:
            doc = cls(student_id=student_id)
            await doc.insert()
        return doc

    def compute_overall(self) -> float:
        c = self.components
        return round(
            c.resume_quality * 0.20 +
            c.assessment_score * 0.30 +
            c.project_strength * 0.15 +
            c.interview_readiness * 0.20 +
            c.activity_consistency * 0.15,
            2
        )