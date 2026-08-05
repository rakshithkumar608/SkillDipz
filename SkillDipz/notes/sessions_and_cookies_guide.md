# SkillDipz — Sessions & Cookies Complete Implementation Guide

> Single source of truth for every session/cookie change — backend AND frontend.
> All code here is production-ready and directly matches the actual project files.

---

## ⚠️ BUGS FOUND IN CURRENT CODE (must fix before implementing)

| File | Bug |
|------|-----|
| `auth.py` | Duplicate `router = APIRouter(...)` at lines 33 & 36 — delete line 36 |
| `auth.py` | Duplicate imports: `User`, `settings`, `APIRouter` imported twice |
| `auth.py` | Stub `register` block (lines 79–96) with `User(...)` shadows the REAL register — delete it |
| `auth.py` | `get_current_user` reads Bearer token only — needs cookie-first logic |
| `auth.py` | `login`, `logout`, `verify-otp`, `google` don't create/destroy sessions or set cookies |
| `auth.py` | Imports `destroy_other_user_session` — typo, missing `s` at end |
| `redis_client.py` | Session functions declared BEFORE `redis = None` — crashes at runtime! |
| `redis_client.py` | Missing `get_user_sessions`, `destroy_other_user_sessions` |
| `redis_client.py` | Missing `save_draft_onboarding`, `get_draft_onboarding`, `clear_draft_onboarding` |
| `config.py` | Missing `COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `SESSION_EXPIRE_DAYS` |

---

## FILE 1 — `backend/app/core/config.py`

**What's missing:** Cookie and session settings don't exist yet. Add these 4 fields:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    MONGODB_URI: str
    REDIS_URL: str
    JWT_SECRET_KEY: str
    JWT_ACCESS_EXPIRATION_MINUTES: int = 30
    JWT_REFRESH_EXPIRATION_DAYS: int = 7
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    FRONTEND_URL: str = "http://localhost:3000"
    SMTP_EMAIL: str
    SMTP_PASSWORD: str
    YOUTUBE_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # ── NEW: Cookie / Session Settings ────────────────────────────────────────
    COOKIE_NAME: str = "session_id"
    COOKIE_SECURE: bool = False     # → True in production (HTTPS only)
    COOKIE_SAMESITE: str = "lax"   # Protects against CSRF
    SESSION_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## FILE 2 — `backend/app/core/redis_client.py`

**Critical fix:** `redis = None` MUST come first. All functions that reference `redis` must be declared AFTER it.

**What's missing in the current file:**
- `get_user_sessions` — completely missing
- `destroy_other_user_sessions` — completely missing
- `save_draft_onboarding` — completely missing
- `get_draft_onboarding` — completely missing
- `clear_draft_onboarding` — completely missing
- Session functions placed before `redis = None` causing a crash

Here is the complete correct file:

```python
import logging
import json
import uuid
import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError
from typing import Optional, List, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: redis must be declared FIRST. All functions below reference it.
# ─────────────────────────────────────────────────────────────────────────────
redis: aioredis.Redis | None = None


async def connect_redis():
    global redis
    try:
        redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=False,
        )
        await redis.ping()
        print("🚀 Redis Connected")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"⚠️  Redis unavailable at startup: {e}. Sessions & rate limiting disabled.")
        redis = None


async def close_redis():
    global redis
    if redis:
        try:
            await redis.aclose()
        except Exception:
            pass
        redis = None
        print("❌ Redis Connection Closed")


def get_redis() -> aioredis.Redis | None:
    return redis


# ── Key Prefixes & TTL Constants ──────────────────────────────────────────────
SESSION_PREFIX       = "session:"
USER_SESSIONS_PREFIX = "user_sessions:"
GUEST_SESSION_PREFIX = "guest:"
DRAFT_PROFILE_PREFIX = "draft_profile:"
BLACKLIST_PREFIX     = "bl:"
RATE_PREFIX          = "rl:"
OTP_PREFIX           = "otp:"

DEFAULT_SESSION_TTL  = 7 * 24 * 3600   # 7 days
GUEST_SESSION_TTL    = 3 * 24 * 3600   # 3 days
OTP_TTL_SECONDS      = 10 * 60         # 10 minutes
MAX_LOGIN_ATTEMPTS   = 5
LOCKOUT_SECONDS      = 15 * 60         # 15 minutes


# ══════════════════════════════════════════════════════════════════════════════
# 1. CORE USER SESSION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def create_session(
    user_id: str,
    role: str,
    email: str,
    ip_address: str = "",
    user_agent: str = "",
    ttl: int = DEFAULT_SESSION_TTL,
) -> str:
    """Creates a Redis session and registers it in the user's active session index."""
    if redis is None:
        return ""
    session_id = str(uuid.uuid4())
    session_data = {
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "email": email,
        "ip_address": ip_address,
        "user_agent": user_agent,
    }
    try:
        await redis.setex(f"{SESSION_PREFIX}{session_id}", ttl, json.dumps(session_data))
        await redis.sadd(f"{USER_SESSIONS_PREFIX}{user_id}", session_id)
        await redis.expire(f"{USER_SESSIONS_PREFIX}{user_id}", ttl)
        return session_id
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return ""


async def get_session(session_id: str) -> Optional[dict]:
    """Fetches session data from Redis. Returns None if expired or not found."""
    if redis is None or not session_id:
        return None
    try:
        raw = await redis.get(f"{SESSION_PREFIX}{session_id}")
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.error(f"Error reading session: {e}")
        return None


async def destroy_session(session_id: str) -> bool:
    """Deletes a session and removes it from the user's active session index."""
    if redis is None or not session_id:
        return False
    try:
        session_data = await get_session(session_id)
        if session_data:
            await redis.srem(f"{USER_SESSIONS_PREFIX}{session_data.get('user_id')}", session_id)
        await redis.delete(f"{SESSION_PREFIX}{session_id}")
        return True
    except Exception as e:
        logger.error(f"Error destroying session: {e}")
        return False


# ─── MISSING IN CURRENT FILE ─────────────────────────────────────────────────

async def get_user_sessions(user_id: str) -> List[Dict]:
    """
    Returns metadata for ALL active sessions (logged-in devices) for a user.
    Used by GET /auth/sessions to show the user their active devices.
    Auto-cleans stale session IDs from the index.
    """
    if redis is None or not user_id:
        return []
    try:
        session_ids = await redis.smembers(f"{USER_SESSIONS_PREFIX}{user_id}")
        sessions = []
        for sid in session_ids:
            data = await get_session(sid)
            if data:
                sessions.append(data)
            else:
                # Clean up expired/stale session ID from the set
                await redis.srem(f"{USER_SESSIONS_PREFIX}{user_id}", sid)
        return sessions
    except Exception as e:
        logger.error(f"Error fetching user sessions: {e}")
        return []


async def destroy_other_user_sessions(user_id: str, current_session_id: str) -> int:
    """
    Destroys ALL sessions for a user EXCEPT the current one.
    Used by POST /auth/sessions/revoke-others ("Log out of all other devices").
    Returns the count of sessions revoked.
    """
    if redis is None:
        return 0
    count = 0
    try:
        session_ids = await redis.smembers(f"{USER_SESSIONS_PREFIX}{user_id}")
        for sid in session_ids:
            if sid != current_session_id:
                await redis.delete(f"{SESSION_PREFIX}{sid}")
                await redis.srem(f"{USER_SESSIONS_PREFIX}{user_id}", sid)
                count += 1
    except Exception as e:
        logger.error(f"Error revoking other sessions: {e}")
    return count


# ══════════════════════════════════════════════════════════════════════════════
# 2. ANONYMOUS GUEST SESSION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def create_guest_session() -> str:
    """Creates a temporary Redis session for unauthenticated visitors."""
    if redis is None:
        return ""
    guest_id = str(uuid.uuid4())
    try:
        await redis.setex(
            f"{GUEST_SESSION_PREFIX}{guest_id}",
            GUEST_SESSION_TTL,
            json.dumps({"target_companies": [], "trial_skills": []}),
        )
        return guest_id
    except Exception as e:
        logger.error(f"Error creating guest session: {e}")
        return ""


async def save_guest_data(guest_id: str, data_key: str, value) -> bool:
    """Saves guest exploration data (e.g. target companies) to the guest Redis session."""
    if redis is None or not guest_id:
        return False
    key = f"{GUEST_SESSION_PREFIX}{guest_id}"
    try:
        raw = await redis.get(key)
        guest_data = json.loads(raw) if raw else {}
        guest_data[data_key] = value
        await redis.setex(key, GUEST_SESSION_TTL, json.dumps(guest_data))
        return True
    except Exception as e:
        logger.error(f"Error saving guest data: {e}")
        return False


async def get_guest_data(guest_id: str) -> dict:
    """Retrieves all data stored in a guest session."""
    if redis is None or not guest_id:
        return {}
    try:
        raw = await redis.get(f"{GUEST_SESSION_PREFIX}{guest_id}")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


async def delete_guest_session(guest_id: str) -> None:
    """Removes the guest session from Redis after migration to a real user account."""
    if redis and guest_id:
        await redis.delete(f"{GUEST_SESSION_PREFIX}{guest_id}")


# ══════════════════════════════════════════════════════════════════════════════
# 3. SESSION-BASED RATE LIMITING (AI Roadmap / Groq API)
# ══════════════════════════════════════════════════════════════════════════════

async def check_session_rate_limit(
    session_id: str, action: str, limit: int = 5, window_seconds: int = 3600
) -> bool:
    """
    Per-session rate limit for expensive actions (e.g. AI roadmap generation).
    Unlike IP-based limits, this is fair per-student even on shared college Wi-Fi.
    Returns True if allowed, False if limit exceeded.
    If Redis is down, returns True (allow) so users are never blocked by infra issues.
    """
    if redis is None or not session_id:
        return True
    key = f"rl:{action}:{session_id}"
    try:
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, window_seconds)
        return attempts <= limit
    except Exception as e:
        logger.error(f"Error in check_session_rate_limit: {e}")
        return True


# ══════════════════════════════════════════════════════════════════════════════
# 4. MULTI-STEP ONBOARDING DRAFT STATE
# ══════════════════════════════════════════════════════════════════════════════

# ─── MISSING IN CURRENT FILE ─────────────────────────────────────────────────

async def save_draft_onboarding(session_id: str, step_name: str, step_data: dict, ttl: int = 86400) -> bool:
    """
    Saves one wizard step to Redis. MongoDB is NOT touched until all steps complete.
    If the user abandons onboarding, Redis TTL (24h) cleans up automatically.
    """
    if redis is None or not session_id:
        return False
    key = f"{DRAFT_PROFILE_PREFIX}{session_id}"
    try:
        raw = await redis.get(key)
        draft = json.loads(raw) if raw else {}
        draft[step_name] = step_data
        await redis.setex(key, ttl, json.dumps(draft))
        return True
    except Exception as e:
        logger.error(f"Error saving draft onboarding: {e}")
        return False


async def get_draft_onboarding(session_id: str) -> dict:
    """Fetches all saved wizard steps for the current session."""
    if redis is None or not session_id:
        return {}
    try:
        raw = await redis.get(f"{DRAFT_PROFILE_PREFIX}{session_id}")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


async def clear_draft_onboarding(session_id: str) -> None:
    """Removes draft state after final commit to MongoDB."""
    if redis and session_id:
        await redis.delete(f"{DRAFT_PROFILE_PREFIX}{session_id}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. TOKEN BLACKLIST HELPERS  (unchanged — already correct)
# ══════════════════════════════════════════════════════════════════════════════

async def blacklist_token(token: str, ttl_second: int) -> None:
    if redis is None:
        logger.warning("Redis unavailable — skipping token blacklist.")
        return
    try:
        await redis.setex(f"{BLACKLIST_PREFIX}{token}", ttl_second, "1")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in blacklist_token: {e}")


async def is_token_blacklisted(token: str) -> bool:
    if redis is None:
        return False
    try:
        return await redis.exists(f"{BLACKLIST_PREFIX}{token}") == 1
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in is_token_blacklisted: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# 6. IP-BASED LOGIN RATE LIMITING  (unchanged — already correct)
# ══════════════════════════════════════════════════════════════════════════════

async def check_rate_limit(identifier: str) -> None:
    from fastapi import HTTPException, status
    if redis is None:
        logger.warning("Redis unavailable — skipping rate limit check.")
        return
    try:
        key = f"{RATE_PREFIX}{identifier}"
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, LOCKOUT_SECONDS)
        if attempts > MAX_LOGIN_ATTEMPTS:
            ttl = await redis.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Try again in {ttl // 60} minutes.",
            )
    except HTTPException:
        raise
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in check_rate_limit: {e} — skipping.")


async def reset_rate_limit(identifier: str) -> None:
    if redis is None:
        return
    try:
        await redis.delete(f"{RATE_PREFIX}{identifier}")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in reset_rate_limit: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 7. OTP HELPERS  (unchanged — already correct)
# ══════════════════════════════════════════════════════════════════════════════

async def store_otp(email: str, otp: str) -> bool:
    if redis is None:
        logger.warning("Redis unavailable — cannot store OTP.")
        return False
    try:
        await redis.setex(f"{OTP_PREFIX}{email}", OTP_TTL_SECONDS, otp)
        return True
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.error(f"Redis error in store_otp: {e}")
        return False


async def verify_otp(email: str, otp: str) -> bool:
    if redis is None:
        return False
    try:
        key = f"{OTP_PREFIX}{email}"
        stored = await redis.get(key)
        if stored and stored == otp:
            await redis.delete(key)
            return True
        return False
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.error(f"Redis error in verify_otp: {e}")
        return False


async def delete_otp(email: str) -> None:
    if redis is None:
        return
    try:
        await redis.delete(f"{OTP_PREFIX}{email}")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in delete_otp: {e}")
```

---

## FILE 3 — `backend/app/api/routes/auth.py`

**What's missing / broken in current file:**
- Duplicate `router` and imports → remove
- Stub `register` block with `User(...)` → remove, add guest migration to REAL register
- `get_current_user` → add cookie-first logic
- `login` → add `create_session` + `set_session_cookie`
- `verify-otp` → add `create_session` + `set_session_cookie` (account fully verified here)
- `google` → add `create_session` + `set_session_cookie` + guest migration
- `logout` → add `destroy_session` + `clear_session_cookie`
- NEW: `GET /auth/sessions` and `POST /auth/sessions/revoke-others` endpoints

Here is the complete correct file:

```python
import random
import logging
from datetime import datetime, timezone
from typing import Optional, List
import httpx

from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from fastapi.security import HTTPBearer

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
from app.core.redis_client import (
    store_otp, verify_otp, delete_otp,
    reset_rate_limit, check_rate_limit,
    blacklist_token, is_token_blacklisted,
    create_session, get_session, destroy_session,
    get_user_sessions, destroy_other_user_sessions,
    create_guest_session, get_guest_data, delete_guest_session,
)

logger = logging.getLogger(__name__)
# ← Only ONE router declaration
router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)  # auto_error=False → allows cookie fallback


# ══════════════════════════════════════════════════════════════════════════════
# COOKIE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=session_id,
        httponly=True,                              # JS cannot read this — XSS protection
        secure=settings.COOKIE_SECURE,             # HTTPS-only in production
        samesite=settings.COOKIE_SAMESITE,         # CSRF protection
        max_age=settings.SESSION_EXPIRE_DAYS * 24 * 3600,
        path="/v1",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/v1",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


# ══════════════════════════════════════════════════════════════════════════════
# GUEST MIGRATION HELPER
# ══════════════════════════════════════════════════════════════════════════════

async def migrate_guest_data_to_user(guest_id: str, user: User) -> None:
    """
    Called on register/google-login if visitor had a guest_session_id cookie.
    Moves target companies from Redis guest session into the new MongoDB user record.
    Deletes the guest Redis key after migration.
    """
    if not guest_id:
        return
    guest_data = await get_guest_data(guest_id)
    if not guest_data:
        return
    target_companies = guest_data.get("target_companies", [])
    if target_companies and hasattr(user, "target_companies"):
        user.target_companies = list(set((user.target_companies or []) + target_companies))
        await user.save()
    await delete_guest_session(guest_id)


# ══════════════════════════════════════════════════════════════════════════════
# SHARED UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════════════════════
# AUTH DEPENDENCY — cookie-first, Bearer header fallback
# ══════════════════════════════════════════════════════════════════════════════

async def get_current_user(request: Request) -> User:
    """
    Resolves the logged-in user.
    1. Reads session_id from HttpOnly cookie → validates in Redis
    2. If no cookie / Redis down → falls back to Authorization: Bearer <token>
    This means the app works even if Redis is temporarily unavailable.
    """
    user_id: Optional[str] = None

    # Step 1: Cookie
    session_id = request.cookies.get(settings.COOKIE_NAME)
    if session_id:
        session = await get_session(session_id)
        if session:
            user_id = session.get("user_id")

    # Step 2: Bearer header fallback
    if not user_id:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            if payload and payload.get("type") == "access":
                user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    return user


# ══════════════════════════════════════════════════════════════════════════════
# REGISTER  (with guest migration + session cookie)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, request: Request, response: Response):
    existing = await User.find_one(User.email == body.email)

    if existing:
        if existing.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please log in.",
            )
        # Unverified — update details and resend OTP
        existing.password_hash = hash_password(body.password)
        existing.full_name = body.full_name
        existing.role = body.role
        existing.college = body.college
        existing.phone = body.phone
        existing.company_name = body.company_name
        existing.industry = body.industry
        await existing.save()
        otp = generate_otp()
        if await store_otp(body.email, otp):
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

    # Migrate guest data if visitor explored before registering
    guest_id = request.cookies.get("guest_session_id")
    if guest_id:
        await migrate_guest_data_to_user(guest_id, user)
        response.delete_cookie("guest_session_id", path="/v1")

    otp = generate_otp()
    if await store_otp(body.email, otp):
        send_otp_email(body.email, otp, body.full_name)
    else:
        logger.warning(f"Could not store OTP for {body.email} — Redis down.")

    return build_auth_response(user, needs_verification=True)


# ══════════════════════════════════════════════════════════════════════════════
# VERIFY OTP  (create session here — account is now verified)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp_route(body: VerifyOTPRequest, request: Request, response: Response):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        return build_auth_response(user)

    matched = await verify_otp(body.email, body.otp)
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please try again or request a new code.",
        )

    user.is_verified = True
    await user.save()

    # Create session now that the account is fully verified
    ip = request.client.host if request.client else ""
    ua = request.headers.get("User-Agent", "")
    session_id = await create_session(str(user.id), user.role, user.email, ip, ua)
    if session_id:
        set_session_cookie(response, session_id)

    return build_auth_response(user)


# ══════════════════════════════════════════════════════════════════════════════
# RESEND OTP  (no session change — unchanged logic)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(body: ResendOTPRequest):
    from app.core.redis_client import redis as _redis, OTP_PREFIX
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

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
    if await store_otp(body.email, otp):
        send_otp_email(body.email, otp, user.full_name)
    return MessageResponse(message="A new verification code has been sent to your email.")


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN  (create session + set cookie)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request, response: Response):
    await check_rate_limit(body.email)

    user = await User.find_one(User.email == body.email)

    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if body.role and user.role != body.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as {user.role}, not {body.role}.",
        )

    if not user.is_verified:
        otp = generate_otp()
        if await store_otp(body.email, otp):
            send_otp_email(body.email, otp, user.full_name)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. A new verification code has been sent to your email.",
        )

    await reset_rate_limit(body.email)

    # Create Redis session & set HttpOnly cookie
    ip = request.client.host if request.client else ""
    ua = request.headers.get("User-Agent", "")
    session_id = await create_session(str(user.id), user.role, user.email, ip, ua)
    if session_id:
        set_session_cookie(response, session_id)

    return build_auth_response(user)


# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE LOGIN  (create session + cookie + guest migration)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest, request: Request, response: Response):
    token = body.id_token.strip()

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?access_token={token}")
        if resp.status_code != 200:
            resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
        if resp.status_code != 200:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code != 200:
            logger.error(f"❌ Google Token Verification Failed: {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google authentication failed: {resp.status_code} {resp.text}",
            )
        google_data = resp.json()

    google_id  = google_data.get("sub") or google_data.get("id")
    email      = google_data.get("email")
    full_name  = google_data.get("name") or google_data.get("email", "").split("@")[0]
    avatar_url = google_data.get("picture")

    if not email or not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incomplete Google profile.")

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
            email=email, google_id=google_id, full_name=full_name,
            avatar_url=avatar_url, role=desired_role, is_verified=True,
        )
        await user.insert()

    # Migrate guest data
    guest_id = request.cookies.get("guest_session_id")
    if guest_id:
        await migrate_guest_data_to_user(guest_id, user)
        response.delete_cookie("guest_session_id", path="/v1")

    # Create session & set cookie
    ip = request.client.host if request.client else ""
    ua = request.headers.get("User-Agent", "")
    session_id = await create_session(str(user.id), user.role, user.email, ip, ua)
    if session_id:
        set_session_cookie(response, session_id)

    return build_auth_response(user)


# ══════════════════════════════════════════════════════════════════════════════
# REFRESH TOKEN  (unchanged logic — no session change needed)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(body: RefreshRequest):
    if await is_token_blacklisted(body.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token.")
    user = await User.get(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return build_auth_response(user)


# ══════════════════════════════════════════════════════════════════════════════
# LOGOUT  (destroy session + blacklist token + clear cookie)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/logout", response_model=MessageResponse)
async def logout(body: LogoutRequest, request: Request, response: Response):
    # 1. Destroy Redis session
    session_id = request.cookies.get(settings.COOKIE_NAME)
    if session_id:
        await destroy_session(session_id)

    # 2. Blacklist refresh token so it can't be reused
    payload = decode_token(body.refresh_token)
    if payload:
        exp = payload.get("exp", 0)
        remaining_ttl = int(exp - datetime.now(timezone.utc).timestamp())
        if remaining_ttl > 0:
            await blacklist_token(body.refresh_token, remaining_ttl)

    # 3. Clear cookie from browser
    clear_session_cookie(response)
    return MessageResponse(message="Logged out successfully.")


# ══════════════════════════════════════════════════════════════════════════════
# ME
# ══════════════════════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════════════════════
# ACTIVE DEVICE / SESSION MANAGEMENT  (new endpoints)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions", response_model=List[dict])
async def list_active_sessions(current_user: User = Depends(get_current_user)):
    """Lists all active logged-in devices for the current user."""
    return await get_user_sessions(str(current_user.id))


@router.post("/sessions/revoke-others", response_model=MessageResponse)
async def revoke_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Logs out every session EXCEPT the device making this request."""
    current_sid = request.cookies.get(settings.COOKIE_NAME, "")
    revoked = await destroy_other_user_sessions(str(current_user.id), current_sid)
    return MessageResponse(message=f"Successfully logged out {revoked} other device(s).")
```

---

## FILE 4 — `backend/app/api/routes/ws.py`

**What's broken in current file:**
- Uses `token = Query(...)` in the URL — exposes JWT in server logs & browser history
- Should read from HttpOnly cookie first, keep token as fallback only

```python
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import ws_manager
from app.core.security import decode_token
from app.core.redis_client import get_session
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/student/{user_id}")
async def student_ws(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(None, description="JWT access token (fallback if no cookie)"),
):
    """
    Cookie-first WebSocket authentication.
    Browsers send HttpOnly cookies automatically on the WS upgrade handshake.
    Token query param is kept as fallback for non-browser clients only.
    """
    authenticated = False

    # 1. Try HttpOnly cookie (most secure — no token in URL)
    session_id = websocket.cookies.get("session_id")
    if session_id:
        session = await get_session(session_id)
        if session and session.get("user_id") == user_id:
            authenticated = True

    # 2. Fallback: token query param (for non-browser clients)
    if not authenticated and token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access" and payload.get("sub") == user_id:
            authenticated = True

    if not authenticated:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await User.get(user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
```

---

## FILE 5 — `backend/app/api/routes/roadmap.py`

**What's missing:** Session-based rate limiting on AI generation endpoints.
Add this to whichever endpoint triggers the Groq/AI call:

```python
# Add these imports at the top of roadmap.py
from fastapi import Request
from app.core.redis_client import check_session_rate_limit
from app.core.config import settings

# Then inside any AI-generating endpoint, add before the generation logic:
async def some_ai_endpoint(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    # Use session_id for fair per-student quota even on shared Wi-Fi
    session_id = request.cookies.get(settings.COOKIE_NAME) or str(current_user.id)
    allowed = await check_session_rate_limit(
        session_id, action="ai_roadmap", limit=5, window_seconds=3600
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="You've reached your limit of 5 AI roadmap generations per hour.",
        )
    # ... rest of generation logic unchanged
```

---

## FILE 6 — `frontend/src/lib/api.ts`

**What's missing:** Guard against infinite retry loop when the refresh call itself returns 401.

```typescript
import { useAuthStore } from "@/store/authStore";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,  // ← sends HttpOnly cookies automatically on EVERY request
});

// Attach JWT access token on every request (Bearer header fallback)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // NEW: guard — don't retry if it's already the refresh call itself
    const isRefreshCall = original.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { withCredentials: true }
        );
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.access_token,
          data.refresh_token,
        );
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## FILE 7 — `frontend/src/lib/auth.ts`

**What's missing:**
- `logout` must still send `refresh_token` body so backend can blacklist it
- `registerUser` doesn't store tokens — correct, it returns `needs_verification: true`
- No changes strictly required, but cleaning up for clarity:

```typescript
import { useAuthStore, AuthUser } from "@/store/authStore";
import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
  role: "STUDENT" | "COMPANY";
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: "STUDENT" | "COMPANY";
  college?: string;
  phone?: string;
  company_name?: string;
  industry?: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  needs_verification?: boolean;
}

export async function loginWithCredentials(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  // Store user + tokens in Zustand for UI + Bearer header
  useAuthStore.getState().setAuth(data.user, data.access_token, data.refresh_token);
  // HttpOnly cookie is set by the backend — browser handles it automatically
  return data;
}

export async function loginWithGoogle(
  googleIdToken: string,
  role?: "STUDENT" | "COMPANY",
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/google", {
    id_token: googleIdToken,
    role: role || "STUDENT",
  });
  useAuthStore.getState().setAuth(data.user, data.access_token, data.refresh_token);
  return data;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  // Backend returns needs_verification: true — no session cookie set until OTP verified
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;
  try {
    // Send refresh_token body so backend blacklists it in Redis
    // Backend also destroys session + clears HttpOnly cookie in the response
    await api.post("/auth/logout", { refresh_token: refreshToken });
  } finally {
    // Always clear Zustand state regardless of server response
    useAuthStore.getState().clearAuth();
  }
}

export function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  return "/";
}
```

---

## FILE 8 — `frontend/src/store/authStore.ts`

**No changes needed ✅**
The Zustand store stores `accessToken`, `refreshToken`, and `user` for UI display and the Bearer header fallback. The `HttpOnly` cookie is managed entirely by the browser — invisible to JavaScript as intended.

---

## Summary — Everything Missing vs Everything Now Covered

| # | What was missing | Now documented |
|---|-----------------|----------------|
| 1 | `config.py` cookie settings | ✅ `COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `SESSION_EXPIRE_DAYS` |
| 2 | `redis = None` order crash | ✅ `redis` declared first, all functions after |
| 3 | `get_user_sessions` | ✅ Full implementation |
| 4 | `destroy_other_user_sessions` | ✅ Full implementation |
| 5 | `save_draft_onboarding` | ✅ Full implementation |
| 6 | `get_draft_onboarding` | ✅ Full implementation |
| 7 | `clear_draft_onboarding` | ✅ Full implementation |
| 8 | `auth.py` duplicate router | ✅ Single router, clean imports |
| 9 | `auth.py` stub register block | ✅ Removed — real register has guest migration |
| 10 | `get_current_user` cookie logic | ✅ Cookie-first + Bearer fallback |
| 11 | `login` session + cookie | ✅ `create_session` + `set_session_cookie` |
| 12 | `verify-otp` session + cookie | ✅ Session created after OTP verified |
| 13 | `google` session + cookie + guest migration | ✅ All three |
| 14 | `logout` destroys session + clears cookie | ✅ `destroy_session` + `clear_session_cookie` |
| 15 | `/auth/sessions` endpoint | ✅ Lists active devices |
| 16 | `/auth/sessions/revoke-others` endpoint | ✅ Logs out all other devices |
| 17 | `ws.py` cookie-first auth | ✅ Cookie primary, token query param fallback |
| 18 | Roadmap rate limiting usage | ✅ Pattern for any Groq AI endpoint |
| 19 | `frontend/api.ts` infinite refresh loop bug | ✅ `isRefreshCall` guard added |
| 20 | `frontend/auth.ts` | ✅ All functions documented cleanly |
