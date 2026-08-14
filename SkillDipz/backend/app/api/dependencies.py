from fastapi import Depends, HTTPException, status
from app.api.routes.auth import get_current_user
from app.models.user import User


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
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Dependency that validates the bearer token and checks that the user is a company user.
    """
    role_lower = (current_user.role or "").lower()
    if role_lower not in ("company", "company_admin", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires company privileges",
        )
    company_id = current_user.company_name or str(current_user.id)
    return {
        "company_id": company_id, 
        "user_id": str(current_user.id),
        "user": current_user,
        }


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
