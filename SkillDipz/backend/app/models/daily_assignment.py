import uuid
from beanie import Document
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from datetime import date, datetime, timezone


class AssignmentTask(BaseModel):
    task_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    type: Literal["quiz", "code", "video", "flashcard", "explain", "resume_tweak", "wildcard"]
    subtype: Optional[str] = None          # for wildcard — stores the actual type it resolved to

    title: str
    status: Literal["pending", "completed", "skipped"] = "pending"
    points: int
    completed_at: Optional[datetime] = None

    # skill context
    skill_tag: Optional[str] = None

    # quiz-specific
    topic_id: Optional[str] = None

    # code-specific
    cf_contest_id: Optional[int] = None
    cf_index: Optional[str] = None
    cf_url: Optional[str] = None
    cf_rating: Optional[int] = None

    # video-specific
    youtube_id: Optional[str] = None
    channel: Optional[str] = None
    duration_label: Optional[str] = None

    # flashcard-specific (list of {front, back} pairs)
    flashcards: Optional[List[Dict[str, str]]] = None

    # explain-specific
    explain_prompt: Optional[str] = None

    # resume_tweak-specific
    resume_skill: Optional[str] = None
    tweak_instruction: Optional[str] = None


class SponsoredTask(BaseModel):
    company_id: str
    company_name: str
    type: Literal["quiz", "code", "video", "explain"]
    title: str
    content_ref: Optional[str] = None     # e.g. CF problem URL or YouTube ID
    target_role: Optional[str] = None
    points: int = 20


class DailyAssignment(Document):
    student_id: str
    date: str                              # ISO date string "YYYY-MM-DD"

    difficulty: Literal["EASY", "MEDIUM", "BOSS"] = "MEDIUM"

    tasks: List[AssignmentTask] = []
    sponsored_task: Optional[SponsoredTask] = None

    # Streak info snapshotted at generation time
    streak: int = 0
    streak_tier: str = "standard"          # "standard" | "unlocked_boss" | "company_tasks" | "elite"
    streak_bonus: Optional[str] = None

    # Completion tracking
    completion_rate_7d: float = 0.0        # avg completion rate over last 7 days (0.0–1.0)

    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "daily_assignments"
        indexes = [
            [("student_id", 1), ("date", 1)],
        ]

    @classmethod
    async def get_for_student(cls, student_id: str, date_str: str) -> Optional["DailyAssignment"]:
        return await cls.find_one(
            cls.student_id == student_id,
            cls.date == date_str,
        )


class CompanySponsoredChallenge(Document):
    """Companies POST here; daily generator pulls from this pool for tomorrow's slot."""
    company_id: str
    company_name: str
    type: Literal["quiz", "code", "video", "explain"]
    title: str
    content_ref: Optional[str] = None
    target_role: Optional[str] = None
    points: int = 20
    is_active: bool = True
    scheduled_date: Optional[str] = None  # "YYYY-MM-DD" — if None, first available slot
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "company_sponsored_challenges"
        indexes = [
            [("is_active", 1), ("scheduled_date", 1)],
        ]