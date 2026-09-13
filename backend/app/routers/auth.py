"""
backend/app/routers/auth.py
----------------------------
Authentication router for IP-SAKTI Sahayak.
Professional login/signup with JWT tokens + Google OAuth.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.models.database import User, get_db
from app.services.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    PasswordChange,
    Token,
    PasswordStrength,
    hash_password,
    verify_password,
    create_tokens,
    decode_token,
    check_password_strength,
)

# ---------------------------------------------------------------------------
# Google OAuth Configuration
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

log = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current authenticated user from JWT token."""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        return None
    
    user_id = payload.get("user_id")
    if not user_id:
        return None
    
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Require valid authentication - raises 401 if not authenticated."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    
    return user


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class AuthResponse(BaseModel):
    """Login/Signup response."""
    user: UserResponse
    tokens: Token
    message: str


class PasswordCheckResponse(BaseModel):
    """Password strength check response."""
    strength: PasswordStrength


class ProfileUpdateRequest(BaseModel):
    """Profile update request."""
    full_name: Optional[str] = None
    organization: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=AuthResponse, tags=["Authentication"])
def signup(
    payload: UserCreate,
    db: Session = Depends(get_db)
) -> AuthResponse:
    """
    Register a new user account.
    
    Password requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter  
    - At least 1 number
    - At least 1 special character
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )
    
    # Create user
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        organization=payload.organization,
        phone=payload.phone,
        role="user",
        is_active=True,
        is_verified=False,  # Email verification can be added later
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create tokens
    tokens = create_tokens(user.id, user.email, user.role)
    
    log.info("New user registered: %s", user.email)
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        message="Account created successfully! Welcome to IP-SAKTI Sahayak."
    )


@router.post("/login", response_model=AuthResponse, tags=["Authentication"])
def login(
    payload: UserLogin,
    db: Session = Depends(get_db)
) -> AuthResponse:
    """
    Login with email and password.
    Returns JWT access and refresh tokens.
    """
    # Find user
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support."
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    tokens = create_tokens(user.id, user.email, user.role)
    
    log.info("User logged in: %s", user.email)
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        message="Login successful! Welcome back."
    )


@router.post("/refresh", response_model=Token, tags=["Authentication"])
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
) -> Token:
    """
    Refresh access token using refresh token.
    """
    payload = decode_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    return create_tokens(user.id, user.email, user.role)


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
def get_profile(
    user: User = Depends(require_auth)
) -> UserResponse:
    """
    Get current user profile.
    Requires authentication.
    """
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse, tags=["Authentication"])
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Update current user profile.
    Requires authentication.
    """
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.organization is not None:
        user.organization = payload.organization.strip() if payload.organization else None
    if payload.phone is not None:
        user.phone = payload.phone.strip() if payload.phone else None
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url.strip() if payload.avatar_url else None
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    log.info("User profile updated: %s", user.email)
    
    return UserResponse.model_validate(user)


@router.post("/change-password", tags=["Authentication"])
def change_password(
    payload: PasswordChange,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> dict:
    """
    Change password for authenticated user.
    Requires current password verification.
    """
    # Verify current password
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    
    log.info("Password changed for user: %s", user.email)
    
    return {"message": "Password changed successfully"}


@router.post("/check-password", response_model=PasswordCheckResponse, tags=["Authentication"])
def check_password(
    password: str
) -> PasswordCheckResponse:
    """
    Check password strength without creating account.
    Useful for real-time password validation in signup form.
    """
    strength = check_password_strength(password)
    return PasswordCheckResponse(strength=strength)


@router.post("/logout", tags=["Authentication"])
def logout(
    user: User = Depends(require_auth)
) -> dict:
    """
    Logout current user.
    Note: With JWT, actual logout happens client-side by discarding tokens.
    This endpoint is for audit logging.
    """
    log.info("User logged out: %s", user.email)
    return {"message": "Logged out successfully"}


@router.delete("/me", tags=["Authentication"])
def delete_account(
    password: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> dict:
    """
    Delete user account (soft delete - deactivate).
    Requires password confirmation.
    """
    # Verify password
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    
    # Soft delete
    user.is_active = False
    user.updated_at = datetime.utcnow()
    db.commit()
    
    log.info("Account deactivated: %s", user.email)
    
    return {"message": "Account deleted successfully"}


# ---------------------------------------------------------------------------
# Google OAuth Endpoints
# ---------------------------------------------------------------------------

# Store state tokens temporarily (in production, use Redis/DB)
_oauth_states: dict[str, datetime] = {}


@router.get("/google", tags=["OAuth"])
def google_login():
    """
    Initiate Google OAuth login.
    Redirects user to Google's consent screen.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured"
        )
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = datetime.utcnow()
    
    # Clean old states (older than 10 minutes)
    cutoff = datetime.utcnow()
    for s in list(_oauth_states.keys()):
        if (cutoff - _oauth_states[s]).seconds > 600:
            del _oauth_states[s]
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "consent",
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    
    return {"auth_url": auth_url, "state": state}


@router.get("/google/callback", tags=["OAuth"])
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Exchanges code for tokens, creates/finds user, returns JWT.
    """
    # Verify state
    if state not in _oauth_states:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=invalid_state"
        )
    
    del _oauth_states[state]
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=oauth_not_configured"
        )
    
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                },
            )
            
            if token_response.status_code != 200:
                log.error("Google token exchange failed: %s", token_response.text)
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/login?error=token_exchange_failed"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # Get user info from Google
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if userinfo_response.status_code != 200:
                log.error("Google userinfo failed: %s", userinfo_response.text)
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/login?error=userinfo_failed"
                )
            
            google_user = userinfo_response.json()
    
    except Exception as e:
        log.error("Google OAuth error: %s", str(e))
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=oauth_error"
        )
    
    # Extract user info
    email = google_user.get("email", "").lower()
    if not email:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=no_email"
        )
    
    full_name = google_user.get("name", "")
    avatar_url = google_user.get("picture", "")
    google_id = google_user.get("id", "")
    
    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        # Existing user - update avatar if they don't have one
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
        user.last_login = datetime.utcnow()
        db.commit()
        log.info("Google OAuth login: %s", email)
    else:
        # Create new user (no password - OAuth only)
        user = User(
            email=email,
            password_hash="",  # Empty = OAuth-only account
            full_name=full_name,
            avatar_url=avatar_url,
            role="user",
            is_active=True,
            is_verified=True,  # Google verified the email
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log.info("Google OAuth new user: %s", email)
    
    # Check if active
    if not user.is_active:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=account_deactivated"
        )
    
    # Create JWT tokens
    tokens = create_tokens(user.id, user.email, user.role)
    
    # Redirect to frontend with tokens
    redirect_url = (
        f"{FRONTEND_URL}/auth/callback"
        f"?access_token={tokens.access_token}"
        f"&refresh_token={tokens.refresh_token}"
        f"&token_type={tokens.token_type}"
    )
    
    return RedirectResponse(url=redirect_url)


@router.get("/google/url", tags=["OAuth"])
def get_google_auth_url():
    """
    Get Google OAuth URL for frontend to redirect.
    Alternative to /google endpoint that doesn't redirect.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured"
        )
    
    # Generate state token
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = datetime.utcnow()
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "consent",
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    
    return {"url": auth_url}
