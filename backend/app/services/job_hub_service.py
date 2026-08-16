import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.models.job_requirement import JobRequirement
from app.models.job_application import JobApplication
from app.models.student_profile import StudentProfile
from app.models.employability_score import EmployabilityScore
from app.models.target_company import CompanyProfile
from app.models.skill_gap import StudentSkillLevel
from app.schemas.job_schema import (
    JobCardOut,
    JobListResponse,
    JobDetailOut,
    ApplyJobResponse,
    JobFiltersResponse,
)
from app.core.redis_client import get_redis
from app.core.event_bus import event_bus

logger = logging.getLogger(__name__)


async def _get_student_data(student_id: str):
    """Fetch student skills, score, and role for matching."""
    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)

    student_skills: List[str] = []
    if student and getattr(student, "skills", None):
        if isinstance(student.skills, list):
            student_skills = list(student.skills)
        elif isinstance(student.skills, dict):
            student_skills = list(student.skills.get("acquired", []))

    if not student_skills:
        skill_levels = await StudentSkillLevel.find(
            StudentSkillLevel.student_id == student_id
        ).to_list()
        if skill_levels:
            student_skills = [sl.skill for sl in skill_levels]

    student_score = 0.0
    student_role = ""

    if student:
        student_role = getattr(student, "target_roles", None) or ""

    score_doc = await EmployabilityScore.find_one(
        EmployabilityScore.student_id == student_id
    )
    if score_doc:
        student_score = score_doc.overall_score or 0.0
        if not student_role and score_doc.target_role:
            student_role = score_doc.target_role

    return student, student_skills, student_score, student_role


def _compute_job_match(
    student_skills: List[str],
    student_score: float,
    student_role: str,
    job: JobRequirement,
) -> Dict[str, Any]:
    """
    Compute profile match % for a job using the spec algorithm:
    1. Skill overlap: matched / required × 100
    2. Score check: student_score >= min_score → eligible
    3. Nice-to-have bonus: +5% per matched nice-to-have
    4. profile_match_pct = skill_match + bonus (capped at 100%)
    """
    student_skill_set = {s.lower().strip() for s in student_skills}

    # Required skills match
    required_set = {s.lower().strip() for s in job.required_skills}
    if required_set:
        matched = student_skill_set & required_set
        matched_skills = [s for s in job.required_skills if s.lower().strip() in matched]
        missing_skills = [s for s in job.required_skills if s.lower().strip() not in matched]
        skill_match_pct = (len(matched) / len(required_set)) * 100
    else:
        matched_skills = []
        missing_skills = []
        skill_match_pct = 100.0

    # Score eligibility
    eligible = student_score >= job.min_score if job.min_score > 0 else True
    score_gap = max(0, job.min_score - student_score) if not eligible else 0.0

    # Nice-to-have bonus
    nice_set = {s.lower().strip() for s in job.nice_to_have}
    nice_matched = student_skill_set & nice_set
    bonus = len(nice_matched) * 5.0

    # Final match percentage (capped at 100)
    profile_match_pct = min(skill_match_pct + bonus, 100.0)

    return {
        "profile_match_pct": round(profile_match_pct, 1),
        "eligible": eligible,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "score_gap": round(score_gap, 1),
    }


async def get_jobs_for_student(
    student_id: str,
    page: int = 1,
    page_size: int = 12,
    sort: str = "match_score",
    role: Optional[str] = None,
    location: Optional[str] = None,
    work_mode: Optional[str] = None,
    show: str = "all",
) -> JobListResponse:
    """
    Fetch all active jobs, compute match for the student, filter/sort/paginate.
    """
    student, student_skills, student_score, student_role = await _get_student_data(
        student_id
    )

    # Build query filters for active jobs
    query_conditions: List[Dict[str, Any]] = [{"status": "ACTIVE"}]

    filter_role = role if (role is not None and role.strip() != "") else None
    if filter_role and filter_role.strip():
        search_term = filter_role.strip()
        query_conditions.append({
            "$or": [
                {"role_id": {"$regex": search_term, "$options": "i"}},
                {"title": {"$regex": search_term, "$options": "i"}},
            ]
        })

    if location and location.strip():
        loc_term = location.strip()
        # Find registered companies whose headquarters or name match location
        matching_companies = await CompanyProfile.find({
            "$or": [
                {"headquarters": {"$regex": loc_term, "$options": "i"}},
                {"name": {"$regex": loc_term, "$options": "i"}},
            ]
        }).to_list()
        matching_company_ids = [c.company_id for c in matching_companies]

        loc_or: List[Dict[str, Any]] = [{"location": {"$regex": loc_term, "$options": "i"}}]
        if matching_company_ids:
            loc_or.append({"company_id": {"$in": matching_company_ids}})

        query_conditions.append({"$or": loc_or})

    if work_mode:
        query_conditions.append({"work_mode": work_mode})

    # Fetch jobs
    if len(query_conditions) == 1:
        all_jobs = await JobRequirement.find(query_conditions[0]).to_list()
    else:
        all_jobs = await JobRequirement.find({"$and": query_conditions}).to_list()

    # Fetch student's applied job IDs
    applied_apps = await JobApplication.find(
        JobApplication.student_id == student_id
    ).to_list()
    applied_job_ids = {app.job_id for app in applied_apps}

    # Load all company profiles for these jobs (batch)
    company_ids = list({j.company_id for j in all_jobs})
    companies = await CompanyProfile.find(
        {"company_id": {"$in": company_ids}}
    ).to_list()
    company_map = {c.company_id: c for c in companies}

    # Compute match for each job
    job_cards: List[Dict[str, Any]] = []
    for job in all_jobs:
        match_result = _compute_job_match(
            student_skills, student_score, student_role, job
        )
        already_applied = job.job_id in applied_job_ids

        # Apply "show" filter
        if show == "eligible" and not match_result["eligible"]:
            continue
        if show == "applied" and not already_applied:
            continue

        company = company_map.get(job.company_id)
        company_name = company.name if company else job.company_id
        company_logo_emoji = company.logo_emoji if company else None
        company_logo_url = company.logo_url if company else None

        job_cards.append({
            "job_id": job.job_id,
            "company_id": job.company_id,
            "company_name": company_name,
            "company_logo_emoji": company_logo_emoji,
            "company_logo_url": company_logo_url,
            "title": job.title,
            "role_id": job.role_id,
            "description": job.description,
            "min_score": job.min_score,
            "location": job.location,
            "work_mode": job.work_mode,
            "ctc_range": job.ctc_range,
            "experience": job.experience,
            "required_skills": job.required_skills,
            "nice_to_have": job.nice_to_have,
            "deadline": job.deadline,
            "openings_count": job.openings_count,
            "posted_at": job.created_at,
            "profile_match_pct": match_result["profile_match_pct"],
            "eligible": match_result["eligible"],
            "matched_skills": match_result["matched_skills"],
            "missing_skills": match_result["missing_skills"],
            "already_applied": already_applied,
        })

    # Sort
    if sort == "newest":
        job_cards.sort(key=lambda x: x.get("posted_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    elif sort == "highest_ctc":
        def _parse_ctc(ctc_str):
            if not ctc_str:
                return 0
            try:
                parts = ctc_str.replace("LPA", "").replace("lpa", "").strip().split("-")
                return float(parts[-1].strip())
            except (ValueError, IndexError):
                return 0
        job_cards.sort(key=lambda x: _parse_ctc(x.get("ctc_range", "")), reverse=True)
    else:
        # Default: match_score DESC
        job_cards.sort(key=lambda x: x["profile_match_pct"], reverse=True)

    total = len(job_cards)

    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    page_jobs = job_cards[start:end]

    return JobListResponse(
        jobs=[JobCardOut(**j) for j in page_jobs],
        total=total,
        page=page,
        page_size=page_size,
        student_score=student_score,
        student_role=student_role,
    )


async def get_job_detail(job_id: str, student_id: str) -> JobDetailOut:
    """Fetch a single job with full details and match info."""
    job = await JobRequirement.find_one(JobRequirement.job_id == job_id)
    if not job:
        raise ValueError(f"Job not found: {job_id}")

    _, student_skills, student_score, student_role = await _get_student_data(student_id)
    match_result = _compute_job_match(student_skills, student_score, student_role, job)

    # Check if already applied
    existing_app = await JobApplication.find_one(
        JobApplication.student_id == student_id,
        JobApplication.job_id == job_id,
    )

    # Get company info
    company = await CompanyProfile.find_one(CompanyProfile.company_id == job.company_id)

    return JobDetailOut(
        job_id=job.job_id,
        company_id=job.company_id,
        company_name=company.name if company else job.company_id,
        company_logo_emoji=company.logo_emoji if company else None,
        company_logo_url=company.logo_url if company else None,
        company_industry=company.industry if company else None,
        company_description=company.description if company else None,
        company_headquarters=company.headquarters if company else None,
        company_website=company.website if company else None,
        title=job.title,
        role_id=job.role_id,
        description=job.description,
        min_score=job.min_score,
        location=job.location,
        work_mode=job.work_mode,
        ctc_range=job.ctc_range,
        experience=job.experience,
        required_skills=job.required_skills,
        nice_to_have=job.nice_to_have,
        deadline=job.deadline,
        openings_count=job.openings_count,
        posted_at=job.created_at,
        profile_match_pct=match_result["profile_match_pct"],
        eligible=match_result["eligible"],
        matched_skills=match_result["matched_skills"],
        missing_skills=match_result["missing_skills"],
        already_applied=existing_app is not None,
        score_gap=match_result["score_gap"],
    )


async def apply_to_job(student_id: str, job_id: str) -> ApplyJobResponse:
    """
    Student applies to a job.
    Validates eligibility, creates application, publishes event.
    """
    job = await JobRequirement.find_one(JobRequirement.job_id == job_id)
    if not job:
        raise ValueError("Job not found")

    if job.status != "ACTIVE":
        raise ValueError("This job is no longer accepting applications")

    # Check deadline
    if job.deadline and job.deadline < datetime.now(timezone.utc):
        raise ValueError("Application deadline has passed")

    # Check if already applied
    existing = await JobApplication.find_one(
        JobApplication.student_id == student_id,
        JobApplication.job_id == job_id,
    )
    if existing:
        raise ValueError("You have already applied to this job")

    # Get student data and check eligibility
    student, student_skills, student_score, student_role = await _get_student_data(
        student_id
    )
    match_result = _compute_job_match(student_skills, student_score, student_role, job)

    if not match_result["eligible"]:
        gap = round(job.min_score - student_score, 1)
        raise ValueError(
            f"Your score ({student_score}) is below the minimum ({job.min_score}). "
            f"Improve by {gap} points to apply."
        )

    # Create application
    application_id = str(uuid.uuid4())
    application = JobApplication(
        application_id=application_id,
        student_id=student_id,
        job_id=job_id,
        company_id=job.company_id,
        status="Applied",
        profile_match_pct=match_result["profile_match_pct"],
    )
    await application.insert()

    # Get company and student name for notification
    company = await CompanyProfile.find_one(CompanyProfile.company_id == job.company_id)
    company_name = company.name if company else job.company_id
    student_name = student.name if student else "A student"

    # Publish event for company notification
    await event_bus.publish("job.applied", {
        "application_id": application_id,
        "student_id": student_id,
        "student_name": student_name,
        "student_score": student_score,
        "job_id": job_id,
        "job_title": job.title,
        "company_id": job.company_id,
        "company_name": company_name,
        "profile_match_pct": match_result["profile_match_pct"],
    })

    return ApplyJobResponse(
        message=f"Successfully applied to {job.title} at {company_name}",
        application_id=application_id,
        status="Applied",
    )


async def get_job_filters() -> JobFiltersResponse:
    """
    Query distinct role_id, location, and work_mode from active jobs.
    Returns only values that actually exist in the database — zero mock data.
    """
    collection = JobRequirement.get_motor_collection()
    active_filter = {"status": "ACTIVE"}

    # MongoDB distinct() returns unique values for a field
    roles_raw = await collection.distinct("role_id", active_filter)
    locations_raw = await collection.distinct("location", active_filter)
    work_modes_raw = await collection.distinct("work_mode", active_filter)

    # Filter out None/empty and sort alphabetically
    roles = sorted([r for r in roles_raw if r])
    locations = sorted([l for l in locations_raw if l])
    work_modes = sorted([w for w in work_modes_raw if w])

    return JobFiltersResponse(
        roles=roles,
        locations=locations,
        work_modes=work_modes,
    )
