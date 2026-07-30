import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from app.api.dependencies import get_current_company, get_current_admin
from app.models.target_company import CompanyProfile, InterviewRound
from app.models.job_requirement import JobRequirement
from app.core.event_bus import event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/companies/me", tags=["Company Portal"])


class RegisterCompanyRequest(BaseModel):
    company_id: str = Field(..., description="Unique slug e.g. 'razorpay'")
    name: str
    logo_emoji: Optional[str] = None
    industry: str
    website: Optional[str] = None
    description: Optional[str] = None
    headquarters: Optional[str] = None
    required_roles: List[str] = []
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    min_score: float = 0.0
    interview_rounds: List[dict] = []
    interview_tips: Optional[str] = None


class PostJobRequest(BaseModel):
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


@router.post("/register")
async def register_company(
    body: RegisterCompanyRequest,
    current_company: dict = Depends(get_current_company),
):
    """Company registers on the platform (pending admin verification)."""
    existing = await CompanyProfile.find_one(
        CompanyProfile.company_id == body.company_id
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID already registered"
        )

    rounds = [InterviewRound(**r) for r in body.interview_rounds]
    company = CompanyProfile(
        company_id=body.company_id,
        name=body.name,
        logo_emoji=body.logo_emoji,
        industry=body.industry,
        website=body.website,
        description=body.description,
        headquarters=body.headquarters,
        required_roles=body.required_roles,
        must_have_skills=body.must_have_skills,
        nice_to_have_skills=body.nice_to_have_skills,
        min_score=body.min_score,
        interview_rounds=rounds,
        interview_tips=body.interview_tips,
        is_verified=False,
    )
    await company.insert()
    return {"message": "Registration submitted. Pending admin verification.", "company_id": body.company_id}


@router.post("/jobs")
async def post_job(
    body: PostJobRequest,
    current_company: dict = Depends(get_current_company),
):
    """Company posts a new job opening."""
    company_id = current_company["company_id"]

    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company must be verified to post jobs"
        )

    job = JobRequirement(
        job_id=str(uuid.uuid4()),
        company_id=company_id,
        title=body.title,
        role_id=body.role_id,
        description=body.description,
        min_score=body.min_score,
        location=body.location,
        work_mode=body.work_mode,
        ctc_range=body.ctc_range,
        experience=body.experience,
        required_skills=body.required_skills,
        nice_to_have=body.nice_to_have,
        deadline=body.deadline,
        openings_count=body.openings_count,
        status="ACTIVE",
    )
    await job.insert()

    # Sync company's active openings count
    active_count = await JobRequirement.find(
        JobRequirement.company_id == company_id,
        JobRequirement.status == "ACTIVE",
    ).count()
    company.active_openings_count = active_count

    # Update company must_have_skills from union of all active job required_skills
    all_active_jobs = await JobRequirement.find(
        JobRequirement.company_id == company_id,
        JobRequirement.status == "ACTIVE",
    ).to_list()
    all_skills = set()
    for j in all_active_jobs:
        all_skills.update(j.required_skills)
    company.must_have_skills = list(all_skills)
    await company.save()

    await event_bus.publish("job.posted", {
        "job_id": job.job_id,
        "company_id": company_id,
        "company_name": company.name,
        "title": body.title,
        "role_id": body.role_id,
        "min_score": body.min_score,
    })

    return {"message": "Job posted successfully", "job_id": job.job_id}


# Admin route to verify company
admin_router = APIRouter(prefix="/admin/companies", tags=["Admin"])


@admin_router.post("/{company_id}/verify")
async def verify_company(
    company_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Admin verifies a company — makes it visible to students."""
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.is_verified = True
    await company.save()

    # Trigger auto-matching for all students
    await event_bus.publish("company.registered", {
        "company_id": company_id,
        "company_name": company.name,
    })

    return {"message": f"Company {company_id} verified and published to platform"}