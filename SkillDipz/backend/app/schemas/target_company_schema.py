from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.target_company import EligibilityStatus, InterviewRound

class SelecteCompanyRequest(BaseModel):
    company_id: str = Field(..., description="Slug ID of the company e.g. 'razorpay")

class UnselecteCompanyRequest(BaseModel):
    company_id: str

class InterviewRoundOut(BaseModel):
    order: int
    name: str
    description: Optional[str] = None
    duration_mins: Optional[int] = None

class MatchedCompanyOut(BaseModel):
    company_id: str
    name: str
    logo_emoji: Optional[str] = None
    logo_url: Optional[str] = None
    industry: str
    website: Optional[str] = None
    headquarters: Optional[str] = None
    min_score: float
    your_score: float
    eligible: bool
    eligibility_status: EligibilityStatus
    skill_match_pct: float
    score_readiness_pct: float
    match_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    interview_rounds: List[InterviewRoundOut]
    active_openings: int
    match_rank: int
    selected_by: str                         # "student" | "auto_suggested"
    last_recomputed_at: Optional[datetime] = None

class NotYetEligibleCompanyOut(BaseModel):
    company_id: str
    name: str
    logo_emoji: Optional[str] = None
    logo_url: Optional[str] = None
    industry: str
    min_score: float
    your_score: float
    score_gap: float                         # min_score - your_score
    missing_skills: List[str]
    active_openings: int


class TargetCompaniesResponse(BaseModel):
    student_score: float
    student_role: str
    selected_companies: List[MatchedCompanyOut]
    auto_suggested: List[MatchedCompanyOut]
    companies_not_yet_eligible: List[NotYetEligibleCompanyOut]
    last_updated_at: Optional[datetime] = None


class CompanyProfileDetailOut(BaseModel):
    company_id: str
    name: str
    logo_emoji: Optional[str] = None
    logo_url: Optional[str] = None
    industry: str
    website: Optional[str] = None
    headquarters: Optional[str] = None
    description: Optional[str] = None
    required_roles: List[str]
    must_have_skills: List[str]
    nice_to_have_skills: List[str]
    min_score: float
    interview_rounds: List[InterviewRoundOut]
    interview_tips: Optional[str] = None
    active_openings: int
    is_verified: bool

class SelectCompanyResponse(BaseModel):
    message: str
    company_id: str
    match_result: MatchedCompanyOut