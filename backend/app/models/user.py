from beanie import Document
from pydantic import Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone

class User(Document):
    email: EmailStr
    password_hash: Optional[str] = None          # None for Google-only accounts
    role: Literal["STUDENT", "COMPANY", "MENTOR", "INTERVIEWER", "ADMIN"] = "STUDENT"
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
