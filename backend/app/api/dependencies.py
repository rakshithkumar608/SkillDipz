from fastapi import Depends, HTTPException, Request, status
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.company import Company
from app.core.config import settings
from app.core.redis_client import get_company_session


async def get_current_student(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Dependency that validates the bearer token and returns a dict with
    ``student_id`` (the MongoDB user _id as a string).

    Used by all target-company endpoints.
    """
    return {"student_id": str(current_user.id), "user": current_user}


async def get_current_company(
    request: Request,
) -> dict:
    """
    Dependency that validates:
    1. Company session cookie (`sdz.company.sid`) -> Reads Redis -> Fetches Company doc -> Confirms approval_status == "approved"
    2. Fallback: Checks legacy Bearer JWT / student cookie on User model.
    """
    # 1. Check Company Session Cookie
    session_id = request.cookies.get(settings.COMPANY_COOKIE_NAME)
    if session_id:
        session = await get_company_session(session_id)
        if session:
            company_id = session.get("company_id")
            company = await Company.get(company_id)
            if company:
                if company.approval_status != "approved":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Company account is pending approval.",
                    )
                return {
                    "company_id": str(company.id),
                    "company_name": company.company_name,
                    "email": company.email,
                    "company": company,
                    "user_id": str(company.id),
                }

    # 2. Fallback to legacy JWT token / User auth
    try:
        current_user = await get_current_user(request)
        role_lower = (current_user.role or "").lower()
        if role_lower in ("company", "company_admin", "admin"):
            company_id = current_user.company_name or str(current_user.id)
            return {
                "company_id": company_id,
                "company_name": current_user.company_name or "Company",
                "user_id": str(current_user.id),
                "user": current_user,
            }
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Company authentication required.",
    )


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Dependency that validates the bearer token and checks that the user is an admin.
    """
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires admin privileges",
        )
    return {"admin_id": str(current_user.id), "user": current_user}


async def get_current_mentor(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Dependency that validates the bearer token and checks that the user is a mentor or interviewer.
    """
    role_lower = (current_user.role or "").lower()
    if role_lower not in ("mentor", "interviewer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mentor or Interviewer privileges required",
        )
    return {"mentor_id": str(current_user.id), "user": current_user}
