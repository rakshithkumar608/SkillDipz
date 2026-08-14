import uuid
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from app.api.dependencies import get_current_company, get_current_admin
from app.models.target_company import CompanyProfile, StudentTargetCompany, InterviewRound
from app.models.job_requirement import JobRequirement
from app.models.student_profile import StudentProfile
from app.models.employability_score import EmployabilityScore
from app.models.user import User
from app.core.event_bus import event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/companies/me", tags=["Company Portal"])


# Request / Response schemas 

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


class TalentCardOut(BaseModel):
    student_id: str
    name: str
    avatar_initials: str
    college: Optional[str] = None
    target_role: Optional[str] = None
    skills: List[str] = []
    ai_skill_fit_pct: float = 0.0


class CandidateDetailOut(BaseModel):
    student_id: str
    name: str
    avatar_initials: str
    email: str
    college: Optional[str] = None
    branch: Optional[str] = None
    target_role: Optional[str] = None
    skills: List[str] = []
    ai_skill_fit_pct: float = 0.0
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    # Only populated when student visibility_setting == "public"
    phone: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    overall_score: float = 0.0


class DashboardStatsOut(BaseModel):
    active_students_on_platform: int
    verified_skilled_developers: int
    partner_hiring_corporates: int
    average_recruitment_time_saved_pct: int


class DashboardOut(BaseModel):
    stats: DashboardStatsOut
    outstanding_talent_pools: List[TalentCardOut]
    company_name: str
    company_logo_emoji: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_id: str


#  Helpers 

def _initials(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


#  GET /companies/me/dashboard 

@router.get("/dashboard", response_model=DashboardOut)
async def get_employer_dashboard(
    limit: int = Query(10, ge=1, le=50),
    current_company: dict = Depends(get_current_company),
):
    """
    Employer dashboard — real-time platform stats + top talent pool.
    Students who selected this company are ranked by skill_match_pct DESC.
    """
    company_id = current_company["company_id"]

    # 1. Verify company exists and is verified
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company profile not found. Complete registration first.",
        )
    if not company.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company is pending admin verification.",
        )

    # 2. Platform-wide stats — run in parallel
    async def count_all_students():
        return await User.find(User.role == "STUDENT").count()

    async def count_verified_skilled():
        # "Verified skilled" = students with overall_score >= 50
        return await EmployabilityScore.find(
            EmployabilityScore.overall_score >= 50.0
        ).count()

    async def count_partner_corporates():
        return await CompanyProfile.find(
            CompanyProfile.is_verified == True  # noqa: E712
        ).count()

    stats_results = await asyncio.gather(
        count_all_students(),
        count_verified_skilled(),
        count_partner_corporates(),
        return_exceptions=True,
    )

    active_students    = stats_results[0] if isinstance(stats_results[0], int) else 0
    verified_skilled   = stats_results[1] if isinstance(stats_results[1], int) else 0
    partner_corporates = stats_results[2] if isinstance(stats_results[2], int) else 0
    avg_time_saved_pct = 60  # platform benchmark (60% faster than manual screening)

    # 3. Talent pool — students who selected this company, sorted by fit
    stc_docs = (
        await StudentTargetCompany.find(
            StudentTargetCompany.company_id == company_id
        )
        .sort(-StudentTargetCompany.skill_match_pct)
        .limit(limit)
        .to_list()
    )

    student_ids = [d.student_id for d in stc_docs]
    profiles    = await StudentProfile.find({"student_id": {"$in": student_ids}}).to_list()
    profile_map = {p.student_id: p for p in profiles}

    talent_pool: List[TalentCardOut] = []
    for stc in stc_docs:
        prof = profile_map.get(stc.student_id)
        if not prof:
            continue
        name = prof.name or "Student"
        talent_pool.append(
            TalentCardOut(
                student_id=stc.student_id,
                name=name,
                avatar_initials=_initials(name),
                college=prof.college,
                target_role=prof.target_roles or None,
                skills=prof.skills[:5],
                ai_skill_fit_pct=round(stc.skill_match_pct, 1),
            )
        )

    return DashboardOut(
        stats=DashboardStatsOut(
            active_students_on_platform=active_students,
            verified_skilled_developers=verified_skilled,
            partner_hiring_corporates=partner_corporates,
            average_recruitment_time_saved_pct=avg_time_saved_pct,
        ),
        outstanding_talent_pools=talent_pool,
        company_name=company.name,
        company_logo_emoji=company.logo_emoji,
        company_logo_url=company.logo_url,
        company_id=company.company_id,
    )


# GET /companies/me/candidates/{student_id} 

@router.get("/candidates/{student_id}", response_model=CandidateDetailOut)
async def get_candidate_detail(
    student_id: str,
    current_company: dict = Depends(get_current_company),
):
    """
    Full candidate profile for the modal popup.
    phone / github / linkedin only returned when student visibility_setting == 'public'.
    """
    company_id = current_company["company_id"]

    # Security: student must have actually targeted this company
    stc = await StudentTargetCompany.find_one(
        StudentTargetCompany.student_id == student_id,
        StudentTargetCompany.company_id == company_id,
    )
    if not stc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found in your talent pool.",
        )

    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    user       = await User.get(student_id)
    email      = user.email if user else (prof.email or "")
    score_doc  = await EmployabilityScore.find_one(EmployabilityScore.student_id == student_id)
    overall    = score_doc.overall_score if score_doc else 0.0
    is_public  = (prof.visibility_setting or "public") == "public"

    name = prof.name or "Student"
    return CandidateDetailOut(
        student_id=student_id,
        name=name,
        avatar_initials=_initials(name),
        email=email,
        college=prof.college,
        branch=prof.branch,
        target_role=prof.target_roles or None,
        skills=prof.skills,
        ai_skill_fit_pct=round(stc.skill_match_pct, 1),
        matched_skills=stc.matched_skills,
        missing_skills=stc.missing_skills,
        phone=prof.phone if is_public else None,
        github=prof.github if is_public else None,
        linkedin=prof.linkedin if is_public else None,
        overall_score=round(overall, 1),
    )


#  POST /companies/me/register 

@router.post("/register")
async def register_company(
    body: RegisterCompanyRequest,
    current_company: dict = Depends(get_current_company),
):
    """Company registers on the platform (pending admin verification)."""
    existing = await CompanyProfile.find_one(CompanyProfile.company_id == body.company_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID already registered",
        )
    rounds  = [InterviewRound(**r) for r in body.interview_rounds]
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


#  POST /companies/me/jobs 
@router.post("/jobs")
async def post_job(
    body: PostJobRequest,
    current_company: dict = Depends(get_current_company),
):
    """Company posts a new job opening."""
    company_id = current_company["company_id"]
    company    = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company must be verified to post jobs",
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

    active_jobs          = await JobRequirement.find(JobRequirement.company_id == company_id, JobRequirement.status == "ACTIVE").to_list()
    company.active_openings_count = len(active_jobs)
    all_skills: set      = set()
    for j in active_jobs:
        all_skills.update(j.required_skills)
    company.must_have_skills = list(all_skills)
    await company.save()

    await event_bus.publish("job.posted", {
        "job_id": job.job_id, "company_id": company_id,
        "company_name": company.name, "title": body.title,
        "role_id": body.role_id, "min_score": body.min_score,
    })
    return {"message": "Job posted successfully", "job_id": job.job_id}


#  Admin router 

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
    await event_bus.publish("company.registered", {"company_id": company_id, "company_name": company.name})
    return {"message": f"Company {company_id} verified and published to platform"}
