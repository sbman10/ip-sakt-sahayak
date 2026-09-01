# IP-SAKTI Sahayak — 3-Day Research Sprint

## Purpose

This three-day sprint prepares the six-person team to explain the problem, intended users, MVP architecture, feasibility, risks, impact, and source-backed legal scope to faculty.

The project follows an **India-first MVP** approach. International content is limited to treaty awareness and export-routing context; the team must not attempt country-by-country legal advice.

## Shared Research Pack

Every member submits one Research Pack before the Day 4 discussion:

- Two concise pages in simple English.
- Six to ten official sources, each with an access date.
- Plain-language definitions of key terms.
- At least three realistic user use cases.
- Risks, limitations, and practical mitigation.
- One reusable visual: a table, flowchart, or decision tree.
- A three-minute verbal explanation.

Use `docs/RESEARCH_PACK_TEMPLATE.md` for a common format.

## Source Rules

- Use official sources only: Ministry of AYUSH, IP India, India Code, FSSAI, National Biodiversity Authority, TKDL, WIPO, WTO, and CBD.
- Record the document title, issuing authority, official URL, access date, and relevant page, section, or stable heading.
- Mark an item `pending` in `SOURCE_REGISTER.md` until a teammate has opened the original document and checked representative text.
- Do not use blogs or AI answers as legal authority.
- Do not present a legal conclusion as legal advice. Use phrases such as “may be relevant”, “requires checking”, and “consult the appropriate authority or qualified professional”.

## Mahak — Ayurveda Theory, Traditional Knowledge, and Product Classification

### Objective

Explain the Ayurveda domain so the system can classify a product before giving IP or regulatory guidance.

### Research

- Ayurveda and AYUSH: what they are and why this problem belongs under AYUSH.
- Classical formulation versus patent/proprietary formulation.
- Ayurveda-Aahara, nutraceutical, cosmetic, medicine, and phytopharmaceutical: simple differences.
- Traditional knowledge, its limits for novelty claims, and the role of TKDL.
- Why formulation and product classification must come before legal guidance.

### Required use cases

1. A vaidya wants to commercialise a formulation from a classical text under a new brand.
2. A student creates a herbal inhaler for an innovation competition and wants to know what may be protected.
3. A researcher improves an extraction method for a known herb and wants to know whether the process may be new.
4. A startup is unsure whether an Ashwagandha drink is food, supplement, or medicine.

### Required visual

```text
User describes product
        ↓
Is it based on a known classical formulation?
        ↓
Is it medicine, food, cosmetic, or another product?
        ↓
Does it use biological resources or traditional knowledge?
        ↓
Route to relevant IP and regulatory guidance
```

### Starting sources

- [Ministry of AYUSH](https://ayush.gov.in/)
- [TKDL — About](https://www.tkdl.res.in/tkdl/langdefault/common/Abouttkdl.asp)
- [FSSAI Regulations](https://www.fssai.gov.in/food-law/regulations)

## Bhavya <3 > — Intellectual Property Rights

### Objective

Explain which IP right may apply to an Ayurveda-related product, process, brand, design, or content.

### Research

- Patent: invention, novelty, inventive step, prior art, and patent search.
- Traditional knowledge and the relevance of Patents Act Section 3(p).
- Trademark: brand names, logos, and product identity.
- Geographical indication: region-linked products and community protection.
- Design: packaging, bottles, containers, and visual appearance.
- Copyright: research, books, websites, videos, and software.
- Trade secrets and plant-variety rights.

### Required use cases

1. A researcher develops a Neem extraction process.
2. A startup wants to protect its name, logo, and herbal-product packaging.
3. A farmer group wants to explore protection for a regional medicinal product.
4. A content creator makes an Ayurveda learning course.

### Required visual

| User situation | Possible protection | Key question |
|---|---|---|
| New technical process | Patent | Is it genuinely new? |
| Brand name or logo | Trademark | Is the name already registered? |
| Regional heritage product | GI | Is quality or reputation linked to a place? |
| Bottle or package look | Design | Is the appearance new? |
| Website, book, or video | Copyright | Is it original expression? |
| Confidential recipe or process | Trade secret | Can it realistically remain secret? |

### Starting sources

- [IP India](https://www.ipindia.gov.in/pages/about-us)
- [IP India](https://www.ipindia.gov.in/)
- [IP Saarthi](https://ipindia.gov.in/ipsaarthi/)
- [Protection of Plant Varieties and Farmers’ Rights Authority](https://plantauthority.gov.in/)

## Sarvagya — Indian Laws, Regulations, and Citation Sources

### Objective

Prepare the India-first legal-source foundation for the future RAG corpus. This is source discovery and verification work, not unsupported legal interpretation.

### Research

- Patents Act and relevant rules.
- Biological Diversity Act, Access and Benefit Sharing, and the National Biodiversity Authority.
- Drugs and Cosmetics Act and Rules.
- Drugs and Magic Remedies law.
- FSSAI Ayurveda-Aahara, food labelling, and advertising requirements.
- The difference between an Act, Rule, Regulation, Notification, Guideline, and Treaty.
- How to preserve title, issuing authority, date, page/section, URL, and verification status.

### Required use cases

1. A manufacturer wants to label a Neem-Turmeric skin cream as a cure for skin disease.
2. A startup uses Indian herbs in a commercial product.
3. A food business wants to sell an Ayurvedic herbal drink.
4. A vaidya wants to market a formulation and needs a starting compliance path.

### Required output

Add pending sources to `SOURCE_REGISTER.md` using this priority order:

1. Patentability and traditional knowledge.
2. Biodiversity and ABS.
3. Drug and product classification.
4. Ayurveda-Aahara.
5. Trademark and GI overview.

Each source row must include the exact document title, authority, official URL, India jurisdiction, publication/version date, relevant sections or pages, reason for inclusion, and `pending` or `verified` status.

### Starting sources

- [India Code](https://www.indiacode.nic.in/)
- [IP India](https://www.ipindia.gov.in/)
- [FSSAI Regulations](https://www.fssai.gov.in/food-law/regulations)
- [National Biodiversity Authority](https://nbaindia.org/)
- [FSSAI Ayurveda-Aahara Gazette Notification](https://fssai.gov.in/upload/notifications/2022/05/62789a20b54bdGazette_Notification_Ayurveda_Aahara_09_05_2022.pdf)

## Anshuman — MVP Architecture, RAG, and Technical Feasibility

### Objective

Explain how the MVP will work without claiming features that are not yet implemented.

### Research

- Frontend, backend, API, and validation.
- React/Vite for the user interface and FastAPI/Python for the service layer.
- RAG: search approved documents before producing an answer.
- Knowledge corpus, chunking, embeddings, vector search, citations, confidence, and safe refusal.
- Why India and International sources must remain separate.

### Required visual

```text
User
  ↓
React + Vite website
  ↓
FastAPI backend
  ↓
Product classification + jurisdiction filter
  ↓
Approved legal-source collection
  ↓
Search relevant source sections
  ↓
Grounded response with citation, confidence, and disclaimer
```

### Required output

- One architecture diagram.
- One RAG-workflow diagram.
- Five MVP test questions.
- A status table:

| Status | Items |
|---|---|
| Implemented | React/Vite UI, FastAPI health route, chat API contract, language and jurisdiction controls |
| MVP next | Verified source corpus, text extraction, retrieval, citations, confidence, and safe refusal |
| Future | Voice, Bhashini integration, knowledge graph, advanced export guidance, and user accounts |

### Starting sources

- `docs/Architecture.md`, `docs/PRD.md`, `docs/Rules.md`, and `docs/Phases.md`
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [ChromaDB documentation](https://docs.trychroma.com/)
- [Sentence Transformers documentation](https://sbert.net/)

## Gautam — Feasibility, Viability, Scalability, and Impact

### Objective

Show that the project can be useful and feasible without inventing adoption figures, cost savings, or accuracy percentages.

### Research

- Target users and pain points.
- Social, economic, cultural, environmental, and institutional benefits.
- Technical and economic feasibility of a student-built MVP.
- Scalability: more documents, languages, users, and jurisdictions.
- Adoption barriers: legal trust, language, source updates, low digital literacy, and connectivity.
- Comparison with IP Saarthi, TKDL, and PATENTSCOPE.

### Required use cases

1. An MSME checks a brand before investing in packaging and marketing.
2. A farmer cooperative learns that a regional product may need community-level protection.
3. A startup checks food, drug, and advertising questions before launch.
4. A rural practitioner accesses simple guidance instead of navigating many portals.

### Required visuals

| Area | Why feasible | Main risk | Mitigation |
|---|---|---|---|
| Technology | Existing React, Python, and retrieval tools | Limited team experience | Build in small phases |
| Sources | Official laws and portals exist | Documents may change | Source register and review dates |
| Cost | Local tools and small corpus initially | API or hosting cost later | Start local and scale after validation |
| Adoption | Clear need across AYUSH users | Trust and language barriers | Citations, disclaimer, and multilingual rollout |

| Impact type | Benefit |
|---|---|
| Social | Easier access to understandable legal-regulatory information |
| Economic | Better preparation for IP, branding, and compliance decisions |
| Cultural | Better awareness and protection of traditional knowledge |
| Environmental | More responsible use of biological resources |
| Institutional | A reusable source-backed AYUSH guidance foundation |

### Starting sources

- [Ministry of AYUSH](https://ayush.gov.in/)
- [Ministry of AYUSH Citizen Charter](https://ayush.gov.in/resources/pdf/citizenCorner/citizenCharterEng.pdf)
- [IP Saarthi](https://ipindia.gov.in/ipsaarthi/)
- [TKDL](https://www.tkdl.res.in/tkdl/langdefault/common/Abouttkdl.asp)
- [WIPO PATENTSCOPE](https://www.wipo.int/en/web/patentscope)

## Mahi — International Protocols, Export Awareness, and Solution Boundaries

### Objective

Provide limited, accurate international context without creating country-by-country export advice.

### Research

- TRIPS, Convention on Biological Diversity, Nagoya Protocol, and WIPO GRATK Treaty.
- PCT, Madrid System, Hague System, and Budapest Treaty.
- Why the same product may be classified differently in different countries.
- How India-specific and international sources stay separate in the product.
- Which questions the MVP must defer to an expert.

### Required use cases

1. An exporter plans to sell an herbal supplement in the European Union.
2. A startup wants to protect a product name in multiple countries.
3. A research organisation uses a biological resource.
4. A patent applicant thinks a PCT filing automatically creates a global patent.

### Required output

- One-page India versus International comparison.
- One international terminology table.
- Three export-awareness scenarios.
- Five questions that must be referred to an expert.

Use this boundary statement:

> The platform can identify a relevant treaty or authority, but destination-country product registration, labelling, and market-access requirements must be checked with the relevant regulator or a qualified professional.

### Starting sources

- [WTO TRIPS](https://www.wto.org/english/tratop_e/trips_e/trips_e.htm)
- [Convention on Biological Diversity](https://www.cbd.int/convention/articles/default.shtml?a=cbd-01&lg=0)
- [Nagoya Protocol](https://www.cbd.int/abs/)
- [WIPO GRATK Treaty](https://www.wipo.int/en/web/treaties/ip/gratk/index)
- [WIPO PCT](https://www.wipo.int/en/web/pct-system/introduction)
- [WIPO Madrid System](https://www.wipo.int/en/web/madrid-system/index)
- [WIPO Hague System](https://www.wipo.int/en/web/hague-system/about)

## Shared Schedule

### Day 1 — Understand and collect

- Read assigned concepts and define terms in simple English.
- Collect only official sources.
- Identify at least three user problems.
- Record each source title, authority, URL, and access date.

### Day 2 — Apply and analyse

- Build realistic use cases.
- Identify the user’s pain point, possible guidance path, risk, and limitation.
- Create one reusable visual.
- State what the MVP can do and what it must not claim to do.

### Day 3 — Finalise and rehearse

- Complete the Research Pack.
- Verify source titles and links.
- Prepare a three-minute explanation and five likely faculty questions.
- Share the completed pack before the Day 4 discussion.

## Day 4 Team Decisions

1. Freeze the India-first MVP scope.
2. Select the first verified corpus documents.
3. Select the first five user questions for the prototype.
4. Confirm the vaidya, startup, and researcher user journeys.
5. Confirm the disclaimer and human-escalation rule.
6. Finalise feasibility, risks, and impact statements for the presentation.
7. Assign coding only after the research outputs are checked.

## Non-Negotiable Rules

- Do not state that the platform gives legal advice.
- Do not say a product is patentable without formal examination.
- Do not invent law sections, citations, dates, user numbers, cost savings, or accuracy figures.
- Do not mix Indian law and international treaties without clear labelling.
- Do not claim RAG, translation, voice, or knowledge-graph features are complete until they are implemented and tested.
