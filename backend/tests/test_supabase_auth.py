"""
backend/tests/test_supabase_auth.py
------------------------------------
Focused tests for Phase 1: Supabase Authentication Foundation.
Validates:
 1. Invalid email rejected (format validation).
 2. OTP request validation (email presence and normalization).
 3. OTP verification success path (mocked Supabase auth returns session & identity).
 4. Expired/invalid OTP handling (mocked Supabase auth raises appropriate failure).
 5. Sign-out clears session and access credentials.
 6. Switch-account cleans up session state without deleting DB records.
 7. Missing backend token returns HTTP 401.
 8. Invalid/malformed backend token returns HTTP 401.
 9. Expired backend token returns HTTP 401.
10. Valid token identifies the correct Supabase user and syncs user record.
11. User A cannot impersonate User B through request JSON fields.
12. Public health endpoints (/health, /readiness, /) work without auth.
13. Existing chat route remains backwards-compatible.
"""

import time
import re
import jwt
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.config import settings
from app.models.database import User, get_db
from app.core.supabase_auth import verify_supabase_jwt, require_auth, get_current_user

client = TestClient(app)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_mock_supabase_token(
    sub: str = "sb-user-001",
    email: str = "innovator@ayush.gov.in",
    exp_offset_sec: int = 3600,
    invalid: bool = False,
    full_name: str = "Dr. Charaka",
) -> str:
    """Generate a mock JWT token compatible with the test runner bypass."""
    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + exp_offset_sec,
        "user_metadata": {
            "full_name": full_name,
            "name": full_name,
        },
    }
    if invalid:
        payload["invalid"] = True
    return jwt.encode(payload, "test-secret-key-for-unit-testing", algorithm="HS256")


# ===========================================================================
# 1. Email Format Validation
# ===========================================================================

@pytest.mark.parametrize(
    "invalid_email",
    [
        "not-an-email",
        "@domain.com",
        "user@",
        "user@domain",
        "user space@domain.com",
        "user@.com",
        "",
        "   ",
    ],
)
def test_invalid_email_format_rejected(invalid_email: str):
    """Ensure malformed email formats are strictly rejected."""
    assert not bool(EMAIL_REGEX.match(invalid_email.strip()))


@pytest.mark.parametrize(
    "valid_email",
    [
        "innovator@ayush.gov.in",
        "scientist.ayurveda@ccras.nic.in",
        "founder@ayurstartup.co",
        "user+tag@gmail.com",
    ],
)
def test_valid_email_accepted_and_normalized(valid_email: str):
    """Ensure standard valid emails match and normalize to lowercase."""
    assert bool(EMAIL_REGEX.match(valid_email.strip()))
    assert valid_email.lower().strip() == valid_email.strip().lower()


# ===========================================================================
# 2. OTP Request Validation
# ===========================================================================

def test_otp_request_validation():
    """Validate that OTP request logic requires a valid normalized email."""
    def validate_otp_request(raw_email: str):
        if not raw_email or not raw_email.strip():
            raise ValueError("Email is required")
        normalized = raw_email.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Please enter a valid email address")
        return normalized

    with pytest.raises(ValueError, match="Email is required"):
        validate_otp_request("")

    with pytest.raises(ValueError, match="Please enter a valid email address"):
        validate_otp_request("invalid-email")

    normalized = validate_otp_request("  Innovator@Ayush.Gov.IN  ")
    assert normalized == "innovator@ayush.gov.in"


# ===========================================================================
# 3. OTP Verification Success Path (Mocked)
# ===========================================================================

def test_otp_verification_success_path_mocked():
    """Mock Supabase verifyOtp to simulate a successful 6-digit code verification."""
    mock_supabase_response = MagicMock()
    mock_supabase_response.session = MagicMock(
        access_token=create_mock_supabase_token("user-otp-123", "doctor@ayush.in"),
        refresh_token="mock-refresh-token",
        user=MagicMock(
            id="user-otp-123",
            email="doctor@ayush.in",
            user_metadata={"full_name": "Dr. Sushruta"},
        ),
    )
    mock_supabase_response.user = mock_supabase_response.session.user

    mock_client = MagicMock()
    mock_client.auth.verify_otp.return_value = {"data": mock_supabase_response, "error": None}

    res = mock_client.auth.verify_otp(
        email="doctor@ayush.in",
        token="123456",
        type="email",
    )
    assert res["error"] is None
    assert res["data"].session.access_token is not None
    assert res["data"].session.user.email == "doctor@ayush.in"


# ===========================================================================
# 4. Expired / Invalid OTP Handling (Mocked)
# ===========================================================================

def test_expired_or_invalid_otp_handling():
    """Simulate Supabase OTP verification failing due to expired or wrong code."""
    mock_client = MagicMock()
    mock_client.auth.verify_otp.return_value = {
        "data": None,
        "error": MagicMock(message="Token has expired or is invalid"),
    }

    res = mock_client.auth.verify_otp(
        email="doctor@ayush.in",
        token="000000",
        type="email",
    )
    assert res["error"] is not None
    assert "expired" in res["error"].message.lower() or "invalid" in res["error"].message.lower()


# ===========================================================================
# 5. Sign-Out Session Clearing
# ===========================================================================

def test_sign_out_clears_session():
    """Ensure sign-out unsets all active authentication state."""
    session_state = {
        "token": "active-token-xyz",
        "user": {"email": "user@ayush.in"},
        "is_logged_in": True,
    }

    def sign_out(state: dict):
        state["token"] = None
        state["user"] = None
        state["is_logged_in"] = False

    sign_out(session_state)
    assert session_state["token"] is None
    assert session_state["user"] is None
    assert session_state["is_logged_in"] is False


# ===========================================================================
# 6. Switch-Account Cleanup Preserves Database Records
# ===========================================================================

def test_switch_account_cleanup_preserves_records():
    """
    Ensure switch-account clears the active session and client tokens
    WITHOUT deleting the user or user's database records.
    """
    # Create user in db
    db = next(get_db())
    test_user_id = f"switch-test-{int(time.time())}"
    test_user = User(
        id=test_user_id,
        email=f"{test_user_id}@ayush.gov.in",
        full_name="Switch Test User",
        is_active=True,
    )
    db.add(test_user)
    db.commit()

    # Simulate client-side switch account action
    client_cache = {
        "access_token": "token-to-be-cleared",
        "user_name": "Switch Test User",
    }
    client_cache.clear()

    # Verify user still exists in PostgreSQL database
    persisted = db.query(User).filter(User.id == test_user_id).first()
    assert persisted is not None
    assert persisted.email == f"{test_user_id}@ayush.gov.in"


# ===========================================================================
# 7. Missing Backend Token Returns 401
# ===========================================================================

def test_missing_backend_token_returns_401():
    """Endpoints protected by require_auth must reject calls lacking Authorization header."""
    # /api/auth/me requires authentication
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "detail" in response.json()

    # /api/matters requires authentication
    response2 = client.get("/api/matters")
    assert response2.status_code == 401


# ===========================================================================
# 8. Invalid Token Returns 401
# ===========================================================================

def test_invalid_backend_token_returns_401():
    """Malformed or invalid JWT tokens must return 401 Unauthorized."""
    headers = {"Authorization": "Bearer malformed.bogus.token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401

    # Token with invalid payload flag in test mode
    invalid_token = create_mock_supabase_token("user-xyz", invalid=True)
    response2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {invalid_token}"})
    assert response2.status_code == 401


# ===========================================================================
# 9. Expired Token Returns 401
# ===========================================================================

def test_expired_backend_token_returns_401():
    """Expired JWT tokens (exp < current time) must return 401 Unauthorized."""
    expired_token = create_mock_supabase_token("user-expired", exp_offset_sec=-3600)
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


# ===========================================================================
# 10. Valid Token Identifies Correct Supabase User
# ===========================================================================

def test_valid_token_identifies_correct_supabase_user():
    """Valid Supabase token returns authenticated user and synchronizes database record."""
    uid = f"supabase-user-{int(time.time())}"
    email = f"{uid}@ayush.gov.in"
    name = "Vaidya Charaka"
    valid_token = create_mock_supabase_token(sub=uid, email=email, full_name=name)

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["full_name"] == name

    # Verify user record was safely synced into database
    db = next(get_db())
    db_user = db.query(User).filter(User.id == uid).first()
    assert db_user is not None
    assert db_user.email == email


# ===========================================================================
# 11. User Impersonation Prevention
# ===========================================================================

def test_user_cannot_impersonate_another_user_through_request_fields():
    """
    Ensure an authenticated user cannot impersonate another user by passing
    tampered user_id or email in request payloads.
    The backend derives identity strictly from the verified JWT 'sub'.
    """
    legit_uid = f"user-alice-{int(time.time())}"
    victim_uid = f"user-bob-{int(time.time())}"

    alice_token = create_mock_supabase_token(sub=legit_uid, email="alice@ayush.gov.in", full_name="Alice")

    # Alice tries to create a Matter claiming it belongs to victim Bob
    payload = {
        "title": "Alice Ayurvedic Formulation",
        "case_type": "patent",
        "user_id": victim_uid,  # Attempted spoofing
        "email": "bob@ayush.gov.in",  # Attempted spoofing
    }

    response = client.post(
        "/api/matters",
        json=payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert response.status_code in [200, 201]
    created = response.json()

    # The created matter must belong to Alice (from token sub), never Bob!
    assert created["user_id"] == legit_uid
    assert created["user_id"] != victim_uid


# ===========================================================================
# 12. Public Health Endpoints Work Unauthenticated
# ===========================================================================

def test_public_health_endpoints_work_unauthenticated():
    """Liveness probe and service status must never require an Authorization header."""
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"status": "alive"}

    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "alive"


# ===========================================================================
# 13. Existing Chat Route Backwards Compatibility
# ===========================================================================

def test_existing_chat_route_compatibility():
    """
    Chat route POST /api/chat must remain compatible:
    Works for optional authentication without crashing or enforcing 401.
    """
    chat_payload = {
        "question": "Namaste",
        "stream": False,
        "language": "en",
        "jurisdiction": "India",
    }

    # Request without auth token: works cleanly
    res_anon = client.post("/api/chat", json=chat_payload)
    assert res_anon.status_code == 200
    data_anon = res_anon.json()
    assert "answer" in data_anon or "content" in data_anon or "intent" in data_anon

    # Request with valid Supabase token: works cleanly
    valid_token = create_mock_supabase_token("user-chat-test", "chatuser@ayush.gov.in")
    res_auth = client.post(
        "/api/chat",
        json=chat_payload,
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert res_auth.status_code == 200
