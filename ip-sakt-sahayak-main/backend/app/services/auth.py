"""
backend/app/services/auth.py
-----------------------------
Authentication service with JWT tokens and secure password hashing.
Professional-grade security for IP-SAKTI Sahayak.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ip-sakti-super-secret-key-change-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class PasswordStrength(BaseModel):
    """Password validation result."""
    is_valid: bool
    score: int  # 0-5
    feedback: list[str]


class TokenData(BaseModel):
    """JWT token payload."""
    user_id: str
    email: str
    role: str
    exp: datetime


class Token(BaseModel):
    """Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserCreate(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = None
    phone: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        result = check_password_strength(v)
        if not result.is_valid:
            raise ValueError("; ".join(result.feedback))
        return v
    
    @validator('full_name')
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


class UserLogin(BaseModel):
    """User login request."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User data response (no password)."""
    id: str
    email: str
    full_name: str
    organization: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        result = check_password_strength(v)
        if not result.is_valid:
            raise ValueError("; ".join(result.feedback))
        return v


# ---------------------------------------------------------------------------
# Password Functions
# ---------------------------------------------------------------------------

def check_password_strength(password: str) -> PasswordStrength:
    """
    Validate password strength with professional criteria.
    
    Requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character (!@#$%^&*(),.?":{}|<>)
    """
    feedback = []
    score = 0
    
    # Length check
    if len(password) < 8:
        feedback.append("Password must be at least 8 characters long")
    else:
        score += 1
        if len(password) >= 12:
            score += 1
    
    # Uppercase check
    if not re.search(r'[A-Z]', password):
        feedback.append("Password must contain at least 1 uppercase letter")
    else:
        score += 1
    
    # Lowercase check
    if not re.search(r'[a-z]', password):
        feedback.append("Password must contain at least 1 lowercase letter")
    else:
        score += 1
    
    # Digit check
    if not re.search(r'\d', password):
        feedback.append("Password must contain at least 1 number")
    else:
        score += 1
    
    # Special character check
    if not re.search(r'[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\;\'`~]', password):
        feedback.append("Password must contain at least 1 special character (!@#$%^&* etc.)")
    else:
        score += 1
    
    # Common password patterns check
    common_patterns = ['password', '123456', 'qwerty', 'abc123', 'letmein', 'welcome', 'admin']
    if any(pattern in password.lower() for pattern in common_patterns):
        feedback.append("Password contains a common pattern - choose something unique")
        score = max(0, score - 2)
    
    is_valid = len(feedback) == 0
    
    return PasswordStrength(is_valid=is_valid, score=min(5, score), feedback=feedback)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT Token Functions
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT access token."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "user_id": user_id,
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_tokens(user_id: str, email: str, role: str) -> Token:
    """Create both access and refresh tokens."""
    access_token = create_access_token(user_id, email, role)
    refresh_token = create_refresh_token(user_id)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_user_id_from_token(token: str) -> Optional[str]:
    """Extract user_id from a valid token."""
    payload = decode_token(token)
    if payload and "user_id" in payload:
        return payload["user_id"]
    return None
