from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class ScoreHistory(BaseModel):
    score: float
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScoreComponents(BaseModel):
    resume_quality: float = 0.0
    skill_tests: float = 0.0
    practice: float = 0.0
    learning_roadmap: float = 0.0
    project_strength: float = 0.0
    activity_consistency: float = 0.0
    # Backward compatibility aliases
    assessment_score: Optional[float] = 0.0
    interview_readiness: Optional[float] = 0.0

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
        # Resolve skill_tests from assessment_score if skill_tests is 0 but assessment_score is set
        st = c.skill_tests if c.skill_tests > 0 else (c.assessment_score or 0.0)
        return round(
            c.resume_quality * 0.15 +
            st * 0.35 +
            c.learning_roadmap * 0.20 +
            c.project_strength * 0.15 +
            c.activity_consistency * 0.15,
            1
        )