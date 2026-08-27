# Memory.md — Workspace State
# IP-SAKTI Sahayak | SIH 2026

---

## 1. Project Health Status

* **Current Phase:** Phase 1 (UI Foundation & Setup Verification)
* **Frontend Running:** YES (Active Vite dev server running in background at `ip-sakti/`)
* **Backend Running:** NO (Not started, planned for Phase 3)
* **Database Ingestion:** NO (Not started, corpus processing planned for Phase 2)

---

## 2. Currently Implemented

* **Landing Hub (`ip-sakti/src/App.jsx`):**
  - Brand branding: Minimalist layout with amber/emerald styling tokens.
  - Multilingual header text typewriter simulation (English, Hindi, Sanskrit).
  - Floating ambient herb-emoji background system.
* **Dialogue Interface (`ip-sakti/src/App.jsx`):**
  - Double column interactive screen displaying the chat.
  - Interactive India vs International switch toggling styled ambient glows.
  - Mock messaging bubble stream featuring source citation modules and law details.
  - Legal disclaimer notices positioned at the bottom of panel cards.

---

## 3. Dynamic Task Checklist

- [x] Complete front-end mockup visuals and layout structures.
- [x] Reorganize documentation files into the `/docs/` space.
- [x] Establish collaborative workspace workflows and `.agents` instructions.
- [x] Set up codeowners configuration and pull request questionnaire.
- [ ] Create initial raw document dataset in `corpus/data/raw/`. (Prerequisite for Phase 2)
- [ ] Develop the text parsing script (`corpus/parser.py`) utilizing PyMuPDF.
- [ ] Create embedding and collection initialization scripts inside ChromaDB.

---

## 4. Current Blockers & Next Up Decisions

* **Scraping Sources:** We need access to clean PDFs of the Patents Act, 1970, and AYUSH guidelines.
* **Vector Models:** Confirm whether `all-MiniLM-L6-v2` runs fast enough on average BAMS student computers without GPU overhead (it is extremely lightweight and consumes ~120MB, so it should run smoothly).
* **Gemini API Key:** Ensure developers store their API keys inside `.env` variables rather than public React files.
