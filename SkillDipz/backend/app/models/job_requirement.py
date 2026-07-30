from beanie import Document
from pydantic import Field
from typing import List, Optional
from datetime import datetime, timezone


class JobRequirement(Document):
    """Job posting by a verified company."""
    job_id: str
    company_id: str                         
    title: str
    role_id: str                             
    description: Optional[str] = None
    min_score: float = 0.0
    location: Optional[str] = None
    work_mode: Optional[str] = None       
    ctc_range: Optional[str] = None
    experience: Optional[str] = None
    required_skills: List[str] = []
    nice_to_have: List[str] = []
    deadline: Optional[datetime] = None
    openings_count: int = 1
    status: str = "ACTIVE"                  
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "job_requirements"