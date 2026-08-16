import logging
import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError
from app.core.config import settings
import json
import uuid
from typing import Optional, List, Dict


logger = logging.getLogger(__name__)


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
        logger.info("Redis Connected")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis unavailable at startup: {e}. Rate limiting & token blacklisting disabled.")
        redis = None

async def close_redis():
    global redis
    if redis:
        try:
            await redis.aclose()
        except Exception:
            pass
        redis = None
        logger.info("Redis Connection Closed")

def get_redis() -> aioredis.Redis | None:
    return redis

#  Key Prefixes & TTL Constants

SESSION_PREFIX = "session:"
USER_SESSIONS_PREFIX = "user_sessions:"
GUEST_SESSION_PREFIX = "guest:"
DRAFT_PROFILE_PREFIX = "draft_profile:"
BLACKLIST_PREFIX = "bl:"
RATE_PREFIX = "rl:"
OTP_PREFIX = "otp:"


DEFAULT_SESSION_TTL = 7 * 24 * 3600
GUEST_SESSION_TTL = 3 * 24 * 3600
OTP_TTL_SECONDS = 10 * 60
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60


#  Core User Sessions

async def create_session(
    user_id: str,
    role: str,
    email: str,
    ip_address: str = "",
    user_agent: str = "",
    ttl: int = DEFAULT_SESSION_TTL
) -> str:
    if redis is None:
        return ""

    session_id = str(uuid.uuid4())
    session_key = f"{SESSION_PREFIX}{session_id}"
    user_session_key = f"{USER_SESSIONS_PREFIX}{user_id}"

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
        logger.error(f"Error Creating Session: {e}")
        return ""

async def get_session(session_id: str) -> Optional[dict]:
    if redis is None or not session_id:
        return None
    try:
        raw = await redis.get(f"{SESSION_PREFIX}{session_id}")
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.error(f"Error reading Session: {e}")
        return None

async def destroy_session(session_id: str) -> bool:
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

# Getting user Session data
async def get_user_sessions(user_id: str) -> List[Dict]:
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
                await redis.srem(f"{USER_SESSIONS_PREFIX}{user_id}", sid)
        return sessions
    except Exception as e:
        logger.error(f"Error getting user sessions: {e}")
        return []

async def destroy_other_user_sessions(user_id: str, current_session_id: str) -> int:
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
        logger.error(f"Error destroying other user sessions: {e}")
    return count

#  Anonymous Guest Session & Migration Helpers
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

async def save_guest_data(guest_id: str, data_key: str, value: any) -> bool:
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
    if redis is None or not guest_id:
        return {}
    try:
        raw = await redis.get(f"{GUEST_SESSION_PREFIX}{guest_id}")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


async def delete_guest_session(guest_id: str) -> None:
    if redis and guest_id:
        await redis.delete(f"{GUEST_SESSION_PREFIX}{guest_id}")


async def check_session_rate_limit(session_id: str, action: str, limit: int = 5, window_seconds: int = 3600) -> bool:
    if redis is None or not session_id:
        return True
    key = f"rl:{action}:{session_id}"
    try:
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, window_seconds)
        return attempts <= limit
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return True

        
# Multi-Step Onboarding Draft State

async def save_draft_onboarding(session_id: str, step_name: str, step_data: dict, ttl: int = 86400) -> bool:
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
        logger.error(f"Error saving draft onboarding:{e}")
        return False
    
async def get_draft_onboarding(session_id: str) -> dict:
    if redis is None or not session_id:
        return {}
    try:
        raw = await redis.get(f"{DRAFT_PROFILE_PREFIX}{session_id}")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


async def clear_draft_onboarding(session_id: str) -> None:
    if redis and session_id:
        await redis.delete(f"{DRAFT_PROFILE_PREFIX}{session_id}")


# Token Blacklist Helpers

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

# Rate Limiting Helper

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
        logger.warning(f"Redis error in check_rate_limit: {e} — skipping rate limit.")


async def reset_rate_limit(identifier: str) -> None:
    if redis is None:
        return
    try:
        key = f"{RATE_PREFIX}{identifier}"
        await redis.delete(key)
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in reset_rate_limit: {e}")


#  OTP Helpers 


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
    """Remove OTP from Redis (e.g. on resend)."""
    if redis is None:
        return
    try:
        await redis.delete(f"{OTP_PREFIX}{email}")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in delete_otp: {e}")