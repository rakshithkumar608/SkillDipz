from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import hashlib
import secrets
from jose import JWTError, jwt
import bcrypt
from app.core.config import settings

# Top-100 most common passwords (extended to protect against obvious patterns)
_COMMON_PASSWORDS = {
    "password", "password1", "password12", "password123", "password1234",
    "123456789", "12345678", "1234567890", "qwerty123", "qwertyuiop",
    "iloveyou", "admin123", "letmein", "welcome1", "monkey123",
    "dragon123", "master123", "sunshine", "princess", "football",
    "shadow123", "superman", "batman123", "trustno1", "baseball",
    "access123", "hello123", "charlie1", "donald123", "michael1",
    "jessica1", "passw0rd", "p@ssword", "p@ssw0rd", "abc123456",
    "111111111", "000000000", "987654321", "qazwsxedc", "1q2w3e4r",
}


def hash_password(password: str) -> str:
    """Hash password with bcrypt, cost=12. Truncated to 72 bytes (bcrypt limit)."""
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")


# Alias for compatibility
get_password_hash = hash_password


def verify_password(plain: str, hashed: str) -> bool:
    password_bytes = plain.encode("utf-8")[:72]
    hashed_bytes = hashed.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def check_password_strength(password: str) -> Tuple[bool, str]:
    """
    Returns (is_ok, error_message).
    Enforces: min 10 chars, not in common-password list.
    Does NOT enforce max below 128 (bcrypt itself caps at 72 bytes).
    """
    if len(password) < 10:
        return False, "Password must be at least 10 characters long."
    if password.lower() in _COMMON_PASSWORDS:
        return False, "Password is too common. Choose a stronger passphrase."
    return True, ""


def generate_verification_token() -> Tuple[str, str]:
    """
    Generate a secure email verification token pair.
    Returns (raw_token, hashed_token).
    - raw_token: 32-byte hex string — goes in the email link ONLY
    - hashed_token: SHA-256 of raw — stored in DB
    Never store raw_token. Never log either value.
    """
    raw = secrets.token_hex(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_EXPIRATION_MINUTES
    )
    payload["exp"] = expire
    payload["type"] = "access"
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256"
    )

def create_refresh_token(data: dict) -> str:
    payload = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_EXPIRATION_DAYS
    )

    payload["exp"] = expire
    payload["type"] = "refresh"
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256"
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )
    except JWTError:
        return None