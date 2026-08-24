"""
Company Auth Routes — session-based (not JWT).

Why sessions here instead of JWT:
- Sessions can be revoked instantly server-side; required for the approval-gate
  (a rejected company can't keep an unexpired token).
- approvalStatus is re-checked on EVERY authenticated request, not just at login.
- httpOnly + sameSite=strict cookie closes XSS token-theft and most CSRF vectors.

Endpoints:
  POST /v1/company/auth/signup
  POST /v1/company/auth/resend-verification
  GET  /v1/company/auth/verify-email?token=<raw>
  POST /v1/company/auth/login
  POST /v1/company/auth/logout
  GET  /v1/company/auth/me
"""

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.models.company import Company
from app.schemas.company_auth_schema import (
    CompanySignupRequest,
    CompanyLoginRequest,
    ResendVerificationRequest,
    CompanyOut,
    CompanyAuthResponse,
    CompanyMeResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    check_password_strength,
    generate_verification_token,
)
from app.core.config import settings
from app.core.email_service import send_company_verification_email
from app.core.redis_client import (
    create_company_session,
    get_company_session,
    destroy_company_session,
    increment_company_login_failure,
    reset_company_login_failures,
    get_company_login_failures,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/company/auth", tags=["Company Auth"])

# ── Free email provider blocklist ─────────────────────────────────────────────
# Extend this list as needed. Intentionally conservative — only block the most
# common consumer providers; don't try to enumerate every free service.
_FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
    "live.com", "icloud.com", "me.com", "mac.com", "protonmail.com",
    "proton.me", "tutanota.com", "tutamail.com", "zoho.com", "aol.com",
    "ymail.com", "rediffmail.com", "mailinator.com", "guerrillamail.com",
    "tempmail.com", "throwam.com", "sharklasers.com", "yopmail.com",
}

# Max failed login attempts before lockout (per-account, tracked in Redis)
_MAX_FAILURES = 6
_LOCKOUT_MINUTES = 15

# Verification token TTL
_VERIFY_TOKEN_HOURS = 24


# ── Cookie helpers ─────────────────────────────────────────────────────────────

def _set_company_cookie(response: Response, session_id: str) -> None:
    """Write the company session cookie — httpOnly, secure, sameSite=strict."""
    response.set_cookie(
        key=settings.COMPANY_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=settings.COMPANY_COOKIE_SECURE,
        samesite=settings.COMPANY_COOKIE_SAMESITE,
        max_age=settings.COMPANY_SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )


def _clear_company_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.COMPANY_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.COMPANY_COOKIE_SECURE,
        samesite=settings.COMPANY_COOKIE_SAMESITE,
    )


# ── Auth dependency ────────────────────────────────────────────────────────────

async def require_company_auth(request: Request) -> Company:
    """
    FastAPI dependency. Validates company session cookie AND re-checks
    approvalStatus on every call — not just at login.
    """
    session_id = request.cookies.get(settings.COMPANY_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Company authentication required.")

    session = await get_company_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Company session expired. Please log in again.")

    company_id = session.get("company_id")
    company = await Company.get(company_id)
    if not company:
        raise HTTPException(status_code=401, detail="Company account not found.")

    # Re-check approvalStatus on EVERY request — rejection mid-session revokes immediately
    if company.approval_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Account is not approved. Access denied.",
        )

    return company


# ── Helpers ────────────────────────────────────────────────────────────────────

def _company_out(company: Company) -> CompanyOut:
    return CompanyOut(
        id=str(company.id),
        company_name=company.company_name,
        contact_name=company.contact_name,
        email=company.email,
        email_domain=company.email_domain,
        industry=company.industry,
        email_verified=company.email_verified,
        approval_status=company.approval_status,
        approval_note=company.approval_note,
        gstin_or_cin=company.gstin_or_cin,
        linkedin_company_url=company.linkedin_company_url,
        company_website=company.company_website,
        company_size=company.company_size,
        created_at=company.created_at,
    )


def _generic_auth_error() -> HTTPException:
    """
    Always return the same generic message regardless of the actual failure reason
    (wrong email, wrong password, unverified, pending, rejected).
    Distinct error messages let attackers fingerprint account state.
    """
    return HTTPException(
        status_code=401,
        detail="Invalid credentials or account not yet active.",
    )


# ── Signup ─────────────────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
async def company_signup(body: CompanySignupRequest, request: Request, response: Response):
    """
    Rate limit: applied at nginx/proxy layer — 5 signups per IP per hour.
    Step order follows spec Section 4 exactly.
    """
    email_lower = body.email.lower()

    # 1. Strict Corporate domain & DNS MX gate
    from app.core.company_validator import validate_corporate_email_domain
    is_corp, domain_or_reason = validate_corporate_email_domain(email_lower)
    if not is_corp:
        raise HTTPException(
            status_code=400,
            detail=domain_or_reason,
        )
    domain = domain_or_reason

    # 2. Password strength (server-side, not just frontend)
    ok, reason = check_password_strength(body.password)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    # 3. Email uniqueness — generic error to avoid enumeration
    existing = await Company.find_one({"email": email_lower})
    if existing and existing.email_verified:
        # Return success-looking response; don't reveal the email is taken
        return {"message": "If this email is not already registered, you will receive a verification link shortly."}

    if existing and not existing.email_verified:
        # Resend verification to the same unverified account
        company = existing
        company.company_name = body.company_name
        company.contact_name = body.contact_name
        company.industry = body.industry
        company.password_hash = hash_password(body.password)
        company.gstin_or_cin = body.gstin_or_cin
        company.linkedin_company_url = body.linkedin_company_url
        company.company_website = body.company_website
        company.company_size = body.company_size
        company.updated_at = datetime.now(timezone.utc)
    else:
        # 4. Create new company doc — pending, unverified
        company = Company(
            company_name=body.company_name,
            contact_name=body.contact_name,
            email=email_lower,
            email_domain=domain,
            industry=body.industry,
            password_hash=hash_password(body.password),
            gstin_or_cin=body.gstin_or_cin,
            linkedin_company_url=body.linkedin_company_url,
            company_website=body.company_website,
            company_size=body.company_size,
        )

    # 5. Generate verification token — raw goes in email, hashed goes in DB
    raw_token, hashed_token = generate_verification_token()
    company.email_verification_token = hashed_token
    company.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=_VERIFY_TOKEN_HOURS)

    if existing:
        await company.save()
    else:
        await company.insert()

    # 6. Send verification email (logged for audit/delivery)
    verify_url = f"{settings.FRONTEND_URL}/company/auth/verify-email?token={raw_token}"
    sent = send_company_verification_email(email_lower, body.contact_name, verify_url)
    if not sent:
        logger.warning(f"Direct verification link for {email_lower}: {verify_url}")

    # 7. Create server-side session so company lands on Pending Review screen with active state
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    session_id = await create_company_session(
        company_id=str(company.id),
        approval_status=company.approval_status,
        email=company.email,
        ip_address=ip,
        user_agent=ua,
    )
    if session_id:
        _set_company_cookie(response, session_id)

    return {
        "message": "Company registered successfully. Account is pending admin approval.",
        "company": _company_out(company),
    }


# ── Resend verification ────────────────────────────────────────────────────────

@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest):
    """Rate limit: applied at proxy — 3 resends per email per hour."""
    email_lower = body.email.lower()
    company = await Company.find_one({"email": email_lower})

    # Always return generic response to avoid confirming whether an account exists
    if not company or company.email_verified:
        return {"message": "If an unverified account with this email exists, a new link has been sent."}

    raw_token, hashed_token = generate_verification_token()
    company.email_verification_token = hashed_token
    company.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=_VERIFY_TOKEN_HOURS)
    company.updated_at = datetime.now(timezone.utc)
    await company.save()

    verify_url = f"{settings.FRONTEND_URL}/company/auth/verify-email?token={raw_token}"
    sent = send_company_verification_email(email_lower, company.contact_name, verify_url)
    if not sent:
        logger.warning(f"SMTP delivery failed. Direct verification link for {email_lower}: {verify_url}")

    return {"message": "If an unverified account with this email exists, a new link has been sent."}


# ── Email verification ─────────────────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(token: str, response: Response):
    """
    Hash the incoming raw token the same way (SHA-256), look up by hashed value.
    On success: email_verified=True, token fields cleared.
    Does NOT create a session — verification ≠ login.
    """
    if not token or len(token) < 32:
        raise HTTPException(status_code=400, detail="Invalid or missing verification token.")

    hashed_incoming = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    company = await Company.find_one({"email_verification_token": hashed_incoming})

    if not company or company.email_verification_expires is None:
        raise HTTPException(status_code=400, detail="Verification link is invalid or has expired.")

    # Ensure the stored datetime is timezone-aware for comparison
    expires = company.email_verification_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if expires < now:
        raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new one.")

    # Mark verified — clear token so it's single-use
    company.email_verified = True
    company.email_verification_token = None
    company.email_verification_expires = None
    company.updated_at = datetime.now(timezone.utc)
    await company.save()

    logger.info(f"Company email verified: {company.email_domain}")

    # Return company status so frontend can redirect appropriately
    return {
        "message": "Email verified successfully.",
        "approval_status": company.approval_status,
        "redirect": "/company/auth/pending",
    }


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login")
async def company_login(body: CompanyLoginRequest, request: Request, response: Response):
    """
    Rate limit: applied at proxy — 8 attempts per IP per 15 min.
    Per-account lockout: 6 failures → 15 min lockout (tracked in Redis).
    Generic error on every failure to avoid fingerprinting account state.
    Session ID is freshly generated on every login (prevents session fixation).
    """
    email_lower = body.email.lower()

    # Look up company — time-constant check to avoid timing oracle on email existence
    company = await Company.find_one({"email": email_lower})

    # 1. Check lockout BEFORE password comparison
    if company:
        failure_count = await get_company_login_failures(str(company.id))
        if failure_count >= _MAX_FAILURES:
            raise _generic_auth_error()

    # 2. Verify password — bcrypt.compare handles timing-safe comparison
    if not company:
        raise _generic_auth_error()

    if not verify_password(body.password, company.password_hash):
        await increment_company_login_failure(str(company.id))
        raise _generic_auth_error()

    # 3. Check email verified
    if not company.email_verified:
        await increment_company_login_failure(str(company.id))
        raise _generic_auth_error()

    # 4. Check approval status
    if company.approval_status != "approved":
        # Don't count this as a failure — password was correct, just not approved yet
        raise _generic_auth_error()

    # 5. Success — reset failure counter, create fresh session (session fixation prevention)
    await reset_company_login_failures(str(company.id))

    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    session_id = await create_company_session(
        company_id=str(company.id),
        approval_status=company.approval_status,
        email=company.email,
        ip_address=ip,
        user_agent=ua,
    )

    if not session_id:
        logger.error(f"Failed to create company session for {company.email_domain}")
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")

    _set_company_cookie(response, session_id)
    logger.info(f"Company login success: {company.email_domain}")

    return CompanyAuthResponse(
        company=_company_out(company),
        message="Login successful.",
    )


# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def company_logout(request: Request, response: Response):
    """Destroy the server-side session and clear the cookie."""
    session_id = request.cookies.get(settings.COMPANY_COOKIE_NAME)
    if session_id:
        await destroy_company_session(session_id)
    _clear_company_cookie(response)
    return {"message": "Logged out successfully."}


# ── Me ─────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=CompanyMeResponse)
async def company_me(request: Request):
    """
    Return current company profile + session validity.
    Checks approvalStatus on every call — revocation takes effect immediately.
    Also used by the pending page to poll for approval.
    """
    session_id = request.cookies.get(settings.COMPANY_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    session = await get_company_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    company = await Company.get(session.get("company_id"))
    if not company:
        raise HTTPException(status_code=401, detail="Company account not found.")

    return CompanyMeResponse(
        company=_company_out(company),
        session_valid=True,
    )
