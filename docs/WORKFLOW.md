# WORKFLOW.md — Master 10-Day Development Roadmap
# IP-SAKTI Sahayak | SIH 2026 | Problem Statement 26045

> **Start Date:** 1 September 2026  
> **Demo Day (Hard Deadline):** 10 September 2026  
> **Goal:** A working, citation-grounded RAG assistant with a polished frontend, ready for SIH judges.

---

## ⚡ Quick Status Snapshot

| Area | Status | Next Action |
|---|---|---|
| Landing Page UI | ✅ Done (mockup) | Polish tomorrow (Day 1) |
| Chat UI | ✅ Done (mockup) | Add missing feature panels (Day 1) |
| FastAPI Backend | ✅ Phase 1.1 skeleton | Locally verify (Day 2) |
| Corpus / Documents | ❌ Not started | Start Day 3 |
| ChromaDB / Embeddings | ❌ Not started | Day 5 |
| RAG Pipeline + Gemini | ❌ Not started | Day 7 |
| Multilingual (Bhashini) | ❌ Not started | Stretch goal Day 9+ |

---

## 🗓️ THE 10-DAY ROUTINE

---

### 📅 DAY 1 — 1 September 2026 | Frontend Polish (PRESENTATION DAY)

**Goal:** A fully-furnished, visually complete frontend. Every feature that will ever exist must be *visible* and *accessible* in the UI — even if not connected to a real backend. Judges should see the complete product vision.

**Morning (Study for 30 min)**
- Read `docs/Design.md` end to end — internalize the color tokens.
- Read `docs/PRD.md` Section 4 (Core Features Roadmap) — know every feature that needs a UI panel.

**Coding Tasks (Frontend `ip-sakti/`)**

- [x] Landing page hero, features grid, "How it works" steps — ✅ Already done
- [x] Chat page: jurisdiction toggle, language selector, wizard shortcuts — ✅ Already done
- [ ] **ADD:** Formulation Wizard modal/page — A step-by-step guided flow (3–4 questions) to classify formulation type (Classical / Proprietary / Nutraceutical). UI only, mock outcome.
- [ ] **ADD:** "History" sidebar panel on the chat page — a left-side rail showing past conversation stubs, collapsible on mobile.
- [ ] **ADD:** "About IP-SAKTI" info panel (drawer or modal) reachable from navbar — explains grounding policy and data sources.
- [ ] **ADD:** ABS Compliance Checker card/route — a placeholder form asking about biodiversity resource usage under the Biological Diversity Act.
- [ ] **ADD:** Confidence badge styling verification — confirm High (green), Medium (amber), Low (red) render correctly in the chat demo data.
- [ ] **ADD:** A "Sources" page or footer section listing official corpus sources: India Code, IP India, TKDL, WIPO, CBD/Nagoya — already partially in landing, enhance it.
- [ ] **POLISH:** Smooth the overall page scroll, hover animations, and mobile responsiveness.

**Definition of Done for Day 1:**  
Open the app → click through every feature → nothing is broken or missing → a first-time viewer immediately understands what the product does.

---

### 📅 DAY 2 — 2 September 2026 | Backend Verification + Local Setup

**Goal:** Confirm the React → FastAPI → React data loop works on your local machine.

**Morning Study (30 min)**
- What is `async/await` in Python FastAPI? Why does it matter?
- What is CORS and why does `127.0.0.1:8000` need it for React on port `5173`?

**Coding Tasks**
- [ ] Run `pip install -r backend/requirements.txt` in a Python 3.11+ virtual environment.
- [ ] Start the FastAPI server: `uvicorn backend.app.main:app --reload`.
- [ ] Hit `http://127.0.0.1:8000/health` in browser — confirm JSON `{"status": "ok"}`.
- [ ] Start the React app: `cd ip-sakti && npm run dev`.
- [ ] Send a question from the chat UI — confirm you see the development placeholder response.
- [ ] Fix any CORS, port or import errors that appear.
- [ ] Document what you verified in `docs/Memory.md` (Phase 1.1 checklist).
- [ ] Commit everything to `main` with message `fix: phase 1.1 local verification complete`.

**Definition of Done for Day 2:**  
Both servers run simultaneously. Typing a chat message reaches FastAPI and shows a response in React.

---

### 📅 DAY 3 — 3 September 2026 | Corpus Research & Collection

**Goal:** Collect the real legal documents that will power the knowledge base.

**Morning Study (45 min)**
- What is a "knowledge corpus" in a RAG system?
- What is chunking? Why do we split documents into 500-token blocks with 50-token overlap?
- Read `docs/LEARNING.md` Section 1 (RAG) and Section 2 (Chunking).

**Research Tasks**
Find and download these documents as PDFs from official sources:

| # | Document | Official URL | Priority |
|---|---|---|---|
| 1 | Patents Act, 1970 | https://ipindia.gov.in/ | 🔴 Critical |
| 2 | Biological Diversity Act, 2002 | https://indiacode.nic.in/ | 🔴 Critical |
| 3 | Drugs & Cosmetics Act, 1940 | https://indiacode.nic.in/ | 🔴 Critical |
| 4 | TKDL overview / policy docs | https://www.tkdl.res.in/ | 🟡 Important |
| 5 | Nagoya Protocol text | https://www.cbd.int/ | 🟡 Important |
| 6 | WIPO GRATK Treaty overview | https://www.wipo.int/ | 🟢 Stretch |

**Coding Tasks**
- [ ] Create `corpus/data/raw/` folder and save all PDFs there.
- [ ] Fill in `docs/SOURCE_REGISTER.md` for each downloaded document (URL, date accessed, SHA-256 checksum if possible).
- [ ] Manually open each PDF and verify that key sections (e.g. §3(p) of Patents Act) are readable text (not scanned images — those need OCR later).

**Definition of Done for Day 3:**  
At least 3 official PDFs are saved locally with verified, readable content and recorded in SOURCE_REGISTER.md.

---

### 📅 DAY 4 — 4 September 2026 | Text Extraction & Cleaning

**Goal:** Convert raw PDFs into clean text chunks Python can work with.

**Morning Study (45 min)**
- Install and explore `PyMuPDF` (`fitz`) in a Python notebook or script.
- Understand `page.get_text()` — how to extract text per page.
- What is `tiktoken` and why do we measure tokens, not word count?

**Coding Tasks**
Create `corpus/parser.py`:

```python
# corpus/parser.py — Extract and chunk PDF text
import fitz         # PyMuPDF
import json, pathlib

def extract_pages(pdf_path):
    """Return list of {'page': int, 'text': str} dicts from a PDF."""
    doc = fitz.open(pdf_path)
    return [{'page': i + 1, 'text': page.get_text()} for i, page in enumerate(doc)]

def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping word-count chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunks.append(' '.join(words[i:i + chunk_size]))
    return chunks
```

- [ ] Run `parser.py` on each PDF — verify the extracted text looks correct.
- [ ] Save output as `.jsonl` files in `corpus/data/processed/`.
- [ ] Check that §3(p) text appears correctly in the Patents Act output.

**Definition of Done for Day 4:**  
Running `python corpus/parser.py` produces clean `.jsonl` chunk files for at least 2 documents.

---

### 📅 DAY 5 — 5 September 2026 | ChromaDB & Embedding Setup

**Goal:** Convert cleaned text chunks into vectors and store them in a local ChromaDB database.

**Morning Study (45 min)**
- What is `sentence-transformers` and how does `all-MiniLM-L6-v2` work?
- What is a "collection" in ChromaDB? How is `india_statutes` different from `international_treaties`?
- Read `docs/Architecture.md` Section 1 (Knowledge Store component).

**Coding Tasks**
Create `corpus/ingest.py`:

```python
# corpus/ingest.py — Embed chunks and store in ChromaDB
from sentence_transformers import SentenceTransformer
import chromadb, json, pathlib

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path='./corpus/chroma_db')
india_col = client.get_or_create_collection('india_statutes')

def ingest_file(jsonl_path, collection):
    chunks = [json.loads(l) for l in open(jsonl_path)]
    texts = [c['text'] for c in chunks]
    ids   = [f"{jsonl_path.stem}_{i}" for i in range(len(texts))]
    embeddings = model.encode(texts).tolist()
    collection.add(documents=texts, embeddings=embeddings, ids=ids)
    print(f"Ingested {len(texts)} chunks from {jsonl_path.name}")
```

- [ ] Install dependencies: `pip install sentence-transformers chromadb`.
- [ ] Run `ingest.py` — confirm chunks appear in ChromaDB.
- [ ] Write a quick test: query `india_statutes` for "traditional knowledge patent" and print top 3 chunks.
- [ ] Verify §3(p) text appears in search results for relevant queries.

**Definition of Done for Day 5:**  
Searching ChromaDB returns real statute text. §3(p) appears when querying "traditional knowledge patent".

---

### 📅 DAY 6 — 6 September 2026 | Retrieval Integration into FastAPI

**Goal:** Wire the ChromaDB query into the `/api/chat` FastAPI route.

**Morning Study (30 min)**
- How does `collection.query(query_texts=[...], n_results=5)` work?
- What is cosine similarity and how does ChromaDB rank results?

**Coding Tasks**
Update `backend/app/routers/chat.py`:
- [ ] Import `chromadb` and load the persistent `india_statutes` and `international_treaties` collections.
- [ ] Inside `POST /api/chat`: query the correct collection based on `jurisdiction` field.
- [ ] Return the top-3 retrieved chunks in the `citations` field of the response.
- [ ] Add a basic confidence score: if the best cosine similarity score < 0.65, return `confidence: "low"`.
- [ ] Test the endpoint using `http://127.0.0.1:8000/docs` (Swagger UI).

**Definition of Done for Day 6:**  
Sending "Can I patent a Neem formulation?" to `/api/chat` returns real statute chunk text from ChromaDB in the citations field.

---

### 📅 DAY 7 — 7 September 2026 | Gemini LLM Integration (RAG Complete)

**Goal:** Use the retrieved chunks as context for Gemini to generate a grounded, cited answer.

**Morning Study (45 min)**
- What is a "prompt template" and what does "grounding" mean in practice?
- Read the RAG accuracy rules in `docs/Rules.md` Section 3 — especially the abstention policy.
- Get your Gemini API key from https://aistudio.google.com/ — store it in `backend/.env` as `GEMINI_API_KEY`.

**Coding Tasks**
Create `backend/app/services/llm.py`:

```python
# backend/app/services/llm.py — Grounded Gemini answer generator
import google.generativeai as genai
import os

genai.configure(api_key=os.environ['GEMINI_API_KEY'])
model = genai.GenerativeModel('gemini-1.5-flash')

SYSTEM_PROMPT = """You are IP-SAKTI Sahayak, an Intellectual Property assistant for Ayurveda.
Answer ONLY using the retrieved context below.
If the context does not answer the question, say:
  "I cannot find an authoritative source to confirm this. Please consult a qualified IP attorney."
Never invent section numbers, act names, or case law."""

def generate_answer(question: str, chunks: list[str]) -> str:
    context = "\n\n---\n\n".join(chunks)
    prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {question}"
    response = model.generate_content(prompt)
    return response.text
```

- [ ] Wire `llm.py` into `chat.py` — call `generate_answer()` with the top-3 retrieved chunks.
- [ ] When confidence is `low` (similarity < 0.65), skip Gemini and return the abstention message directly.
- [ ] Test end-to-end: React → FastAPI → ChromaDB → Gemini → React.
- [ ] Verify the answer references actual statute text (not hallucinated).

**Definition of Done for Day 7:**  
The complete RAG pipeline is functional. A question about §3(p) returns an answer sourced from the Patents Act PDF, with a citation card linking to IP India.

---

### 📅 DAY 8 — 8 September 2026 | UI–Backend Connection & Polish

**Goal:** Connect every frontend feature to the live backend. Remove all mock data from the send path.

**Coding Tasks (Frontend)**
- [ ] Replace mock chat demo messages with an empty welcome state (keep the welcome greeting only).
- [ ] Ensure the Formulation Wizard UI (built Day 1) sends a structured question to `/api/chat`.
- [ ] Connect the "Classify" button to call a `/api/classify` endpoint (can be a simple rules-based endpoint for now).
- [ ] Fix loading states, error messages, and retry logic.
- [ ] Test on mobile viewport (375px width) — fix any overflow or broken layouts.
- [ ] Final visual polish: button hover states, transition timing, font sizes.

**Definition of Done for Day 8:**  
Every UI control either works end-to-end or clearly shows a "Coming Soon" state — nothing silently breaks.

---

### 📅 DAY 9 — 9 September 2026 | Testing, Error Handling & Documentation

**Goal:** Make the system robust enough to survive a live demo.

**Coding Tasks**
- [ ] Add error handling for: backend offline, Gemini API rate-limit, PDF extraction failure.
- [ ] Write a `tests/test_retrieval.py` script: query ChromaDB for 5 known statute sections and confirm they appear in results.
- [ ] Update `docs/Memory.md` — mark all completed checklist items.
- [ ] Update `docs/CHANGELOG.md` with everything built this week.
- [ ] Update `AI_ACTIVITY_LOG.md` with the Day 7–8 Gemini integration milestone.
- [ ] Do a dry-run demo: simulate a judge asking 3 different questions. Document results.

**Definition of Done for Day 9:**  
The app survives a 10-minute demo session with no crashes. All docs are up to date.

---

### 📅 DAY 10 — 10 September 2026 | Final Demo Prep & GIT Review

**Goal:** Package everything cleanly for SIH submission and judge demo.

**Morning**
- [ ] Final `git status` — confirm no uncommitted files.
- [ ] Run `npm run build` in `ip-sakti/` — confirm the production build succeeds.
- [ ] Test the built app from `dist/` on a different browser.

**Afternoon**
- [ ] Finalize `docs/PPT_CONTENT_DRAFT.md` — fill every placeholder with real data.
- [ ] Export SIH PPT as PDF from the supplied template.
- [ ] Record a 2-minute screen demo video as backup in case of live demo failure.
- [ ] Push all changes to `main` branch.

**Definition of Done for Day 10:**  
PDF is ready. Git is clean. Demo works. Every teammate can explain their slide.

---

## 📚 WHAT TO LEARN — Grouped by Day

| Day | Topic | Resource |
|---|---|---|
| 1 | React component design, CSS variables | Existing `App.jsx`, `Design.md` |
| 2 | FastAPI async routes, Pydantic models, CORS | `backend/app/main.py`, FastAPI docs |
| 3 | PDF provenance, legal document structure | Official government portals |
| 4 | PyMuPDF text extraction, tokenization | PyMuPDF docs, `tiktoken` library |
| 5 | Vector embeddings, sentence-transformers, ChromaDB | HuggingFace model cards, ChromaDB docs |
| 6 | Cosine similarity, retrieval ranking, JSON API design | ChromaDB query docs |
| 7 | Prompt engineering, RAG grounding rules, Gemini API | Google AI Studio, `Rules.md` Section 3 |
| 8 | React state management, end-to-end testing | React docs, browser DevTools |
| 9 | Error handling, test scripts, documentation | Python `pytest` basics |
| 10 | Git, build systems, demo preparation | GitHub docs, `npm run build` |

---

## 🧠 WHEN DOES AI/ML/RAG START?

```
Day 1–2   →   Pure Frontend & Backend Setup   (No AI)
Day 3–4   →   Data Collection & Text Prep     (No AI, just Python scripting)
Day 5     →   Embedding Model Setup           (First AI/ML step — sentence-transformers)
Day 6     →   ChromaDB Retrieval              (Second AI/ML step — vector search)
Day 7     →   Gemini + RAG Complete           ← THE BIG AI DAY
Day 8–10  →   Polish, Connect, Ship           (AI is running, you just fix bugs)
```

> **Rule of thumb:** You cannot do the AI part without having clean data (Day 3–4) and a running backend (Day 2). Do not skip ahead.

---

## 🏗️ COMPLETE FEATURE INVENTORY

Every feature below must be visible in the UI by Day 1 (even if not wired to backend).

### Landing Page (`/`)
- [x] Hero title with typewriter multilingual animation
- [x] "Start Asking" CTA button
- [x] Feature cards (Cited Answers, Multilingual, Jurisdiction, Confidence, Wizard, TKDL/GI)
- [x] "How it works" 4-step process
- [x] Official sources trust section
- [ ] Stats bar (e.g. "6+ Languages", "4 Acts Indexed", "3 Jurisdictions") — add Day 1
- [ ] Footer with disclaimer and team credit

### Chat Page (`/chat`)
- [x] Jurisdiction toggle (India 🇮🇳 / International 🌐)
- [x] Language selector (EN, HI, KN, BN, TA, TE)
- [x] Wizard shortcut buttons (Formulation, Patentability, Trademark, GI, TKDL)
- [x] Message bubbles (user / AI)
- [x] Citation cards with clickable links
- [x] Confidence badge (High / Medium / Low)
- [x] Legal disclaimer banner
- [x] Typing indicator (dots animation)
- [x] Send button + Enter key shortcut
- [x] Clear chat button
- [ ] Voice input button (visible, non-functional — shows "Coming Soon" toast) — Day 1
- [ ] History sidebar (conversation list, collapsible) — Day 1
- [ ] Formulation Wizard modal (3-step guided flow) — Day 1
- [ ] ABS Compliance Checker panel (form with key questions) — Day 1

### Pages / Routes to Add
- [ ] `/formulation-wizard` — Step-by-step IP classification flow
- [ ] `/abs-checker` — Biodiversity compliance form
- [ ] `/sources` — Full corpus register (reads from `SOURCE_REGISTER.md` data)

---

## 🔄 DAILY LOG — Update This Section Every Day

> Paste a 3–5 line summary of what you did and what you learned every evening.

### Day 0 — 31 August 2026 (Setup)
- Read all `docs/` files.
- Created this WORKFLOW.md roadmap.
- Current state: UI mockup done, FastAPI skeleton done, no corpus, no RAG.

### Day 1 — 1 September 2026
- [ ] Summary: *(fill after the day)*

### Day 2 — 2 September 2026
- [ ] Summary: *(fill after the day)*

### Day 3 — 3 September 2026
- [ ] Summary: *(fill after the day)*

### Day 4 — 4 September 2026
- [ ] Summary: *(fill after the day)*

### Day 5 — 5 September 2026
- [ ] Summary: *(fill after the day)*

### Day 6 — 6 September 2026
- [ ] Summary: *(fill after the day)*

### Day 7 — 7 September 2026
- [ ] Summary: *(fill after the day)*

### Day 8 — 8 September 2026
- [ ] Summary: *(fill after the day)*

### Day 9 — 9 September 2026
- [ ] Summary: *(fill after the day)*

### Day 10 — 10 September 2026
- [ ] Summary: *(fill after the day)*

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Skipping corpus verification** — Never ingest a PDF without reading a sample of its text. OCR-scanned PDFs return garbage.
2. **Hallucinating in the UI** — Never show a fake AI response and call it RAG. Use the development placeholder until Day 7.
3. **Committing API keys** — Store `GEMINI_API_KEY` only in `.env` (already in `.gitignore`). Never hardcode in Python.
4. **Mixing jurisdictions** — India law and International treaties go into separate ChromaDB collections. Never query both together.
5. **Over-engineering too early** — Follow the phases. Don't add Supabase auth or Bhashini voice before the core RAG works.

---

## 🚀 THE NORTH STAR

> By Day 10, a judge should be able to ask:
> *"Can I patent my Neem oil extraction process?"*
> 
> And the system should:
> 1. Retrieve §3(p) and §2(1)(j) from the actual Patents Act PDF in ChromaDB.
> 2. Send those chunks to Gemini as grounded context.
> 3. Display a plain-language answer with clickable citation cards.
> 4. Show a "High Confidence" badge because the retrieval score is strong.
> 5. Always display the disclaimer: *"This is information, not legal advice."*
> 
> **That is the complete product.**
