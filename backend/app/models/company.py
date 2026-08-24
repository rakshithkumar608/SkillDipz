from beanie import Document
from pydantic import Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone


class Company(Document):
    """
    Company account with session-based auth and admin approval gate.
    Passwords are hashed with bcrypt (cost 12). Email verification tokens
    are stored as SHA-256 hashes — raw token goes in the email link only.
    """

    # Identity
    company_name: str
    contact_name: str
    email: EmailStr
    email_domain: str                                  # derived from email, indexed
    password_hash: str

    # Email verification
    email_verified: bool = False
    email_verification_token: Optional[str] = None    # SHA-256 hash of raw token
    email_verification_expires: Optional[datetime] = None

    # Approval gate
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    approval_note: Optional[str] = None               # admin rejection reason
    reviewed_by: Optional[str] = None                 # admin user_id
    reviewed_at: Optional[datetime] = None

    # Company details
    industry: Optional[str] = None
    gstin_or_cin: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None

    # Security: per-account lockout
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "companies"

    class Config:
        json_schema_extra = {
            "example": {
                "company_name": "Acme Corp",
                "contact_name": "Jane Smith",
                "email": "jane@acmecorp.com",
                "email_domain": "acmecorp.com",
                "approval_status": "pending",
                "email_verified": False,
            }
        }
