from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime

# ── Requests ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["STUDENT", "COMPANY", "MENTOR", "INTERVIEWER", "ADMIN"] = "STUDENT"
    # Student
    college: Optional[str] = None
    phone: Optional[str] = None
    # Company
    company_name: Optional[str] = None
    industry: Optional[str] = None

class MentorRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

class MentorLoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[Literal["STUDENT", "COMPANY", "MENTOR", "INTERVIEWER", "ADMIN"]] = None  # Optional filter

class GoogleLoginRequest(BaseModel):
    id_token: str   # Google access token or id_token
    role: Optional[Literal["STUDENT", "COMPANY", "MENTOR", "INTERVIEWER", "ADMIN"]] = "STUDENT"

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ResendOTPRequest(BaseModel):
    email: EmailStr

# ── Responses

class UserOut(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool
    created_at: datetime
    college: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    needs_verification: bool = False   # True → redirect to /verify-otp

class MessageResponse(BaseModel):
    message: str