# CHANGELOG.md — Release & Update Logs
# IP-SAKTI Sahayak | SIH 2026

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Added the Phase 1.1 FastAPI development API with `/health` and `/api/chat` endpoints.
- Added strict Pydantic schemas for question, jurisdiction, language, citations, confidence and disclaimer fields.
- Connected the React chat send action to the local backend with loading and connection-error handling.
- Added `docs/AI_ACTIVITY_LOG.md` to track AI-assisted changes and verification status.
- Proposed FastAPI Python web server architecture.
- Planned Local ChromaDB storage indices for India/International regulations.
- Proposed parsing pipeline matching PyMuPDF libraries.

---

## [0.1.0] — 2026-08-27

### Removed
- Removed the floating herb-emoji particle backdrop and associated keyframes float from index.css to enforce minimalist cognitive ergonomics.

### Added
- Completed **Phase 1 (UI Foundation & Setup Verification)**.
- Built active React + Vite mockup shell inside `ip-sakti/`.
- Created interactive Home (Landing) page with multi-language animation and herb element backdrops.
- Created interactive chat interface with mock citations, details side-cards, and jurisdiction toggles.
- Created `/docs` document workspace structure containing `PRD.md`, `Architecture.md`, `Design.md`, `Memory.md`, `Rules.md`, `Phases.md`, `LEARNING.md`, `DECISIONS.md`, and `CONTRIBUTING.md`.
- Created `.agents` task execution workflows.
- Created `.github` templates and CODEOWNERS rules.
- Setup layout styles globally mapping variables in `index.css`.
