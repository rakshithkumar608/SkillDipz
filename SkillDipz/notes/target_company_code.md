# Target Company — Complete Implementation

> **Version 1.0 — Full real-time auto-matching. Zero mock data. Student can select preferred companies; platform auto-validates against resume.**

---

## Feature Summary

```
╔══════════════════════════════════════════════════════════════════╗
║            TARGET COMPANY — HYBRID SELECTION + AUTO-MATCH        ║
║                                                                  ║
║  HOW IT WORKS:                                                   ║
║  1. Student SELECTS companies they are interested in             ║
║     (from the list of verified companies on the platform)        ║
║  2. Platform checks if student's RESUME meets company's          ║
║     requirements (role, skills, score)                           ║
║  3. If MATCH → shown as "Eligible" with match %                  ║
║     If GAP   → shown as "Work on these skills" with roadmap link ║
║  4. Platform ALSO auto-suggests additional companies the student  ║
║     hasn't selected yet but qualifies for (based on resume parse)║
║                                                                  ║
║  Student sees:                                                   ║
║  - Their selected companies with match validation                ║
║  - Auto-suggested matches they didn't know about                 ║
║  - "Improve to Unlock" section for aspirational companies        ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Gap Audit vs Spec

| # | Spec Requirement | Implementation |
|---|---|---|
| Student company selection | Student picks preferred companies | POST /students/me/target-companies/select |
| Resume-based validation | Check resume skills vs company must-haves | RecruitingService.validate_company_fit() |
| Notification on skill gap | Alert student to learn missing skills | company.gap_detected event → Notification |
| Auto-match suggestions | Companies matching student but not selected | Separate auto_suggested array in response |
| Score readiness check | student.score >= company.min_score | Part of match algorithm |
| Real-time re-ranking | On score.updated event → recompute | Event bus consumer in recruiting_service.py |
| Redis caching | matched_companies:{studentId} TTL 30 min | Cache invalidated on any score/profile update |
| Company detail view | Full profile + interview rounds + tips | GET /companies/:id/profile |
| "Improve to Unlock" | Companies where score < min_score | companies_not_yet_eligible array |
| WebSocket real-time push | Push when company match changes | ws_manager.broadcast() on recompute |

---

## Architecture Flow

```
TRIGGER A — Student selects a company:
  POST /students/me/target-companies/select
       |
       ├── [Recruiting Service]
       |     ├── READ StudentProfile (skills[], score, role)
       |     ├── READ CompanyProfile + JobRequirements
       |     ├── RUN match algorithm
       |     ├── INSERT StudentTargetCompany { studentId, companyId, match_result }
       |     |
       |     ├── IF gap detected:
       |     |     PUBLISH company.gap_detected
       |     |     → [Notification Service] push:
       |     |         "You're missing [DSA, System Design] for Flipkart. Start learning →"
       |     |
       |     └── INVALIDATE Redis: matched_companies:{studentId}
       |
       └── Response: full match_result for that company

TRIGGER B — score.updated OR profile.updated event:
  [Recruiting Service CONSUMER]
       |
       ├── Fetch all StudentTargetCompany for this studentId
       ├── Re-run match algorithm for each selected company
       ├── UPDATE StudentTargetCompany rows
       ├── Compute auto_suggestions (verified companies not yet selected)
       ├── UPDATE Redis cache: matched_companies:{studentId} TTL 30 min
       └── WS broadcast: score_update type + matched_companies payload

TRIGGER C — company.registered event:
  [Recruiting Service CONSUMER]
       |
       ├── Find all students who match this new company
       └── PUBLISH notification: "New company [X] just joined — you're a match!"

GET /students/me/target-companies
  → [Redis] HIT  → return cached
  → [Redis] MISS → compute → cache → return
```

---

## File 1 — `backend/app/models/target_company.py`

```python
from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class EligibilityStatus(str, Enum):
    ELIGIBLE = "eligible"
    NOT_YET = "not_yet"           # score < min_score
    SKILL_GAP = "skill_gap"       # score ok but missing skills
    FULL_MATCH = "full_match"     # score ok + all skills present


class InterviewRound(BaseModel):
    order: int
    name: str
    description: Optional[str] = None
    duration_mins: Optional[int] = None


class CompanyProfile(Document):
    """Registered company on the platform."""
    company_id: str                          # slug e.g. "razorpay"
    name: str
    logo_emoji: Optional[str] = None         # fallback emoji if no logo image
    logo_url: Optional[str] = None           # S3/CDN URL for logo image
    industry: str
    website: Optional[str] = None
    description: Optional[str] = None
    headquarters: Optional[str] = None

    # Matching criteria (set when company posts a job)
    required_roles: List[str] = []           # ["backend", "fullstack"]
    must_have_skills: List[str] = []         # ["Java", "Spring Boot", "SQL"]
    nice_to_have_skills: List[str] = []      # ["Docker", "Kafka"]
    min_score: float = 0.0                   # minimum employability score to be eligible

    # Interview process
    interview_rounds: List[InterviewRound] = []
    interview_tips: Optional[str] = None     # markdown text

    # Platform state
    is_verified: bool = False
    active_openings_count: int = 0          # synced from job_requirements count

    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "company_profiles"


class StudentTargetCompany(Document):
    """
    When a student selects a company, this record stores the match result.
    Re-evaluated on every score.updated / profile.updated event.
    """
    student_id: str
    company_id: str

    # Selection metadata
    selected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    selected_by: str = "student"             # "student" | "auto_suggested"

    # Match result (recomputed on trigger)
    match_score: float = 0.0                 # 0-100 composite
    skill_match_pct: float = 0.0             # % of must-have skills student has
    score_readiness_pct: float = 0.0         # student.score / company.min_score * 100 (capped at 100)
    eligibility_status: EligibilityStatus = EligibilityStatus.NOT_YET

    matched_skills: List[str] = []           # skills student HAS that company needs
    missing_skills: List[str] = []           # skills student is MISSING
    match_rank: int = 0                      # rank among all student's selected companies

    last_recomputed_at: Optional[datetime] = None
    notification_sent: bool = False          # prevent duplicate gap notifications

    class Settings:
        name = "student_target_companies"
```

---

## File 2 — `backend/app/schemas/target_company_schema.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.target_company import EligibilityStatus, InterviewRound


# ─── Request Schemas ──────────────────────────────────────────────────────────

class SelectCompanyRequest(BaseModel):
    company_id: str = Field(..., description="Slug ID of the company e.g. 'razorpay'")


class UnselectCompanyRequest(BaseModel):
    company_id: str


# ─── Response Schemas ─────────────────────────────────────────────────────────

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
    """Companies where student.score < company.min_score — shown as 'Improve to Unlock'"""
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
    selected_companies: List[MatchedCompanyOut]        # student-selected + matched
    auto_suggested: List[MatchedCompanyOut]            # platform auto-suggestions not yet selected
    companies_not_yet_eligible: List[NotYetEligibleCompanyOut]
    last_updated_at: Optional[datetime] = None


class CompanyProfileDetailOut(BaseModel):
    """Full company profile returned on GET /companies/:id/profile"""
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
```

---

## File 3 — `backend/app/services/recruiting_service.py`

```python
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
from app.core.database import redis_client
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)

MATCH_CACHE_TTL = 1800  # 30 minutes


# ─────────────────────────────────────────────────────────────────────────────
# CORE MATCH ALGORITHM
# ─────────────────────────────────────────────────────────────────────────────

def _compute_match(
    student_skills: List[str],
    student_score: float,
    company: CompanyProfile,
) -> Dict[str, Any]:
    """
    Computes a match result between a student and a company.

    Algorithm:
      1. skill_match_pct = (student_skills ∩ company.must_have_skills).len
                           / company.must_have_skills.len × 100
         If must_have_skills is empty → 100% skill match
      2. score_readiness_pct = (student.score / company.min_score) × 100
         Capped at 100. If min_score = 0 → 100%
      3. match_score = (skill_match_pct × 0.6) + (score_readiness_pct × 0.4)
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# STUDENT SELECTS A COMPANY
# ─────────────────────────────────────────────────────────────────────────────

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

    student_skills = student.skills.get("acquired", [])
    student_score = student.overall_score or 0.0
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
    await redis_client.delete(cache_key)

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


# ─────────────────────────────────────────────────────────────────────────────
# FETCH TARGET COMPANIES FOR STUDENT (GET endpoint)
# ─────────────────────────────────────────────────────────────────────────────

async def get_target_companies(student_id: str) -> Dict[str, Any]:
    """
    Returns the full target company list for a student.
    Uses Redis cache (TTL 30 min). Cache invalidated on any update.
    """
    cache_key = f"matched_companies:{student_id}"

    cached = await redis_client.get(cache_key)
    if cached:
        logger.info(f"Cache HIT for matched_companies:{student_id}")
        return json.loads(cached)

    logger.info(f"Cache MISS — computing matches for student {student_id}")

    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not student:
        raise ValueError(f"Student profile not found: {student_id}")

    student_skills = student.skills.get("acquired", [])
    student_score = student.overall_score or 0.0
    student_role = student.primary_role or ""

    all_companies = await CompanyProfile.find(
        CompanyProfile.is_verified == True
    ).to_list()

    selected_records = await StudentTargetCompany.find(
        StudentTargetCompany.student_id == student_id
    ).to_list()
    selected_company_ids = {r.company_id for r in selected_records}

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

    await redis_client.setex(cache_key, MATCH_CACHE_TTL, json.dumps(result, default=str))
    return result


# ─────────────────────────────────────────────────────────────────────────────
# EVENT HANDLER — score.updated OR profile.updated
# ─────────────────────────────────────────────────────────────────────────────

async def on_score_or_profile_updated(student_id: str, event_bus) -> None:
    """
    Triggered by event bus when score.updated or profile.updated fires.
    Recomputes match for all selected companies and pushes via WebSocket.
    """
    logger.info(f"Recomputing target company matches for student {student_id}")

    await redis_client.delete(f"matched_companies:{student_id}")

    student = await StudentProfile.find_one(StudentProfile.student_id == student_id)
    if not student:
        return

    student_skills = student.skills.get("acquired", [])
    student_score = student.overall_score or 0.0

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


# ─────────────────────────────────────────────────────────────────────────────
# EVENT HANDLER — company.registered
# ─────────────────────────────────────────────────────────────────────────────

async def on_company_registered(company_id: str, event_bus) -> None:
    """
    When a new company registers and is verified, check all students who match.
    """
    company = await CompanyProfile.find_one(CompanyProfile.company_id == company_id)
    if not company or not company.is_verified:
        return

    query_filter = {}
    if company.required_roles:
        query_filter["primary_role"] = {"$in": company.required_roles}

    matching_students = await StudentProfile.find(query_filter).to_list()

    for student in matching_students:
        student_skills = student.skills.get("acquired", [])
        student_score = student.overall_score or 0.0
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
            await redis_client.delete(f"matched_companies:{student.student_id}")


# ─────────────────────────────────────────────────────────────────────────────
# UNSELECT COMPANY
# ─────────────────────────────────────────────────────────────────────────────

async def unselect_target_company(student_id: str, company_id: str) -> None:
    record = await StudentTargetCompany.find_one(
        StudentTargetCompany.student_id == student_id,
        StudentTargetCompany.company_id == company_id,
    )
    if record:
        await record.delete()
    await redis_client.delete(f"matched_companies:{student_id}")
```

---

## File 4 — `backend/app/api/routes/target_company.py`

```python
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_current_student
from app.schemas.target_company_schema import (
    SelectCompanyRequest,
    SelectCompanyResponse,
    TargetCompaniesResponse,
    CompanyProfileDetailOut,
)
from app.services import recruiting_service
from app.models.target_company import CompanyProfile
from app.models.job_requirement import JobRequirement
from app.core.event_bus import event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students/me/target-companies", tags=["Target Companies"])


@router.get("", response_model=TargetCompaniesResponse)
async def get_my_target_companies(
    current_student: dict = Depends(get_current_student),
):
    """
    Returns all matched and selected companies for the current student.
    Uses Redis cache (30 min TTL). Cache invalidated on score/profile updates.
    """
    try:
        result = await recruiting_service.get_target_companies(
            student_id=current_student["student_id"]
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error fetching target companies: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch target companies"
        )


@router.post("/select", response_model=SelectCompanyResponse)
async def select_target_company(
    body: SelectCompanyRequest,
    current_student: dict = Depends(get_current_student),
):
    """
    Student explicitly selects a company to target.
    Runs resume-vs-company match immediately and sends gap notification if needed.
    """
    try:
        match_result = await recruiting_service.select_target_company(
            student_id=current_student["student_id"],
            company_id=body.company_id,
            event_bus=event_bus,
        )
        return {
            "message": "Company added to your target list",
            "company_id": body.company_id,
            "match_result": match_result,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error selecting target company: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to select target company"
        )


@router.delete("/{company_id}")
async def unselect_target_company(
    company_id: str,
    current_student: dict = Depends(get_current_student),
):
    """Remove a company from the student's target list."""
    try:
        await recruiting_service.unselect_target_company(
            student_id=current_student["student_id"],
            company_id=company_id,
        )
        return {"message": f"Company {company_id} removed from your target list"}
    except Exception as e:
        logger.exception(f"Error unselecting company: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove target company"
        )


# ─── Company public profile endpoint ─────────────────────────────────────────

companies_router = APIRouter(prefix="/companies", tags=["Companies"])


@companies_router.get("/{company_id}/profile", response_model=CompanyProfileDetailOut)
async def get_company_profile(
    company_id: str,
    current_student: dict = Depends(get_current_student),
):
    """
    Full company profile: description, required skills, interview rounds, tips.
    Called when student clicks "View Company →" on a match card.
    """
    company = await CompanyProfile.find_one(
        CompanyProfile.company_id == company_id,
        CompanyProfile.is_verified == True,
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or not yet verified"
        )

    active_openings = await JobRequirement.find(
        JobRequirement.company_id == company_id,
        JobRequirement.status == "ACTIVE",
    ).count()

    return {
        "company_id": company.company_id,
        "name": company.name,
        "logo_emoji": company.logo_emoji,
        "logo_url": company.logo_url,
        "industry": company.industry,
        "website": company.website,
        "headquarters": company.headquarters,
        "description": company.description,
        "required_roles": company.required_roles,
        "must_have_skills": company.must_have_skills,
        "nice_to_have_skills": company.nice_to_have_skills,
        "min_score": company.min_score,
        "interview_rounds": [r.dict() for r in company.interview_rounds],
        "interview_tips": company.interview_tips,
        "active_openings": active_openings,
        "is_verified": company.is_verified,
    }


@companies_router.get("", response_model=list)
async def list_verified_companies(
    role: str = None,
    current_student: dict = Depends(get_current_student),
):
    """
    List all verified companies (used for student to browse and select).
    """
    companies = await CompanyProfile.find(CompanyProfile.is_verified == True).to_list()

    if role:
        companies = [
            c for c in companies
            if not c.required_roles or role.lower() in [r.lower() for r in c.required_roles]
        ]

    return [
        {
            "company_id": c.company_id,
            "name": c.name,
            "logo_emoji": c.logo_emoji,
            "logo_url": c.logo_url,
            "industry": c.industry,
            "headquarters": c.headquarters,
            "required_roles": c.required_roles,
            "must_have_skills": c.must_have_skills,
            "min_score": c.min_score,
            "active_openings": c.active_openings_count,
        }
        for c in companies
    ]
```

---

## File 5 — `backend/app/models/job_requirement.py`

```python
from beanie import Document
from pydantic import Field
from typing import List, Optional
from datetime import datetime, timezone


class JobRequirement(Document):
    """Job posting by a verified company."""
    job_id: str
    company_id: str                          # FK → CompanyProfile.company_id
    title: str
    role_id: str                             # e.g. "backend"
    description: Optional[str] = None
    min_score: float = 0.0
    location: Optional[str] = None
    work_mode: Optional[str] = None          # "hybrid" | "remote" | "office"
    ctc_range: Optional[str] = None
    experience: Optional[str] = None
    required_skills: List[str] = []
    nice_to_have: List[str] = []
    deadline: Optional[datetime] = None
    openings_count: int = 1
    status: str = "ACTIVE"                   # "ACTIVE" | "CLOSED"
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "job_requirements"
```

---

## File 6 — `backend/app/core/event_bus.py`

```python
"""
Redis Streams event bus for SkillDipz.
Publishers push events; consumers run as background async tasks.
"""
import json
import asyncio
import logging
from typing import Callable, Dict, List, Any
from app.core.database import redis_client

logger = logging.getLogger(__name__)


class EventBus:
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers.setdefault(event_type, []).append(handler)
        logger.info(f"EventBus: subscribed {handler.__name__} to {event_type}")

    async def publish(self, event_type: str, payload: Dict[str, Any]):
        """Publish event to Redis Stream and dispatch to local handlers."""
        stream_key = f"stream:{event_type}"
        await redis_client.xadd(
            stream_key,
            {"payload": json.dumps(payload, default=str)},
            maxlen=1000,
        )
        logger.info(f"EventBus: published {event_type}")

        for handler in self._handlers.get(event_type, []):
            asyncio.create_task(handler(payload))


event_bus = EventBus()


# ─── Register Target Company Event Handlers ──────────────────────────────────

async def _handle_score_updated(payload: Dict[str, Any]):
    from app.services import recruiting_service
    student_id = payload.get("student_id")
    if student_id:
        await recruiting_service.on_score_or_profile_updated(student_id, event_bus)


async def _handle_profile_updated(payload: Dict[str, Any]):
    from app.services import recruiting_service
    student_id = payload.get("student_id")
    if student_id:
        await recruiting_service.on_score_or_profile_updated(student_id, event_bus)


async def _handle_company_registered(payload: Dict[str, Any]):
    from app.services import recruiting_service
    company_id = payload.get("company_id")
    if company_id:
        await recruiting_service.on_company_registered(company_id, event_bus)


async def _handle_company_gap_detected(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"Skill gap detected for {payload['company_name']}",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_gap",
    )


async def _handle_company_now_eligible(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"You're now eligible for {payload['company_name']}!",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_eligible",
    )


async def _handle_company_new_match(payload: Dict[str, Any]):
    from app.services.notification_service import send_notification
    await send_notification(
        student_id=payload["student_id"],
        title=f"New company match: {payload['company_name']}",
        body=payload["notification_body"],
        action_url=payload.get("action_url", "/student/target-company"),
        notification_type="company_new_match",
    )


def register_target_company_handlers():
    event_bus.subscribe("score.updated", _handle_score_updated)
    event_bus.subscribe("profile.updated", _handle_profile_updated)
    event_bus.subscribe("company.registered", _handle_company_registered)
    event_bus.subscribe("company.gap_detected", _handle_company_gap_detected)
    event_bus.subscribe("company.now_eligible", _handle_company_now_eligible)
    event_bus.subscribe("company.new_match", _handle_company_new_match)
```

---

## File 7 — `backend/app/api/routes/company_admin.py`

```python
"""
Company registration and job posting routes.
Companies register → admin verifies → company posts jobs → students auto-matched.
"""
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
```

---

## File 8 — `frontend/src/lib/targetCompanyApi.ts`

```typescript
import api from "@/lib/api";
import type {
  TargetCompaniesResponse,
  SelectCompanyResponse,
  CompanyProfileDetail,
  VerifiedCompany,
} from "@/types/targetCompany";

/**
 * Fetch all matched and selected companies for the current student.
 * Served from Redis cache (30 min TTL) — refreshed on score/profile update.
 */
export const getTargetCompanies = async (): Promise<TargetCompaniesResponse> => {
  const { data } = await api.get<TargetCompaniesResponse>(
    "/students/me/target-companies"
  );
  return data;
};

/**
 * Student explicitly selects a company to target.
 * Backend immediately runs resume match and returns result.
 */
export const selectTargetCompany = async (
  company_id: string
): Promise<SelectCompanyResponse> => {
  const { data } = await api.post<SelectCompanyResponse>(
    "/students/me/target-companies/select",
    { company_id }
  );
  return data;
};

/**
 * Remove a company from the student's target list.
 */
export const unselectTargetCompany = async (company_id: string): Promise<void> => {
  await api.delete(`/students/me/target-companies/${company_id}`);
};

/**
 * Full company profile: description, required skills, interview rounds, tips.
 */
export const getCompanyProfile = async (
  company_id: string
): Promise<CompanyProfileDetail> => {
  const { data } = await api.get<CompanyProfileDetail>(
    `/companies/${company_id}/profile`
  );
  return data;
};

/**
 * List all verified companies on the platform (for student to browse and select).
 */
export const listVerifiedCompanies = async (
  role?: string
): Promise<VerifiedCompany[]> => {
  const params = role ? { role } : {};
  const { data } = await api.get<VerifiedCompany[]>("/companies", { params });
  return data;
};
```

---

## File 9 — `frontend/src/types/targetCompany.ts`

```typescript
export type EligibilityStatus =
  | "eligible"
  | "not_yet"
  | "skill_gap"
  | "full_match";

export interface InterviewRound {
  order: number;
  name: string;
  description?: string;
  duration_mins?: number;
}

export interface MatchedCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  website?: string;
  headquarters?: string;
  min_score: number;
  your_score: number;
  eligible: boolean;
  eligibility_status: EligibilityStatus;
  skill_match_pct: number;
  score_readiness_pct: number;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  interview_rounds: InterviewRound[];
  active_openings: number;
  match_rank: number;
  selected_by: "student" | "auto_suggested";
  last_recomputed_at?: string;
}

export interface NotYetEligibleCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  min_score: number;
  your_score: number;
  score_gap: number;
  missing_skills: string[];
  active_openings: number;
}

export interface TargetCompaniesResponse {
  student_score: number;
  student_role: string;
  selected_companies: MatchedCompany[];
  auto_suggested: MatchedCompany[];
  companies_not_yet_eligible: NotYetEligibleCompany[];
  last_updated_at?: string;
}

export interface SelectCompanyResponse {
  message: string;
  company_id: string;
  match_result: MatchedCompany;
}

export interface CompanyProfileDetail {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  website?: string;
  headquarters?: string;
  description?: string;
  required_roles: string[];
  must_have_skills: string[];
  nice_to_have_skills: string[];
  min_score: number;
  interview_rounds: InterviewRound[];
  interview_tips?: string;
  active_openings: number;
  is_verified: boolean;
}

export interface VerifiedCompany {
  company_id: string;
  name: string;
  logo_emoji?: string;
  logo_url?: string;
  industry: string;
  headquarters?: string;
  required_roles: string[];
  must_have_skills: string[];
  min_score: number;
  active_openings: number;
}
```

---

## File 10 — `frontend/src/hooks/useTargetCompanies.ts`

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import {
  getTargetCompanies,
  selectTargetCompany,
  unselectTargetCompany,
} from "@/lib/targetCompanyApi";
import type { TargetCompaniesResponse, MatchedCompany } from "@/types/targetCompany";

interface UseTargetCompaniesReturn {
  data: TargetCompaniesResponse | null;
  isLoading: boolean;
  error: string | null;
  selectCompany: (company_id: string) => Promise<MatchedCompany>;
  removeCompany: (company_id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTargetCompanies(): UseTargetCompaniesReturn {
  const [data, setData] = useState<TargetCompaniesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getTargetCompanies();
      if (isMounted.current) setData(result);
    } catch (err: any) {
      if (isMounted.current)
        setError(err?.response?.data?.detail || "Failed to load target companies");
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, [fetchData]);

  // Real-time WebSocket: update companies when score changes
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (payload: TargetCompaniesResponse) => {
      if (isMounted.current) setData(payload);
    };
    socket.on("target_companies_updated", handleUpdate);
    return () => { socket.off("target_companies_updated", handleUpdate); };
  }, [socket]);

  const selectCompany = useCallback(async (company_id: string): Promise<MatchedCompany> => {
    const response = await selectTargetCompany(company_id);
    await fetchData();
    return response.match_result;
  }, [fetchData]);

  const removeCompany = useCallback(async (company_id: string): Promise<void> => {
    await unselectTargetCompany(company_id);
    await fetchData();
  }, [fetchData]);

  return { data, isLoading, error, selectCompany, removeCompany, refresh: fetchData };
}
```

---

## File 11 — `frontend/src/app/student/target-company/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useTargetCompanies } from "@/hooks/useTargetCompanies";
import { listVerifiedCompanies, getCompanyProfile } from "@/lib/targetCompanyApi";
import type {
  MatchedCompany,
  NotYetEligibleCompany,
  CompanyProfileDetail,
  VerifiedCompany,
} from "@/types/targetCompany";
import CompanyMatchCard from "@/components/target-company/CompanyMatchCard";
import CompanyDetailModal from "@/components/target-company/CompanyDetailModal";
import CompanyBrowserModal from "@/components/target-company/CompanyBrowserModal";
import NotYetEligibleCard from "@/components/target-company/NotYetEligibleCard";
import { Loader2, Plus, RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

export default function TargetCompanyPage() {
  const { data, isLoading, error, selectCompany, removeCompany, refresh } =
    useTargetCompanies();

  const [selectedCompanyDetail, setSelectedCompanyDetail] =
    useState<CompanyProfileDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSelectingCompany, setIsSelectingCompany] = useState<string | null>(null);

  const handleViewCompany = async (company_id: string) => {
    setIsDetailLoading(true);
    setIsDetailModalOpen(true);
    try {
      const profile = await getCompanyProfile(company_id);
      setSelectedCompanyDetail(profile);
    } catch {
      toast.error("Failed to load company profile");
      setIsDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSelectFromBrowser = async (company_id: string) => {
    setIsSelectingCompany(company_id);
    try {
      const result = await selectCompany(company_id);
      toast.success(`${result.name} added to your target list!`);
      if (result.missing_skills.length > 0) {
        toast.info(
          `You're missing: ${result.missing_skills.slice(0, 2).join(", ")}. Check your roadmap.`,
          { duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add company");
    } finally {
      setIsSelectingCompany(null);
    }
  };

  const handleRemoveCompany = async (company_id: string, company_name: string) => {
    try {
      await removeCompany(company_id);
      toast.success(`${company_name} removed from your target list`);
    } catch {
      toast.error("Failed to remove company");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-400">Loading your matched companies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const {
    student_score = 0,
    student_role = "",
    selected_companies = [],
    auto_suggested = [],
    companies_not_yet_eligible = [],
    last_updated_at,
  } = data || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Target className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Target Companies</h1>
          </div>
          <p className="text-slate-400 mt-1 text-sm">
            Your score:{" "}
            <span className="text-indigo-400 font-semibold">{student_score}</span>
            {" · "}Role:{" "}
            <span className="text-indigo-400 font-semibold capitalize">
              {student_role}
            </span>
            {last_updated_at && (
              <span className="ml-2 text-slate-500 text-xs">
                · Updated {new Date(last_updated_at).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setIsBrowserModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition"
          >
            <Plus className="w-4 h-4" /> Add Company
          </button>
        </div>
      </div>

      {/* Selected Companies */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Your Target Companies
          <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-900 text-indigo-300 rounded-full">
            {selected_companies.length}
          </span>
        </h2>

        {selected_companies.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center">
            <Target className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 text-sm">
              You haven't selected any target companies yet.
            </p>
            <button
              onClick={() => setIsBrowserModalOpen(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition"
            >
              Browse Companies →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {selected_companies.map((company) => (
              <CompanyMatchCard
                key={company.company_id}
                company={company}
                onViewCompany={() => handleViewCompany(company.company_id)}
                onRemove={() =>
                  handleRemoveCompany(company.company_id, company.name)
                }
                showRemoveButton
              />
            ))}
          </div>
        )}
      </section>

      {/* Auto-Suggested Companies */}
      {auto_suggested.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">
            ✨ Companies You Might Not Know About
          </h2>
          <p className="text-slate-500 text-xs mb-4">
            Platform found these matches based on your resume — you haven't
            selected them yet.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auto_suggested.map((company) => (
              <CompanyMatchCard
                key={company.company_id}
                company={company}
                onViewCompany={() => handleViewCompany(company.company_id)}
                onSelect={() => handleSelectFromBrowser(company.company_id)}
                isSelecting={isSelectingCompany === company.company_id}
                showSelectButton
                badgeText="Auto-Match"
              />
            ))}
          </div>
        </section>
      )}

      {/* Improve to Unlock */}
      {companies_not_yet_eligible.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">
            🔒 Improve to Unlock
          </h2>
          <p className="text-slate-500 text-xs mb-4">
            Increase your employability score to become eligible for these
            companies.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {companies_not_yet_eligible.map((company) => (
              <NotYetEligibleCard key={company.company_id} company={company} />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <CompanyDetailModal
        isOpen={isDetailModalOpen}
        isLoading={isDetailLoading}
        company={selectedCompanyDetail}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedCompanyDetail(null);
        }}
      />

      <CompanyBrowserModal
        isOpen={isBrowserModalOpen}
        studentRole={student_role}
        selectedCompanyIds={
          new Set(selected_companies.map((c) => c.company_id))
        }
        onSelect={handleSelectFromBrowser}
        isSelecting={isSelectingCompany}
        onClose={() => setIsBrowserModalOpen(false)}
      />
    </div>
  );
}
```

---

## File 12 — `frontend/src/components/target-company/CompanyMatchCard.tsx`

```tsx
"use client";

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Plus,
  Briefcase,
} from "lucide-react";
import type { MatchedCompany } from "@/types/targetCompany";

interface CompanyMatchCardProps {
  company: MatchedCompany;
  onViewCompany: () => void;
  onRemove?: () => void;
  onSelect?: () => void;
  isSelecting?: boolean;
  showRemoveButton?: boolean;
  showSelectButton?: boolean;
  badgeText?: string;
}

const statusConfig = {
  full_match: {
    icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    color: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-700/30",
  },
  eligible: {
    icon: <CheckCircle className="w-4 h-4 text-blue-400" />,
    color: "text-blue-400",
    bg: "bg-blue-950/40 border-blue-700/30",
  },
  skill_gap: {
    icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
    color: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-700/30",
  },
  not_yet: {
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    color: "text-red-400",
    bg: "bg-red-950/40 border-red-700/30",
  },
};

function SkillBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function CompanyMatchCard({
  company,
  onViewCompany,
  onRemove,
  onSelect,
  isSelecting,
  showRemoveButton,
  showSelectButton,
  badgeText,
}: CompanyMatchCardProps) {
  const status = statusConfig[company.eligibility_status] ?? statusConfig.not_yet;

  return (
    <div
      className={`relative rounded-xl border p-5 space-y-4 transition-all hover:shadow-lg hover:shadow-indigo-900/20 ${status.bg}`}
    >
      {badgeText && (
        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-indigo-900/60 text-indigo-300 border border-indigo-700/40 rounded-full">
          {badgeText}
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-10 h-10 object-contain rounded"
            />
          ) : (
            company.logo_emoji || "🏢"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-base truncate">
              {company.name}
            </h3>
            {status.icon}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {company.industry}
            {company.headquarters && ` · ${company.headquarters}`}
          </p>
        </div>
      </div>

      {/* Match Score Bars */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Skill Match</span>
            <span className={status.color}>
              {company.skill_match_pct.toFixed(0)}%
            </span>
          </div>
          <SkillBar
            pct={company.skill_match_pct}
            colorClass={
              company.skill_match_pct >= 80
                ? "bg-emerald-500"
                : company.skill_match_pct >= 50
                ? "bg-amber-500"
                : "bg-red-500"
            }
          />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Score</span>
            <span className={company.eligible ? "text-emerald-400" : "text-red-400"}>
              {company.your_score}/{company.min_score}
              {company.eligible ? " ✅" : " ❌"}
            </span>
          </div>
          <SkillBar
            pct={company.score_readiness_pct}
            colorClass={company.eligible ? "bg-emerald-500" : "bg-red-500"}
          />
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-1.5">
        {company.matched_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.matched_skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 rounded-full"
              >
                ✓ {s}
              </span>
            ))}
          </div>
        )}
        {company.missing_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.missing_skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 bg-red-900/40 border border-red-700/40 text-red-300 rounded-full"
              >
                ✗ {s}
              </span>
            ))}
            {company.missing_skills.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">
                +{company.missing_skills.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interview Rounds */}
      {company.interview_rounds.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Interview Process:</p>
          <div className="flex flex-wrap gap-1">
            {company.interview_rounds.map((round) => (
              <span
                key={round.order}
                className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700"
              >
                {round.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Briefcase className="w-3.5 h-3.5" />
          <span>
            {company.active_openings} open position
            {company.active_openings !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {showRemoveButton && onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-slate-500 hover:text-red-400 transition rounded"
              title="Remove from targets"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {showSelectButton && onSelect && (
            <button
              onClick={onSelect}
              disabled={isSelecting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-60"
            >
              {isSelecting ? (
                <span className="animate-pulse">Adding…</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add
                </>
              )}
            </button>
          )}
          <button
            onClick={onViewCompany}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## File 13 — `frontend/src/components/target-company/NotYetEligibleCard.tsx`

```tsx
"use client";

import { Lock, TrendingUp } from "lucide-react";
import type { NotYetEligibleCompany } from "@/types/targetCompany";
import Link from "next/link";

interface Props {
  company: NotYetEligibleCompany;
}

export default function NotYetEligibleCard({ company }: Props) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 flex items-start gap-4 hover:border-slate-600 transition">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl flex-shrink-0 opacity-60">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-8 h-8 object-contain rounded"
          />
        ) : (
          company.logo_emoji || "🏢"
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="font-medium text-slate-300 text-sm">{company.name}</h3>
          <span className="text-xs text-slate-500">· {company.industry}</span>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span>
            Required:{" "}
            <span className="text-red-400 font-medium">{company.min_score}</span>
          </span>
          <span>
            Your score:{" "}
            <span className="text-slate-300">{company.your_score}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <TrendingUp className="w-3 h-3" />
            +{company.score_gap} pts needed
          </span>
        </div>

        {company.missing_skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {company.missing_skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/student/roadmap"
        className="flex-shrink-0 text-xs px-3 py-1.5 border border-indigo-700/50 text-indigo-400 hover:bg-indigo-950 rounded-lg transition"
      >
        Improve →
      </Link>
    </div>
  );
}
```

---

## File 14 — `frontend/src/components/target-company/CompanyDetailModal.tsx`

```tsx
"use client";

import { X, Globe, MapPin, Loader2 } from "lucide-react";
import type { CompanyProfileDetail } from "@/types/targetCompany";

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  company: CompanyProfileDetail | null;
  onClose: () => void;
}

export default function CompanyDetailModal({
  isOpen,
  isLoading,
  company,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : company ? (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center text-3xl flex-shrink-0">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-14 h-14 object-contain rounded"
                  />
                ) : (
                  company.logo_emoji || "🏢"
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{company.name}</h2>
                <p className="text-slate-400 text-sm">{company.industry}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                  {company.headquarters && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {company.headquarters}
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-400 hover:underline"
                    >
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">About</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {company.description}
                </p>
              </div>
            )}

            {/* Required Skills */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Required Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.must_have_skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 text-xs bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Nice-to-Have */}
            {company.nice_to_have_skills.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">
                  Nice-to-Have
                </h3>
                <div className="flex flex-wrap gap-2">
                  {company.nice_to_have_skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Min Score */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-xl">
              <span className="text-sm text-slate-400">
                Min. Employability Score:
              </span>
              <span className="text-lg font-bold text-white">
                {company.min_score}
              </span>
              <span className="text-xs text-slate-500">
                · {company.active_openings} open positions
              </span>
            </div>

            {/* Interview Rounds */}
            {company.interview_rounds.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Interview Process
                </h3>
                <div className="space-y-2">
                  {company.interview_rounds.map((round, idx) => (
                    <div
                      key={round.order}
                      className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/40"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {round.name}
                        </p>
                        {round.description && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {round.description}
                          </p>
                        )}
                        {round.duration_mins && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Duration: {round.duration_mins} mins
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview Tips */}
            {company.interview_tips && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">
                  Interview Tips
                </h3>
                <div className="p-3 bg-amber-950/30 border border-amber-700/30 rounded-lg text-xs text-amber-200 leading-relaxed whitespace-pre-wrap">
                  {company.interview_tips}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500">
            Company not found
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## File 15 — `frontend/src/components/target-company/CompanyBrowserModal.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, CheckCircle, Plus } from "lucide-react";
import { listVerifiedCompanies } from "@/lib/targetCompanyApi";
import type { VerifiedCompany } from "@/types/targetCompany";

interface Props {
  isOpen: boolean;
  studentRole: string;
  selectedCompanyIds: Set<string>;
  onSelect: (company_id: string) => void;
  isSelecting: string | null;
  onClose: () => void;
}

export default function CompanyBrowserModal({
  isOpen,
  studentRole,
  selectedCompanyIds,
  onSelect,
  isSelecting,
  onClose,
}: Props) {
  const [companies, setCompanies] = useState<VerifiedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAll, setFilterAll] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await listVerifiedCompanies(
          filterAll ? undefined : studentRole
        );
        setCompanies(data);
      } catch {
        // Silent — empty list
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, filterAll, studentRole]);

  if (!isOpen) return null;

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Browse Companies</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setFilterAll(true)}
              className={`px-3 py-1.5 rounded-full border transition ${
                filterAll
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              All Companies
            </button>
            <button
              onClick={() => setFilterAll(false)}
              className={`px-3 py-1.5 rounded-full border transition ${
                !filterAll
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              Matching My Role
            </button>
          </div>
        </div>

        {/* Company List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No companies found matching your search.
            </div>
          ) : (
            filtered.map((company) => {
              const isSelected = selectedCompanyIds.has(company.company_id);
              const isCurrentlySelecting =
                isSelecting === company.company_id;

              return (
                <div
                  key={company.company_id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-slate-600 transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl flex-shrink-0">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    ) : (
                      company.logo_emoji || "🏢"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {company.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {company.industry}
                      {company.headquarters && ` · ${company.headquarters}`}
                    </p>
                    {company.must_have_skills.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Needs:{" "}
                        {company.must_have_skills.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-slate-500">
                      Min: {company.min_score}
                    </span>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelect(company.company_id)}
                        disabled={isCurrentlySelecting}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-60"
                      >
                        {isCurrentlySelecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Select
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## File 16 — New Events Added to Event Bus

```
Updated event catalog (additions to Section 16 of spec):

EVENT: company.gap_detected (NEW)
  Publisher:  Recruiting Service (on company selection)
  Consumers:  Notification Service
  Payload:    {
    student_id, company_id, company_name,
    missing_skills[], notification_body, action_url
  }

EVENT: company.now_eligible (NEW)
  Publisher:  Recruiting Service (on score.updated recompute)
  Consumers:  Notification Service
  Payload:    {
    student_id, company_id, company_name,
    notification_body, action_url
  }

EVENT: company.new_match (NEW)
  Publisher:  Recruiting Service (on company.registered)
  Consumers:  Notification Service
  Payload:    {
    student_id, company_id, company_name,
    match_score, notification_body, action_url
  }

EVENT: company.registered (EXISTING — now also triggers student auto-match)
  Publisher:  Admin Service (on company verification)
  Consumers:  Recruiting Service (find matching students + notify)
  Payload:    { company_id, company_name }
```

---

## File 17 — New MongoDB Collections (Additions to Section 17 of spec)

```
New collections added:

CompanyProfile (company_profiles):
  {
    company_id: string (slug, unique index),
    name: string,
    logo_emoji: string | null,
    logo_url: string | null,           ← S3/CDN URL for logo image
    industry: string,
    website: string | null,
    description: string | null,
    headquarters: string | null,
    required_roles: string[],          ← e.g. ["backend", "fullstack"]
    must_have_skills: string[],        ← union of all active job required_skills
    nice_to_have_skills: string[],
    min_score: number,
    interview_rounds: [{
      order: number,
      name: string,
      description: string | null,
      duration_mins: number | null
    }],
    interview_tips: string | null,     ← markdown text
    is_verified: boolean,
    active_openings_count: number,
    registered_at: datetime
  }

StudentTargetCompany (student_target_companies):
  {
    student_id: string,
    company_id: string,
    selected_at: datetime,
    selected_by: "student" | "auto_suggested",
    match_score: number,               ← 0-100 composite
    skill_match_pct: number,
    score_readiness_pct: number,
    eligibility_status: enum,
    matched_skills: string[],
    missing_skills: string[],
    match_rank: number,
    last_recomputed_at: datetime | null,
    notification_sent: boolean
  }

Indexes:
  db.student_target_companies.createIndex(
    { student_id: 1, company_id: 1 }, { unique: true }
  )
  db.company_profiles.createIndex({ company_id: 1 }, { unique: true })
  db.company_profiles.createIndex({ is_verified: 1 })
  db.company_profiles.createIndex({ required_roles: 1 })
```

---

## File 18 — New API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/v1/students/me/target-companies` | Student Bearer | Get all matched/selected companies (Redis cached) |
| POST | `/v1/students/me/target-companies/select` | Student Bearer | Select a company + run immediate match |
| DELETE | `/v1/students/me/target-companies/{company_id}` | Student Bearer | Unselect a company |
| GET | `/v1/companies` | Student Bearer | List all verified companies (for browse modal) |
| GET | `/v1/companies/{company_id}/profile` | Student Bearer | Full company profile + interview rounds |
| POST | `/v1/companies/me/register` | Company Bearer | Company registers on platform |
| POST | `/v1/companies/me/jobs` | Company Bearer | Company posts a job (updates must_have_skills) |
| POST | `/v1/admin/companies/{company_id}/verify` | Admin Bearer | Admin verifies a company |

---

## File 19 — Redis Cache Keys

```
matched_companies:{studentId}
  Type:    JSON string
  TTL:     1800 seconds (30 min)
  Set by:  get_target_companies() in recruiting_service.py
  Deleted: on score.updated, profile.updated,
           student selects/unselects a company

company_profile:{companyId}
  Type:    JSON string
  TTL:     3600 seconds (1 hour)
  Set by:  GET /companies/:id/profile handler
  Deleted: when company updates profile or posts new jobs
```

---

## File 20 — `backend/main.py` additions

```python
# Add these imports and registrations in main.py:

from app.api.routes.target_company import router as target_company_router
from app.api.routes.target_company import companies_router
from app.api.routes.company_admin import router as company_admin_router
from app.api.routes.company_admin import admin_router
from app.core.event_bus import register_target_company_handlers

app.include_router(target_company_router, prefix="/v1")
app.include_router(companies_router, prefix="/v1")
app.include_router(company_admin_router, prefix="/v1")
app.include_router(admin_router, prefix="/v1")

@app.on_event("startup")
async def on_startup():
    # ... existing startup code ...
    register_target_company_handlers()
```

---

## Verification Plan

### Backend Tests

```bash
# 1. Company registration + verification
POST /v1/companies/me/register { company_id: "razorpay", required_roles: ["backend"], ... }
POST /v1/admin/companies/razorpay/verify
# Expected: company.registered event fires → matching students notified

# 2. Student selects company with skill gaps
POST /v1/students/me/target-companies/select { company_id: "google" }
# Expected:
#   - match_result.eligibility_status = "skill_gap"
#   - missing_skills is not empty
#   - company.gap_detected event fires
#   - Notification sent to student with roadmap link

# 3. Student selects eligible company
POST /v1/students/me/target-companies/select { company_id: "razorpay" }
# Expected:
#   - match_result.eligibility_status = "eligible" or "full_match"
#   - matched_skills populated

# 4. Redis cache test
GET /v1/students/me/target-companies   ← Cache MISS (computes + stores)
GET /v1/students/me/target-companies   ← Cache HIT (from Redis)

# 5. Score update triggers recompute (via event bus)
# Fire score.updated event for student →
GET /v1/students/me/target-companies   ← Returns fresh data (cache was cleared)
# If student now passes company.min_score → company.now_eligible event fires

# 6. Unselect company
DELETE /v1/students/me/target-companies/razorpay
GET /v1/students/me/target-companies
# Expected: Razorpay no longer in selected_companies;
#           may appear in auto_suggested if still a match
```

### Frontend Verification

```
1. Open /student/target-company
   ✓ Shows selected_companies grid
   ✓ Shows auto_suggested section if platform found matches
   ✓ Shows companies_not_yet_eligible at bottom with score gap

2. Click "Add Company" → Company Browser Modal opens
   ✓ GET /companies fetches all verified companies
   ✓ Search filters by name/industry
   ✓ "Matching My Role" filter calls GET /companies?role={studentRole}
   ✓ Already-selected companies show "Added ✓" (button disabled)

3. Select a company with skill gaps
   ✓ Toast: "{Company} added to your target list!"
   ✓ Toast info: "You're missing: DSA, System Design. Check your roadmap."
   ✓ Company appears in selected_companies with red ✗ tags for missing skills

4. Click "View" → CompanyDetailModal opens
   ✓ GET /companies/{id}/profile loads full profile
   ✓ Shows description, required skills, nice-to-have, interview rounds, tips

5. Score updates via WebSocket
   ✓ target_companies_updated event received
   ✓ Company cards re-render with new match percentages (no page reload)
   ✓ If newly eligible → eligibility_status changes color (red → green)

6. Remove a company
   ✓ Trash icon → DELETE /v1/students/me/target-companies/:id
   ✓ Company disappears from selected list instantly
   ✓ May reappear in auto_suggested if still a strong match (>= 50%)
```

---

> **All flows use real data from MongoDB + Redis + WebSocket.**
> **Zero mock data. Every match is computed from actual student resume skills vs actual company job requirements.**
