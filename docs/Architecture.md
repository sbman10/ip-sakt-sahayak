# Architecture.md — System Architecture
# IP-SAKTI Sahayak | SIH 2026

---

## 1. High-Level Architecture (Modular & Split)

The system is designed to separate the user-facing web app from the offline ingestion workers and backend endpoints. This keeps components easy to debug for student developers.

```
┌────────────────────────────────────────────────────────┐
│                     USER INTERFACE                     │
│               [ip-sakti] React + Vite app              │
│               (Vanilla CSS, Custom State)              │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST requests
┌───────────────────────────▼────────────────────────────┐
│                    BACKEND SERVER                      │
│              FastAPI (Phase 1.1 baseline)              │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│    │ Chat Router │  │ Classifier  │  │ Health Check│   │
│    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└───────────┼────────────────┼────────────────┼──────────┘
            │                │                │
┌───────────────────────────▼────────────────▼──────────┐
│                     RAG PIPELINE                       │
│  [Proposed]                                            │
│  1. Query Embedder (BAAI/bge-m3)                       │
│  2. Vector Index Query (ChromaDB)                      │
│  3. Re-ranker (cross-encoder/ms-marco-MiniLM-L-6-v2)  │
│  4. RAG Prompt Composer                                │
│  5. LLM Connector (Gemini 1.5 Flash API)              │
│  6. Response Citation & Constraint Validator           │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    KNOWLEDGE STORE                     │
│  [Proposed Vector Store]                               │
│  Collection: india_statutes                            │
│  Collection: international_treaties                    │
│  Collection: ayush_regulations                         │
└────────────────────────────────────────────────────────┘
                            ▲
┌───────────────────────────┴────────────────────────────┐
│                 OFFLINE INGESTION LINE                 │
│              Python Scrapers & Parsers                 │
│  Raw PDFs ➔ Text Extract (fitz) ➔ Embed ➔ Local DB      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Technical Stack Selection

### Frontend (Implemented Mockup)
* **Framework:** React 19 + Vite. Extremely fast build times, simple routing, easy to host.
* **Styling:** Vanilla CSS. Built from scratch with variables in `src/index.css` to allow maximum layout control and visual identity without relying on third-party Tailwind setups, maintaining transparency for learning.
* **Routing:** `react-router-dom` for transitioning between static home and interactive chat screens.

### Backend (Phase 1.1 baseline implemented)
* **Framework:** FastAPI (Python). Async endpoints, high throughput, native type-hinting, automatic OpenAPI documentation.
* **Current contract:** `GET /health` and `POST /api/chat` are implemented with strict Pydantic request/response models and local-development CORS.
* **Retrieval Orchestration:** Direct integration with raw embedding adapters and SQLite/Chroma DB APIs—minimizing abstraction layers like LangChain to maximize student control and troubleshooting visibility.
* **Vector Database:** local ChromaDB (persisted folder). Zero-config setup, queries run inside local Docker or filesystem, very fast for student testing.

### Artificial Intelligence & ML Models (Planned)
* **Embedding Model:** `BAAI/bge-m3` (HuggingFace, local). Maps text phrases into 1024-dimensional multilingual dense vectors. Runs locally on CPU/GPU without token costs.
* **LLM Engine:** Google Gemini 1.5 Flash (via free API key). Low latency, high output-quality, large context window suitable for ingestion snippets.
* **Re-ranker:** `cross-encoder/ms-marco-MiniLM-L-6-v2` (HuggingFace, local). Compares candidate chunks with the query on a deep comparison level to select the top 3 items to forward to Gemini.

---

## 3. Real Workspace Structure

The project code is organized as follows:

```
ip-sakti-sahayak/                    # Workspace root
│
├── docs/                            # Governance & project specifications
│   ├── PRD.md                       # Product plans
│   ├── Architecture.md              # System design blueprints (this file)
│   ├── Design.md                    # Visual guidelines
│   ├── Rules.md                     # Coding & execution rules
│   ├── Phases.md                    # Roadmap timeline
│   ├── Memory.md                    # Dynamic progress tracker
│   ├── LEARNING.md                  # Team training journal
│   ├── DECISIONS.md                 # Architectural record (ADR)
│   ├── CHANGELOG.md                 # Incremental changes log
│   └── CONTRIBUTING.md              # Team git policy
│
├── ip-sakti/                        # React + Vite application (UI mockup)
│   ├── package.json
│   ├── index.html                   # Font bindings & SEO configuration
│   └── src/
│       ├── App.jsx                  # Main Page component wrapper
│       ├── index.css                # Global Visual Stylesheet
│       └── main.jsx                 # React root mount
│
├── backend/                         # FastAPI application (Phase 1.1 baseline)
│   ├── app/main.py                  # Application + health route
│   ├── app/routers/chat.py          # Transparent development chat route
│   └── app/schemas/chat.py          # Validated request/response models
│
├── knowledge-base/                  # Unified sovereign knowledge base, schemas & ingestion
│   ├── schemas/                     # YAML validation schemas
│   ├── manifests/                   # Source catalogs, boundaries, verification status
│   ├── sources/                     # Authoritative statutes & treaties (PDFs + metadata YAML)
│   ├── curated/                     # Domain knowledge JSONL records (AYUSH, ABS, IP practice)
│   ├── derived/                     # Chunked JSONL & extracted text (isolated by jurisdiction)
│   ├── uploads/                     # User-uploaded document runtime storage
│   ├── parser.py                    # Sliding window PDF parser (500 words / 50 overlap)
│   ├── ingest.py                    # Chunk embedder → ChromaDB collections & BM25 index
│   ├── scripts/                     # Verification, metadata & diagnostic utilities
│   └── tests/                       # Automated pytest integrity & schema test suite
│
├── .agents/                         # Workspace AI automation rules & actions
│   ├── rules/
│   │   └── workspace.md             # Developer system configuration
│   └── workflows/
│       ├── feature.md               # Feature work process
│       ├── bugfix.md                # Bug fixing procedure
│       ├── research.md              # Research and investigation
│       ├── review.md                # Code review guidelines
│       └── learn.md                 # Adding items to LEARNING.md
│
└── .github/                         # Collaborative git blueprints
    ├── pull_request_template.md     # Pull Request questionnaire
    └── CODEOWNERS                   # File code ownership settings
```

---

## 4. Expected Information Flow

An interactive conversation flow goes through these steps:

1. **Input Submission:** A user submits a query on the UI: *"Can I patent an extraction process for Neem oil?"*
2. **Preprocessing:** The user's active toggle state is recorded (Jurisdiction = `India`). Language selection is processed.
3. **API Routing:** The request is sent to the FastAPI backend `/api/chat` with metadata.
4. **Vector Retrieval:**
   - The query string is sent to `BAAI/bge-m3` to get a 1024-dimensional query vector.
   - ChromaDB queries the `india_statutes` collection (because Jurisdiction = India). It retrieves top-5 most similar text sections based on cosine distance.
5. **Re-ranking:** The 5 chunks and user question are comparison-scored using the Cross-Encoder. The top 3 ranked chunks are kept.
6. **Prompt Assembly:** The backend inserts the 3 pieces of text, user question, and grounding safety rules into a prompt template:
   - *"Only base your answer on the retrieved facts. If the facts do not answer the question, state that you do not know. Do not hallucinate."*
7. **Inference:** Gemini generates the answer along with metadata markers indicating which chunk supplied which fact.
8. **Delivery:** The API parses references out of the metadata, formats citation cards, and sends `{ answer, citations, confidence, disclaimer }` to the React app for display.
