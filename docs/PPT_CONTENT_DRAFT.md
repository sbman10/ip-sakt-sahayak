# IP-SAKTI Sahayak — SIH PPT Content Draft

> This draft follows `C:\Users\thaku\Desktop\SIH2026-IDEA-Presentation-Format.pptx`. The template allows **six slides maximum, including the title slide**. Keep the supplied slide headings and replace every bracketed placeholder before submission.

## Slide 1 — Title Page

**Fill the supplied fields:**

- Problem Statement ID — `26045`
- Problem Statement Title — `[copy the official title exactly]`
- Theme — `AYUSH`
- PS Category — `Software`
- Team ID — `[registered team ID]`
- Team Name — `[registered portal name]`

**Project name:** IP-SAKTI Sahayak  
**Subtitle:** A source-cited guide for Ayurvedic IP, regulatory and biodiversity questions

## Slide 2 — Idea Title / Proposed Solution

**Title:** IP-SAKTI Sahayak — a trusted guide for Ayurveda innovation

**Suggested points:**

- Ayurveda practitioners, researchers and startups must navigate IP, product regulation and biodiversity rules together.
- Our guided assistant asks focused formulation questions before routing the user to the relevant information path.
- It separates India and International jurisdictions and explains approved sources in plain language.
- Every future legal claim is linked to a source; when evidence is weak, the assistant abstains and recommends human review.
- Innovation: classification-first, source-cited and safety-aware guidance designed for the AYUSH context.

**Visual:** one simple flow: `Describe product → classify → choose jurisdiction → receive cited guidance`.

## Slide 3 — Technical Approach

**Technologies:**

- React + Vite + JavaScript + Vanilla CSS — user interface
- FastAPI + Python + Pydantic — validated API layer
- Official, version-tracked source corpus — knowledge base
- Text extraction → chunking → embeddings → jurisdiction-filtered retrieval — planned RAG pipeline
- Language model — generates plain-language output only from retrieved evidence; planned after retrieval is verified

**Implementation flow:**

`User question → React JSON request → FastAPI validation → source retrieval → grounded answer → citations + confidence + disclaimer`

**Current proof:** React/Vite screens and FastAPI `GET /health` / `POST /api/chat` contract are implemented. Retrieval and grounded generation are next.

**Visual:** use a clean six-step flowchart or current UI/API screenshots; avoid dense architecture diagrams.

## Slide 4 — Feasibility and Viability

**Feasibility:**

- The working baseline uses familiar, open-source tools and can run locally on student laptops.
- The first corpus remains small and manually verified, reducing legal-source and implementation risk.
- The 15-day scope prioritises a demonstrable retrieval-backed MVP over advanced features.

**Risks and mitigation:**

| Risk | Mitigation |
|---|---|
| Outdated or unreliable source | Source register, version dates, checksum and human verification |
| Hallucinated legal claim | Retrieved-context-only prompt, citation checks and abstention |
| India/international rule mixing | Separate source collections and visible jurisdiction selection |
| OCR or PDF extraction errors | Preserve page metadata and manually check representative extracts |
| Too much scope | Defer voice, knowledge graph and advanced agents until the MVP works |

## Slide 5 — Impact and Benefits

**Target users:** Vaidyas, AYUSH startups/MSMEs, researchers, cultivators, students and IP facilitators.

**Expected benefits:**

- Faster discovery of relevant official IP and regulatory information.
- Easier understanding of complex pathways without pretending to provide legal advice.
- Better visibility of traditional-knowledge, biodiversity and benefit-sharing considerations.
- Traceable answers that a user or facilitator can inspect and verify.
- A reusable foundation for multilingual access across Indian languages.

**Guardrail:** Do not add adoption, accuracy, cost-saving or social-impact numbers unless the team has a verifiable source.

## Slide 6 — Research and References

Include short, readable links and the access/version date for:

- Official SIH Problem Statement 26045
- Ministry of AYUSH or other issuing-authority material
- Relevant Indian statutes, rules and official guidance
- Relevant international treaty or registry material
- Project repository and prototype/demo link, if available

Maintain full provenance details in `docs/SOURCE_REGISTER.md` and use those records to prepare this slide. Add final references only after a teammate verifies each source.

## Submission rules from the template

- Maximum six slides, including the title slide.
- Use the supplied template only; do not change the required idea-detail pointers.
- Prefer points, diagrams, infographics and pictures over paragraphs.
- Keep explanations precise and easy to understand.
- Delete the template’s “Important Instructions” slide before submission.
- Export and upload **PDF only**; the template says PPT/Word formats are not supported.

## Team inputs still required

- `[official problem-statement title]`
- `[theme wording from portal]`
- `[team ID and registered team name]`
- `[institute name and member names, if permitted by the template]`
- verified source URLs and access dates
- final UI/API screenshots after local verification
- demo link or recorded fallback
