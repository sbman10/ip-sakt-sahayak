# Phase 4 Implementation Plan: Tenant and Document Isolation

## 1. Objective
Enforce strict multi-tenant and user-level data isolation across all layers of IP-SAKTI Sahayak:
- Supabase PostgreSQL Database (Row Level Security & tenant columns)
- Supabase Storage (hierarchical object keys)
- Qdrant Vector Cloud (payload metadata & server-side filtering)
- Document Parsing & Ingestion
- RAG Hybrid Retrieval & Citation Attribution
- Conversation & Matter Workspace Sessions

---

## 2. Core Architecture & Isolation Schema

### A. Database Columns & Foreign Keys
Add `organisation_id` to all tenant-owned models:
- `conversations` (UUID FK `organisations.id`)
- `uploaded_documents` (UUID FK `organisations.id`)
- `matter_workspace` (UUID FK `organisations.id`)
- `audit_logs` (UUID FK `organisations.id`)
- `patentability_assessments` (UUID FK `organisations.id`)

### B. Server-Side Active Tenant Resolution (`TenantContext`)
In `backend/app/core/dependencies.py`:
- Extracts verified user from Supabase JWT.
- Resolves active `organisation_id`:
  - If `X-Organisation-ID` header supplied: validates caller is an active member in `organisation_members`. If not, rejects with **HTTP 403 / 404**.
  - If header omitted: resolves to user's primary organisation or auto-provisions a `Personal Workspace` organization.
- Overrides all client-supplied ownership fields.

### C. Storage Path Hierarchy
Format:
```text
organisations/{organisation_id}/users/{user_id}/documents/{document_id}/{filename}
```
Validated server-side on every upload, download, presigned URL, and deletion.

### D. Qdrant Payload & Server-Generated Filters
- Ingestion payload:
  ```json
  {
    "visibility": "private",
    "user_id": "<uuid>",
    "organisation_id": "<uuid>",
    "document_id": "<uuid>",
    "source": "<filename/title>",
    "section": "<section>",
    "text": "<content>"
  }
  ```
- Search filtering:
  - Official statutory corpus remains global (`visibility: public`).
  - Private uploaded documents strictly filtered by `organisation_id == caller_org_id` and `visibility == "private"`.
  - Non-members / foreign organizations can never match private document chunks.

### E. Chat & Citations
- When `document_ids` are supplied, the server validates they belong to the caller's active organisation.
- Retrieved passages only contain official corpus or tenant-owned private documents.
- Citations from Tenant A's private files never leak into Tenant B's responses.

---

## 3. Step-by-Step Execution Plan

1. **Database Models** (`backend/app/models/database.py`):
   - Add `organisation_id` and relationships to `Conversation`, `UploadedDocument`, `MatterWorkspace`, `AuditLog`, `PatentabilityAssessmentRecord`.
2. **SQL Migration** (`scripts/migrations/phase4_tenant_document_isolation.sql`):
   - Additive DDL with foreign keys, indexes, and updated RLS policies for tenant isolation.
3. **Core Dependencies** (`backend/app/core/dependencies.py`):
   - Implement `TenantContext` dataclass and `get_tenant_context` dependency.
4. **Storage Service** (`backend/app/services/storage_service.py`):
   - Update `build_storage_key` to `organisations/{org_id}/users/{user_id}/documents/{doc_id}/{filename}`.
5. **Qdrant Service & Ingestion** (`backend/app/services/qdrant_service.py` & `backend/app/routers/documents.py`):
   - Update payload index setup to include `organisation_id` and `visibility`.
   - Pass `organisation_id` on upsert and search.
6. **Retrieval Service & Router** (`backend/app/services/retrieval_service.py`, `retrieval_router.py`, `backend/app/routers/chat.py`):
   - Add `organisation_id` filtering.
   - Enforce document ownership validation before retrieval.
7. **Routers Update**:
   - `backend/app/routers/uploads.py`: Scope list, get, upload, and URL endpoints by tenant.
   - `backend/app/routers/conversations.py`: Scope list, create, update, delete, get by tenant.
   - `backend/app/routers/matters.py`: Scope by tenant.
8. **Automated Verification**:
   - `backend/tests/test_phase4_tenant_isolation.py`: Comprehensive test suite proving cross-user and cross-org isolation, Qdrant filtering, storage hierarchy, and citation confidentiality.
9. **Documentation**:
   - Update `docs/Memory.md`, `docs/CHANGELOG.md`, `docs/AI_ACTIVITY_LOG.md`.
