from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class JobListQuery(BaseModel):
    """Query parameters for GET /jobs."""
    page: int = 1
    page_size: int = 12
    sort: str = "match_score"  # match_score | newest | highest_ctc
    role: Optional[str] = None
    location: Optional[str] = None
    work_mode: Optional[str] = None
    show: str = "all"  # all | eligible | applied


class JobCardOut(BaseModel):
    """Single job card in the listing."""
    job_id: str
    company_id: str
    company_name: str
    company_logo_emoji: Optional[str] = None
    company_logo_url: Optional[str] = None
    title: str
    role_id: str
    description: Optional[str] = None
    min_score: float
    location: Optional[str] = None
    work_mode: Optional[str] = None
    ctc_range: Optional[str] = None
    experience: Optional[str] = None
    required_skills: List[str] = []
    nice_to_have: List[str] = []
    deadline: Optional[datetime] = None
    openings_count: int = 1
    posted_at: Optional[datetime] = None
    profile_match_pct: float = 0.0
    eligible: bool = False
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    already_applied: bool = False


class JobListResponse(BaseModel):
    """Paginated response for GET /jobs."""
    jobs: List[JobCardOut]
    total: int
    page: int
    page_size: int
    student_score: float
    student_role: str


class JobDetailOut(BaseModel):
    """Full job detail response."""
    job_id: str
    company_id: str
    company_name: str
    company_logo_emoji: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_industry: Optional[str] = None
    company_description: Optional[str] = None
    company_headquarters: Optional[str] = None
    company_website: Optional[str] = None
    title: str
    role_id: str
    description: Optional[str] = None
    min_score: float
    location: Optional[str] = None
    work_mode: Optional[str] = None
    ctc_range: Optional[str] = None
    experience: Optional[str] = None
    required_skills: List[str] = []
    nice_to_have: List[str] = []
    deadline: Optional[datetime] = None
    openings_count: int = 1
    posted_at: Optional[datetime] = None
    profile_match_pct: float = 0.0
    eligible: bool = False
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    already_applied: bool = False
    score_gap: float = 0.0  # How many points needed to become eligible


class ApplyJobResponse(BaseModel):
    """Response for POST /jobs/{jobId}/apply."""
    message: str
    application_id: str
    status: str


class JobFiltersResponse(BaseModel):
    """Available filter options derived from active jobs in DB."""
    roles: List[str] = []
    locations: List[str] = []
    work_modes: List[str] = []
