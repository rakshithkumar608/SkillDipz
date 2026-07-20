import logging
import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError
from app.core.config import settings

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
        print("🚀 Redis Connected")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"⚠️  Redis unavailable at startup: {e}. Rate limiting & token blacklisting disabled.")
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


# Token Blacklist Helpers

BLACKLIST_PREFIX = "bl:"

async def blacklist_token(token: str, ttl_second: int) -> None:
    if redis is None:
        logger.warning("Redis unavailable — skipping token blacklist.")
        return
    try:
        key = f"{BLACKLIST_PREFIX}{token}"
        await redis.setex(key, ttl_second, "1")
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in blacklist_token: {e}")

async def is_token_blacklisted(token: str) -> bool:
    if redis is None:
        return False
    try:
        key = f"{BLACKLIST_PREFIX}{token}"
        return await redis.exists(key) == 1
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.warning(f"Redis error in is_token_blacklisted: {e}")
        return False

# Rate Limiting Helper

RATE_PREFIX = "rl:"
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

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


# ── OTP Helpers ──────────────────────────────────────────────────────────────

OTP_PREFIX = "otp:"
OTP_TTL_SECONDS = 10 * 60   # 10 minutes


async def store_otp(email: str, otp: str) -> bool:
    """Store OTP in Redis. Returns False if Redis is unavailable."""
    if redis is None:
        logger.warning("Redis unavailable — cannot store OTP.")
        return False
    try:
        key = f"{OTP_PREFIX}{email}"
        await redis.setex(key, OTP_TTL_SECONDS, otp)
        return True
    except (RedisConnectionError, RedisError, OSError) as e:
        logger.error(f"Redis error in store_otp: {e}")
        return False


async def verify_otp(email: str, otp: str) -> bool:
    """Returns True if the OTP matches. Deletes it on success (single-use)."""
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