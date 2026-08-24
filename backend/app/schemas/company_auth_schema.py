from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
import re


class CompanySignupRequest(BaseModel):
    # Step 1: Account setup
    company_name: str = Field(..., min_length=2, max_length=120)
    contact_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)
    industry: str = Field(..., min_length=2, max_length=80)

    # Step 2: Company verification (Mandatory)
    gstin_or_cin: str = Field(..., min_length=15, max_length=25)
    linkedin_company_url: str = Field(..., min_length=10, max_length=300)
    company_website: Optional[str] = Field(None, max_length=300)
    company_size: Optional[Literal["1-10", "11-50", "51-200", "200+"]] = None

    @field_validator("gstin_or_cin")
    @classmethod
    def validate_gstin_cin(cls, v: str) -> str:
        from app.core.company_validator import validate_business_registration
        ok, msg, _ = validate_business_registration(v)
        if not ok:
            raise ValueError(msg)
        return v.strip().upper()

    @field_validator("linkedin_company_url")
    @classmethod
    def validate_linkedin(cls, v: str) -> str:
        from app.core.company_validator import validate_linkedin_url
        ok, msg = validate_linkedin_url(v)
        if not ok:
            raise ValueError(msg)
        return v.strip()

    @field_validator("company_website")
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        from app.core.company_validator import validate_website_url
        ok, cleaned_or_err = validate_website_url(v)
        if not ok:
            raise ValueError(cleaned_or_err)
        return cleaned_or_err if v else None


class CompanyLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class CompanyOut(BaseModel):
    id: str
    company_name: str
    contact_name: str
    email: str
    email_domain: str
    industry: Optional[str] = None
    email_verified: bool
    approval_status: Literal["pending", "approved", "rejected"]
    approval_note: Optional[str] = None
    gstin_or_cin: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None
    created_at: datetime


class CompanyAuthResponse(BaseModel):
    company: CompanyOut
    message: str


class CompanyMeResponse(BaseModel):
    company: CompanyOut
    session_valid: bool = True


class CompanyApprovalAction(BaseModel):
    approval_note: Optional[str] = Field(None, max_length=500)
