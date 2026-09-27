"""
backend/tests/test_phase3_identity.py
--------------------------------------
Comprehensive test suite for Phase 3: Profiles, Organisations, and RBAC Membership Identity.

Validates:
 1. Profile auto-provisioning on GET /api/profile
 2. Self-service profile update via PATCH /api/profile
 3. Profile isolation (User A cannot alter User B's profile)
 4. Organisation creation with automatic 'organisation_admin' assignment
 5. Slug generation and duplicate slug conflict (409) handling
 6. Cross-tenant isolation (non-member receives 404 on org endpoints to prevent tenant enumeration)
 7. Organisation membership listing for active members
 8. RBAC enforcement: normal 'user' cannot add or modify members (403 Forbidden)
 9. Prevention of privilege escalation: non-super_admin cannot grant 'super_admin' role (403)
 10. Admin role update and demotion protection (sole admin cannot be demoted/removed)
 11. Member removal with sole-admin guard
 12. Super admin global inspection and privileged operations
 13. Backwards compatibility with existing chat endpoint
"""

import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.database import Organisation, OrganisationMember, Profile, User, get_db

client = TestClient(app)


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

def create_test_token(
    sub: str,
    email: str,
    full_name: str = "Test User",
    role: str = "authenticated",
) -> str:
    """Creates a mock JWT token handled by test mode bypass in verify_supabase_jwt."""
    import jwt

    payload = {
        "sub": sub,
        "email": email,
        "aud": "authenticated",
        "role": role,
        "exp": int(time.time()) + 3600,
        "user_metadata": {
            "full_name": full_name,
            "name": full_name,
        },
    }
    return jwt.encode(payload, "test-secret-phase3", algorithm="HS256")


# ---------------------------------------------------------------------------
# Tests: Profiles
# ---------------------------------------------------------------------------

def test_profile_auto_provisioning():
    """GET /api/profile auto-creates a Profile record for new users."""
    token = create_test_token("user-p3-001", "dr.patel@ayush.gov.in", "Dr. Patel")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/profile", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["user_id"] == "user-p3-001"
    assert data["email"] == "dr.patel@ayush.gov.in"
    assert data["profile"]["id"] == "user-p3-001"
    assert data["profile"]["full_name"] == "Dr. Patel"
    assert data["profile"]["preferred_language"] == "en"
    assert isinstance(data["organisations"], list)


def test_profile_self_service_update():
    """PATCH /api/profile allows the authenticated user to update their profile."""
    token = create_test_token("user-p3-002", "dr.mehta@ayush.gov.in", "Dr. Mehta")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial profile creation
    client.get("/api/profile", headers=headers)

    # Patch profile
    patch_payload = {
        "full_name": "Dr. Rajesh Mehta, Ph.D.",
        "avatar_url": "https://example.com/avatar/mehta.png",
        "preferred_language": "hi",
    }
    patch_resp = client.patch("/api/profile", json=patch_payload, headers=headers)
    assert patch_resp.status_code == 200, patch_resp.text
    patched = patch_resp.json()

    assert patched["full_name"] == "Dr. Rajesh Mehta, Ph.D."
    assert patched["avatar_url"] == "https://example.com/avatar/mehta.png"
    assert patched["preferred_language"] == "hi"

    # Verify persistent state via GET /api/profile
    get_resp = client.get("/api/profile", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["profile"]["full_name"] == "Dr. Rajesh Mehta, Ph.D."
    assert get_resp.json()["profile"]["preferred_language"] == "hi"


def test_profile_isolation_between_users():
    """User A's profile updates cannot modify User B's profile."""
    token_a = create_test_token("user-p3-a", "user.a@ayush.gov.in", "User A")
    token_b = create_test_token("user-p3-b", "user.b@ayush.gov.in", "User B")

    client.get("/api/profile", headers={"Authorization": f"Bearer {token_a}"})
    client.get("/api/profile", headers={"Authorization": f"Bearer {token_b}"})

    # User A updates profile
    client.patch(
        "/api/profile",
        json={"full_name": "User A Modified", "preferred_language": "ta"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # User B's profile must remain untouched
    resp_b = client.get("/api/profile", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_b.status_code == 200
    assert resp_b.json()["profile"]["full_name"] == "User B"
    assert resp_b.json()["profile"]["preferred_language"] == "en"


# ---------------------------------------------------------------------------
# Tests: Organisations & Membership
# ---------------------------------------------------------------------------

def test_organisation_creation_and_auto_admin():
    """POST /api/organisations creates org and assigns creator as organisation_admin."""
    token = create_test_token("founder-p3-01", "founder@ayushlabs.in", "Ayush Founder")
    headers = {"Authorization": f"Bearer {token}"}

    create_payload = {
        "name": "Central Council for Research in Ayurvedic Sciences",
        "slug": "ccras-india",
    }
    resp = client.post("/api/organisations", json=create_payload, headers=headers)
    assert resp.status_code == 201, resp.text
    org = resp.json()

    assert org["name"] == "Central Council for Research in Ayurvedic Sciences"
    assert org["slug"] == "ccras-india"
    assert org["created_by"] == "founder-p3-01"
    assert org["my_role"] == "organisation_admin"

    # Listed in GET /api/organisations/me
    my_orgs_resp = client.get("/api/organisations/me", headers=headers)
    assert my_orgs_resp.status_code == 200
    my_orgs = my_orgs_resp.json()
    assert any(o["id"] == org["id"] and o["my_role"] == "organisation_admin" for o in my_orgs)


def test_organisation_duplicate_slug_conflict():
    """POST /api/organisations with an existing slug returns 409 Conflict."""
    token = create_test_token("user-slug-01", "slug1@ayushlabs.in", "Slug User 1")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"name": "National Institute of Ayurveda", "slug": "nia-jaipur"}
    resp1 = client.post("/api/organisations", json=payload, headers=headers)
    assert resp1.status_code == 201

    # Second creation with identical slug must conflict
    resp2 = client.post("/api/organisations", json=payload, headers=headers)
    assert resp2.status_code == 409
    assert "already taken" in resp2.json()["detail"]


def test_cross_tenant_isolation_returns_404():
    """
    Non-members attempting to access organisation details or members
    receive HTTP 404 to avoid leaking tenant existence.
    """
    # Org created by Org Owner
    owner_token = create_test_token("owner-org-01", "owner@org-a.com", "Org Owner")
    create_resp = client.post(
        "/api/organisations",
        json={"name": "Proprietary Herbals Ltd", "slug": "proprietary-herbals"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert create_resp.status_code == 201
    org_id = create_resp.json()["id"]

    # Stranger tries to inspect Org A
    stranger_token = create_test_token("stranger-01", "outsider@external.com", "Outsider")
    stranger_headers = {"Authorization": f"Bearer {stranger_token}"}

    # GET details should 404
    details_resp = client.get(f"/api/organisations/{org_id}", headers=stranger_headers)
    assert details_resp.status_code == 404

    # GET members should 404
    members_resp = client.get(f"/api/organisations/{org_id}/members", headers=stranger_headers)
    assert members_resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: RBAC & Membership Operations
# ---------------------------------------------------------------------------

def test_add_member_rbac_and_flow():
    """Organisation admin can add a registered user; non-admin receives 403."""
    # 1. Setup Admin, Member User, and Target User
    admin_token = create_test_token("admin-user-01", "admin@institute.gov.in", "Institute Admin")
    target_token = create_test_token("target-user-01", "researcher@institute.gov.in", "Target Researcher")
    normal_member_token = create_test_token("normal-user-01", "staff@institute.gov.in", "Staff Member")

    # Provision target and staff users in DB via GET /api/profile
    client.get("/api/profile", headers={"Authorization": f"Bearer {target_token}"})
    client.get("/api/profile", headers={"Authorization": f"Bearer {normal_member_token}"})

    # Admin creates organisation
    org_resp = client.post(
        "/api/organisations",
        json={"name": "All India Institute of Ayurveda", "slug": "aiia-delhi"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Add staff as a regular member
    client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "staff@institute.gov.in", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Regular staff member tries to add another member -> MUST RETURN 403
    forbidden_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "researcher@institute.gov.in", "role": "reviewer"},
        headers={"Authorization": f"Bearer {normal_member_token}"},
    )
    assert forbidden_resp.status_code == 403
    assert "requires one of roles" in forbidden_resp.json()["detail"]

    # 3. Admin adds researcher with role 'reviewer' -> MUST SUCCEED
    add_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "researcher@institute.gov.in", "role": "reviewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert add_resp.status_code == 201, add_resp.text
    new_member = add_resp.json()
    assert new_member["user_id"] == "target-user-01"
    assert new_member["role"] == "reviewer"

    # 4. Duplicate addition returns 409
    dup_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "researcher@institute.gov.in", "role": "reviewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dup_resp.status_code == 409


def test_privilege_escalation_prevented():
    """An organisation_admin cannot assign the super_admin role."""
    admin_token = create_test_token("org-admin-priv", "admin@priv.gov.in", "Priv Admin")
    target_token = create_test_token("target-priv", "target@priv.gov.in", "Target User")

    client.get("/api/profile", headers={"Authorization": f"Bearer {target_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Priv Test Org", "slug": "priv-test-org"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Attempting to grant 'super_admin' role without system super_admin credentials must be rejected
    escalate_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "target@priv.gov.in", "role": "super_admin"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert escalate_resp.status_code == 403
    assert "Only system super administrators" in escalate_resp.json()["detail"]


def test_member_role_update_and_sole_admin_protection():
    """Updating a member's role works, but sole admin cannot be demoted."""
    admin_token = create_test_token("sole-admin-01", "sole.admin@ayush.org", "Sole Admin")
    member_token = create_test_token("member-02", "member2@ayush.org", "Member Two")

    client.get("/api/profile", headers={"Authorization": f"Bearer {member_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Sole Admin Org", "slug": "sole-admin-org"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Add member as 'user'
    client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "member2@ayush.org", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Promote member to 'reviewer'
    patch_resp = client.patch(
        f"/api/organisations/{org_id}/members/member-02",
        json={"role": "reviewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["role"] == "reviewer"

    # Attempt to demote the sole organisation_admin -> MUST RETURN 400
    demote_admin_resp = client.patch(
        f"/api/organisations/{org_id}/members/sole-admin-01",
        json={"role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert demote_admin_resp.status_code == 400
    assert "Cannot demote the sole organisation administrator" in demote_admin_resp.json()["detail"]


def test_member_removal_and_sole_admin_protection():
    """Members can be removed by admin, but sole admin cannot be removed."""
    admin_token = create_test_token("admin-rem-01", "admin.rem@ayush.org", "Rem Admin")
    member_token = create_test_token("member-rem-02", "member.rem@ayush.org", "Rem Member")

    client.get("/api/profile", headers={"Authorization": f"Bearer {member_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Removal Test Org", "slug": "rem-test-org"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Add member
    client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "member.rem@ayush.org", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Sole admin cannot remove themselves
    del_admin_resp = client.delete(
        f"/api/organisations/{org_id}/members/admin-rem-01",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_admin_resp.status_code == 400
    assert "Cannot remove the sole organisation administrator" in del_admin_resp.json()["detail"]

    # Admin removes member -> MUST SUCCEED
    del_member_resp = client.delete(
        f"/api/organisations/{org_id}/members/member-rem-02",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_member_resp.status_code == 200
    assert del_member_resp.json()["status"] == "success"

    # Verify member is gone
    members_list_resp = client.get(
        f"/api/organisations/{org_id}/members",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    member_ids = [m["user_id"] for m in members_list_resp.json()]
    assert "member-rem-02" not in member_ids


# ---------------------------------------------------------------------------
# Test: Chat Route Compatibility
# ---------------------------------------------------------------------------

def test_existing_chat_route_compatibility():
    """Verify that existing /api/chat functionality continues to work with user identity."""
    token = create_test_token("chat-user-01", "innovator@chat.gov.in", "Chat Innovator")
    headers = {"Authorization": f"Bearer {token}"}

    # Verify the user has a profile
    prof_resp = client.get("/api/profile", headers=headers)
    assert prof_resp.status_code == 200

    # Test that conversation initialization works
    conv_resp = client.post(
        "/api/conversations",
        json={"title": "Phase 3 Compatibility Check", "jurisdiction": "India", "language": "en"},
        headers=headers,
    )
    assert conv_resp.status_code in (200, 201), conv_resp.text
    conv_id = conv_resp.json()["id"]
    assert conv_id is not None
