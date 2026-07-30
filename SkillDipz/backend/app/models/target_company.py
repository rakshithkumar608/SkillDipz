from sys import flags
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class EligibalityStatus(str, Enum):
    ELIGIBLE = "eligible"
    NOT_YET = "not_yet"
    SKILL_GAP = "skill_gap"
    FULL_MATCH = "full_match"


class InterviewRound(BaseModel):
    order: int
    name: str
    description: Optional[str] = None
    duration_mins: Optional[int] = None


class CompanyProfile(Document):
    comapny_id: str
    name: str
    logo_emoji: Optional[str] = None
    logo_url: Optional[str] = None
    industry: str
    website: Optional[str] = None
    description: Optional[str] = None
    headquaters: Optional[str] = None

    # Matching criteria (set when company posts a job)
    required_roles: List[str] = []
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    min_score: float = 0.0

    # Interview Process
    interview_rounds: List[InterviewRound] = []
    interview_tips: Optional[str] = None

    # Platform state
    is_verified: bool = False
    active_openings_count: int = 0

    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "company_profiles"

class StudentTargetCompany(Document):
    student_id: str
    company_id: str
    
    # Selection metadata
    selected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    selected_by: str = "student"


    # Match result (recomputed on trigger)
    match_score: float = 0.0
    skill_match_pct: float = 0.0
    score_readiness_pct: float = 0.0
    eligibality_status: EligibalityStatus = EligibalityStatus.NOT_YET

    matched_skills: List[str] = []
    missing_skills: List[str] = []
    match_rank: int = 0


    last_recomputed_at: Optional[datetime] = None
    notification_sent: bool = False

    class Settings:
        name = "student_target_companies"