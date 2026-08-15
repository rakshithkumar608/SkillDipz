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
from app.models.assessment import AssessmentResult
from app.models.project import StudentProjectSubmission
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


class BrowseCandidateOut(BaseModel):
    student_id: str
    name: str
    avatar_initials: str
    college: Optional[str] = None
    skills: List[str] = []
    additional_skills_count: int = 0
    skill_index_pct: float = 0.0
    tests_completed: int = 0
    projects_completed: int = 0
    target_role: Optional[str] = None


class BrowseListOut(BaseModel):
    candidates: List[BrowseCandidateOut]
    total: int
    page: int
    total_pages: int


class BrowseHintsOut(BaseModel):
    names: List[str] = []
    colleges: List[str] = []
    skills: List[str] = []


class BrowseCandidateDetailOut(BaseModel):
    student_id: str
    name: str
    avatar_initials: str
    email: str
    college: Optional[str] = None
    branch: Optional[str] = None
    target_role: Optional[str] = None
    skills: List[str] = []
    skill_index_pct: float = 0.0
    tests_completed: int = 0
    projects_completed: int = 0
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    phone: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    overall_score: float = 0.0
    ai_skill_fit_pct: float = 0.0


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
    current_user: User = current_company["user"]
    company_id = current_company["company_id"]

    # 1. Verify company exists or auto-provision for company user
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company and current_user.company_name:
        slug = current_user.company_name.lower().strip().replace(" ", "-")
        company = await CompanyProfile.find_one(CompanyProfile.company_id == slug)

    if not company:
        # Auto-provision CompanyProfile for the authenticated company user
        comp_name = current_user.company_name or current_user.full_name or "Hiring Partner"
        comp_slug = (current_user.company_name or comp_name).lower().strip().replace(" ", "-")
        existing_comp = await CompanyProfile.find_one(CompanyProfile.company_id == comp_slug)
        if existing_comp:
            comp_slug = f"{comp_slug}-{str(current_user.id)[:6]}"
        company = CompanyProfile(
            company_id=comp_slug,
            name=comp_name,
            industry=current_user.industry or "Technology",
            is_verified=True,
            logo_emoji="🏢",
        )
        await company.insert()
        company_id = comp_slug
        current_user.company_name = comp_slug
        await current_user.save()
    else:
        company_id = company.company_id
        if not company.is_verified:
            company.is_verified = True
            await company.save()

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
    current_user: User = current_company["user"]
    company_id = current_user.company_name or current_company["company_id"]

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


# ─────────────────────────────────────────────────────────────────────────────
#  GET /companies/me/browse  — Browse All Platform Candidates
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/browse", response_model=BrowseListOut)
async def browse_candidates(
    role: Optional[str] = Query(None, description="Filter by target role"),
    min_score: float = Query(0.0, ge=0.0, le=100.0, description="Min skill score (0-100)"),
    min_projects: int = Query(0, ge=0, description="Min completed projects"),
    search: Optional[str] = Query(None, description="Search name, college, or skill"),
    sort_by: str = Query("score", description="Sort by score | projects | tests"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    current_company: dict = Depends(get_current_company),
):
    """
    Browse ALL platform student candidates with real verified metrics.
    Zero mock data — live from MongoDB collections.
    """
    import re

    # 1. Fetch all student profiles
    all_profiles: List[StudentProfile] = await StudentProfile.find().to_list()
    if not all_profiles:
        return BrowseListOut(candidates=[], total=0, page=1, total_pages=1)

    # 2. Fetch all employability scores
    all_scores: List[EmployabilityScore] = await EmployabilityScore.find().to_list()
    score_map = {s.student_id: s for s in all_scores}

    # 3. Apply filters
    search_re = re.compile(re.escape(search.strip()), re.IGNORECASE) if search and search.strip() else None
    role_re = re.compile(re.escape(role.strip()), re.IGNORECASE) if role and role.strip() else None

    filtered_profiles: List[StudentProfile] = []
    for prof in all_profiles:
        score_doc = score_map.get(prof.student_id)
        overall = score_doc.overall_score if score_doc else 0.0

        # Min score filter
        if min_score > 0.0 and overall < min_score:
            continue

        # Target role filter
        if role_re:
            if not prof.target_roles or not role_re.search(prof.target_roles):
                continue

        # Direct search filter (name, college, skills)
        if search_re:
            name_match = bool(search_re.search(prof.name or ""))
            college_match = bool(search_re.search(prof.college or ""))
            skill_match = any(bool(search_re.search(s)) for s in (prof.skills or []))
            if not (name_match or college_match or skill_match):
                continue

        filtered_profiles.append(prof)

    if not filtered_profiles:
        return BrowseListOut(candidates=[], total=0, page=1, total_pages=1)

    filtered_ids = [p.student_id for p in filtered_profiles]

    # 4. Fetch counts for projects and tests concurrently
    async def count_projects(sid: str) -> int:
        return await StudentProjectSubmission.find(
            StudentProjectSubmission.student_id == sid,
            StudentProjectSubmission.evaluation_status == "evaluated",
        ).count()

    async def count_tests(sid: str) -> int:
        return await AssessmentResult.find(
            AssessmentResult.student_id == sid
        ).count()

    project_counts, test_counts = await asyncio.gather(
        asyncio.gather(*[count_projects(sid) for sid in filtered_ids], return_exceptions=True),
        asyncio.gather(*[count_tests(sid) for sid in filtered_ids], return_exceptions=True),
    )

    proj_map = {
        sid: (cnt if isinstance(cnt, int) else 0)
        for sid, cnt in zip(filtered_ids, project_counts)
    }
    test_map = {
        sid: (cnt if isinstance(cnt, int) else 0)
        for sid, cnt in zip(filtered_ids, test_counts)
    }

    # 5. Apply min_projects filter
    if min_projects > 0:
        filtered_profiles = [
            p for p in filtered_profiles
            if proj_map.get(p.student_id, 0) >= min_projects
        ]

    # 6. Sorting
    if sort_by == "projects":
        filtered_profiles.sort(
            key=lambda p: (
                proj_map.get(p.student_id, 0),
                score_map.get(p.student_id).overall_score if score_map.get(p.student_id) else 0.0,
            ),
            reverse=True,
        )
    elif sort_by == "tests":
        filtered_profiles.sort(
            key=lambda p: (
                test_map.get(p.student_id, 0),
                score_map.get(p.student_id).overall_score if score_map.get(p.student_id) else 0.0,
            ),
            reverse=True,
        )
    else:  # "score" default
        filtered_profiles.sort(
            key=lambda p: (
                score_map.get(p.student_id).overall_score if score_map.get(p.student_id) else 0.0,
                proj_map.get(p.student_id, 0),
            ),
            reverse=True,
        )

    # 7. Pagination
    total = len(filtered_profiles)
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = min(page, total_pages)
    start = (page - 1) * per_page
    page_profiles = filtered_profiles[start: start + per_page]

    # 8. Assemble response
    candidates: List[BrowseCandidateOut] = []
    for prof in page_profiles:
        sid = prof.student_id
        score_doc = score_map.get(sid)
        overall = score_doc.overall_score if score_doc else 0.0
        name = prof.name or "Student"
        skills = prof.skills or []
        displayed_skills = skills[:4]
        extra_count = max(0, len(skills) - 4)

        candidates.append(
            BrowseCandidateOut(
                student_id=sid,
                name=name,
                avatar_initials=_initials(name),
                college=prof.college,
                skills=displayed_skills,
                additional_skills_count=extra_count,
                skill_index_pct=round(overall, 1),
                tests_completed=test_map.get(sid, 0),
                projects_completed=proj_map.get(sid, 0),
                target_role=prof.target_roles or None,
            )
        )

    return BrowseListOut(
        candidates=candidates,
        total=total,
        page=page,
        total_pages=total_pages,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  GET /companies/me/browse/hints  — Autocomplete Hints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/browse/hints", response_model=BrowseHintsOut)
async def browse_hints(
    q: str = Query(..., min_length=2, description="Query string for search suggestions"),
    current_company: dict = Depends(get_current_company),
):
    """
    Returns live matching student names, colleges, and skills for search hints.
    """
    import re
    query_str = q.strip()
    pattern = re.compile(re.escape(query_str), re.IGNORECASE)

    async def get_names():
        profiles = await StudentProfile.find(
            {"name": {"$regex": re.escape(query_str), "$options": "i"}}
        ).limit(5).to_list()
        return [p.name for p in profiles if p.name]

    async def get_colleges():
        profiles = await StudentProfile.find(
            {"college": {"$regex": re.escape(query_str), "$options": "i"}}
        ).limit(15).to_list()
        seen = set()
        colleges = []
        for p in profiles:
            if p.college and p.college not in seen:
                seen.add(p.college)
                colleges.append(p.college)
                if len(colleges) >= 5:
                    break
        return colleges

    async def get_skills():
        profiles = await StudentProfile.find(
            {"skills": {"$elemMatch": {"$regex": re.escape(query_str), "$options": "i"}}}
        ).limit(20).to_list()
        seen = set()
        skills = []
        for p in profiles:
            for skill in (p.skills or []):
                if pattern.search(skill) and skill not in seen:
                    seen.add(skill)
                    skills.append(skill)
                    if len(skills) >= 8:
                        return skills
        return skills

    names, colleges, skills = await asyncio.gather(
        get_names(), get_colleges(), get_skills(),
        return_exceptions=True,
    )

    return BrowseHintsOut(
        names=names if isinstance(names, list) else [],
        colleges=colleges if isinstance(colleges, list) else [],
        skills=skills if isinstance(skills, list) else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
#  GET /companies/me/browse/{student_id}  — Candidate Detail for Browse
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/browse/{student_id}", response_model=BrowseCandidateDetailOut)
async def get_browse_candidate_detail(
    student_id: str,
    current_company: dict = Depends(get_current_company),
):
    """
    Candidate detail for the modal when viewing any student from Browse.
    Respects privacy settings (phone/github/linkedin only if public).
    """
    prof = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    user = await User.get(student_id)
    score_doc = await EmployabilityScore.find_one(EmployabilityScore.student_id == student_id)
    overall = score_doc.overall_score if score_doc else 0.0
    is_public = (prof.visibility_setting or "public") == "public"

    # Fetch live project and test counts
    projects_count, tests_count = await asyncio.gather(
        StudentProjectSubmission.find(
            StudentProjectSubmission.student_id == student_id,
            StudentProjectSubmission.evaluation_status == "evaluated",
        ).count(),
        AssessmentResult.find(AssessmentResult.student_id == student_id).count(),
        return_exceptions=True,
    )

    name = prof.name or "Student"
    return BrowseCandidateDetailOut(
        student_id=student_id,
        name=name,
        avatar_initials=_initials(name),
        email=user.email if user else (prof.email or ""),
        college=prof.college,
        branch=prof.branch,
        target_role=prof.target_roles or None,
        skills=prof.skills or [],
        skill_index_pct=round(overall, 1),
        tests_completed=tests_count if isinstance(tests_count, int) else 0,
        projects_completed=projects_count if isinstance(projects_count, int) else 0,
        matched_skills=prof.skills or [],
        missing_skills=[],
        phone=prof.phone if is_public else None,
        github=prof.github if is_public else None,
        linkedin=prof.linkedin if is_public else None,
        overall_score=round(overall, 1),
        ai_skill_fit_pct=round(overall, 1),
    )


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
