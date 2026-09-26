# RAGVYN AI / IP-SAKTI Sahayak — Cloud Architecture Migration Contract

This directory contains the database migration definitions, schema contracts, and rollback procedures for migrating the IP-SAKTI Sahayak platform from a single-machine local setup to a distributed, production-grade cloud architecture.

---

## 1. Architecture Overview

### Current Local Architecture
* **Frontend**: React 19 / Vite SPA running on `http://localhost:5173` or `http://localhost:5174`.
* **Backend**: FastAPI running on Uvicorn (`http://127.0.0.1:8000`), executing local SentenceTransformer (`all-MiniLM-L6-v2`, 384-d) and CrossEncoder (`ms-marco-MiniLM-L-6-v2`).
* **Databases**:
  * `backend/ip_sakti.db`: SQLite database holding users, conversations, messages, matters, and document records.
  * `backend/audit.db`: SQLite database storing immutable audit/compliance logs (`conversations` table, 80 rows).
* **Vector Store**: Local ChromaDB (`backend/chroma_db`) with 2,261 chunks (384-d embeddings).
* **Lexical Search**: Local serialized BM25 index (`backend/bm25_index.pkl`).
* **File Storage**: Local filesystem directories (`backend/uploads/` and `knowledge-base/uploads/`).
* **LLM Engine**: Google Gemini Flash API (`gemini-3.5-flash`).

### Target Cloud Architecture
* **Frontend**: **Vercel** (React/Vite with dynamic `VITE_API_BASE_URL` routing).
* **Backend**: **Render** (FastAPI + Uvicorn + SentenceTransformer/BGE-M3 + CrossEncoder).
* **Relational Database**: **Supabase PostgreSQL** (hosted PostgreSQL with connection pooling).
* **File Storage**: **Supabase Storage** (private bucket `documents` with signed URL access).
* **Vector Database**: **Qdrant Cloud** (Managed cluster in AWS `eu-central-1`).
* **LLM Engine**: **Google Gemini** (statutory grounded legal response generation).

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    Vercel Frontend                          │
   │               (React 19 / Vite SPA)                         │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ HTTPS (VITE_API_BASE_URL)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                     Render Backend                          │
   │      FastAPI + Uvicorn + ML Embeddings + CrossEncoder       │
   └───────┬──────────────────────┬──────────────────────┬───────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Supabase Cloud     │ │   Qdrant Cloud   │ │   Google Cloud   │
│  - PostgreSQL        │ │  - india_statutes│ │  - Gemini Flash  │
│  - Storage (private) │ │  - treaties      │ │                  │
└──────────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 2. Directory Structure

```text
supabase/
├── README.md                           # Architecture migration contract & runbook (this document)
├── migrations/                         # Version-controlled PostgreSQL schemas
│   ├── .gitkeep
│   ├── 0001_initial_schema.sql         # (Phase 1) Users, conversations, messages, matters, audit
│   ├── 0002_indexes_and_constraints.sql# (Phase 1) Performance indexes, foreign keys, constraints
│   └── 0003_storage_metadata.sql       # (Phase 1) Uploaded documents & storage bucket references
├── seed.sql                            # Optional non-sensitive test/staging demo seed
└── .gitignore                          # Excludes local secrets, .env files, and CLI cache
```

---

## 3. SQLite-to-Supabase Schema Mapping

### Model Conflict Resolution
The local architecture contains three conflicting SQLAlchemy model bases:
1. `backend/app/models/database.py`: Defines `User` with **UUID string PK** (`id = Column(String)`), `password_hash`, `role`, `preferences_json`. **This is the active database model** containing 7 user accounts in `backend/ip_sakti.db`.
2. `backend/app/models/db.py`: Defines an obsolete/duplicate `User` with **Integer PK** (`id = Column(Integer)`) and `hashed_password`. **Resolved**: Superseded by `database.py` UUID primary keys.
3. `backend/app/models/matters.py` vs `database.py`:
   - `database.py` defines `matters` (empty, 0 rows).
   - `matters.py` defines `matter_workspace` (active, 3 rows) and `matter_events` (0 rows).
   - **Resolved**: Target schema preserves `matter_workspace` and `matter_events`.
4. `backend/audit.db` vs `ip_sakti.db`:
   - `backend/audit.db` contains table `conversations` with **80 audit rows**.
   - `backend/ip_sakti.db` contains table `audit_logs` with **14 audit rows**.
   - **Resolved**: Target schema unifies both into a single `audit_logs` table in PostgreSQL.

### Table-by-Table Schema Specification

| Source Table (Local) | Source File | Row Count | Target PostgreSQL Table | Primary Key | Foreign Keys / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `ip_sakti.db` | 7 | `public.users` | `id UUID DEFAULT gen_random_uuid()` | Preserves existing FastAPI bcrypt hashes. `auth.users` is NOT used. |
| `conversations` | `ip_sakti.db` | 10 | `public.conversations` | `id VARCHAR(36)` | `user_id -> users.id ON DELETE SET NULL` |
| `messages` | `ip_sakti.db` | 5 | `public.messages` | `id VARCHAR(36)` | `conversation_id -> conversations.id ON DELETE CASCADE` |
| `matter_workspace` | `ip_sakti.db` | 3 | `public.matter_workspace` | `id VARCHAR(36)` | `user_id -> users.id ON DELETE CASCADE` |
| `matter_events` | `ip_sakti.db` | 0 | `public.matter_events` | `id VARCHAR(36)` | `matter_id -> matter_workspace.id ON DELETE CASCADE` |
| `uploaded_documents` | `ip_sakti.db` | 1 | `public.uploaded_documents` | `id VARCHAR(36)` | `user_id -> users.id`, `storage_path` points to Supabase Storage key |
| `audit_logs` | `ip_sakti.db` (14) & `audit.db:conversations` (80) | 94 total | `public.audit_logs` | `id VARCHAR(36)` | Immutable compliance ledger. Consolidated from both SQLite databases. |
| `patentability_assessments` | `ip_sakti.db` (root) | 0 | `public.patentability_assessments` | `id VARCHAR(36)` | Structured prior-art & Section 3/6 assessment reports |
| `sources` | `ip_sakti.db` | 0 | `public.sources` | `id VARCHAR(100)` | Legal corpus statutory source registry |
| `feedback` | `ip_sakti.db` | 0 | `public.feedback` | `id VARCHAR(36)` | User response rating and thumbs-up/down ledger |

---

## 4. Chroma-to-Qdrant Vector Mapping

### Baseline Vector Inventory
* Active vector store: `backend/chroma_db` (ChromaDB v0.4+ persistent client).
* Vector dimension: **384** (`all-MiniLM-L6-v2`).
* Distance metric: **Cosine**.
* Collection inventory:
  1. `india_statutes`: **1,713 items**
     * Stored metadata: `jurisdiction`, `section`, `source`, `page_number`
  2. `international_treaties`: **548 items**
     * Stored metadata: `jurisdiction`, `section`, `source`, `page_number`
  3. `user_uploads`: Dynamic per-user uploads indexed via `backend/app/routers/documents.py`.
  4. `patentability_corpus`: Seeded statutory corpus initialized in `backend/app/services/patentability/vector_store.py`.

### Qdrant Cloud Sizing & Allocation
* **Cluster Specifications**:
  * Cloud: AWS `eu-central-1` (Frankfurt)
  * Tier: Free tier (1 GiB RAM, 4 GiB disk, 0.5 vCPU)
* **Storage Footprint Analysis**:
  * 2,261 vectors * 384 dimensions * 4 bytes/float = ~3.47 MB raw vector data.
  * HNSW index graph + payload metadata: ~12 MB total memory.
  * Conclusion: The current corpus occupies less than 2% of the free tier capacity and is completely safe for direct migration.

### Qdrant Collection Structure

```json
{
  "name": "india_statutes",
  "vectors": {
    "size": 384,
    "distance": "Cosine"
  },
  "payload_indexes": [
    {"field_name": "jurisdiction", "schema": "keyword"},
    {"field_name": "source", "schema": "keyword"},
    {"field_name": "section", "schema": "keyword"},
    {"field_name": "document_id", "schema": "keyword"}
  ]
}
```

*Note on BGE-M3 (1,024 dimensions)*:
If the application upgrades to `BAAI/bge-m3` in Phase 2, vectors must be re-embedded from the raw source chunks (`knowledge-base/data/chunks/*.jsonl`) into 1,024-dimensional Qdrant collections (`india_statutes_bge_m3`). During Phase 1/Phase 2 testing, the existing 384-dimensional vectors will be migrated first to guarantee zero regression.

---

## 5. Local File-to-Supabase Storage Mapping

### Current Local File Writes
1. `backend/uploads/{user_id}/{filename}`: Raw files uploaded through `backend/app/routers/uploads.py`.
2. `knowledge-base/uploads/{user_id}_{document_id}.pdf`: Ingested PDFs uploaded through `backend/app/routers/documents.py`.

### Supabase Storage Architecture
* **Bucket Name**: `documents` (Private bucket).
* **Access Policy**: Authenticated read/write via backend service role key; presigned download URLs generated on-demand for frontend users.
* **Storage Key Convention**:
  * Ingested PDFs: `documents/users/{user_id}/rag/{document_id}.pdf`
  * Matter / Chat attachments: `documents/users/{user_id}/matters/{matter_id}/{stored_filename}`
* **Database Mapping**:
  * `UploadedDocument.storage_path` will store the Supabase Storage object key (`users/{user_id}/...`) rather than an absolute filesystem path (`C:\...` or `/app/...`).

---

## 6. Frontend Configuration Contract (Vercel)

### Current Audit Findings
* The frontend has no single centralized API client module; multiple components declare `API_BASE` locally.
* **Hardcoded URLs discovered**:
  * `frontend/src/components/PricingPage.jsx`: `http://127.0.0.1:8000` (does not use env var).
  * `frontend/src/components/IPChecklist.jsx`: `http://127.0.0.1:8000` (does not use env var).
  * `frontend/src/components/ExpertConnect.jsx`: `http://127.0.0.1:8000` (does not use env var).
* **Dynamic URLs with fallback**:
  * `VerdictEngine.jsx`, `PatentabilityAssessment.jsx`, `MatterWorkspace.jsx`, `IPJourneyRoadmap.jsx`, `DualUseGuardian.jsx`, `DraftGenerator.jsx`, `DocumentUpload.jsx`, `App.jsx`.

### Target Contract
In Phase 3, create a centralized `frontend/src/api/client.js` reading `import.meta.env.VITE_API_BASE_URL`.
* **Vercel Environment Variables**:
  * `VITE_API_BASE_URL`: URL of the deployed Render backend: `https://ragvyn.onrender.com`.

---

## 7. Required Environment Variables

### Render Backend Service
```bash
# Core Application
ENVIRONMENT=production
PROJECT_NAME="IP-SAKTI Sahayak"

# Database (Supabase PostgreSQL)
# Use the transaction pooler URL (port 6543) or direct connection (port 5432)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"

# Supabase Storage & Services
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE-ROLE-KEY]"
SUPABASE_STORAGE_BUCKET="documents"

# Qdrant Cloud Vector Database
QDRANT_URL="https://279ebc57-cb14-439b-96d4-67677139f98a.eu-central-1-0.aws.cloud.qdrant.io"
QDRANT_API_KEY="[QDRANT-CLOUD-API-KEY]"

# Google Gemini LLM
GEMINI_API_KEY="[GEMINI-API-KEY]"
PRIMARY_MODEL="gemini-3.5-flash"

# Authentication & Security
JWT_SECRET_KEY="[SECURE-64-CHAR-HEX-SECRET]"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS Allowed Origins
ALLOWED_ORIGINS="https://ragvyn.vercel.app,https://*-your-org.vercel.app,http://localhost:5173"
```

### Vercel Frontend
```bash
VITE_API_BASE_URL="https://ragvyn.onrender.com"
```

---

## 8. Data Backup Requirements & Safety Verification

Before running any migration script in Phase 1 or Phase 2:
1. **SQLite Snapshots**:
   * Create read-only cold copies:
     * `backend/ip_sakti.db` -> `backend/backups/ip_sakti_pre_migration.db`
     * `backend/audit.db` -> `backend/backups/audit_pre_migration.db`
2. **ChromaDB Snapshots**:
   * Archive `backend/chroma_db/` directory into a compressed tarball or backup folder.
3. **BM25 & Uploads Snapshots**:
   * Preserve `backend/bm25_index.pkl` and `uploads/`.
4. **Verification Rule**:
   * No SQLite database files, ChromaDB collections, or local files may be deleted or modified until full end-to-end verification has been approved by Kiro and Antigravity in Phase 4.

---

## 9. Rollback Policy

If any phase fails or encounters an unresolvable issue:
1. **Database Rollback**:
   * The backend retains support for `sqlite:///./ip_sakti.db` via configuration flag `DATABASE_URL`.
   * Setting `DATABASE_URL=sqlite:///./ip_sakti.db` immediately restores local SQLite operation.
2. **Vector Retrieval Rollback**:
   * The hybrid retriever can fall back to local ChromaDB if `QDRANT_URL` is empty or unreachable.
3. **Storage Rollback**:
   * If Supabase Storage is unavailable, document operations fall back to local disk storage `uploads/`.
4. **Zero Data Loss Guarantee**:
   * SQLite and ChromaDB data are never modified during read audits or export pipelines.
