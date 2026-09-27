# IP-SAKTI Sahayak - Complete Project Documentation for ChatGPT

> **Purpose**: This document contains ALL information about the IP-SAKTI Sahayak project. Use this as your complete knowledge base to understand and answer questions about this project.

---

## 1. PROJECT OVERVIEW

### What is IP-SAKTI Sahayak?
**IP-SAKTI Sahayak** (Intellectual Property - Strategic Advisory on Knowledge, Traditions & Innovations) is an AI-powered legal advisory chatbot built for **Smart India Hackathon 2026**.

- **Problem Statement ID**: SIH26045
- **Ministry**: Ministry of AYUSH
- **Team Name**: AyuSync
- **Product Name**: IP-SAKTI Sahayak (also called Ragvyn AI)

### The Problem Being Solved
India has the world's largest traditional knowledge treasure (Ayurveda, Yoga, Unani, Siddha), but:

1. **Biopiracy**: Foreign companies steal traditional knowledge and patent it (e.g., Neem patent 1995, Turmeric patent 1995)
2. **Knowledge Gap**: Ayurveda practitioners don't understand IP laws
3. **Complex Legal Language**: Laws like Patents Act, TRIPS, Nagoya Protocol are too technical
4. **Language Barrier**: Most resources are English-only, practitioners speak regional languages

### The Solution
An AI chatbot that:
- Explains IP laws in simple language (10 Indian languages supported)
- Analyzes formulations for patentability (RED/YELLOW/GREEN verdict)
- Guides users through IP filing process
- Checks ABS (Access & Benefit Sharing) compliance
- Protects user privacy (DPDP Act compliant PII scrubbing)

---

## 2. TECH STACK (Currently Active)

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.8 | UI framework |
| Vite | 8.2.2 | Build tool (fast HMR) |
| React Router | 7.18.2 | Client-side routing |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.110.0+ | Web framework (async) |
| Uvicorn | 0.28.0+ | ASGI server |
| Pydantic | 2.6.0+ | Data validation |
| SQLAlchemy | 2.0.28+ | ORM |

### AI/ML
| Technology | Purpose |
|------------|---------|
| Google Gemini (gemini-3.5-flash) | LLM for response generation |
| all-MiniLM-L6-v2 | Text embeddings (384 dimensions) |
| ms-marco-MiniLM-L-6-v2 | Cross-encoder reranking |
| rank-bm25 | Keyword search (BM25 algorithm) |

### Databases
| Database | Purpose | Status |
|----------|---------|--------|
| SQLite (ip_sakti.db) | User data, conversations, documents | ACTIVE |
| SQLite (audit.db) | Compliance audit logs | ACTIVE |
| ChromaDB | Vector store (2249 vectors) | ACTIVE |
| Supabase PostgreSQL | Cloud relational DB | PREPARED (not active) |
| Qdrant Cloud | Cloud vector DB | PREPARED (not active) |

---

## 3. FOLDER STRUCTURE

```
ip-sakt-sahayak-LATEST/
├── backend/                      # FastAPI Python backend
│   ├── app/
│   │   ├── core/                # Config, settings
│   │   │   └── config.py        # All environment variables
│   │   ├── models/              # SQLAlchemy database models
│   │   │   └── database.py      # User, Conversation, Message, etc.
│   │   ├── routers/             # API endpoints
│   │   │   ├── chat.py          # Main chatbot endpoint (/api/chat)
│   │   │   ├── auth.py          # Authentication (/api/auth)
│   │   │   ├── verdict.py       # Patentability verdict (/api/verdict)
│   │   │   ├── roadmap.py       # IP Journey Roadmap (/api/roadmap)
│   │   │   ├── guardian.py      # Dual-Use Guardian (/api/guardian)
│   │   │   ├── patentability.py # Patentability assessment
│   │   │   ├── documents.py     # Document upload/management
│   │   │   ├── conversations.py # Conversation history
│   │   │   ├── drafts.py        # Patent draft generation
│   │   │   ├── experts.py       # Expert connect feature
│   │   │   ├── analytics.py     # Usage analytics
│   │   │   └── ...
│   │   ├── schemas/             # Pydantic request/response models
│   │   │   ├── chat.py          # ChatRequest, ChatResponse
│   │   │   ├── verdict.py       # VerdictRequest, VerdictResponse
│   │   │   └── ...
│   │   ├── services/            # Business logic
│   │   │   ├── pii_scrubber.py  # PII removal (DPDP compliance)
│   │   │   ├── hybrid_retriever.py  # BM25 + Semantic search
│   │   │   ├── retrieval_gate.py    # Confidence threshold check
│   │   │   ├── reranker.py      # Cross-encoder reranking
│   │   │   ├── context_compressor.py # Context truncation
│   │   │   ├── llm.py           # Gemini API calls
│   │   │   ├── confidence_calculator.py # Score calculation
│   │   │   ├── verdict_service.py    # Verdict logic
│   │   │   ├── roadmap_service.py    # Roadmap logic
│   │   │   ├── guardian_service.py   # Guardian logic
│   │   │   ├── bm25_service.py  # BM25 keyword search
│   │   │   ├── qdrant_service.py # Qdrant cloud (prepared)
│   │   │   ├── storage_service.py # Supabase storage (prepared)
│   │   │   └── ...
│   │   └── main.py              # FastAPI app entry point
│   ├── chroma_db/               # Vector database storage
│   ├── ip_sakti.db              # SQLite database
│   ├── audit.db                 # Audit logs database
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables (secrets)
│
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── App.jsx              # Main app (~300KB monolith)
│   │   ├── components/
│   │   │   ├── VerdictEngine.jsx    # Patentability verdict UI
│   │   │   ├── IPJourneyRoadmap.jsx # Filing roadmap UI
│   │   │   ├── DualUseGuardian.jsx  # Dual-use checker UI
│   │   │   ├── PatentabilityAssessment.jsx # Assessment UI
│   │   │   ├── MatterWorkspace.jsx  # Matter management
│   │   │   ├── DraftGenerator.jsx   # Draft generation UI
│   │   │   ├── AccessibilityPanel.jsx # A11y features
│   │   │   ├── OnboardingTour.jsx   # 18-step tour
│   │   │   ├── ExpertConnect.jsx    # Expert connection
│   │   │   └── ...
│   │   ├── index.css            # Global styles (201KB)
│   │   └── assets/              # Images, icons
│   ├── package.json             # npm dependencies
│   └── vite.config.js           # Vite configuration
│
├── knowledge-base/              # Source documents
│   ├── sources/
│   │   ├── india/              # Indian laws (Patents Act, etc.)
│   │   └── international/      # Treaties (TRIPS, Nagoya, etc.)
│   ├── curated/                # Hand-written JSONL chunks
│   └── derived/                # Processed chunks, embeddings
│
├── supabase/                    # Cloud migration (PREPARED)
│   ├── migrations/              # PostgreSQL schema
│   └── README.md                # Migration documentation
│
├── TRIPS/                       # TRIPS Agreement PDFs
├── NAGOYA/                      # Nagoya Protocol PDFs
├── WIPO-GRATK/                  # WIPO GRATK Treaty PDFs
├── Patents-GI-Trademark/        # IP law PDFs
├── CONVENTION-BIOLOGICAL-DIVERSITY/
├── FSSAI-Ayurveda-Ahaar-Regulations/
└── ADVERTISING-CLAIM/
```

---

## 4. RAG PIPELINE (12 Stages)

When a user sends a query, it goes through 12 stages:

### Stage 1: PII Scrubber
**File**: `backend/app/services/pii_scrubber.py`
- Removes personal data (name, phone, Aadhaar, email) BEFORE processing
- DPDP Act 2023 compliance
- Example: "Mera naam Rahul hai" → "Mera naam [NAME] hai"

### Stage 2: Query Classification
**File**: `backend/app/routers/chat.py` → `_is_out_of_scope()`
- Checks if query is: Greeting / Out-of-scope / In-scope
- Greetings get instant response (no model loading)
- Out-of-scope rejected: "I cannot answer that because it is outside my area of knowledge"
- Uses WHITELIST approach (must have IP domain keywords)

### Stage 3: Hybrid Search
**File**: `backend/app/services/hybrid_retriever.py`
- **BM25**: Keyword matching (exact terms like "Section 3(p)")
- **Semantic**: Vector similarity (meaning-based, handles synonyms)
- Both run in parallel

### Stage 4: RRF Fusion
**File**: `backend/app/services/hybrid_retriever.py`
- Reciprocal Rank Fusion combines BM25 + Semantic results
- Formula: `score(d) = Σ 1/(k + rank(d))` where k=60

### Stage 5: Retrieval Gate
**File**: `backend/app/services/retrieval_gate.py`
- Checks if best_distance > SIMILARITY_THRESHOLD (0.65)
- If distance too high → abstain: "I cannot find authoritative sources"
- Prevents hallucination

### Stage 6: Conditional Reranker
**File**: `backend/app/services/reranker.py`
- Cross-encoder model evaluates query+document together
- Reorders results by relevance
- Skipped if ≤2 documents (no point reranking)

### Stage 7: Context Compressor
**File**: `backend/app/services/context_compressor.py`
- Extracts only relevant portions from documents
- Reduces token usage for Gemini

### Stage 8: Gemini LLM Call
**File**: `backend/app/services/llm.py`
- Sends compressed context + query to Gemini
- Structured JSON output schema enforced
- Model: `gemini-3.5-flash` (or .env override)

### Stage 9: Citation Extraction
**File**: `backend/app/routers/chat.py`
- Extracts source titles, sections, relevance from response

### Stage 10: Confidence Calculator
**File**: `backend/app/services/confidence_calculator.py`
- Factors: number of sources, cosine similarity, reranker scores
- Output: 0-100 score with High/Medium/Low label

### Stage 11: Response Formatting
- Assembles ChatResponse with sections, citations, confidence, follow-ups

### Stage 12: Audit Logging
**File**: `backend/app/services/audit_service.py`
- Logs query, response summary, confidence to audit.db

---

## 5. KEY FEATURES

### 5.1 Core Chat (Mandatory PS Features)
| Feature | Description | Endpoint |
|---------|-------------|----------|
| AI Chatbot | Conversational IP legal advice | POST /api/chat |
| Multi-lingual | 10 languages (en, hi, kn, bn, ta, te, mr, gu, ml, pa) | i18n in App.jsx |
| Knowledge Base | 2249 vectors from legal documents | ChromaDB |
| Citations | Every answer shows sources | In ChatResponse |

### 5.2 Differentiator Features (USPs)
| Feature | Description | Endpoint |
|---------|-------------|----------|
| **Patentability Verdict Engine** | RED/YELLOW/GREEN traffic-light decision | POST /api/verdict |
| **IP Journey Roadmap** | Step-by-step filing checklist | POST /api/roadmap |
| **Dual-Use Guardian** | Checks for dual-use (civilian+military) | POST /api/guardian |
| **PII Scrubber** | DPDP Act compliant data removal | Automatic in pipeline |
| **Confidence Score** | 0-100 with explanation | In every response |

### 5.3 Additional Features
| Feature | Description |
|---------|-------------|
| Patentability Assessment | Detailed assessment with prior art |
| Matter Workspace | Case/project management |
| Draft Generator | Generate patent draft sections |
| Expert Connect | Connect with IP attorneys |
| Document Upload | Upload PDFs for context |
| Onboarding Tour | 18-step COD/Free-Fire style walkthrough |
| Accessibility Panel | High contrast, read-aloud, font size |
| Fee Calculator | IP filing fee estimation |
| Deadline Calculator | Filing deadline tracking |

---

## 6. DATABASE SCHEMA

### SQLite: ip_sakti.db (11 tables)
```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255),
    is_active BOOLEAN,
    created_at TIMESTAMP
);

-- Conversations table
CREATE TABLE conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    language VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    conversation_id VARCHAR(36) REFERENCES conversations(id),
    role VARCHAR(20),  -- 'user' or 'assistant'
    content TEXT,
    citations JSON,
    confidence JSON,
    created_at TIMESTAMP
);

-- Other tables: matter_workspace, uploaded_documents, audit_logs, etc.
```

### ChromaDB Collections
| Collection | Vectors | Dimensions | Content |
|------------|---------|------------|---------|
| india_statutes | 1702 | 384 | Patents Act, Biodiversity Act, TKDL, AYUSH guidelines |
| international_treaties | 547 | 384 | TRIPS, Nagoya Protocol, CBD, WIPO GRATK |

---

## 7. API ENDPOINTS

### Chat
```
POST /api/chat
Request: { "question": "Can I patent neem?", "conversation_id": "...", "language": "en" }
Response: { "answer": "...", "citations": [...], "confidence": {...}, "follow_up_questions": [...] }
```

### Verdict Engine
```
POST /api/verdict
Request: { "formulation": "Ashwagandha + Brahmi for memory", "context": "..." }
Response: { "verdict": "YELLOW", "summary": "...", "law_basis": [...], "next_steps": [...] }
```

### Roadmap
```
POST /api/roadmap
Request: { "goal": "Patent my Ayurvedic hair oil", "current_stage": "idea" }
Response: { "stages": [...], "current_stage": 1, "estimated_timeline": "12-18 months" }
```

### Guardian
```
POST /api/guardian
Request: { "formulation": "...", "intended_use": "..." }
Response: { "risk_level": "LOW", "flags": [...], "recommendations": [...] }
```

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/google  (Google OAuth)
GET /api/auth/me
```

---

## 8. CONFIGURATION

### Environment Variables (.env)
```bash
# LLM
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash

# Auth
JWT_SECRET_KEY=your_secret_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Database
DATABASE_URL=sqlite:///./ip_sakti.db

# Thresholds
SIMILARITY_THRESHOLD=0.65
RERANK_SKIP_THRESHOLD=0.25
```

---

## 9. RUNNING THE PROJECT

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Verify: http://127.0.0.1:8000/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens: http://localhost:5173
```

---

## 10. KNOWN ISSUES

1. **Slow Response**: First request loads embedding model (~5-10 seconds)
2. **Gemini Deprecation**: Models deprecate fast - use .env GEMINI_MODEL override
3. **Empty Citations**: Sometimes shows empty - usually stale build (npm run build fixes)
4. **6GB RAM**: Runs tight on 6GB laptops - may need pagefile increase

---

## 11. IMPORTANT NOTES

### Security Warning
- Real API keys were committed to `.env.example` (exposed on GitHub)
- After hackathon: ROTATE Gemini key, Google OAuth secrets, JWT secret

### Cloud Migration Ready
- Supabase folder has PostgreSQL migrations
- Qdrant service code exists
- Just add credentials to .env to switch from local to cloud

### Embedding Model Mismatch
- Config says `BAAI/bge-m3` but actual vectors are `all-MiniLM-L6-v2` (384-dim)
- This is intentional - bge-m3 was planned but not migrated

---

## 12. PROBLEM STATEMENT COMPLIANCE

| PS Requirement | Implementation | Status |
|----------------|----------------|--------|
| Conversational AI Interface | 12-stage RAG chatbot | ✅ Done |
| Multi-lingual Support | 10 Indian languages | ✅ Done |
| Knowledge Base Integration | 2249 vectors from legal docs | ✅ Done |
| Formulation Analysis | Verdict Engine | ✅ Done |
| Biopiracy Alert | Query classification + source verification | ✅ Done |
| ABS Compliance Guidance | Roadmap feature | ✅ Done |

---

## 13. FILE-BY-FILE QUICK REFERENCE

### Most Important Files
| File | Lines | Purpose |
|------|-------|---------|
| `backend/app/routers/chat.py` | ~700 | Main RAG pipeline |
| `backend/app/services/pii_scrubber.py` | ~150 | DPDP compliance |
| `backend/app/services/hybrid_retriever.py` | ~200 | BM25+Semantic search |
| `backend/app/services/llm.py` | ~250 | Gemini API wrapper |
| `backend/app/core/config.py` | ~120 | All settings |
| `frontend/src/App.jsx` | ~3000 | Entire frontend |
| `frontend/src/components/VerdictEngine.jsx` | ~200 | Verdict UI |

---

## 14. GLOSSARY

| Term | Meaning |
|------|---------|
| RAG | Retrieval Augmented Generation |
| BM25 | Best Matching 25 (keyword search algorithm) |
| RRF | Reciprocal Rank Fusion |
| DPDP | Digital Personal Data Protection Act 2023 |
| TKDL | Traditional Knowledge Digital Library |
| ABS | Access and Benefit Sharing |
| PII | Personally Identifiable Information |
| ChromaDB | Open-source vector database |
| Embeddings | Numerical representations of text |
| Cross-encoder | Model that scores query+document together |

---

**Document Version**: 1.0
**Last Updated**: September 20, 2026
**Author**: Kiro (AI Assistant)

---

*This document is complete. ChatGPT can use this to understand and answer any questions about the IP-SAKTI Sahayak project.*
