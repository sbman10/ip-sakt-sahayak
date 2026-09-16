<div align="center">

# 🌿 IP-SAKTI Sahayak

### *Your Trusted Guide to Ayurvedic Intellectual Property*

**A multilingual, source-citing AI assistant that helps the AYUSH community navigate intellectual-property, regulatory, and biodiversity-compliance questions — grounded in real law, never hallucinated.**

<br>

[![SIH 2026](https://img.shields.io/badge/SIH_2026-PS_26045-FF6B00?style=for-the-badge)](https://sih.gov.in)
[![Ministry of AYUSH](https://img.shields.io/badge/Ministry-AYUSH-2E7D32?style=for-the-badge)](https://ayush.gov.in)
[![Status](https://img.shields.io/badge/status-active_development-yellow?style=for-the-badge)]()

<br>

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-vector_search-FF4B4B)
![Gemini](https://img.shields.io/badge/Google-Gemini_2.5_Flash-4285F4?logo=google&logoColor=white)
![DPDP](https://img.shields.io/badge/DPDP_Act-compliant-2E7D32)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Key Features](#-key-features)
- [How It Works — The Anti-Hallucination RAG Pipeline](#-how-it-works--the-anti-hallucination-rag-pipeline)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Knowledge Corpus](#-knowledge-corpus)
- [Safety & Legal Guardrails](#-safety--legal-guardrails)
- [Roadmap](#-roadmap)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [Team & Credits](#-team--credits)
- [License](#-license)

---

## 🎯 Overview

**IP-SAKTI Sahayak** (*Intellectual Property – Smart Ayurveda Knowledge & Technology Initiative*) is built for **Smart India Hackathon 2026, Problem Statement 26045** under the **Ministry of AYUSH**.

It is **not a generic chatbot**. It is a Retrieval-Augmented Generation (RAG) system with one non-negotiable design principle: **retrieve first, generate second, and abstain when there is no evidence.** Every legal claim must trace back to an authoritative, verifiable source. When the knowledge base cannot support an answer, the system says so and offers to escalate to a human facilitator — it never guesses.

> **Tone:** professional, authoritative, calm — like a helpful senior IP lawyer who tells you when they don't know.

---

## 🔥 The Problem

Ayurvedic practitioners, AYUSH startups, researchers, and herb cultivators face two simultaneous crises:

| Crisis | What it means |
|--------|---------------|
| 🛡️ **Under-protection** | Genuine Ayurvedic innovations go unprotected because innovators lack plain-language legal awareness (e.g. Section 3(p) patent bars). |
| ⚠️ **Misappropriation** | Traditional Knowledge is exposed to biopiracy — foreign entities attempting to patent ancient formulations abroad. |

There is no easy, trustworthy, plain-language assistant guiding the AYUSH community through **patent eligibility, GIs & trademarks, regulatory licensing, and biodiversity (ABS) compliance**. IP-SAKTI Sahayak fills that gap.

---

## ✨ Key Features

| Feature | Description | Status |
|---------|-------------|:------:|
| 🔍 **Grounded RAG Q&A** | Bi-encoder retrieval → cross-encoder re-rank → similarity guardrail → Gemini grounded answer, with source citations on every response. | ✅ Implemented |
| 🧭 **Formulation Classification Wizard** | Deterministic, rules-based decision tree that classifies a formulation (Classical / Patent & Proprietary / Nutraceutical) and returns its regulatory pathway, patentability, and required license. Fully reproducible & auditable. | ✅ Implemented |
| 🔒 **DPDP PII Scrubber** | Redacts phone numbers, Aadhaar, e-mails, and name disclosures **before** any query leaves for an external API. | ✅ Implemented |
| 🌐 **Jurisdiction Separation** | India vs International toggle strictly routes to isolated ChromaDB collections — answers never mix jurisdictions. | ✅ Implemented |
| 📊 **Confidence Scoring** | Every answer carries a `high` / `moderate` / `low` badge derived from vector-search distance. | ✅ Implemented |
| 📝 **Immutable Audit Log** | Every transaction (scrubbed query, jurisdiction, confidence, latency) written to a local SQLite audit trail. | ✅ Implemented |
| 🚫 **Safe Abstention** | If retrieval confidence is below threshold, the API refuses to call the LLM and returns a safe escalation message. | ✅ Implemented |
| 📱 **PWA / Offline Scaffold** | Service worker, offline page, and manifest for installable, offline-first behaviour. | ✅ Scaffolded |
| 🗣️ **Multilingual (Bhashini)** | Indian-language translation + voice actions. | 🔜 Planned |

---

## 🧠 How It Works — The Anti-Hallucination RAG Pipeline

Every call to `POST /api/chat` runs this exact 8-stage pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│  User question + jurisdiction toggle                                     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               ▼
  1. ⏱️  Start latency timer
  2. 🔒  Scrub PII            (DPDP Act — mask phone / Aadhaar / email / name)
  3. 🧬  Embed question        (BAAI/bge-m3 → 1024-dim multilingual vector, local CPU)
  4. 🔎  Vector search         (ChromaDB → top-5 candidates, cosine distance)
  5. 🚦  Guardrail check       (best distance ≥ 0.35 → ABSTAIN, no LLM call)
  6. 🎯  Re-rank               (cross-encoder ms-marco-MiniLM-L-6-v2 → top-3)
  7. 🤖  Grounded generation   (Gemini 2.5 Flash — retrieved context ONLY)
  8. 📝  Async audit log        (scrubbed query + confidence + latency → SQLite)
                               ▼
        { answer, citations[], confidence, disclaimer }
```

**The guardrail is the heart of the system.** ChromaDB returns cosine *distance* (0 = identical, 2 = opposite). If the closest chunk's distance is `≥ 0.35` (similarity `≤ 0.65`), the pipeline **never calls Gemini** — it returns a safe abstention instead. This is what makes the assistant legally defensible.

| Cosine distance | Similarity | Confidence label | Action |
|:---------------:|:----------:|:----------------:|--------|
| `< 0.20` | `> 0.80` | 🟢 **high** | Answer with citations |
| `< 0.35` | `> 0.65` | 🟡 **moderate** | Answer with citations |
| `≥ 0.35` | `≤ 0.65` | 🔴 **low** | **Abstain** + escalate to human facilitator |

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (UI)                        │
│            React 19 + Vite 8 · Vanilla CSS               │
│      Jurisdiction toggle · Language selector · Chat      │
└───────────────────────────┬──────────────────────────────┘
                            │  HTTP POST (JSON)
┌───────────────────────────▼──────────────────────────────┐
│                   BACKEND — FastAPI                       │
│   ┌────────────┐   ┌──────────────┐   ┌───────────────┐  │
│   │ /api/chat  │   │ /api/classify│   │  /health      │  │
│   │  (RAG)     │   │  (wizard)    │   │  (liveness)   │  │
│   └─────┬──────┘   └──────────────┘   └───────────────┘  │
│         │  services: pii_scrubber · llm · audit          │
└─────────┼─────────────────────────────────────────────────┘
          ▼
┌──────────────────────────────────────────────────────────┐
│                     RAG PIPELINE                         │
│  Embedder (BAAI/bge-m3) → ChromaDB query →               │
│  Cross-encoder re-rank → Guardrail → Gemini 2.5 Flash    │
└───────────────────────────┬──────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────┐
│                  KNOWLEDGE STORE (ChromaDB)              │
│    Collection: india_statutes                            │
│    Collection: international_treaties                     │
└──────────────────────────────────────────────────────────┘
                            ▲
┌───────────────────────────┴──────────────────────────────┐
│          OFFLINE INGESTION (knowledge-base/)             │
│   Raw PDFs → parser.py (chunk) → ingest.py (embed+store) │
└──────────────────────────────────────────────────────────┘
```

See [`docs/Architecture.md`](docs/Architecture.md) for the full design and information-flow walkthrough.

---

## 🛠 Tech Stack

### Backend
| Component | Choice | Why |
|-----------|--------|-----|
| Framework | **FastAPI** (async, Pydantic v2) | Auto OpenAPI docs, native typing, high throughput |
| Vector DB | **ChromaDB** (local, persistent) | Zero-config, filesystem-based, fast for local dev |
| Embedder | **BAAI/bge-m3** (Sentence-Transformers) | 1024-dim multilingual embeddings, runs on CPU, no token cost |
| Re-ranker | **cross-encoder/ms-marco-MiniLM-L-6-v2** | Deep query↔chunk comparison for precision top-3 |
| LLM | **Google Gemini 2.5 Flash** | Low latency, large context, free-tier friendly |
| Audit | **SQLite** (WAL mode, async writes) | Local, immutable transaction trail |

### Frontend
| Component | Choice |
|-----------|--------|
| Framework | **React 19** + **Vite 8** |
| Routing | **react-router-dom 7** |
| Styling | **Vanilla CSS** (tokenized design system in `src/index.css`) |
| Offline | Service Worker + manifest (**PWA scaffold**) |

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+**
- **Node.js 20+**
- A **Google Gemini API key** ([Google AI Studio](https://aistudio.google.com/app/apikey))

### 1️⃣ Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` (never commit this file):

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
DEBUG=true
```

Run the server:

```bash
uvicorn app.main:app --reload --port 8000
```

- 📘 Swagger UI → [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- 📗 ReDoc → [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- ❤️ Health → [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 2️⃣ Knowledge Base Ingestion (one-time — required for `/api/chat`)

```bash
pip install pymupdf                # PDF parser (installs as 'fitz')
python knowledge-base/parser.py    # PDFs → chunked JSONL
python knowledge-base/ingest.py    # JSONL → ChromaDB collections & BM25
python knowledge-base/scripts/search_diagnostic.py # sanity-check retrieval
```

> ⚠️ Until the corpus is ingested, `POST /api/chat` returns **HTTP 503** — the knowledge base is not yet initialised. The classification wizard (`/api/classify`) works without any corpus.

### 3️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The backend's CORS is pre-configured for ports `5173`.

---

## 📡 API Reference

Base URL: `http://127.0.0.1:8000`

### `GET /health`
Liveness probe.
```json
{ "status": "ok" }
```

---

### `POST /api/chat` — RAG Legal Q&A

**Request**
```json
{
  "question": "Is Ashwagandha extract patentable under Indian law?",
  "jurisdiction": "India",
  "language": "EN"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `question` | string | 3–2000 chars, non-blank |
| `jurisdiction` | `"India"` \| `"International"` | selects the ChromaDB collection |
| `language` | string (ISO 639-1) | default `"EN"`, uppercased server-side |

**Response** (`200`)
```json
{
  "answer": "Under Section 3(p) of the Patents Act, 1970, ...",
  "citations": [
    {
      "source": "Patents_Act_1970",
      "section": "Page 12",
      "text": "An invention which is, in effect, traditional knowledge ..."
    }
  ],
  "confidence": "high",
  "disclaimer": "This is an informational prototype, not formal legal advice. Please consult a qualified IP professional or registered patent agent."
}
```

| Status | Meaning |
|:------:|---------|
| `200` | Answer returned (or safe abstention with empty `citations`) |
| `503` | Knowledge base not ingested — run `python knowledge-base/ingest.py` |
| `500` | Gemini service error |

---

### `POST /api/classify` — Formulation Classification Wizard

Deterministic, no ML, fully reproducible.

**Request**
```json
{
  "is_classical": true,
  "has_preservatives": false,
  "target": "ASU"
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `is_classical` | bool | drawn verbatim from a classical (Shastriya) text? |
| `has_preservatives` | bool | synthetic preservatives / novel delivery / modifications? |
| `target` | `"ASU"` \| `"Food"` | medicinal (Drugs & Cosmetics Act) vs nutraceutical (FSSAI) |

**Response** (`200`)
```json
{
  "classification": "Classical (Shastriya)",
  "pathway": "Formulas extracted directly from First-Schedule texts of the Drugs and Cosmetics Act...",
  "patentability": "Barred from patenting under Section 3(p) of the Patents Act, 1970... Protected by TKDL.",
  "required_license": "AYUSH Manufacturing License under Rule 158-B(1)..."
}
```

**Decision matrix**

| `target` | `is_classical` | `has_preservatives` | → Classification |
|:--------:|:--------------:|:-------------------:|------------------|
| `Food` | any | any | Ayurveda-Aahar / Nutraceutical (FSSAI) |
| `ASU` | `true` | `false` | Classical (Shastriya) — Rule 158-B(1) |
| `ASU` | `true` | `true` | Patent & Proprietary — Rule 158-B(2) |
| `ASU` | `false` | any | Patent & Proprietary — Rule 158-B(2) |

---

## 📁 Project Structure

```
ip-sakt-sahayak/
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── main.py                # App entry, CORS, /health, router mounts
│   │   ├── routers/
│   │   │   ├── chat.py            # POST /api/chat — full grounded RAG pipeline
│   │   │   ├── classify.py        # POST /api/classify — deterministic wizard
│   │   │   └── documents.py       # POST /api/documents/upload — user document ingestion
│   │   ├── schemas/
│   │   │   └── chat.py            # Pydantic v2 request/response models
│   │   └── services/
│   │       ├── llm.py             # Gemini grounded-answer generation
│   │       ├── retrieval_service.py # Hybrid RRF search (ChromaDB + BM25)
│   │       ├── pii_scrubber.py    # DPDP PII redaction gateway
│   │       └── audit.py           # Async SQLite transaction logging
│   ├── requirements.txt
│   └── .env.example
│
├── knowledge-base/                # Unified sovereign knowledge base & ingestion pipeline
│   ├── schemas/                   # YAML validation schemas
│   ├── manifests/                 # Source catalogs, boundaries, verification status
│   ├── sources/                   # Authoritative statutes & treaties (PDFs + metadata YAML)
│   ├── curated/                   # Domain knowledge JSONL records (AYUSH, ABS, IP practice)
│   ├── derived/                   # Chunked JSONL & extracted text (isolated by jurisdiction)
│   ├── uploads/                   # User-uploaded document runtime storage
│   ├── parser.py                  # Sliding window PDF parser (500 words / 50 overlap)
│   ├── ingest.py                  # Chunk embedder → ChromaDB collections & BM25 index
│   ├── scripts/                   # Verification, metadata & diagnostic utilities
│   └── tests/                     # Automated pytest integrity & schema test suite
│
├── frontend/                      # React 19 + Vite 8 app
│   ├── src/
│   │   ├── App.jsx                # Main UI (landing + chat)
│   │   ├── index.css              # Tokenized design system
│   │   └── components/            # Icons, etc.
│   └── public/                    # PWA: sw.js, manifest.json, offline.html, assets
│
├── docs/                          # PRD, Architecture, Design, Phases, roadmaps
├── .agents/                       # AI automation rules & workflows
└── .github/                       # PR template, CODEOWNERS
```

---

## 📚 Knowledge Corpus

All citations **must** be grounded in authoritative, verifiable law — no simulated sources. The ingestion pipeline routes documents into two isolated ChromaDB collections by keyword:

- **`india_statutes`** — Patents Act 1970 (Sec 3(p), 3(c), 3(d), 3(j)), Biological Diversity Act 2002 (ABS/NBA), Drugs & Cosmetics Act 1940 (Rule 158-B, Schedule E/T/FF), GI of Goods Act 1999.
- **`international_treaties`** — Nagoya Protocol, WIPO GRATK Treaty 2024, TRIPS Agreement.

Chunking scheme: **500-word sliding window, 50-word overlap**, with page-level citation metadata preserved through to the API response.

---

## 🔐 Safety & Legal Guardrails

This project treats safety as **architecture, not a feature toggle**:

- ✅ **Accurate citation grounding** — a cited section MUST exist in the retrieved context block.
- ✅ **No hallucinated citations** — the prompt enforces strict abstention when the vector DB returns no direct match.
- ✅ **Jurisdiction separation** — India and International contexts are never mixed in a single retrieval.
- ✅ **Similarity guardrail** — the LLM is not even called below the confidence threshold.
- ✅ **DPDP compliance** — PII is scrubbed at the application layer before any external API call.
- ✅ **Immutable disclaimer** — injected server-side; every response states it is informational, not legal advice.

> ⚖️ **IP-SAKTI Sahayak provides information, not legal advice.** It is not a substitute for a qualified IP professional or registered patent agent.

---

## 🗺 Roadmap

| Phase | Scope | Status |
|:-----:|-------|:------:|
| **1** | Frontend UI mockup & AYUSH design system | ✅ Done |
| **1.1** | FastAPI `/health` + `/api/chat` contract with Pydantic validation | ✅ Done |
| **2** | Corpus ingestion + local ChromaDB (chunking, retrieval test suite) | 🚧 In progress |
| **3** | Full local RAG pipeline & Gemini grounded answering + confidence badge | ✅ Core delivered |
| **4** | Bhashini multilingual + voice, ABS form flows, TKDL prior-art pointer | 🔜 Planned |

See [`docs/Phases.md`](docs/Phases.md) for the detailed timeline.

---

## 📄 Documentation

| Doc | Purpose |
|-----|---------|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements, target users, feature roadmap |
| [`docs/Architecture.md`](docs/Architecture.md) | System design, tech-stack rationale, information flow |
| [`docs/Design.md`](docs/Design.md) | Visual design rules & AYUSH design system |
| [`docs/Rules.md`](docs/Rules.md) | Development & AI-safety rules |
| [`docs/Phases.md`](docs/Phases.md) | Implementation roadmap (Phases 0–8) |
| [`docs/LEARNING.md`](docs/LEARNING.md) | Team learning journal |
| [`docs/AI_ACTIVITY_LOG.md`](docs/AI_ACTIVITY_LOG.md) | AI-assisted changes & verification log |

---

## 🤝 Contributing

1. Branch off `main` using the workflow conventions in [`.agents/workflows/`](.agents/workflows).
2. Keep the safety guardrails intact — **never** weaken jurisdiction separation, the similarity guardrail, or PII scrubbing.
3. Fill in the [pull-request template](.github/pull_request_template.md); respect [`CODEOWNERS`](.github/CODEOWNERS).
4. Run `npm run lint` (frontend) and verify both servers boot before opening a PR.

> **Do not commit** `backend/.env`, `backend/audit.db*`, or `backend/chroma_db/` — these are local runtime artefacts.

---

## 👥 Team & Credits

Built for **Smart India Hackathon 2026** · **Problem Statement 26045** · **Ministry of AYUSH**.

Repository owner: [@sbman10](https://github.com/sbman10) — Anshuman Thakur · Team size: 5.

---

## 📜 License

Developed under **Ministry of AYUSH — Problem Statement 26045 (SIH 2026)**. See the problem-statement terms for usage and distribution.

<div align="center">

<br>

**🌿 Retrieve first. Cite always. Abstain when unsure. 🌿**

</div>
