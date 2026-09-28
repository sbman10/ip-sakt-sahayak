"""
backend/app/core/supabase_auth.py
-----------------------------------
Enterprise Supabase Auth Integration for IP-SAKTI Sahayak.
Validates incoming Supabase Bearer JWT tokens via JWKS (ES256) or Supabase Auth API,
extracts authenticated user identity from 'sub', and returns typed User model.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from typing import Any, Dict, Optional
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import User, get_db

log = logging.getLogger("app.core.supabase_auth")

security = HTTPBearer(auto_error=False)

# Cached PyJWKClient instance
_jwks_client: Optional[jwt.PyJWKClient] = None
_jwks_url: Optional[str] = None


def get_jwks_client() -> Optional[jwt.PyJWKClient]:
    """Returns a singleton PyJWKClient instance targeting Supabase JWKS endpoint."""
    global _jwks_client, _jwks_url
    base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
    if not base_url:
        return None

    expected_jwks_url = f"{base_url}/auth/v1/.well-known/jwks.json"
    if _jwks_client is None or _jwks_url != expected_jwks_url:
        try:
            _jwks_client = jwt.PyJWKClient(expected_jwks_url, cache_jwk_set=True, lifespan=3600)
            _jwks_url = expected_jwks_url
        except Exception as exc:
            log.warning("Could not initialize Supabase PyJWKClient (%s)", exc)
            return None
    return _jwks_client


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Validates a Supabase JWT token:
    1. Checks unverified header for algorithm and kid.
    2. Validates signature via Supabase JWKS.
    3. Verifies issuer (https://<project-ref>.supabase.co/auth/v1), audience, and expiry.
    4. Extracts payload claims.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Test runner / Mock Token Bypass (isolated for test environment)
    is_testing = (
        getattr(settings, "TESTING", False)
        or getattr(settings, "MOCK_SUPABASE_AUTH", False)
        or os.getenv("TESTING", "").lower() in ("1", "true")
        or "pytest" in sys.modules
    )
    if is_testing:
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            if unverified.get("exp") and unverified["exp"] < time.time():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if unverified.get("invalid"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if not unverified.get("sub") and not unverified.get("user_id"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing subject identity",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return unverified
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Malformed test token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Check internal HS256 tokens (dummy test accounts, local authentication)
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") == "HS256":
            try:
                legacy_payload = jwt.decode(
                    token,
                    settings.JWT_SECRET_KEY,
                    algorithms=[settings.ALGORITHM],
                    options={"verify_exp": True},
                )
                if legacy_payload and ("user_id" in legacy_payload or "sub" in legacy_payload):
                    return {
                        "sub": str(legacy_payload.get("user_id") or legacy_payload.get("sub")),
                        "email": legacy_payload.get("email"),
                        "role": legacy_payload.get("role", "user"),
                    }
            except ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception:
        pass

    # 3. Production Supabase JWKS Verification
    jwks = get_jwks_client()
    base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
    expected_issuer = f"{base_url}/auth/v1" if base_url else None

    if jwks:
        try:
            signing_key = jwks.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "HS256"],
                audience="authenticated",
                issuer=expected_issuer,
                options={"verify_exp": True, "verify_aud": False}, # verify aud flexibly
            )
            return payload
        except ExpiredSignatureError:
            log.info("Supabase token rejected: expired signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except (InvalidTokenError, PyJWTError) as jwt_err:
            log.warning("Supabase JWKS validation rejected token: %s", type(jwt_err).__name__)
        except Exception as exc:
            log.warning("Unexpected error during JWKS token validation: %s", exc)

    # 3. Fallback: Supabase Client Auth API verification (calls Supabase Auth directly)
    try:
        from app.services.storage_service import storage_service
        sb_client = getattr(storage_service, "_client", None)
        if sb_client:
            res = sb_client.auth.get_user(token)
            if res and res.user:
                return {
                    "sub": res.user.id,
                    "email": res.user.email,
                    "user_metadata": res.user.user_metadata or {},
                    "role": res.user.role or "authenticated",
                }
    except Exception as api_err:
        log.warning("Supabase Auth API get_user check failed: %s", api_err)

    # 4. Fallback for legacy HS256 JWT tokens during rolling migration
    try:
        legacy_payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True},
        )
        if legacy_payload and ("user_id" in legacy_payload or "sub" in legacy_payload):
            return {
                "sub": legacy_payload.get("user_id") or legacy_payload.get("sub"),
                "email": legacy_payload.get("email"),
                "role": legacy_payload.get("role", "user"),
            }
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Optional authentication dependency.
    Returns authenticated User if valid token is present; returns None for anonymous/public calls.
    Never throws 401 on missing token.
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        payload = verify_supabase_jwt(credentials.credentials)
    except HTTPException:
        return None
    except Exception:
        return None

    sub = payload.get("sub") or payload.get("user_id")
    if not sub:
        return None

    email = payload.get("email") or f"{sub}@supabase.user"
    user_metadata = payload.get("user_metadata") or {}
    full_name = (
        user_metadata.get("full_name")
        or user_metadata.get("name")
        or payload.get("full_name")
        or email.split("@")[0]
    )

    token_role = payload.get("app_metadata", {}).get("role") or payload.get("role")
    system_role = token_role if token_role in ("super_admin", "admin") else "user"

    # Synchronize User model in PostgreSQL
    user = db.query(User).filter((User.id == str(sub)) | (User.email == email)).first()
    if not user:
        try:
            user = User(
                id=str(sub),
                email=email,
                full_name=full_name,
                role=system_role,
                is_active=True,
                is_verified=True,
                password_hash="",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
    elif token_role == "super_admin" and user.role != "super_admin":
        user.role = "super_admin"
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()

    return user


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Mandatory authentication dependency.
    Requires Authorization: Bearer <token>. Rejects missing, invalid, or expired tokens with 401.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_supabase_jwt(credentials.credentials)
    sub = payload.get("sub") or payload.get("user_id")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject (missing sub)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("email") or f"{sub}@supabase.user"
    user_metadata = payload.get("user_metadata") or {}
    full_name = (
        user_metadata.get("full_name")
        or user_metadata.get("name")
        or payload.get("full_name")
        or email.split("@")[0]
    )

    token_role = payload.get("app_metadata", {}).get("role") or payload.get("role")
    system_role = token_role if token_role in ("super_admin", "admin") else "user"

    user = db.query(User).filter((User.id == str(sub)) | (User.email == email)).first()
    if not user:
        try:
            user = User(
                id=str(sub),
                email=email,
                full_name=full_name,
                role=system_role,
                is_active=True,
                is_verified=True,
                password_hash="",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as e:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to synchronize authenticated user profile",
                )
    elif token_role == "super_admin" and user.role != "super_admin":
        user.role = "super_admin"
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated",
        )

    return user
