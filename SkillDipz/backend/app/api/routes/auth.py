import random
import logging
from app.core.redis_client import reset_rate_limit, check_rate_limit
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import httpx

from app.schemas.auth_schema import (
    RegisterRequest, LoginRequest, GoogleLoginRequest,
    RefreshRequest, LogoutRequest, AuthResponse, UserOut,
    MessageResponse, VerifyOTPRequest, ResendOTPRequest
)
from app.models.user import User
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings
from app.core.email_service import send_otp_email
from app.core.redis_client import store_otp, verify_otp, delete_otp

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer()


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def build_auth_response(user: User, needs_verification: bool = False) -> AuthResponse:
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
        needs_verification=needs_verification,
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


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest):
    existing = await User.find_one(User.email == body.email)

    if existing:
        if existing.is_verified:
            # Fully verified account — block registration
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please log in.",
            )
        # Unverified account (e.g. previous registration where OTP failed)
        # Update their details and resend OTP
        existing.password_hash = hash_password(body.password)
        existing.full_name = body.full_name
        existing.role = body.role
        existing.college = body.college
        existing.phone = body.phone
        existing.company_name = body.company_name
        existing.industry = body.industry
        await existing.save()

        otp = generate_otp()
        stored = await store_otp(body.email, otp)
        if stored:
            send_otp_email(body.email, otp, existing.full_name)
        else:
            logger.warning(f"Could not store OTP for {body.email} — Redis down.")

        return build_auth_response(existing, needs_verification=True)

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

    # Generate & send OTP
    otp = generate_otp()
    stored = await store_otp(body.email, otp)
    if stored:
        send_otp_email(body.email, otp, body.full_name)
    else:
        logger.warning(f"Could not store OTP for {body.email} — Redis down.")

    return build_auth_response(user, needs_verification=True)


# ── Verify OTP ────────────────────────────────────────────────────────────────

@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp_route(body: VerifyOTPRequest):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        # Already verified — just return tokens
        return build_auth_response(user)

    matched = await verify_otp(body.email, body.otp)
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please try again or request a new code.",
        )

    user.is_verified = True
    await user.save()
    return build_auth_response(user)


# ── Resend OTP ────────────────────────────────────────────────────────────────

@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(body: ResendOTPRequest):
    from app.core.redis_client import redis as _redis, OTP_PREFIX
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

    # Simple 60-second cooldown using a separate Redis key
    if _redis:
        cooldown_key = f"otp_cd:{body.email}"
        try:
            if await _redis.exists(cooldown_key):
                raise HTTPException(
                    status_code=429,
                    detail="Please wait 60 seconds before requesting another code.",
                )
            await _redis.setex(cooldown_key, 60, "1")
        except HTTPException:
            raise
        except Exception:
            pass

    await delete_otp(body.email)
    otp = generate_otp()
    stored = await store_otp(body.email, otp)
    if stored:
        send_otp_email(body.email, otp, user.full_name)
    return MessageResponse(message="A new verification code has been sent to your email.")


# ── Login ─────────────────────────────────────────────────────────────────────

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

    if not user.is_verified:
        # Resend OTP automatically on login attempt
        otp = generate_otp()
        stored = await store_otp(body.email, otp)
        if stored:
            send_otp_email(body.email, otp, user.full_name)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. A new verification code has been sent to your email.",
        )

    await reset_rate_limit(body.email)
    return build_auth_response(user)


# ── Google ────────────────────────────────────────────────────────────────────

@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest):
    token = body.id_token.strip()

    async with httpx.AsyncClient() as client:
        # 1. Try verifying as Google Access Token info
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?access_token={token}"
        )

        # 2. Try verifying as Google ID Token info
        if resp.status_code != 200:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
            )

        # 3. Try fetching Google UserInfo endpoint with Bearer header
        if resp.status_code != 200:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )

        if resp.status_code != 200:
            error_msg = resp.text
            logger.error(f"❌ Google Token Verification Failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google authentication failed: {resp.status_code} {error_msg}",
            )

        google_data = resp.json()

    google_id = google_data.get("sub") or google_data.get("id")
    email = google_data.get("email")
    full_name = google_data.get("name") or google_data.get("email", "").split("@")[0]
    avatar_url = google_data.get("picture")

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incomplete Google profile returned by Google.",
        )

    user = await User.find_one(User.email == email)
    desired_role = body.role if body.role in ["STUDENT", "COMPANY"] else "STUDENT"

    if user:
        if not user.google_id:
            user.google_id = google_id
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
        user.is_verified = True
        await user.save()
    else:
        user = User(
            email=email,
            google_id=google_id,
            full_name=full_name,
            avatar_url=avatar_url,
            role=desired_role,
            is_verified=True,
        )
        await user.insert()

    return build_auth_response(user)


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(body: RefreshRequest):
    from app.core.redis_client import is_token_blacklisted

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


# ── Logout ────────────────────────────────────────────────────────────────────

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

    return MessageResponse(message="Logged out successfully.")


# ── Me ────────────────────────────────────────────────────────────────────────

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

