# SkillDipz — Backend Authentication Code
> **Stack:** FastAPI · Python 3.11 · MongoDB (Motor async) · Redis · JWT · Google OAuth  
> **Security:** bcrypt hashing · Access token (30min) · Refresh token (7 days) · Redis token blacklist on logout · Rate limiting on login

---

## File Structure

```
backend/
├── .env
├── requirements.txt
├── main.py
└── app/
    ├── api/
    │   └── routes/
    │       └── auth.py          ← All auth endpoints
    ├── core/
    │   ├── config.py            ← Pydantic settings
    │   ├── security.py          ← JWT + bcrypt helpers
    │   ├── database.py          ← MongoDB async client
    │   └── redis_client.py      ← Redis async client  ← NEW
    ├── models/
    │   └── user.py              ← MongoDB user document model
    └── schemas/
        └── auth_schema.py       ← Pydantic request/response schemas
```

---

## 1. `requirements.txt`

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
motor==3.5.1
beanie==1.26.0
pydantic==2.8.2
pydantic-settings==2.4.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
httpx==0.27.0
google-auth==2.35.0
redis[asyncio]==5.0.8
```

---

## 2. `.env`

```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/skilldipz

# Upstash Redis (copy from Upstash dashboard → Connect → .env)
REDIS_URL=rediss://default:<your-upstash-password>@<your-endpoint>.upstash.io:6379

JWT_SECRET_KEY=super_secure_random_string_change_in_production
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=7

GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

FRONTEND_URL=http://localhost:3000
```

---

## 3. `app/core/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    MONGODB_URI: str
    REDIS_URL: str  # Set in .env — use Upstash: rediss://default:<password>@<endpoint>.upstash.io:6379
    JWT_SECRET_KEY: str
    JWT_ACCESS_EXPIRATION_MINUTES: int = 30
    JWT_REFRESH_EXPIRATION_DAYS: int = 7
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 4. `app/core/database.py`

```python
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.core.config import settings

client: AsyncIOMotorClient | None = None

async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    await init_beanie(
        database=client.skilldipz,
        document_models=[User]
    )
    print("✅ MongoDB connected")

async def close_db():
    if client:
        client.close()
        print("🔴 MongoDB disconnected")
```

---

## 4b. `app/core/redis_client.py`  ← NEW

```python
import redis.asyncio as aioredis
from app.core.config import settings

# Global async Redis client
redis: aioredis.Redis | None = None

async def connect_redis():
    global redis
    redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.ping()   # fail fast if Redis is down
    print("✅ Redis connected")

async def close_redis():
    global redis
    if redis:
        await redis.close()
        print("🔴 Redis disconnected")

def get_redis() -> aioredis.Redis:
    """Dependency injection — use in route handlers."""
    if redis is None:
        raise RuntimeError("Redis not initialised")
    return redis


# ── Token Blacklist Helpers ────────────────────────────────────

BLACKLIST_PREFIX = "bl:"   # bl:<jti_or_token_hash>

async def blacklist_token(token: str, ttl_seconds: int) -> None:
    """
    Store token in Redis blacklist.
    TTL = remaining lifetime of the token so it auto-expires.
    """
    key = f"{BLACKLIST_PREFIX}{token}"
    await redis.setex(key, ttl_seconds, "1")

async def is_token_blacklisted(token: str) -> bool:
    """Returns True if the token has been revoked."""
    key = f"{BLACKLIST_PREFIX}{token}"
    return await redis.exists(key) == 1


# ── Rate Limiting Helper ───────────────────────────────────────

RATE_PREFIX = "rl:"
MAX_LOGIN_ATTEMPTS = 5        # max attempts
LOCKOUT_SECONDS = 15 * 60    # 15 minutes lockout

async def check_rate_limit(identifier: str) -> None:
    """
    Raises HTTPException 429 if identifier (email) exceeded
    MAX_LOGIN_ATTEMPTS within LOCKOUT_SECONDS window.
    """
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
    """Clear rate limit on successful login."""
    key = f"{RATE_PREFIX}{identifier}"
    await redis.delete(key)
```

---

## 5. `app/core/security.py`

```python
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_EXPIRATION_MINUTES
    )
    payload["exp"] = expire
    payload["type"] = "access"
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_EXPIRATION_DAYS
    )
    payload["exp"] = expire
    payload["type"] = "refresh"
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        return None
```

---

## 6. `app/models/user.py`

```python
from beanie import Document
from pydantic import Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone

class User(Document):
    email: EmailStr
    password_hash: Optional[str] = None          # None for Google-only accounts
    role: Literal["STUDENT", "COMPANY", "CREATOR", "ADMIN"] = "STUDENT"
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool = False
    google_id: Optional[str] = None              # Populated on Google login
    
    # Student extras
    college: Optional[str] = None
    phone: Optional[str] = None

    # Company extras
    company_name: Optional[str] = None
    industry: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"

    class Config:
        json_schema_extra = {
            "example": {
                "email": "student@example.com",
                "role": "STUDENT",
                "full_name": "Arjun Sharma",
                "is_verified": False,
            }
        }
```

---

## 7. `app/schemas/auth_schema.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime

# ── Requests ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["STUDENT", "COMPANY"] = "STUDENT"
    # Student
    college: Optional[str] = None
    phone: Optional[str] = None
    # Company
    company_name: Optional[str] = None
    industry: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[Literal["STUDENT", "COMPANY"]] = None  # Optional filter

class GoogleLoginRequest(BaseModel):
    id_token: str   # Google access token or id_token

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

# ── Responses ─────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool
    created_at: datetime

class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class MessageResponse(BaseModel):
    message: str
```

---

## 8. `app/api/routes/auth.py` ← **FULL AUTH ROUTER**

```python
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

# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def build_auth_response(user: User) -> AuthResponse:
    """Build standard auth response with fresh JWT pair."""
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
        ),
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    """Dependency — validates Bearer token and returns User doc."""
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = await User.get(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─────────────────────────────────────────────────────────────
# POST /v1/auth/register
# ─────────────────────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest):
    # Check duplicate
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters."
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


# ─────────────────────────────────────────────────────────────
# POST /v1/auth/login
# ─────────────────────────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email)

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    # Optional role check
    if body.role and user.role != body.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as {user.role}, not {body.role}.",
        )

    return build_auth_response(user)


# ─────────────────────────────────────────────────────────────
# POST /v1/auth/google
# ─────────────────────────────────────────────────────────────
@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleLoginRequest):
    """
    Accepts Google OAuth access_token or id_token.
    Fetches user info from Google userinfo endpoint.
    Creates account automatically if new user.
    """
    async with httpx.AsyncClient() as client:
        # Verify token with Google and get user info
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {body.id_token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token.",
            )
        google_data = resp.json()

    google_id = google_data.get("sub")
    email = google_data.get("email")
    full_name = google_data.get("name", "")
    avatar_url = google_data.get("picture")

    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Incomplete Google profile.")

    # Find or create user
    user = await User.find_one(User.email == email)
    if user:
        # Merge Google ID if not set
        if not user.google_id:
            user.google_id = google_id
            user.avatar_url = user.avatar_url or avatar_url
            await user.save()
    else:
        # New user via Google — default to STUDENT
        user = User(
            email=email,
            google_id=google_id,
            full_name=full_name,
            avatar_url=avatar_url,
            role="STUDENT",
            is_verified=True,   # Google emails are pre-verified
        )
        await user.insert()

    return build_auth_response(user)


# ─────────────────────────────────────────────────────────────
# POST /v1/auth/refresh
# ─────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(body: RefreshRequest):
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


# ─────────────────────────────────────────────────────────────
# POST /v1/auth/logout  — Redis blacklists the refresh token
# ─────────────────────────────────────────────────────────────
@router.post("/logout", response_model=MessageResponse)
async def logout(body: LogoutRequest):
    """
    Decodes the refresh token to get its remaining TTL,
    then stores it in Redis blacklist so it cannot be reused.
    Access token expires on its own (30 min max).
    """
    from app.core.redis_client import blacklist_token
    from datetime import datetime, timezone

    payload = decode_token(body.refresh_token)
    if payload:
        exp = payload.get("exp", 0)
        remaining_ttl = int(exp - datetime.now(timezone.utc).timestamp())
        if remaining_ttl > 0:
            await blacklist_token(body.refresh_token, remaining_ttl)

    return MessageResponse(message="Logged out successfully.")


# ─────────────────────────────────────────────────────────────
# GET /v1/auth/me
# ─────────────────────────────────────────────────────────────
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
    )
```

---

## 9. `main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis
from app.core.config import settings
from app.api.routes.auth import router as auth_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()   # ← Redis starts here
    yield
    await close_db()
    await close_redis()     # ← Redis closes here

app = FastAPI(
    title="SkillDipz API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "SkillDipz API"}
```

---

## 10. Run Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Swagger docs:** `http://localhost:8000/docs`

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/auth/register` | ❌ | Email/password registration (Student or Company) |
| POST | `/v1/auth/login` | ❌ | Email/password login, returns JWT pair |
| POST | `/v1/auth/google` | ❌ | Google OAuth login/register |
| POST | `/v1/auth/refresh` | ❌ | Exchange refresh token for new access token |
| POST | `/v1/auth/logout` | ❌ | Client-side token clearing |
| GET | `/v1/auth/me` | ✅ Bearer | Get current authenticated user |

---

## MongoDB Indexes (run once)

```python
# In database.py or a setup script
await User.get_motor_collection().create_index("email", unique=True)
await User.get_motor_collection().create_index("google_id", sparse=True)
```

---

## Redis — What It Does in Auth

| Feature | Redis Key | TTL | Description |
|---|---|---|---|
| **Token Blacklist** | `bl:<refresh_token>` | Remaining token lifetime | Logout invalidates refresh token immediately |
| **Refresh check** | `bl:<refresh_token>` | — | On `/auth/refresh`, check blacklist before issuing new tokens |
| **Rate Limiting** | `rl:<email>` | 15 minutes | Max 5 failed logins → 429 Too Many Requests |
| **Rate Reset** | `rl:<email>` | — | Deleted on successful login |

---

## Updated `/v1/auth/login` — with Rate Limiting

Add these 2 lines to the `login` route (in `auth.py`):

```python
# At the TOP of the login function, before any DB query:
from app.core.redis_client import check_rate_limit, reset_rate_limit

@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    # ← Rate limit check first
    await check_rate_limit(body.email)

    user = await User.find_one(User.email == body.email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if body.role and user.role != body.role:
        raise HTTPException(status_code=403, detail=f"Account is registered as {user.role}.")

    # ← Reset rate limit on success
    await reset_rate_limit(body.email)
    return build_auth_response(user)
```

## Updated `/v1/auth/refresh` — with Blacklist Check

Add blacklist check to the refresh route:

```python
@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(body: RefreshRequest):
    from app.core.redis_client import is_token_blacklisted

    # ← Block blacklisted tokens (already logged out)
    if await is_token_blacklisted(body.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please login again.",
        )

    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    user = await User.get(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return build_auth_response(user)
```

---

## Redis Setup — Upstash (Managed Cloud Redis)

> ✅ We use **Upstash** — no Docker or local Redis needed.

### Steps:
1. Go to [https://upstash.com](https://upstash.com) → Create a Redis database
2. Choose **region** closest to your backend (e.g., `ap-south-1` for India)
3. Enable **TLS** (default on Upstash)
4. Copy the **REST URL** or **Redis URL** from the dashboard
5. Paste into `.env`:

```env
REDIS_URL=rediss://default:<your-upstash-password>@<your-endpoint>.upstash.io:6379
```

> **Note:** Use `rediss://` (double `s`) — Upstash requires TLS.

```bash
# Already in requirements.txt (no extra install needed):
redis[asyncio]==5.0.8
```
