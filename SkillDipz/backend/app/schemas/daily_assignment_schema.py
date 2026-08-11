from pydantic import BaseModel
from typing import Any, Dict, List, Literal, Optional


class TaskOut(BaseModel):
    task_id: str
    type: str                              # quiz | code | video | flashcard | explain | resume_tweak | wildcard
    subtype: Optional[str] = None          # used when type == "wildcard"
    title: str
    status: Literal["pending", "completed", "skipped"]
    points: int
    completed_at: Optional[str] = None
    skill_tag: Optional[str] = None

    # quiz
    topic_id: Optional[str] = None

    # code
    cf_url: Optional[str] = None
    cf_rating: Optional[int] = None

    # video
    youtube_id: Optional[str] = None
    channel: Optional[str] = None
    duration_label: Optional[str] = None

    # flashcard
    flashcards: Optional[List[Dict[str, str]]] = None

    # explain
    explain_prompt: Optional[str] = None

    # resume_tweak
    resume_skill: Optional[str] = None
    tweak_instruction: Optional[str] = None


class SponsoredTaskOut(BaseModel):
    company: str
    type: str
    title: str
    points: int
    content_ref: Optional[str] = None


class DailyAssignmentOut(BaseModel):
    date: str
    difficulty: Literal["EASY", "MEDIUM", "BOSS"]
    completed: int
    total: int
    tasks: List[TaskOut]
    sponsored_task: Optional[SponsoredTaskOut] = None
    streak: int
    streak_tier: str
    streak_bonus: Optional[str] = None
    completed_today_platform_wide: int = 0


class SponsoredChallengeIn(BaseModel):
    """Payload when a company POSTs a sponsored challenge."""
    title: str
    type: Literal["quiz", "code", "video", "explain"]
    content_ref: Optional[str] = None        # CF problem URL or YouTube video ID
    target_role: Optional[str] = None
    points: int = 20
    scheduled_date: Optional[str] = None     # "YYYY-MM-DD"; None = next available


class PlatformStatsOut(BaseModel):
    completed_today: int
    total_active_students: int
