import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from app.api.dependencies import get_current_student
from app.services.job_hub_service import (
    get_jobs_for_student,
    get_job_detail,
    apply_to_job,
    get_job_filters,
)
from app.schemas.job_schema import (
    JobListResponse, JobDetailOut, ApplyJobResponse, JobFiltersResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Jobs Hub"])


@router.get("/filters", response_model=JobFiltersResponse)
async def job_filter_options(
    current_student: dict = Depends(get_current_student),
):
    """
    Returns distinct roles, locations, and work_modes from active jobs.
    Used to populate filter dropdowns with real data — no hardcoded values.
    """
    try:
        return await get_job_filters()
    except Exception as e:
        logger.error(f"Error fetching job filters: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("", response_model=JobListResponse)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    sort: str = Query("match_score", pattern="^(match_score|newest|highest_ctc)$"),
    role: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    show: str = Query("all", pattern="^(all|eligible|applied)$"),
    current_student: dict = Depends(get_current_student),
):
    """
    List active job postings matched to the student's profile.
    Results are sorted by profile_match_pct DESC by default.
    """
    try:
        result = await get_jobs_for_student(
            student_id=current_student["student_id"],
            page=page,
            page_size=page_size,
            sort=sort,
            role=role,
            location=location,
            work_mode=work_mode,
            show=show,
        )
        return result
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{job_id}", response_model=JobDetailOut)
async def job_detail(
    job_id: str,
    current_student: dict = Depends(get_current_student),
):
    """Fetch full details for a single job posting."""
    try:
        return await get_job_detail(job_id, current_student["student_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching job detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/{job_id}/apply", response_model=ApplyJobResponse)
async def apply_for_job(
    job_id: str,
    current_student: dict = Depends(get_current_student),
):
    """
    Student applies to a job posting.
    Validates eligibility (score >= min_score) before creating application.
    """
    try:
        return await apply_to_job(current_student["student_id"], job_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error applying to job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
