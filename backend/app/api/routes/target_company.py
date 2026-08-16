import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    refresh: bool = Query(False),
    current_student: dict = Depends(get_current_student),
):
    """
    Returns all matched and selected companies for the current student.
    Uses Redis cache (30 min TTL). Cache invalidated on score/profile updates.
    Pass ?refresh=true to bypass cache.
    """
    try:
        result = await recruiting_service.get_target_companies(
            student_id=current_student["student_id"],
            force_refresh=refresh,
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