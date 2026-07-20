from app.core.redis_client import reset_rate_limit
from app.core.redis_client import check_rate_limit
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import httpx

from app.schemas.auth_schema import (
    RegisterRequest, LoginRequest, GoogleLoginRequest,
    RefreshRequest, LogoutRequest, AuthResponse, UserOut, MessageResponse
)
from app.models.user import User
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer()


def build_auth_response(user: User) -> AuthResponse:
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return AuthResponse(
        user=UserOut(
            id=str(user.id),
            email=user.email,
            role=user.role,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_verified=user.is_verified,
            created_at=user.created_at,
            college=user.college,
            phone=user.phone,
            company_name=user.company_name,
            industry=user.industry,
        ),
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = await User.get(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


#  Register

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest):
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        college=body.college,
        phone=body.phone,
        company_name=body.company_name,
        industry=body.industry,
        is_verified=False,
    )
    await user.insert()
    return build_auth_response(user)


# Login
@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    await check_rate_limit(body.email)

    user = await User.find_one(User.email == body.email)

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if body.role and user.role != body.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as {user.role}, not {body.role}.",
        )
    await reset_rate_limit(body.email)
    return build_auth_response(user)

# Google


@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest):

    async with httpx.AsyncClient() as client:
        # 1. Try verifying it as an ID Token (standard for modern Google Sign-In)
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={body.id_token}"
        )

        if resp.status_code != 200:
            # 2. If that fails, try verifying it as an Access Token (OAuth2)
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {body.id_token}"},
            )

        if resp.status_code != 200:
            error_msg = resp.text
            print(f"❌ Google Token Verification Failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to verify Google token: {error_msg}"
            )
            
        google_data = resp.json()

    google_id = google_data.get("sub")
    email = google_data.get("email")
    full_name = google_data.get("name", "")
    avatar_url = google_data.get("picture")

    if not email or not google_id:
        raise HTTPException(
            status_code=400, detail="Incomplete Google profile")

    user = await User.find_one(User.email == email)
    if user:
        if not user.google_id:
            user.google_id = google_id
            user.avatar_url = user.avatar_url or avatar_url
            await user.save()

    else:
        user = User(
            email=email,
            google_id=google_id,
            full_name=full_name,
            avatar_url=avatar_url,
            role="STUDENT",
            is_verified=True,
        )
        await user.insert()

    return build_auth_response(user)

#  refresh


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(body: RefreshRequest):
    from app.core.redis_client import is_token_blacklisted

    #  Block blacklisted tokens (already logged out)
    if await is_token_blacklisted(body.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please login again.",
        )

    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )
    user = await User.get(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return build_auth_response(user)


# Logout - Redis blacklists the refresh token
@router.post("/logout", response_model=MessageResponse)
async def logout(body: LogoutRequest):

    from app.core.redis_client import blacklist_token
    from datetime import datetime, timezone

    payload = decode_token(body.refresh_token)
    if payload:
        exp = payload.get("exp", 0)
        remaining_ttl = int(exp - datetime.now(timezone.utc).timestamp())
        if remaining_ttl > 0:
            await blacklist_token(body.refresh_token, remaining_ttl)

    return MessageResponse(message="Logged out successfullt.")


# me

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        college=current_user.college,
        phone=current_user.phone,
        company_name=current_user.company_name,
        industry=current_user.industry,
    )
