# IP-SAKTI Sahayak — Dynamic Memory & State Tracker

## Project Overview
- **System**: IP-SAKTI Sahayak (Ayush Traditional Knowledge & Patent Advisory AI)
- **Frontend**: React 19 / Vite 8 (Deployed on Vercel)
- **Backend**: FastAPI / Python 3.11 / Uvicorn (Deployed on Render)
- **Vector Database**: Qdrant Cloud (Hybrid Dense + Sparse BM25 / BGE-M3 / FastEmbed)
- **Primary Database**: Supabase PostgreSQL with Row Level Security (RLS)

---

## Phase Execution History

### Phase 1: Supabase Authentication Foundation (Completed)
- Email OTP passwordless authentication backed by Supabase Auth (`/auth/v1/otp`, `/auth/v1/verify`).
- Strict JWT verification using JWKS (ES256) caching with `PyJWKClient`.
- Deprecated custom insecure token generators in production flows.
- Automated token bypass reserved exclusively for isolated `pytest` runners.

### Phase 2: Render & Deployment Stability (Completed)
- Fixed `ALLOWED_ORIGINS` settings parsing in `backend/app/core/config.py` using flexible Pydantic v2 `before` validator supporting comma-separated strings, JSON arrays, and wildcards.
- Eliminated Render deployment crash on Python 3.14 / 3.11 environments.

### Phase 3: Profiles, Organisations, and Membership Identity (Completed)
- **Database Schema**:
  - `profiles`: 1:1 database-backed user profile (`id`, `full_name`, `avatar_url`, `preferred_language`, `created_at`, `updated_at`).
  - `organisations`: Multi-tenant institution entity (`id`, `name`, `slug` unique, `created_by`, timestamps).
  - `organisation_members`: Composite PK (`organisation_id`, `user_id`), `role` ('user', 'organisation_admin', 'reviewer', 'super_admin'), `created_at`.
- **Row Level Security (RLS)**:
  - Enabled RLS across all three tables in `scripts/migrations/phase3_profiles_organisations_rls.sql`.
  - Automatic `handle_new_user()` trigger on `auth.users` creates initial profile.
  - Safe policies restricting profile modification to owner, organisation inspection to members, and membership management to admins.
- **Backend Architecture**:
  - `backend/app/core/dependencies.py`: Reusable typed dependencies (`get_or_create_profile`, `get_current_org_membership`, `require_org_role`, `require_super_admin`).
  - `backend/app/routers/organisations.py`: REST API endpoints for profiles (`GET/PATCH /api/profile`), organisations (`POST /api/organisations`, `GET /api/organisations/me`, `GET /api/organisations/{id}`), and members (`GET/POST /api/organisations/{id}/members`, `PATCH/DELETE /api/organisations/{id}/members/{user_id}`).
  - Cross-tenant isolation: Unenrolled users receive `404 Not Found` when requesting foreign organisations to prevent tenant enumeration.
  - Privilege escalation & self-promotion prevention: Sole admins cannot self-demote or remove themselves; non-super_admins cannot grant `super_admin` role.
- **Frontend Integration**:
  - `frontend/src/components/UserProfileMenu.jsx`: Dynamically fetches `/api/profile`, displays verified primary organisation badge, role badge, and prevents leaking administrative controls to regular members.
  - `frontend/src/components/EditProfileModal.jsx`: Synchronizes profile changes to `/api/profile`.
- **Database Deployment**:
  - `phase3_profiles_organisations_rls.sql` successfully executed against production Supabase database. Tables, indexes, triggers, and RLS policies are live.

### Phase 4: Tenant and Document Isolation (Completed)
- **Database Schema**:
  - Added `organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE` (with indexing) across all 5 tenant-owned entities:
    - `conversations`
    - `matter_workspace`
    - `uploaded_documents`
    - `audit_logs`
    - `patentability_assessments`
- **Row-Level Security (RLS)**:
  - Enabled RLS across `conversations`, `uploaded_documents`, and `matter_workspace` in `scripts/migrations/phase4_tenant_document_isolation.sql`.
  - Enforced scoped access: users can only SELECT/INSERT/UPDATE/DELETE records where `organisation_id` matches active memberships in `organisation_members`.
- **Server-Side Tenant Context Resolution**:
  - `backend/app/core/dependencies.py`:
    - `TenantContext` dataclass carries immutable `user`, `organisation`, `membership`, `user_id`, `organisation_id`, `role`.
    - `get_or_create_personal_organisation`: Auto-provisions default workspace for users without one.
    - `get_tenant_context`: Resolves verified JWT user and server-side membership. Respects `X-Organisation-ID` header if membership is verified; rejects client-spoofed ownership fields. Returns 403 on invalid active workspace selection.
    - `get_optional_tenant_context`: Safe backwards compatibility for unauthenticated or public paths.
- **Hierarchical Storage Isolation**:
  - `backend/app/services/storage_service.py`:
    - Strict hierarchical path generation: `organisations/{organisation_id}/users/{user_id}/documents/{document_id}/{filename}`.
    - Path traversal prevention via filename sanitization.
    - Pre-action ownership verification before file downloads, signed URL generation, or deletion.
- **Qdrant Vector Payload Scoping**:
  - `backend/app/services/qdrant_service.py`:
    - Indexed `organisation_id` and `visibility` in Qdrant payloads.
    - Every private document chunk tagged with `visibility: "private"`, `user_id`, `organisation_id`, `document_id`.
    - Search queries strictly require server-generated tenant filters on `user_uploads`. Unfiltered searches to private collections are blocked at the vector service level.
- **Hybrid RRF Retrieval Scoping**:
  - `backend/app/services/retrieval_service.py`:
    - `hybrid_rrf_search` forwards `organisation_id` and `user_id` down to Qdrant searches on `user_uploads`.
- **Router Protections**:
  - `backend/app/routers/documents.py`: Ingestion, document listing, and document deletion fully scoped by `tenant.organisation_id`. Returns 404 on cross-tenant document access.
  - `backend/app/routers/uploads.py`: Upload retrieval, signed URLs, and deletion scoped by `tenant.organisation_id`.
  - `backend/app/routers/chat.py`: In `/api/chat` and `/api/chat/stream`, validates requested `document_ids` against `tenant.organisation_id` in database. Client-spoofed IDs are stripped/rejected. Conversation and message storage scoped by `tenant.organisation_id`.
  - `backend/app/routers/conversations.py`: CRUD operations for conversations and messages return 404 on foreign tenant access.
  - `backend/app/routers/matters.py`: Legal matter workspace CRUD and events isolated to `tenant.organisation_id`. Returns 404 on cross-tenant access.
  - `backend/app/routers/patentability.py`: Patentability assessments scoped by `tenant.organisation_id`.
  - `backend/app/services/audit_service.py`: Audit logs record `user_id` and `organisation_id`.
- **Automated Verification**:
  - `backend/tests/test_phase4_tenant_isolation.py`: 8 dedicated test suites verifying cross-user and cross-org document isolation, Qdrant payload filters, hierarchical storage paths, ownership tampering rejection, 404 enumeration resistance, and matter workspace isolation.
  - Full suite: 120/120 tests passed (`pytest`). Frontend: `npm run build` succeeds cleanly.

### Phase 5: Explicit RBAC and Permissions (Completed)
- **Central Permission Registry** (`backend/app/core/permissions.py`):
  - Created granular `Permission` enum: `org:read`, `org:update`, `org:delete`, `member:read`, `member:create`, `member:update_role`, `member:delete`, `document:read`, `document:create`, `document:delete`, `conversation:read`, `conversation:create`, `conversation:update`, `conversation:delete`, `chat:query`, `matter:read`, `matter:create`, `matter:update`, `matter:delete`, `patentability:run`, `patentability:read`, `audit:read`.
  - Defined explicit `ROLE_PERMISSIONS` mapping for `super_admin`, `organisation_admin`, `reviewer`, `user`.
  - Implemented `has_permission()`, `get_role_permissions()`, and `check_permission_or_raise()` (enforces HTTP 403 Forbidden with descriptive error details).
- **FastAPI Core Dependencies** (`backend/app/core/dependencies.py`):
  - `require_permission(permission)`: Enforces active organisation role permission checks for routes using `TenantContext`. Bypasses for `super_admin`.
  - `require_org_permission(permission)`: Enforces permission checks for path-scoped organisation routes (`/api/organisations/{id}/...`). Preserves 404 on unauthenticated/non-member access to prevent tenant enumeration.
- **Admin Audit Logging** (`backend/app/services/audit_service.py`):
  - `log_admin_action`: Records sensitive administrative actions (`member:create`, `member:update_role`, `member:delete`, `matter:delete`, `document:delete`) in `audit_logs` with actor `user_id`, `organisation_id`, action name, and details.
- **Router Protections**:
  - `backend/app/routers/organisations.py`: Member management (`member:create`, `member:update_role`, `member:delete`) protected with `require_org_permission` and audited.
  - `backend/app/routers/matters.py`: Matter operations (`matter:read`, `matter:create`, `matter:update`, `matter:delete`) protected with `require_permission`. Matter deletion audited.
  - `backend/app/routers/documents.py`: Document ingestion (`document:create`), listing (`document:read`), and deletion (`document:delete`) protected with `require_permission`. Deletion audited.
  - `backend/app/routers/uploads.py`: Uploads protected with `document:create`, `document:read`, `document:delete`. Deletion audited.
  - `backend/app/routers/patentability.py`: Protected with `patentability:run` and `patentability:read`.
  - `backend/app/routers/conversations.py`: Protected with `conversation:read`, `conversation:create`, `conversation:update`, `conversation:delete`.
- **System Role Token Propagation** (`backend/app/core/supabase_auth.py`):
  - Automatically maps `super_admin` from verified token claims (`role` or `app_metadata.role`) to synchronized `User.role`.
- **Automated Verification**:
  - `backend/tests/test_phase5_rbac_permissions.py`: 9 comprehensive test suites validating registry completeness, 401 on missing identity, 403 on unauthorized user roles, reviewer boundaries, organisation admin privileges, super admin cross-org access, organisation-scoped role checks, admin action audit logging in DB, and unaffected public health endpoints.
  - 105/105 total backend tests passed (`pytest`). Frontend builds cleanly (`npm run build`).

---

## Non-Negotiable Invariants
1. **No Client Self-Promotion**: Frontend input can never dictate user or organisation role. Roles are verified server-side.
2. **Tenant Isolation**: Non-members cannot verify whether an organisation or resource exists (HTTP 404 response to prevent enumeration).
3. **No Direct `auth.users` Manipulation**: All client-accessible profile attributes reside in `public.profiles`.
4. **Server-Generated Scope**: Direct client manipulation of `user_id` or `organisation_id` is ignored or rejected; backend resolves scope strictly from verified JWT and active membership.
5. **Private Vector Quarantine**: Private document chunks in Qdrant must never be searched without explicit `organisation_id` filters.
6. **Explicit RBAC Enforcement**: All protected endpoints enforce server-side granular permissions; 401 for missing identity, 403 for insufficient permissions.
7. **Audit Trail for Sensitive Administrative Actions**: Member modifications, role changes, and matter/document deletions are synchronously recorded in `audit_logs`.
8. **Empirical Verification**: All endpoints and isolation rules covered by automated tests. Zero test regressions.

