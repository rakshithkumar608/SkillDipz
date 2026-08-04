from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class JobApplication(Document):
    """A student's application to a specific job posting."""
    application_id: str
    student_id: str
    job_id: str
    company_id: str
    status: str = "Applied"  # Applied | Shortlisted | Interviewed | Offered | Rejected
    profile_match_pct: float = 0.0
    applied_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "job_applications"
