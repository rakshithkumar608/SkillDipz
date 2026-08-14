import json
import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone

from app.models.target_company import (
    CompanyProfile,
    StudentTargetCompany,
    EligibilityStatus,
)
from app.models.student_profile import StudentProfile
from app.models.job_requirement import JobRequirement
from app.core.redis_client import get_redis
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)

MATCH_CACHE_TTL = 1800  # 30 minutes


async def _get_student_info(student_id: str, student: Optional[StudentProfile] = None) -> Tuple[List[str], float, str]:
    if not student:
        student = await StudentProfile.find_one(StudentProfile.student_id == student_id)

    student_skills: List[str] = []
    if student and getattr(student, "skills", None):
        if isinstance(student.skills, list):
            student_skills = list(student.skills)
        elif isinstance(student.skills, dict):
            student_skills = list(student.skills.get("acquired", []))

    if not student_skills:
        from app.models.skill_gap import StudentSkillLevel
        skill_levels = await StudentSkillLevel.find(StudentSkillLevel.student_id == student_id).to_list()
        if skill_levels:
            student_skills = [sl.skill for sl in skill_levels]

    student_score = getattr(student, "overall_score", None) if student else None
    student_role = (getattr(student, "primary_role", None) or getattr(student, "target_roles", None) or "") if student else ""

    from app.models.employability_score import EmployabilityScore
    score_doc = await EmployabilityScore.find_one(EmployabilityScore.student_id == student_id)
    if score_doc:
        if student_score is None or student_score == 0.0:
            student_score = score_doc.overall_score or 0.0
        if not student_role and score_doc.target_role:
            student_role = score_doc.target_role

    return student_skills, student_score or 0.0, student_role or ""


def _compute_match(
    student_skills: List[str],
    student_score: float,
    company: CompanyProfile,
) -> Dict[str, Any]:
    student_skill_set = {s.lower().strip() for s in student_skills}
    must_have_set = {s.lower().strip() for s in company.must_have_skills}

    if must_have_set:
        matched = student_skill_set & must_have_set
        matched_skills = [s for s in company.must_have_skills if s.lower().strip() in matched]
        missing_skills = [s for s in company.must_have_skills if s.lower().strip() not in matched]
        skill_match_pct = (len(matched) / len(must_have_set)) * 100
    else:
        matched_skills = []
        missing_skills = []
        skill_match_pct = 100.0

    if company.min_score > 0:
        score_readiness_pct = min((student_score / company.min_score) * 100, 100.0)
    else:
        score_readiness_pct = 100.0

    match_score = (skill_match_pct * 0.6) + (score_readiness_pct * 0.4)

    score_ok = student_score >= company.min_score
    if score_ok and not missing_skills:
        status = EligibilityStatus.FULL_MATCH
    elif score_ok and missing_skills:
        status = EligibilityStatus.SKILL_GAP
    else:
        status = EligibilityStatus.NOT_YET

    return {
        "skill_match_pct": round(skill_match_pct, 2),
        "score_readiness_pct": round(score_readiness_pct, 2),
        "match_score": round(match_score, 2),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "eligibility_status": status,
        "eligible": score_ok,
    }

# STUDENT SELECT A COMPANY
async def select_target_company(
    student_id: str,
    company_id: str,
    event_bus,
) -> Dict[str, Any]:
    """
    Called when student explicitly selects a company they want to target.
    Steps:
    1. Load student profile + company profile
    2. Run match algorithm
    3. Upsert StudentTargetCompany record
    4. If skill gap found → publish company.gap_detected event
    5. Invalidate Redis cache
    6. Return match result
    """
    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not student:
        raise ValueError(f"Student profile not found: {student_id}")

    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company:
        raise ValueError(f"Company not found: {company_id}")

    if not company.is_verified:
        raise ValueError(f"Company {company_id} is not yet verified on the platform")

    existing = await StudentTargetCompany.find_one(
        StudentTargetCompany.student_id == student_id,
        StudentTargetCompany.company_id == company_id,
    )

    student_skills, student_score, _ = await _get_student_info(student_id, student)
    match_result = _compute_match(student_skills, student_score, company)

    now = datetime.now(timezone.utc)
    if existing:
        existing.match_score = match_result["match_score"]
        existing.skill_match_pct = match_result["skill_match_pct"]
        existing.score_readiness_pct = match_result["score_readiness_pct"]
        existing.eligibility_status = match_result["eligibility_status"]
        existing.matched_skills = match_result["matched_skills"]
        existing.missing_skills = match_result["missing_skills"]
        existing.last_recomputed_at = now
        existing.selected_by = "student"
        await existing.save()
        record = existing
    else:
        record = StudentTargetCompany(
            student_id=student_id,
            company_id=company_id,
            selected_at=now,
            selected_by="student",
            match_score=match_result["match_score"],
            skill_match_pct=match_result["skill_match_pct"],
            score_readiness_pct=match_result["score_readiness_pct"],
            eligibility_status=match_result["eligibility_status"],
            matched_skills=match_result["matched_skills"],
            missing_skills=match_result["missing_skills"],
            last_recomputed_at=now,
        )
        await record.insert()

    # ── Notify company via WebSocket (real-time toast on their dashboard) ──────
    try:
        from app.models.user import User as UserModel
        company_user = await UserModel.find_one(
            UserModel.company_name == company_id,
            UserModel.role == "COMPANY",
        )
        if company_user:
            student_name = student.name or "A student"
            await ws_manager.broadcast(
                str(company_user.id),
                "new_candidate",
                {
                    "student_id": student_id,
                    "student_name": student_name,
                    "skill_match_pct": round(match_result["skill_match_pct"], 1),
                    "company_id": company_id,
                },
            )
    except Exception as _ws_err:
        logger.warning(f"Company WS notify failed (non-critical): {_ws_err}")
    # ──────────────────────────────────────────────────────────────────────────

    if match_result["missing_skills"] and not record.notification_sent:
        missing_str = ", ".join(match_result["missing_skills"][:3])
        await event_bus.publish("company.gap_detected", {
            "student_id": student_id,
            "company_id": company_id,
            "company_name": company.name,
            "missing_skills": match_result["missing_skills"],
            "notification_body": (
                f"You're missing {missing_str} to target {company.name}. "
                f"Start learning → your roadmap has been updated."
            ),
            "action_url": "/student/roadmap",
        })
        record.notification_sent = True
        await record.save()

    # Invalidate Redis cache
    cache_key = f"matched_companies:{student_id}"
    rc = get_redis()
    if rc:
        await rc.delete(cache_key)

    active_openings = await JobRequirement.find(
        JobRequirement.company_id == company_id,
        JobRequirement.status == "ACTIVE",
    ).count()

    return {
        "company_id": company_id,
        "name": company.name,
        "logo_emoji": company.logo_emoji,
        "logo_url": company.logo_url,
        "industry": company.industry,
        "website": company.website,
        "headquarters": company.headquarters,
        "min_score": company.min_score,
        "your_score": student_score,
        "eligible": match_result["eligible"],
        "eligibility_status": match_result["eligibility_status"],
        "skill_match_pct": match_result["skill_match_pct"],
        "score_readiness_pct": match_result["score_readiness_pct"],
        "match_score": match_result["match_score"],
        "matched_skills": match_result["matched_skills"],
        "missing_skills": match_result["missing_skills"],
        "interview_rounds": [r.dict() for r in company.interview_rounds],
        "active_openings": active_openings,
        "match_rank": 0,
        "selected_by": "student",
        "last_recomputed_at": now.isoformat(),
    }


# FETCH TARGET COMPANIES FOR STUDENT 
async def get_target_companies(student_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns the full target company list for a student.
    Uses Redis cache (TTL 30 min). Cache invalidated on any update.
    """
    cache_key = f"matched_companies:{student_id}"

    rc = get_redis()
    if rc and not force_refresh:
        cached = await rc.get(cache_key)
        if cached:
            logger.info(f"Cache HIT for matched_companies:{student_id}")
            return json.loads(cached)

    logger.info(f"Cache MISS — computing matches for student {student_id}")

    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not student:
        raise ValueError(f"Student profile not found: {student_id}")

    student_skills, student_score, student_role = await _get_student_info(student_id, student)

    all_companies = await CompanyProfile.find(
        CompanyProfile.is_verified == True
    ).to_list()

    selected_records = await StudentTargetCompany.find(
        StudentTargetCompany.student_id == student_id
    ).to_list()
    selected_company_ids = {r.company_id for r in selected_records}

    # Also check if student specified target companies in Profile Building (e.g. "Google, Amazon")
    if student and getattr(student, "target_company", None):
        target_str = student.target_company.lower()
        for company in all_companies:
            if (company.company_id.lower() in target_str or company.name.lower() in target_str):
                selected_company_ids.add(company.company_id)

    selected_companies = []
    auto_suggested = []
    not_yet_eligible = []

    for company in all_companies:
        role_matches = (
            not company.required_roles or
            student_role.lower() in [r.lower() for r in company.required_roles]
        )
        if not role_matches:
            continue

        match_result = _compute_match(student_skills, student_score, company)

        active_openings = await JobRequirement.find(
            JobRequirement.company_id == company.company_id,
            JobRequirement.status == "ACTIVE",
        ).count()

        company_out = {
            "company_id": company.company_id,
            "name": company.name,
            "logo_emoji": company.logo_emoji,
            "logo_url": company.logo_url,
            "industry": company.industry,
            "website": company.website,
            "headquarters": company.headquarters,
            "min_score": company.min_score,
            "your_score": student_score,
            "eligible": match_result["eligible"],
            "eligibility_status": match_result["eligibility_status"],
            "skill_match_pct": match_result["skill_match_pct"],
            "score_readiness_pct": match_result["score_readiness_pct"],
            "match_score": match_result["match_score"],
            "matched_skills": match_result["matched_skills"],
            "missing_skills": match_result["missing_skills"],
            "interview_rounds": [r.dict() for r in company.interview_rounds],
            "active_openings": active_openings,
            "match_rank": 0,
        }

        if not match_result["eligible"] and student_score < company.min_score:
            not_yet_eligible.append({
                "company_id": company.company_id,
                "name": company.name,
                "logo_emoji": company.logo_emoji,
                "logo_url": company.logo_url,
                "industry": company.industry,
                "min_score": company.min_score,
                "your_score": student_score,
                "score_gap": round(company.min_score - student_score, 1),
                "missing_skills": match_result["missing_skills"],
                "active_openings": active_openings,
            })
            continue

        if company.company_id in selected_company_ids:
            company_out["selected_by"] = "student"
            selected_companies.append(company_out)
        else:
            if match_result["match_score"] >= 50:
                company_out["selected_by"] = "auto_suggested"
                auto_suggested.append(company_out)

    selected_companies.sort(key=lambda x: x["match_score"], reverse=True)
    for i, c in enumerate(selected_companies):
        c["match_rank"] = i + 1

    auto_suggested.sort(key=lambda x: x["match_score"], reverse=True)
    auto_suggested = auto_suggested[:5]
    for i, c in enumerate(auto_suggested):
        c["match_rank"] = i + 1

    not_yet_eligible.sort(key=lambda x: x["score_gap"])

    now = datetime.now(timezone.utc)
    result = {
        "student_score": student_score,
        "student_role": student_role,
        "selected_companies": selected_companies,
        "auto_suggested": auto_suggested,
        "companies_not_yet_eligible": not_yet_eligible,
        "last_updated_at": now.isoformat(),
    }

    rc = get_redis()
    if rc:
        await rc.setex(cache_key, MATCH_CACHE_TTL, json.dumps(result, default=str))
    return result


# EVENT HANDLER - score.update OR profile.update
async def on_score_or_profile_updated(student_id: str, event_bus) -> None:
    """
    Triggered by event bus when score.updated or profile.updated fires.
    Recomputes match for all selected companies and pushes via WebSocket.
    """
    logger.info(f"Recomputing target company matches for student {student_id}")

    rc = get_redis()
    if rc:
        await rc.delete(f"matched_companies:{student_id}")

    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not student:
        return

    student_skills, student_score, _ = await _get_student_info(student_id, student)

    selected_records = await StudentTargetCompany.find(
        StudentTargetCompany.student_id == student_id
    ).to_list()

    now = datetime.now(timezone.utc)
    for record in selected_records:
        company = await CompanyProfile.find_one(
            CompanyProfile.company_id == record.company_id
        )
        if not company:
            continue

        match_result = _compute_match(student_skills, student_score, company)
        record.match_score = match_result["match_score"]
        record.skill_match_pct = match_result["skill_match_pct"]
        record.score_readiness_pct = match_result["score_readiness_pct"]
        record.eligibility_status = match_result["eligibility_status"]
        record.matched_skills = match_result["matched_skills"]
        record.missing_skills = match_result["missing_skills"]
        record.last_recomputed_at = now

        # Notify if student just became eligible
        if match_result["eligibility_status"] in (
            EligibilityStatus.ELIGIBLE, EligibilityStatus.FULL_MATCH
        ):
            await event_bus.publish("company.now_eligible", {
                "student_id": student_id,
                "company_id": record.company_id,
                "company_name": company.name,
                "notification_body": (
                    f"You are now eligible for {company.name}! "
                    f"Your score ({student_score}) meets their requirement ({company.min_score})."
                ),
                "action_url": "/student/target-company",
            })

        if not match_result["missing_skills"]:
            record.notification_sent = False

        await record.save()

    result = await get_target_companies(student_id)

    await ws_manager.broadcast(
        student_id=student_id,
        event_type="target_companies_updated",
        payload=result,
    )

# EVENT HANDLER — company.registered

async def on_company_registered(company_id: str, event_bus) -> None:
    """
    When a new company registers and is verified, check all students who match.
    """
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        return

    matching_students = await StudentProfile.find_all().to_list()

    for student in matching_students:
        student_skills, student_score, _ = await _get_student_info(student.student_id, student)
        match_result = _compute_match(student_skills, student_score, company)

        if match_result["match_score"] >= 50:
            await event_bus.publish("company.new_match", {
                "student_id": student.student_id,
                "company_id": company_id,
                "company_name": company.name,
                "match_score": match_result["match_score"],
                "notification_body": (
                    f"{company.name} just joined SkillDipz! "
                    f"You're a {round(match_result['match_score'])}% match. Check them out →"
                ),
                "action_url": "/student/target-company",
            })
            rc = get_redis()
            if rc:
                await rc.delete(f"matched_companies:{student.student_id}")


# UNSELECTED COMPANY

async def unselect_target_company(student_id: str, company_id: str) -> None:
    record = await StudentTargetCompany.find_one(
        StudentTargetCompany.student_id == student_id,
        StudentTargetCompany.company_id == company_id,
    )
    if record:
        await record.delete()
    rc = get_redis()
    if rc:
        await rc.delete(f"matched_companies:{student_id}")