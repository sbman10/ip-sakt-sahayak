# Phase 5 Implementation Plan: Explicit RBAC and Permissions

## Objective
Implement a robust, explicit permission-based authorization layer on top of the verified-user and organisation-membership infrastructure established in Phases 1–4.

---

## Architectural Principles
1. **Central Permission Registry**:
   - Explicit definitions of system and tenant permissions as an extensible `Enum`.
   - Clear mapping matrix from roles (`super_admin`, `organisation_admin`, `reviewer`, `user`) to granted permission sets.
2. **Server-Side Enforcement**:
   - Zero reliance on frontend authorization; UI role checks are visual hints only.
   - Every API endpoint that mutates or accesses tenant resources enforces permission checks.
3. **HTTP Status Code Precision**:
   - `401 Unauthorized` for missing, expired, or invalid identity credentials.
   - `403 Forbidden` for authenticated callers lacking the specific required permission.
   - `404 Not Found` for non-member organisation/resource lookups (preserving anti-enumeration).
4. **Organisation-Scoped Privilege**:
   - Permissions are resolved against the caller's active organisation membership (`membership.role` / `tenant.role`), ensuring cross-tenant privilege separation.
5. **Audit Logging of Sensitive Actions**:
   - All administrative actions (member creation, role changes, member removal, deletions) are recorded in `audit_logs` with actor `user_id` and target `organisation_id`.
6. **No Premature Custom JWT Claims**:
   - Direct database-backed checks are verified and tested before any custom token claim extensions.

---

## Permission Matrix
| Permission | Description | super_admin | organisation_admin | reviewer | user |
|---|---|:---:|:---:|:---:|:---:|
| `org:read` | Inspect organisation metadata | Yes | Yes | Yes | Yes |
| `org:update` | Edit organisation settings | Yes | Yes | No | No |
| `org:delete` | Delete organisation | Yes | Yes | No | No |
| `member:read` | List organisation members | Yes | Yes | Yes | Yes |
| `member:create` | Add/invite user to organisation | Yes | Yes | No | No |
| `member:update_role`| Modify member role | Yes | Yes | No | No |
| `member:delete` | Remove member from organisation | Yes | Yes | No | No |
| `document:read` | View & download private documents | Yes | Yes | Yes | Yes |
| `document:create` | Upload & ingest documents | Yes | Yes | Yes | Yes |
| `document:delete` | Delete documents | Yes | Yes | Yes | No (admin/reviewer or owner) |
| `conversation:read`| Access chat sessions | Yes | Yes | Yes | Yes |
| `conversation:create`| Create chat sessions | Yes | Yes | Yes | Yes |
| `conversation:update`| Update chat sessions | Yes | Yes | Yes | Yes |
| `conversation:delete`| Delete chat sessions | Yes | Yes | Yes | Yes |
| `chat:query` | Execute chat & RAG inference | Yes | Yes | Yes | Yes |
| `matter:read` | View matters, events, deadlines | Yes | Yes | Yes | Yes |
| `matter:create` | Create matters & filings | Yes | Yes | Yes | Yes |
| `matter:update` | Update matters & timeline events | Yes | Yes | Yes | Yes |
| `matter:delete` | Delete legal matters | Yes | Yes | No | No |
| `patentability:run`| Run AI patentability assessments | Yes | Yes | Yes | Yes |
| `patentability:read`| View prior-art assessments | Yes | Yes | Yes | Yes |
| `audit:read` | View DPDP audit telemetry | Yes | Yes | Yes | No |

---

## Implementation Steps
1. **Permission Registry**:
   - Create `backend/app/core/permissions.py` with `Permission` enum, `ROLE_PERMISSIONS` dict, `has_permission()`, and `require_permission()`.
2. **FastAPI Dependencies**:
   - Extend `backend/app/core/dependencies.py` with `require_permission(permission: Permission)` and `require_org_permission(permission: Permission)`.
3. **Audit Service Enhancement**:
   - Add `log_admin_action()` in `backend/app/services/audit_service.py` to persist administrative mutations to `audit_logs`.
4. **Router Updates**:
   - Update `organisations.py` to enforce `member:create`, `member:update_role`, `member:delete`, `org:read`, `member:read` and log admin audit records.
   - Update `matters.py` to enforce `matter:delete` using `require_permission(Permission.MATTER_DELETE)`.
   - Update `documents.py` to enforce `document:delete` using `require_permission(Permission.DOCUMENT_DELETE)`.
5. **Comprehensive Tests**:
   - Implement `backend/tests/test_phase5_rbac_permissions.py` testing every permission, 401 on missing auth, 403 on insufficient roles, reviewer boundaries, org admin capabilities, super admin bypass, organisation-scoped roles, and audit trail persistence.
6. **Verification**:
   - Execute full test suite (`pytest`) and frontend build check.
