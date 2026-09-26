# PRD.md — Product Requirements Document
# IP-SAKTI Sahayak | SIH 2026 | Problem Statement 26045

---

## 1. Product Overview

- **Name:** IP-SAKTI Sahayak
- **Full Form:** Intellectual Property – Smart Ayurveda Knowledge & Technology Initiative
- **Role:** "Your Trusted Guide to Ayurvedic Intellectual Property"
- **Ministry:** Ministry of AYUSH
- **Type:** Multilingual, RAG-based AI assistant for IP and regulatory guidance in Ayurveda, supporting national (India) and international regimes.
- **Tone:** Professional, authoritative, calm, and trustworthy—like a helpful senior lawyer friend.

---

## 2. Problem Being Solved

Ayurvedic practitioners, researchers, AYUSH startups, MSMEs, and traditional cultivators face two simultaneous crises:
1. **Under-protection:** Legitimate Ayurvedic innovations (such as novel processes or extract enhancements) are not patented or protected because innovators lack plain-language legal awareness.
2. **Misappropriation:** Traditional knowledge (TK) is vulnerably exposed to biopiracy and exploitation by foreign entities who attempt to patent ancient formulations abroad.

Currently, there is no easy-to-use, plain-language assistant that guides the AYUSH community through:
- **Patent Eligibility:** Grasping what can and cannot be patented in Ayurveda (especially navigating Section 3(p) bars).
- **Other IP Forms:** Leveraging Geographical Indications (GIs), Trademarks, and Designs for heritage protection.
- **Regulatory Approvals:** Categorizing products to qualify under appropriate licensing pathways.
- **Biodiversity Compliance:** Understanding Access and Benefit Sharing (ABS) obligations under the Biological Diversity Act.

---

## 3. Target Users

| User Type | Core Pain Point |
|-----------|-----------------|
| **Ayurvedic Practitioners & Vaidyas** | Do not know if their custom formulations can be legally patented or if they fall under public traditional knowledge. |
| **AYUSH Startups & MSMEs** | Confused about the distinction between drug licensing requirements and IP protection. |
| **Researchers & Academia** | Need step-by-step guidance on ABS compliance before using biological resources. |
| **Medicinal Herb Cultivators** | Unaware of rights under the Protection of Plant Varieties and Farmers' Rights (PPV&FR) Act. |
| **Junior IP Facilitators / Lawyers** | Need quick, reliable cross-references of relevant statutes and treaty guidelines. |
| **BAMS / BNYS Students** | Need an educational resource to learn about IP protections in Indian Traditional Medicine. |

---

## 4. Core Features & Incremental Roadmap

To manage project complexity, features are broken into distinct phases. We explicitly avoid faking product readiness:

### Phase 1 (Current State) — Frontend UI Mockup & Design Foundation
- [x] Basic interactive landing page and chat layout (initial placeholder response).
- [x] UI/UX design components matching the AYUSH Visual Design System.
- [x] Jurisdiction switch toggle (India 🇮🇳 vs International 🌐).
- [x] Quick actions/Shortcut triggers for the Formulation Wizard.
- [x] Language selector dropdown layout.

### Phase 1.1 (Implemented) — Frontend/Backend Contract
- [x] FastAPI `GET /health` endpoint.
- [x] FastAPI `POST /api/chat` endpoint with strict Pydantic validation.
- [x] React sends question, jurisdiction and language as JSON.
- [x] React displays the API response, loading state and connection errors.
- [ ] Team runs and manually verifies both servers locally.

### Phase 2 (Planned Next) — Knowledge Corpus & Local ChromaDB Ingestion
- [ ] Offline Python ingestion script to parse official documents (PDFs/HTML).
- [ ] Document chunking scheme (500 tokens with 50-token overlap).
- [ ] Local vector store setup using ChromaDB.
- [ ] Ground-truth retrieval test suite (retrieving statutes like Section 3(p) of Patents Act).

### Phase 3 (Planned) — Local RAG Pipeline & Grounded Answering
- [x] FastAPI foundation and chat contract (delivered in Phase 1.1).
- [ ] Local semantic search and retrieved-chunk re-ranking using small sentence-transformers.
- [ ] Prompt construction targeting LLM contextual constraints (retrieved context only, abstain if missing).
- [ ] Proof of Concept using free-tier Gemini API for response generation.
- [ ] Confidence badge scoring based on retrieval distance.

### Phase 4 (Proposed Future) — Bhashini Multilingual Support & Government Integrations
- [ ] Integration with Bhashini API for accurate Indian language translation and audio voice actions.
- [ ] Support for 6+ local languages (Hindi, Kannada, Bengali, Tamil, etc.).
- [ ] Guidance flows for ABS (Biological Diversity Act) forms.
- [ ] TKDL check pointer to alert users to existing prior art.

---

## 5. Formulation Classification Logic

Legal rules for Ayurvedic remedies depend heavily on classification. The assistant will guide users through a series of questions to classify their formulation:

```
                          ┌───────────────────────────┐
                          │   Ayurvedic Formulation   │
                          └─────────────┬─────────────┘
                                        │
                ┌───────────────────────┴───────────────────────┐
         Classical / Generic                            Patent / Proprietary
         (From 1st Schedule texts)                      (Modified / New formulations)
                │                                               │
   ┌────────────┴────────────┐                     ┌────────────┴────────────┐
   │ Patent Bar: Sec 3(p)    │                     │ Patentable: Novelty +   │
   │ Protection: TKDL / GI   │                     │ Inventive step required │
   │ License: Rule 158-B(1)  │                     │ License: Rule 158-B(2)  │
   └─────────────────────────┘                     └─────────────────────────┘
```

1. **Classical / Generic Medicine (Shastriya):**
   - Formulas extracted directly from First-Schedule texts of the Drugs and Cosmetics Act (e.g., Charaka Samhita).
   - *IP Action:* Barred from patenting under **Patents Act Section 3(p)**. Protected from foreign biopiracy using the TKDL.
2. **Patent / Proprietary Medicine (Anubhavasiddha / Modified):**
   - Contains traditional ingredients but modified dosages, delivery systems, or novel combinations.
   - *IP Action:* Patentable *only if* it demonstrates a clear inventive step and enhanced therapeutic efficacy.
3. **Ayurveda-Aahar / Nutraceutical:**
   - Functional food supplements containing herbal elements, regulated under FSSAI rules.
   - *IP Action:* Cannot claim curative efficacy. Protected primarily by Trademark and Packaging Design.

---

## 6. Target Ingestion Corpus

All citations generated by the pipeline must be grounded in this authoritative data corpus. No sources may be simulated.

### National Documents (India)
- **Patents Act, 1970:** Specifically Section 3(p) (traditional knowledge), Section 3(c) (laws of nature), and Section 3(j) (plants).
- **Biological Diversity Act, 2002:** Access and Benefit Sharing (ABS) requirements, NBA approval processes.
- **Drugs and Cosmetics Act, 1940:** Rules 158-B (licensing parameters for Ayurvedic drugs) and Schedule E (list of poisonous substances).
- **Geographical Indications of Goods Act, 1999:** Protecting localized heritage assets.

### International Treaties
- **Nagoya Protocol:** Safeguarding access to genetic resources and fair benefit sharing.
- **WIPO GRATK Treaty, 2024:** New disclosure obligations regarding Genetic Resources and Associated Traditional Knowledge.
- **TRIPS Agreement:** Articles governing patent standards and exclusions.

---

## 7. Legal Guardrails & Constraints

- **Accurate Citation Grounding:** If a statute or section is cited, it MUST exist in the retrieved context block.
- **No Hallucinated Citations:** The prompt template must enforce strict abstention ("I do not have enough information to answer with citation") if the vector database does not return a direct match.
- **Jurisdiction Separation:** Chat toggles must filter context strictly (India DB vs International DB). The RAG pipeline must never compile mixed-jurisdiction answers in a single retrieval step.
- **Legal Advice Disclaimer:** Every AI response must clearly state it is an informational tool, not a replacement for a qualified IP professional.
- **Confidence Rating:** Simple score mapping based on embedding semantic match closeness:
  - *High:* Strong text matching with direct sections.
  - *Moderate:* Broader contextual match with generic guidance.
  - *Low:* Incomplete matches; triggers advice to contact an IP legal counselor.
