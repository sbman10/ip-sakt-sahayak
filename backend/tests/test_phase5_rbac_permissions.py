"""
backend/tests/test_phase5_rbac_permissions.py
---------------------------------------------
Comprehensive test suite for Phase 5: Explicit RBAC and Permissions.

Validates:
1. Central permission registry and role-permission mappings:
   - Permission enum and ROLE_PERMISSIONS completeness
   - has_permission(), get_role_permissions(), check_permission_or_raise()
2. Missing identity returns HTTP 401 Unauthorized across protected endpoints.
3. Insufficient permission returns HTTP 403 Forbidden:
   - Standard 'user' role is blocked from administrative actions:
     - Member invitation (member:create) -> 403
     - Role updates (member:update_role) -> 403
     - Member deletion (member:delete) -> 403
     - Document deletion (document:delete) -> 403
     - Matter deletion (matter:delete) -> 403
4. Reviewer role permissions and boundaries:
   - 'reviewer' can read/create/update matters, read/upload/delete documents, run chat queries
   - 'reviewer' is blocked from deleting matters (403) and managing members (403)
5. Organisation admin allowed all organization actions:
   - 'organisation_admin' can manage members, create/update/delete matters, upload/read/delete documents
6. Super admin bypasses all boundaries across organisations.
7. Organisation-scoped role checks:
   - A user who is 'organisation_admin' in Org A and 'user' in Org B has admin rights in Org A,
     but is blocked (403) from admin operations in Org B.
8. Audit logging of sensitive administrative actions:
   - Member addition, role update, member removal, and matter deletion are persisted to audit_logs table.
9. Public endpoints remain accessible without authentication:
   - /health, /readiness, /api/health/llm remain open with 200 OK.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.permissions import (
    Permission,
    ROLE_PERMISSIONS,
    check_permission_or_raise,
    get_role_permissions,
    has_permission,
)
from app.main import app
from app.models.database import AuditLog, get_db

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
    return jwt.encode(payload, "test-secret-phase5", algorithm="HS256")


# ---------------------------------------------------------------------------
# Test 1: Central Permission Registry & Role Mappings
# ---------------------------------------------------------------------------

def test_permission_registry_completeness():
    """
    Validate that:
    - All expected granular permissions are defined in Permission enum.
    - ROLE_PERMISSIONS maps all recognized roles.
    - Role hierarchies and boundaries are strictly defined.
    """
    # 1. Verify Permission enum members
    expected_permissions = [
        "org:read",
        "org:update",
        "org:delete",
        "member:read",
        "member:create",
        "member:update_role",
        "member:delete",
        "document:read",
        "document:create",
        "document:delete",
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:delete",
        "chat:query",
        "matter:read",
        "matter:create",
        "matter:update",
        "matter:delete",
        "patentability:run",
        "patentability:read",
        "audit:read",
    ]
    for perm_val in expected_permissions:
        assert Permission(perm_val) in set(Permission), f"Missing permission: {perm_val}"

    # 2. Verify all standard roles exist in ROLE_PERMISSIONS
    for role in ("super_admin", "organisation_admin", "reviewer", "user"):
        assert role in ROLE_PERMISSIONS, f"Role {role} missing from ROLE_PERMISSIONS"

    # 3. Super admin has every single permission
    all_enum_permissions = set(Permission)
    assert ROLE_PERMISSIONS["super_admin"] == all_enum_permissions

    # 4. Organisation admin has sensitive admin permissions
    org_admin_perms = ROLE_PERMISSIONS["organisation_admin"]
    assert Permission.MEMBER_CREATE in org_admin_perms
    assert Permission.MEMBER_UPDATE_ROLE in org_admin_perms
    assert Permission.MEMBER_DELETE in org_admin_perms
    assert Permission.MATTER_DELETE in org_admin_perms
    assert Permission.DOCUMENT_DELETE in org_admin_perms
    assert Permission.PATENTABILITY_RUN in org_admin_perms
    assert Permission.AUDIT_READ in org_admin_perms

    # 5. Reviewer has operational permissions and document operations, but lacks member admin & matter deletion
    reviewer_perms = ROLE_PERMISSIONS["reviewer"]
    assert Permission.MATTER_READ in reviewer_perms
    assert Permission.MATTER_CREATE in reviewer_perms
    assert Permission.MATTER_UPDATE in reviewer_perms
    assert Permission.DOCUMENT_READ in reviewer_perms
    assert Permission.DOCUMENT_CREATE in reviewer_perms
    assert Permission.DOCUMENT_DELETE in reviewer_perms
    assert Permission.PATENTABILITY_RUN in reviewer_perms
    assert Permission.PATENTABILITY_READ in reviewer_perms
    assert Permission.CHAT_QUERY in reviewer_perms
    assert Permission.AUDIT_READ in reviewer_perms
    assert Permission.MEMBER_CREATE not in reviewer_perms
    assert Permission.MEMBER_UPDATE_ROLE not in reviewer_perms
    assert Permission.MEMBER_DELETE not in reviewer_perms
    assert Permission.MATTER_DELETE not in reviewer_perms

    # 6. Standard user has baseline read/write but lacks admin, deletion, and audit read
    user_perms = ROLE_PERMISSIONS["user"]
    assert Permission.CONVERSATION_CREATE in user_perms
    assert Permission.CONVERSATION_READ in user_perms
    assert Permission.CHAT_QUERY in user_perms
    assert Permission.MATTER_READ in user_perms
    assert Permission.MATTER_CREATE in user_perms
    assert Permission.MATTER_UPDATE in user_perms
    assert Permission.DOCUMENT_READ in user_perms
    assert Permission.DOCUMENT_CREATE in user_perms
    assert Permission.PATENTABILITY_RUN in user_perms
    assert Permission.PATENTABILITY_READ in user_perms
    assert Permission.MEMBER_CREATE not in user_perms
    assert Permission.MEMBER_UPDATE_ROLE not in user_perms
    assert Permission.MEMBER_DELETE not in user_perms
    assert Permission.MATTER_DELETE not in user_perms
    assert Permission.DOCUMENT_DELETE not in user_perms
    assert Permission.AUDIT_READ not in user_perms

    # 7. Helper functions
    assert has_permission("organisation_admin", Permission.MEMBER_CREATE) is True
    assert has_permission("user", Permission.MEMBER_CREATE) is False
    assert has_permission("non_existent_role", Permission.CHAT_QUERY) is False

    assert Permission.MEMBER_CREATE in get_role_permissions("organisation_admin")
    assert get_role_permissions("unknown") == frozenset()

    # check_permission_or_raise returns None when permitted
    check_permission_or_raise("organisation_admin", Permission.MEMBER_CREATE)

    # check_permission_or_raise raises HTTPException 403 when forbidden
    with pytest.raises(HTTPException) as exc_info:
        check_permission_or_raise("user", Permission.MEMBER_CREATE)
    assert exc_info.value.status_code == 403
    assert "Insufficient permission" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Test 2: Missing Identity Returns HTTP 401
# ---------------------------------------------------------------------------

def test_unauthenticated_request_returns_401():
    """
    Verify that requests without authentication headers or with invalid tokens
    return HTTP 401 Unauthorized across protected endpoints.
    """
    # 1. Missing Authorization header
    endpoints = [
        ("GET", "/api/profile"),
        ("GET", "/api/organisations/me"),
        ("GET", "/api/matters"),
        ("POST", "/api/matters"),
        ("GET", "/api/documents"),
        ("DELETE", f"/api/matters/{uuid.uuid4()}"),
    ]

    for method, path in endpoints:
        if method == "GET":
            resp = client.get(path)
        elif method == "DELETE":
            resp = client.delete(path)
        else:
            resp = client.post(path, json={})
        assert resp.status_code == 401, f"Expected 401 on unauthenticated {method} {path}, got {resp.status_code}"
        assert "WWW-Authenticate" in resp.headers

    # 2. Malformed / invalid Bearer token
    bad_headers = {"Authorization": "Bearer not-a-valid-token-string"}
    resp = client.get("/api/profile", headers=bad_headers)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Test 3: Insufficient Permission Server-Side Checks (HTTP 403)
# ---------------------------------------------------------------------------

def test_user_role_blocked_from_admin_actions_returns_403():
    """
    Standard 'user' role is blocked with HTTP 403 from:
    - Adding members (member:create)
    - Updating member roles (member:update_role)
    - Removing members (member:delete)
    - Deleting matters (matter:delete)
    - Deleting documents (document:delete)
    """
    admin_token = create_test_token("admin-p5-u1", "admin@law.in", "Admin User")
    user_token = create_test_token("user-p5-u2", "user@law.in", "Standard User")
    target_token = create_test_token("target-p5-u3", "target@law.in", "Target User")

    # Provision target & standard user profiles
    client.get("/api/profile", headers={"Authorization": f"Bearer {user_token}"})
    client.get("/api/profile", headers={"Authorization": f"Bearer {target_token}"})

    # Admin creates organisation
    org_resp = client.post(
        "/api/organisations",
        json={"name": "RBAC Test Chambers", "slug": f"rbac-test-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Admin adds standard user to org with role 'user'
    add_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "user@law.in", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert add_resp.status_code == 201

    admin_headers = {"Authorization": f"Bearer {admin_token}", "X-Organisation-ID": org_id}
    user_headers = {"Authorization": f"Bearer {user_token}", "X-Organisation-ID": org_id}

    # Admin creates a matter in the org
    matter = client.post(
        "/api/matters",
        json={"title": "Ashwagandha Extract Patent Application", "case_type": "patent"},
        headers=admin_headers,
    ).json()
    matter_id = matter["id"]

    # 1. Standard user attempts to invite a member -> 403 Forbidden
    invite_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "target@law.in", "role": "user"},
        headers=user_headers,
    )
    assert invite_resp.status_code == 403
    assert "Insufficient permission" in invite_resp.json()["detail"] or "requires one of roles" in invite_resp.json()["detail"]

    # 2. Standard user attempts to update member role -> 403 Forbidden
    patch_role_resp = client.patch(
        f"/api/organisations/{org_id}/members/admin-p5-u1",
        json={"role": "user"},
        headers=user_headers,
    )
    assert patch_role_resp.status_code == 403

    # 3. Standard user attempts to remove member -> 403 Forbidden
    remove_member_resp = client.delete(
        f"/api/organisations/{org_id}/members/admin-p5-u1",
        headers=user_headers,
    )
    assert remove_member_resp.status_code == 403

    # 4. Standard user attempts to delete matter -> 403 Forbidden
    del_matter_resp = client.delete(f"/api/matters/{matter_id}", headers=user_headers)
    assert del_matter_resp.status_code == 403
    assert "Insufficient permission: 'matter:delete'" in del_matter_resp.json()["detail"]

    # 5. Standard user attempts to delete a document -> 403 Forbidden
    del_doc_resp = client.delete(f"/api/documents/{uuid.uuid4()}", headers=user_headers)
    assert del_doc_resp.status_code == 403
    assert "Insufficient permission: 'document:delete'" in del_doc_resp.json()["detail"]

    # 6. Standard user lacks audit:read permission
    with pytest.raises(HTTPException) as exc_audit:
        check_permission_or_raise("user", Permission.AUDIT_READ)
    assert exc_audit.value.status_code == 403


# ---------------------------------------------------------------------------
# Test 4: Reviewer Role Permissions and Boundaries
# ---------------------------------------------------------------------------

def test_reviewer_role_permissions_and_boundaries():
    """
    'reviewer' role can:
    - View matters (matter:read)
    - Create matters (matter:create)
    - Update matters (matter:update)
    - View documents (document:read)
    - Run chat queries (chat:query)
    'reviewer' role CANNOT:
    - Delete matters (matter:delete) -> 403
    - Add members (member:create) -> 403
    - Remove members (member:delete) -> 403
    """
    admin_token = create_test_token("admin-rev-01", "admin@revcorp.in", "Rev Admin")
    reviewer_token = create_test_token("rev-user-02", "reviewer@revcorp.in", "IP Reviewer")

    client.get("/api/profile", headers={"Authorization": f"Bearer {reviewer_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Reviewer Test Org", "slug": f"rev-org-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    org_id = org_resp.json()["id"]

    # Admin adds member as 'reviewer'
    client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "reviewer@revcorp.in", "role": "reviewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    admin_headers = {"Authorization": f"Bearer {admin_token}", "X-Organisation-ID": org_id}
    rev_headers = {"Authorization": f"Bearer {reviewer_token}", "X-Organisation-ID": org_id}

    # 1. Reviewer CAN read matters
    matters_resp = client.get("/api/matters", headers=rev_headers)
    assert matters_resp.status_code == 200

    # 2. Reviewer CAN create matter
    create_matter_resp = client.post(
        "/api/matters",
        json={"title": "Reviewer Filed Matter", "case_type": "trademark"},
        headers=rev_headers,
    )
    assert create_matter_resp.status_code == 201
    matter_id = create_matter_resp.json()["id"]

    # 3. Reviewer CAN update matter (using valid CaseStatus)
    update_matter_resp = client.put(
        f"/api/matters/{matter_id}",
        json={"title": "Reviewer Updated Matter Title", "status": "examination"},
        headers=rev_headers,
    )
    assert update_matter_resp.status_code == 200
    assert update_matter_resp.json()["status"] == "examination"

    # 4. Reviewer CAN list documents
    docs_resp = client.get("/api/documents", headers=rev_headers)
    assert docs_resp.status_code == 200

    # 5. Reviewer CAN execute chat query
    with patch("app.routers.chat.hybrid_rrf_search", return_value=[]):
        chat_resp = client.post(
            "/api/chat",
            json={"question": "What are the requirements for Section 3(d)?", "jurisdiction": "India"},
            headers=rev_headers,
        )
        assert chat_resp.status_code == 200

    # 6. Reviewer CANNOT delete matter -> 403 Forbidden
    del_matter_resp = client.delete(f"/api/matters/{matter_id}", headers=rev_headers)
    assert del_matter_resp.status_code == 403
    assert "Insufficient permission: 'matter:delete'" in del_matter_resp.json()["detail"]

    # 7. Reviewer CANNOT add members -> 403 Forbidden
    add_member_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "nobody@revcorp.in", "role": "user"},
        headers=rev_headers,
    )
    assert add_member_resp.status_code == 403

    # 8. Reviewer CANNOT remove members -> 403 Forbidden
    del_member_resp = client.delete(
        f"/api/organisations/{org_id}/members/admin-rev-01",
        headers=rev_headers,
    )
    assert del_member_resp.status_code == 403


# ---------------------------------------------------------------------------
# Test 5: Organisation Admin Allowed All Organization Actions
# ---------------------------------------------------------------------------

def test_organisation_admin_allowed_all_org_actions():
    """
    'organisation_admin' can perform all tenant-scoped operations:
    - Member management (add, update role, delete)
    - Matter management (create, read, update, delete)
    - Document deletion
    """
    admin_token = create_test_token("admin-full-01", "owner@legalteam.in", "Org Admin")
    target_token = create_test_token("target-full-02", "paralegal@legalteam.in", "Paralegal")

    client.get("/api/profile", headers={"Authorization": f"Bearer {target_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Full Access Org", "slug": f"full-org-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    org_id = org_resp.json()["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "X-Organisation-ID": org_id}

    # 1. Admin adds member
    add_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "paralegal@legalteam.in", "role": "user"},
        headers=admin_headers,
    )
    assert add_resp.status_code == 201

    # 2. Admin updates member role
    patch_resp = client.patch(
        f"/api/organisations/{org_id}/members/target-full-02",
        json={"role": "reviewer"},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["role"] == "reviewer"

    # 3. Admin creates matter
    create_matter_resp = client.post(
        "/api/matters",
        json={"title": "Admin Created Matter", "case_type": "copyright"},
        headers=admin_headers,
    )
    assert create_matter_resp.status_code == 201
    matter_id = create_matter_resp.json()["id"]

    # 4. Admin deletes matter -> MUST SUCCEED (200)
    del_matter_resp = client.delete(f"/api/matters/{matter_id}", headers=admin_headers)
    assert del_matter_resp.status_code == 200
    assert del_matter_resp.json()["id"] == matter_id

    # 5. Admin removes member -> MUST SUCCEED (200)
    del_member_resp = client.delete(
        f"/api/organisations/{org_id}/members/target-full-02",
        headers=admin_headers,
    )
    assert del_member_resp.status_code == 200


# ---------------------------------------------------------------------------
# Test 6: Super Admin Bypasses Boundaries
# ---------------------------------------------------------------------------

def test_super_admin_bypasses_all_boundaries():
    """
    A system 'super_admin' bypasses organisation boundaries and has all permissions.
    """
    owner_token = create_test_token("owner-super-01", "owner@normal.in", "Normal Owner")
    super_admin_token = create_test_token("super-admin-01", "sysadmin@gov.in", "System Super Admin", role="super_admin")

    # Create organisation by regular owner
    org_resp = client.post(
        "/api/organisations",
        json={"name": "Inspected Org", "slug": f"inspect-org-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    org_id = org_resp.json()["id"]

    # Super admin accesses organisation details without prior membership -> MUST SUCCEED
    super_headers = {
        "Authorization": f"Bearer {super_admin_token}",
        "X-Organisation-ID": org_id,
    }
    details_resp = client.get(f"/api/organisations/{org_id}", headers=super_headers)
    assert details_resp.status_code == 200
    assert details_resp.json()["id"] == org_id

    # Super admin lists matters in the organisation
    matters_resp = client.get("/api/matters", headers=super_headers)
    assert matters_resp.status_code == 200


# ---------------------------------------------------------------------------
# Test 7: Organisation-Scoped Role Checks (Per-Tenant Role Isolation)
# ---------------------------------------------------------------------------

def test_organisation_scoped_roles_isolation():
    """
    Prove that role checks are strictly organisation-scoped:
    - User Alice creates Org Alpha -> Alice is 'organisation_admin' in Org Alpha.
    - User Bob creates Org Beta -> Bob is 'organisation_admin' in Org Beta.
    - Bob invites Alice to Org Beta with role 'user'.
    - In Org Alpha: Alice can delete matters and add members.
    - In Org Beta: Alice is blocked (403) from deleting matters and adding members.
    """
    alice_token = create_test_token("alice-multi-01", "alice@legal.in", "Alice Counsel")
    bob_token = create_test_token("bob-multi-02", "bob@ipfirm.in", "Bob Partner")

    # Alice initializes profile
    client.get("/api/profile", headers={"Authorization": f"Bearer {alice_token}"})

    # Alice creates Org Alpha
    alpha_resp = client.post(
        "/api/organisations",
        json={"name": "Alpha Chambers", "slug": f"alpha-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert alpha_resp.status_code == 201
    alpha_id = alpha_resp.json()["id"]

    # Bob creates Org Beta
    beta_resp = client.post(
        "/api/organisations",
        json={"name": "Beta Chambers", "slug": f"beta-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert beta_resp.status_code == 201
    beta_id = beta_resp.json()["id"]

    # Bob adds Alice to Org Beta as a regular 'user'
    bob_beta_headers = {"Authorization": f"Bearer {bob_token}", "X-Organisation-ID": beta_id}
    client.post(
        f"/api/organisations/{beta_id}/members",
        json={"email": "alice@legal.in", "role": "user"},
        headers=bob_beta_headers,
    )

    # Bob creates a matter in Beta
    beta_matter = client.post(
        "/api/matters",
        json={"title": "Beta Confidential Matter", "case_type": "patent"},
        headers=bob_beta_headers,
    ).json()
    beta_matter_id = beta_matter["id"]

    # Alice headers for Alpha vs Beta
    alice_alpha_headers = {"Authorization": f"Bearer {alice_token}", "X-Organisation-ID": alpha_id}
    alice_beta_headers = {"Authorization": f"Bearer {alice_token}", "X-Organisation-ID": beta_id}

    # Alice creates a matter in Alpha
    alpha_matter = client.post(
        "/api/matters",
        json={"title": "Alpha Proprietary Matter", "case_type": "patent"},
        headers=alice_alpha_headers,
    ).json()
    alpha_matter_id = alpha_matter["id"]

    # 1. In Org Alpha (Admin): Alice CAN delete Alpha matter -> 200 OK
    alpha_del = client.delete(f"/api/matters/{alpha_matter_id}", headers=alice_alpha_headers)
    assert alpha_del.status_code == 200

    # 2. In Org Beta (User): Alice CANNOT delete Beta matter -> 403 Forbidden!
    beta_del = client.delete(f"/api/matters/{beta_matter_id}", headers=alice_beta_headers)
    assert beta_del.status_code == 403
    assert "Insufficient permission: 'matter:delete'" in beta_del.json()["detail"]

    # 3. In Org Beta (User): Alice CANNOT add members to Beta -> 403 Forbidden!
    beta_add_member = client.post(
        f"/api/organisations/{beta_id}/members",
        json={"email": "someone@test.com", "role": "user"},
        headers=alice_beta_headers,
    )
    assert beta_add_member.status_code == 403


# ---------------------------------------------------------------------------
# Test 8: Audit Logging of Sensitive Administrative Actions
# ---------------------------------------------------------------------------

def test_admin_actions_are_audited_in_db():
    """
    Ensure sensitive administrative actions write audit records to audit_logs:
    - member_create
    - member_update_role
    - member_delete
    - matter_delete
    """
    admin_token = create_test_token("audit-admin-01", "auditor@ayush.gov.in", "Audit Administrator")
    target_token = create_test_token("audit-target-02", "clerk@ayush.gov.in", "Clerk")

    client.get("/api/profile", headers={"Authorization": f"Bearer {target_token}"})

    org_resp = client.post(
        "/api/organisations",
        json={"name": "Audit Logging Org", "slug": f"audit-org-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    org_id = org_resp.json()["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "X-Organisation-ID": org_id}

    # 1. Add member
    add_resp = client.post(
        f"/api/organisations/{org_id}/members",
        json={"email": "clerk@ayush.gov.in", "role": "user"},
        headers=admin_headers,
    )
    assert add_resp.status_code == 201

    # 2. Update member role
    patch_resp = client.patch(
        f"/api/organisations/{org_id}/members/audit-target-02",
        json={"role": "reviewer"},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200

    # 3. Create & delete matter
    matter = client.post(
        "/api/matters",
        json={"title": "Audited Matter Deletion", "case_type": "patent"},
        headers=admin_headers,
    ).json()
    assert "id" in matter
    matter_id = matter["id"]

    del_resp = client.delete(f"/api/matters/{matter_id}", headers=admin_headers)
    assert del_resp.status_code == 200

    # 4. Remove member
    del_mem_resp = client.delete(f"/api/organisations/{org_id}/members/audit-target-02", headers=admin_headers)
    assert del_mem_resp.status_code == 200

    # Query DB directly to verify AuditLog entries
    db = next(get_db())
    try:
        audit_records = (
            db.query(AuditLog)
            .filter(
                AuditLog.organisation_id == org_id,
                AuditLog.user_id == "audit-admin-01",
                AuditLog.jurisdiction == "Administrative",
            )
            .all()
        )
        assert len(audit_records) >= 4, f"Expected at least 4 admin audit logs, found {len(audit_records)}"

        actions_logged = [r.query_scrubbed for r in audit_records]
        assert any("member:create" in act for act in actions_logged), f"member:create not found in {actions_logged}"
        assert any("member:update_role" in act for act in actions_logged), f"member:update_role not found in {actions_logged}"
        assert any("matter:delete" in act for act in actions_logged), f"matter:delete not found in {actions_logged}"
        assert any("member:delete" in act for act in actions_logged), f"member:delete not found in {actions_logged}"
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test 9: Public Endpoints Unaffected
# ---------------------------------------------------------------------------

def test_public_endpoints_unaffected():
    """
    Confirm that public health check endpoints remain open without authentication.
    """
    resp1 = client.get("/health")
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "alive"

    resp2 = client.get("/readiness")
    assert resp2.status_code == 200

    resp3 = client.get("/api/health/llm")
    assert resp3.status_code == 200
