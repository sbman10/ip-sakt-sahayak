# Changelog

All notable changes to the **IP-SAKTI Sahayak** project are documented in this file.

## [Phase 4] - 2026-09-27: Tenant and Document Isolation

### Added
- **Tenant Isolation SQL Migration & RLS** (`scripts/migrations/phase4_tenant_document_isolation.sql`):
  - Added `organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE` with indexes across `conversations`, `matter_workspace`, `uploaded_documents`, `audit_logs`, and `patentability_assessments`.
  - Row Level Security (RLS) policies for `conversations`, `uploaded_documents`, and `matter_workspace` restricting CRUD access to users whose authenticated JWT belongs to active memberships in `organisation_members`.
- **Tenant Context Dependency** (`backend/app/core/dependencies.py`):
  - `TenantContext` dataclass containing verified `user`, `organisation`, `membership`, `user_id`, `organisation_id`, and `role`.
  - `get_or_create_personal_organisation`: Auto-generates a primary personal workspace for isolated users.
  - `get_tenant_context`: Identifies caller from verified Supabase JWT; resolves active membership server-side; supports `X-Organisation-ID` header; verifies membership (403 on invalid org); ignores/rejects client-spoofed ownership fields.
  - `get_optional_tenant_context`: Seamless backwards compatibility for unauthenticated or public paths.
- **Hierarchical Storage Isolation** (`backend/app/services/storage_service.py`):
  - Structured storage paths: `organisations/{organisation_id}/users/{user_id}/documents/{document_id}/{filename}` with path traversal sanitization.
  - Strict ownership pre-validation before download, presigned URL generation, update, or deletion.
- **Vector Isolation & Payload Indexing** (`backend/app/services/qdrant_service.py`):
  - Payload indexes for `organisation_id` and `visibility`.
  - Every private document chunk tagged with `visibility: "private"`, `user_id`, `organisation_id`, and `document_id`.
  - Server-enforced query filtering: unfiltered searches against `user_uploads` are prohibited at the service boundary.
- **Retrieval Pipeline Scoping** (`backend/app/services/retrieval_service.py`):
  - `hybrid_rrf_search` propagates `organisation_id` and `user_id` to vector search filters on `user_uploads`.
- **Router Scoping & 404 Enumeration Protection**:
  - `backend/app/routers/documents.py`: Document ingestion, chunking, listing, and deletion scoped by `tenant.organisation_id`. Returns 404 on cross-tenant document lookups.
  - `backend/app/routers/uploads.py`: Upload retrieval and download URLs scoped by `tenant.organisation_id`.
  - `backend/app/routers/chat.py`: Validates requested `document_ids` against database `organisation_id`; ignores spoofed foreign document IDs; scopes conversation histories and audit logs.
  - `backend/app/routers/conversations.py`: Conversation and message CRUD scoped by `tenant.organisation_id`; foreign lookups return 404.
  - `backend/app/routers/matters.py`: Legal matter workspace and timeline events scoped by `tenant.organisation_id`; foreign lookups return 404.
  - `backend/app/routers/patentability.py`: Patentability assessments scoped by `tenant.organisation_id`.
  - `backend/app/services/audit_service.py`: Audit logs record verified `user_id` and `organisation_id`.
- **Automated Test Suite** (`backend/tests/test_phase4_tenant_isolation.py`):
  - 8 dedicated test suites verifying:
    1. Cross-user document isolation.
    2. Cross-organisation document isolation.
    3. Storage path formatting and ownership validation.
    4. Client ownership spoofing rejection.
    5. Qdrant payload tagging and server-side filtering.
    6. Citation generation and foreign document filtering in chat.
    7. 404 enumeration resistance on conversations.
    8. Matter workspace isolation and cross-tenant event isolation.

### Changed
- `backend/app/models/database.py`: Added `organisation_id` foreign keys and relationships to `Conversation`, `MatterWorkspace`, `UploadedDocument`, `AuditLog`, and `PatentabilityAssessmentRecord`.
- `backend/app/routers/documents.py`: Updated `DocumentIngestResponse` with `Optional` imports and tenant-scoped attributes (`user_id`, `organisation_id`).

## [Phase 3] - 2026-09-27: Profiles, Organisations, and Membership Identity


### Added
- **Database Schema & Models** (`backend/app/models/database.py`):
  - `Profile`: 1:1 user profile table linking to `auth.users` (`id`, `full_name`, `avatar_url`, `preferred_language`, `created_at`, `updated_at`).
  - `Organisation`: Multi-tenant institution entity (`id`, `name`, `slug` unique, `created_by`, timestamps).
  - `OrganisationMember`: RBAC association table (`organisation_id`, `user_id`, `role`, `created_at`).
- **SQL Migration & Row-Level Security** (`scripts/migrations/phase3_profiles_organisations_rls.sql`):
  - DDL for `profiles`, `organisations`, `organisation_members`.
  - Automatic `handle_new_user()` trigger on `auth.users` for profile provisioning.
  - Strict RLS policies enforcing self-profile access, member-only organisation inspection, and admin-only membership modification.
- **FastAPI Core Dependencies** (`backend/app/core/dependencies.py`):
  - `get_or_create_profile`: Auto-provisions profile on demand.
  - `get_current_org_membership`: Verifies caller membership, returns 404 on unauthenticated or non-member calls to prevent tenant enumeration.
  - `require_org_role`: RBAC factory enforcing permissible roles (`organisation_admin`, `reviewer`, `super_admin`).
  - `require_super_admin`: System-level administrative verification.
- **Pydantic Schemas** (`backend/app/schemas/identity.py`):
  - Validation schemas for `ProfileResponse`, `ProfileUpdate`, `OrganisationCreate`, `OrganisationResponse`, `OrganisationMemberResponse`, `MemberAddRequest`, `MemberRoleUpdate`, and `UserIdentityOverview`.
- **Identity & Organisations Router** (`backend/app/routers/organisations.py`):
  - `GET /api/profile`: Returns `UserIdentityOverview` with profile, user email, organisations list, and primary organisation.
  - `PATCH /api/profile`: Self-service profile update for caller.
  - `POST /api/organisations`: Creates organisation with automated `organisation_admin` enrollment for creator and collision-safe slug generation.
  - `GET /api/organisations/me`: Lists caller's active organisations and membership roles.
  - `GET /api/organisations/{id}`: Organisation details with tenant isolation (404 for non-members).
  - `GET /api/organisations/{id}/members`: Lists organization members for active members.
  - `POST /api/organisations/{id}/members`: Adds registered user to organization (admin-only, blocks unauthorized super_admin elevation).
  - `PATCH /api/organisations/{id}/members/{user_id}`: Updates member role (admin-only, prevents demoting the sole organisation admin).
  - `DELETE /api/organisations/{id}/members/{user_id}`: Removes member (admin-only, protects sole organisation admin from removal).
- **Automated Test Suite** (`backend/tests/test_phase3_identity.py`):
  - 11 comprehensive automated tests covering profile auto-provisioning, profile isolation, organization creation, slug collisions, cross-tenant 404 isolation, RBAC member management, privilege escalation blocking, sole-admin protection, and chat backwards compatibility.
- **Frontend Enhancements**:
  - `frontend/src/components/UserProfileMenu.jsx`: Dynamically fetches `/api/profile`, displays primary organisation name, and verified role badge (`Org Admin`, `Reviewer`, `Member`, `Super Admin`).
  - `frontend/src/components/EditProfileModal.jsx`: Synchronizes profile changes to `/api/profile`.

### Added
- **Central Permission Registry** (`backend/app/core/permissions.py`):
  - `Permission` enum defining granular permissions across organisations, members, documents, conversations, matters, patentability, and audit.
  - `ROLE_PERMISSIONS` dictionary mapping role sets for `super_admin`, `organisation_admin`, `reviewer`, `user`.
  - Helpers `has_permission()`, `get_role_permissions()`, `check_permission_or_raise()`.
- **FastAPI Typed Dependencies** (`backend/app/core/dependencies.py`):
  - `require_permission(permission)`: Injects verified `TenantContext` and enforces active organisation role permission check.
  - `require_org_permission(permission)`: Injects verified `OrganisationMember` for path-scoped routes.
- **Administrative Audit Logging** (`backend/app/services/audit_service.py`):
  - `log_admin_action`: Records sensitive administrative actions in `audit_logs` table for compliance.
- **Automated Test Suite** (`backend/tests/test_phase5_rbac_permissions.py`):
  - 9 automated tests verifying registry completeness, 401 unauthenticated responses, 403 forbidden responses, reviewer privileges and boundaries, organisation admin privileges, super admin cross-tenant bypass, organisation-scoped role checks, and DB audit logging.

### Changed
- `backend/app/routers/organisations.py`: Integrated `require_org_permission` and `log_admin_action` for member operations.
- `backend/app/routers/matters.py`: Integrated `require_permission` and `log_admin_action` for matter deletion.
- `backend/app/routers/documents.py`: Integrated `require_permission` and `log_admin_action` for document deletion.
- `backend/app/routers/uploads.py`: Integrated `require_permission` and `log_admin_action` for file deletion.
- `backend/app/routers/patentability.py`: Integrated permission checks for assessments.
- `backend/app/routers/conversations.py`: Integrated permission checks for conversation CRUD.
- `backend/app/core/supabase_auth.py`: Synchronized system roles from verified JWT claims.

