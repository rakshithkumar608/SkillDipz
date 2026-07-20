import redis.asyncio as aioredis
from app.core.config import settings

redis: aioredis.Redis | None = None

async def connect_redis():
    global redis
    redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.ping()
    print("🚀 Redis Connected")

async def close_redis():
    if redis:
        await redis.close()
        print("❌ Redis Connection Closed")

def get_redis() -> aioredis.Redis:
    if redis is None:
        raise RuntimeError("Redis not initialised")


# Token Blacklist Helpers

BLACKLIST_PREFIX = "bl:"

async def blacklist_token(token: str, ttl_second: int) -> None:
    key = f"{BLACKLIST_PREFIX}{token}"
    await redis.setex(key, ttl_second, "1")

async def is_token_blacklisted(token: str) -> bool:
    key = f"{BLACKLIST_PREFIX}{token}"
    return await redis.exists(key) == 1

# Rate Limiting Helper

RATE_PREFIX = "rl:"
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

async def check_rate_limit(identifier: str) -> None:
    from fastapi import HTTPException, status
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


async def reset_rate_limit(identifier: str) -> None:
    key = f"{RATE_PREFIX}{identifier}"
    await redis.delete(key)