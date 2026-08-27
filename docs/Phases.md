# Phases.md — Implementation Roadmap
# IP-SAKTI Sahayak | SIH 2026

---

## Roadmap Overview

```
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│      Phase 1       │ ➔    │      Phase 2       │ ➔    │      Phase 3       │
│  UI Mockup & Env   │      │ Corpus Processing  │      │   RAG Backend API  │
│   (Current State)  │      │     (Planned)      │      │     (Planned)      │
└────────────────────┘      └────────────────────┘      └────────────────────┘
                                                                   │
                                                                   ▼
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│      Phase 6       │ ◀    │      Phase 5       │ ◀    │      Phase 4       │
│ Knowledge Graphs   │      │ Bhashini & Voice   │      │ Integrations &     │
│   (Future Phase)   │      │   (Future Phase)   │      │ Advanced Features  │
└────────────────────┘      └────────────────────┘      └────────────────────┘
```

---

## Detailed Roadmap

### Phase 1 — Frontend Prototype & Environment Setup
- **Objective:** Create the environment layout, configure development rules, and compile the first mockup pages of the chat experience.
- **Status:** **Completed** ✅
- **Technologies:** React 19, Vite, Javascript, Vanilla CSS.
- **Skills/Knowledge:** Basic React components and routing, layout variables, CSS keyframe animations.
- **Definition of Done:** Landing page and chat template render, interactive inputs display placeholder messages.

### Phase 2 — Ingestion Corpus Handling (Next Task)
- **Objective:** Write scripts to collect and prepare the Ayurvedic statutory knowledge base for retrieval.
- **Status:** **Planned / In Queue** ⏳
- **Prerequisites:** Clean PDF/txt sources of the Indian Patents Act, D&C Act 1940, and basic international treaties.
- **Deliverables:**
  - `corpus/scrapers/` containing index collection scripts.
  - Python scripts to convert raw text into cleaned markdown text chunks.
  - Integration script converting text chunks into embedded database collections.
- **Technologies:** Python 3.11+, PyMuPDF, sentence-transformers, ChromaDB.
- **Skills/Knowledge:** Vector algebra, chunking strategies (chunk size and overlap concepts), similarity searching.
- **Definition of Done:** Searching for *"Neem"* in the local database retrieves direct segments containing Patents Act citations.

### Phase 3 — Simple RAG Pipeline Backend
- **Objective:** Create API connections so the frontend can receive computed AI responses based on retrieved context.
- **Status:** **Planned** ⏳
- **Prerequisites:** Completed Phase 2 ChromaDB database output.
- **Deliverables:**
  - FastAPI web server running under `/backend`.
  - `/api/chat` endpoint returning `{ answer, citations, confidence, disclaimer }`.
  - `/api/classify` endpoint containing the rules engine for formulations.
- **Technologies:** FastAPI, Gemini Developer API, cross-encoder models.
- **Skills/Knowledge:** REST API design, async functions in Python, prompts mapping constraints to LLMs.
- **Definition of Done:** Sending an API request with *"Arthritis traditional medicine"* returns an answer mentioning Section 3(p) with direct citations retrieved from ChromaDB.

### Phase 4 — Integrations & Advanced Verification
- **Objective:** Secure the backend, support user logins, and verify accuracy metrics.
- **Status:** **Planned** ⏳
- **Prerequisites:** Phase 3 API is fully operational.
- **Deliverables:**
  - Supabase database mapping for logins.
  - Audit logging layer capturing IP and query metrics.
  - Test suite measuring retrieval recall.
- **Technologies:** Supabase, Python logging, Playwright.
- **Definition of Done:** System can track 10 consecutive user queries, record them to PostgreSQL, and safely reject out-of-scope requests.

### Phase 5 — Bhashini Translation & Voice Layer
- **Objective:** Provide multilingual accessibility so regional innovators can interact with the app.
- **Status:** **Future Phase** 🔮
- **Deliverables:** Translators matching Hin/Kan/Ben languages and STT audio capturing.
- **Technologies:** Bhashini API, Web Speech tools.
- **Definition of Done:** Voice command in Kannada successfully translates to English, retrieves data, and speaks the translation back to the user.

### Phase 6 — Advanced Reasoners & Knowledge Graph
- **Objective:** Integrate relation mapping (Statutes ➔ Case Law ➔ Treaties) for complex multi-source inquiries.
- **Status:** **Future Phase** 🔮
- **Technologies:** NetworkX, Neo4j, LangGraph.
- **Definition of Done:** Multi-hop lookup resolves queries involving overlapping ABS approvals and patent disclosures.
