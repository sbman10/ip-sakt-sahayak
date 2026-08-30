# IP-SAKTI Sahayak

SIH 2026 Problem Statement 26045 — a multilingual, source-cited guide for Ayurveda intellectual-property, regulatory and biodiversity questions.

## Current status

- React + Vite frontend in `ip-sakti/`
- FastAPI/Pydantic development API in `backend/`
- `GET /health` and `POST /api/chat` implemented
- Corpus ingestion, retrieval and grounded generation are next

## Run locally

### Frontend

```text
cd ip-sakti
npm install
npm run dev
```

### Backend

```text
cd backend
python -m venv .venv
\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open the API documentation at `http://127.0.0.1:8000/docs` and the frontend URL printed by Vite.

## Project documents

- `docs/PRD.md` — product requirements
- `docs/Architecture.md` — system design and data flow
- `docs/Design.md` — visual design rules
- `docs/Rules.md` — development and AI-safety rules
- `docs/Phases.md` — implementation roadmap
- `docs/LEARNING.md` — team learning journal
- `docs/SOURCE_REGISTER.md` — verified-corpus provenance register
- `docs/PPT_GUIDE.md` — presentation plan and checklist
- `docs/PPT_CONTENT_DRAFT.md` — editable slide wording and speaker points
- `docs/AI_ACTIVITY_LOG.md` — AI-assisted changes and verification

## Safety promise

The assistant provides information, not legal advice. Legal claims must come from approved, traceable sources; when evidence is missing, the system must abstain rather than guess.
