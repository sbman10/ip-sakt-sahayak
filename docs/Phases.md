# Implementation Roadmap
# IP-SAKTI Sahayak | SIH 2026

## Purpose and delivery target

Build an India-first, multilingual, source-citing AI assistant that helps Ayurveda stakeholders understand IP, regulatory, traditional-knowledge, and biodiversity-compliance questions. It is an informational guide, not a legal adviser.

The demonstration must work when internet connectivity is unavailable. Its core evidence store, retrieval, citations, source-version history, and a safe answer path must run from local project data. The team must be able to update one approved rule or law source locally, re-index it, and visibly show that the chatbot's next answer uses the updated evidence and citation.

## Roadmap at a glance

```text
0. Stakeholder discovery and questionnaire
        -> 1. Scope, journeys, and evaluation plan
        -> 2. Source governance and local data foundation
        -> 3. Extraction, chunking, and versioned ingestion
        -> 4. Local retrieval and source-update demonstration
        -> 5. Grounded RAG and safety controls
        -> 6. Multilingual experience
        -> 7. Offline-ready demo, testing, and presentation
        -> 8. Post-MVP enhancements
```

## Non-negotiable product rules

1. Every legal or regulatory claim must be supported by a visible source citation.
2. If evidence is missing, weak, outdated, or outside scope, the system must abstain and suggest an appropriate authority or qualified professional.
3. India and International source collections must remain separated. Any comparison must retrieve and label evidence for each jurisdiction independently.
4. Only verified official sources may enter the retrieval corpus. Their metadata, checksum, version date, and review status must be recorded.
5. A confidence label represents evidence quality, not legal certainty.
6. The prototype must have an offline demonstration mode. It must not pretend that an online model response is available when the network is unavailable.
7. The system must record which source version and chunk identifiers supported each answer.

---

## Phase 0 - Stakeholder discovery and questionnaire

### Objective

Validate the real needs, language preferences, trust expectations, and common questions of the people this application is intended to serve before locking features or building the corpus.

### Stakeholder groups

- Ayurvedic specialists, vaidyas, and clinical practitioners
- AYUSH researchers and academic faculty
- BAMS, BNYS, pharmacy, law, and research students
- AYUSH startups, MSMEs, and product manufacturers
- Medicinal-plant cultivators, producer groups, and cooperatives
- IP facilitators, patent agents, legal professionals, and regulatory advisors

### Work items

1. Prepare a short consent statement explaining that responses are for product research, are voluntary, and will be reported without personal identifiers.
2. Create the questionnaire in English and, after review, the priority local language(s). Keep terminology simple and test it with one student and one practitioner first.
3. Recruit a balanced initial sample across at least four stakeholder groups. Record role and experience only where participants consent.
4. Conduct a combination of form responses and short interviews. Interviews are important for specialists because their workflows and terminology can be difficult to capture in multiple-choice questions.
5. Group responses into user needs, high-risk questions, language needs, trust barriers, desired features, and questions the application must refuse or escalate.
6. Turn the findings into prioritised user stories and a list of the first evaluation questions.

### Questionnaire question bank

Use this as the initial questionnaire. Add role-specific follow-up questions only when needed.

1. What is your role and how often do you work with Ayurvedic formulations, research, products, cultivation, or IP matters?
2. What decision or task is hardest for you today: patentability, branding, product classification, licensing, biodiversity compliance, export awareness, finding authoritative sources, or something else?
3. Describe one real question you would ask an Ayurveda IP and compliance assistant.
4. Which information would make you trust an answer: official links, exact section or page citations, a plain-language explanation, confidence level, expert referral, source update date, or another item?
5. Which answer format is easiest for you: short answer, step-by-step checklist, comparison table, guided questionnaire, or links to official portals?
6. Which language or languages should the application support for you? Can you read English legal or technical terms comfortably?
7. Would you use voice input or audio answers? In which language?
8. What details would you be comfortable entering about a formulation or research project? What must remain private?
9. What mistakes by an AI assistant would be most harmful or unacceptable for you?
10. Would an offline or low-connectivity mode be useful in your work, teaching, field visits, or presentations? Why?
11. If a law, rule, notification, or guideline changes, what proof would you need to believe that the application has used the current version?
12. What should the assistant do when it cannot give a reliable answer?
13. Would you be willing to test a prototype? If yes, may the team contact you through an approved channel?

### Deliverables

- Consent wording, questionnaire, and interview guide
- An anonymised response summary and respondent-segment table
- Top ten user questions, ranked by frequency, impact, and legal risk
- Prioritised language list and accessibility needs
- A list of trust requirements and refusal or escalation triggers
- Updated user stories in the PRD or a linked discovery report

### Definition of done

The team has reviewed enough responses to justify the MVP's first user journeys, languages, answer format, and safety boundaries. Assumptions that conflict with stakeholder feedback are recorded and resolved before corpus implementation begins.

---

## Phase 1 - Scope, user journeys, and evaluation plan

### Objective

Convert discovery findings into a small, testable India-first MVP instead of attempting every IP and regulatory route at once.

### Work items

1. Select the first three to five user journeys, such as a practitioner with a classical formulation, a researcher with a modified extraction process, a startup seeking a product path, and a student learning about traditional knowledge.
2. Define the formulation-classification flow. It must gather only the minimum facts needed to route the user to relevant information; it must not make a legal determination.
3. Write a clear scope boundary for each journey: what the assistant can explain, what it must cite, and when it must refer the user to a human expert or authority.
4. Create a gold-question set from stakeholder questions. For each question, document expected jurisdiction, expected source, acceptable answer points, and abstention conditions.
5. Define acceptance metrics before implementation: citation correctness, retrieval hit rate, abstention correctness, language clarity, and task completion feedback. Do not invent target percentages before a baseline is measured.
6. Align the frontend placeholders, API response contract, and data model with these journeys.

### Deliverables

- MVP scope statement and out-of-scope list
- User-journey maps and formulation-classification script
- Gold-question and expected-citation dataset
- Evaluation rubric for experts, students, and general users
- Updated API response fields for citations, source version, confidence, disclaimer, and escalation path

### Definition of done

Every MVP feature maps to a validated user need and a testable user journey. The team can explain exactly what the prototype will and will not answer.

---

## Phase 2 - Source governance and local data foundation

### Objective

Create an auditable, local-first knowledge foundation before building generation.

### Work items

1. Select a deliberately small, verified India-first corpus. Start with the Patents Act, Biological Diversity Act and relevant rules, Drugs and Cosmetics material, and only the supporting official guidance required for chosen journeys.
2. Add every candidate source to `docs/SOURCE_REGISTER.md` before ingestion. Verify official provenance, title, jurisdiction, document type, version or publication date, access date, stable section or page references, and usage restrictions.
3. Establish local storage with separate areas for raw source files, processed text, source metadata, vector data, structured application data, and backups. Do not rely on live web pages at question time.
4. Use a local structured database, initially SQLite, to store source metadata, source versions, ingestion runs, chunk identifiers, answer audit records, and any approved rule overrides. Use local ChromaDB only for vector retrieval, not as the sole source of truth.
5. Define a source-version model with `source_id`, `version_id`, effective or publication date, checksum, verification status, supersedes version, and review date.
6. Define the change policy: a changed law, rule, or notification is first recorded as `needs-update`, then human-verified, then ingested as a new version. Older versions remain traceable and are excluded from current-answer retrieval unless the user explicitly requests historical information.
7. Add an offline-readiness checklist: cached local documents, locally stored embeddings, local database files, local model or safe-template fallback, and startup instructions that do not require internet.

### Deliverables

- Verified initial source register
- Local directory and database schema design
- Source-version and update policy
- Offline-readiness checklist and backup procedure
- One approved update scenario for the final demonstration

### Definition of done

At least the first critical sources are verified, stored locally, registered, and queryable by metadata. The team can identify the exact local file and version behind every eligible source.

---

## Phase 3 - Extraction, chunking, and versioned ingestion

### Objective

Turn verified local source files into traceable chunks that can be searched, cited, replaced, and rebuilt reliably.

### Work items

1. Build extraction for text PDFs, HTML, and scanned documents where approved OCR is needed. Preserve page boundaries and section headings.
2. Clean extraction artifacts without altering legal wording. Keep the raw file and extracted text so a reviewer can compare them.
3. Chunk by meaningful legal structure first, such as Act, chapter, section, rule, schedule, article, or paragraph. Use token-length limits and overlap only where a structured section needs subdivision.
4. Attach metadata to every chunk: chunk ID, source ID, source version, jurisdiction, document type, title, section or article, page range, language, effective date, checksum, and verification status.
5. Generate and persist embeddings locally. Cache the selected embedding model before the offline demo.
6. Create an idempotent ingestion command that can add a new version, deactivate superseded chunks, rebuild the relevant index, and write an ingestion audit record.
7. Manually inspect representative chunks, including the sections used by the gold-question set.

### Deliverables

- Reusable extraction and ingestion scripts
- Processed text and metadata files for the initial corpus
- Local ChromaDB collections separated by jurisdiction
- Ingestion log showing source version, chunk counts, errors, and completion time
- Manual chunk-quality checklist

### Definition of done

A team member can ingest a verified source from a clean local checkout and retrieve a chunk whose citation resolves to the correct source, version, and page or section.

---

## Phase 4 - Local retrieval and source-update demonstration

### Objective

Prove the evidence layer works independently of any external LLM or network connection.

### Work items

1. Implement jurisdiction-filtered keyword and semantic retrieval over local data. Add reranking only after baseline retrieval is correct.
2. Return retrieved evidence with source title, version, section or page, local chunk ID, and relevance score.
3. Implement threshold and conflict rules. Weak matches return an evidence-not-found result rather than unrelated text.
4. Build a local evidence viewer in the frontend or a simple demo route so judges can inspect the supporting passage.
5. Prepare the required update demonstration using a controlled, approved sample rule or policy source. Do not alter the text of real law merely for effect.
6. Demonstrate this sequence while offline: ask the baseline question, show its retrieved source version, register the approved updated source version, run the local ingestion command, ask the same question again, and show the changed citation and answer evidence.
7. Record the before-and-after result in an audit log. The chat answer must name or expose the source version it used.

### Deliverables

- Local retrieval API and evidence-view response
- Retrieval test results for the gold-question set
- Update-demo script, approved sample source, and before-and-after screenshots or recording
- Audit log for the source update and affected answer

### Definition of done

With internet disabled, the team can retrieve correct local evidence and complete the update demonstration from source registration through a changed, cited retrieval result.

---

## Phase 5 - Grounded RAG, answer validation, and safety

### Objective

Produce useful plain-language answers only from retrieved evidence, while retaining a reliable local fallback for the demonstration.

### Work items

1. Add a retrieval-to-answer orchestration layer to the existing FastAPI endpoint.
2. Build prompts that require answer claims to be grounded in the supplied evidence, cite each material claim, label jurisdiction, and abstain when the evidence is insufficient.
3. Validate answer citations against the retrieved chunk IDs before returning an answer. Reject unsupported citations and use a safe abstention response.
4. Include confidence, disclaimer, source version, retrieval timestamp, and human-escalation guidance in every response.
5. Implement two answer modes:
   - Online assisted mode: an approved hosted LLM may turn retrieved evidence into plain language.
   - Offline demonstration mode: a locally available model, if the device supports it, or a deterministic evidence-summary template. This mode must never claim generative capability it cannot provide.
6. Keep the same retrieval, citation, source-version, and guardrail logic in both modes.
7. Test normal answers, weak evidence, conflicting versions, missing source files, India versus International separation, and malicious or out-of-scope prompts.

### Deliverables

- Grounded chat API returning answer, citations, confidence, disclaimer, source version, and escalation action
- Citation and abstention validator
- Online and offline mode configuration and clear UI status indicator
- Safety and failure-case test report

### Definition of done

For the approved question set, the system returns only validated citations or a clear abstention. When offline, it still returns a truthful, source-based response through the configured local fallback.

---

## Phase 6 - Multilingual experience

### Objective

Make the validated MVP understandable in the languages stakeholders prioritised, without weakening source traceability.

### Work items

1. Select the first languages from Phase 0 evidence. English and Hindi are a practical initial pair only if stakeholder feedback supports them.
2. Translate interface labels, onboarding, formulation questions, disclaimers, abstentions, and escalation guidance with human review.
3. Decide the retrieval strategy for each supported language: multilingual embeddings, translated query with the original preserved, translated corpus fields, or a combination. Record this decision and test it.
4. Preserve citations to the authoritative original source. Where an explanation is translated, label it as a plain-language translation or summary, not as the authoritative legal text.
5. Add language-specific evaluation questions and ask bilingual reviewers to check clarity, terminology, and harmful ambiguity.
6. Add speech input or output only after text mode is safe and only where the chosen service or local fallback supports the selected language.

### Deliverables

- Prioritised language rollout plan
- Reviewed multilingual UI and answer templates
- Tested multilingual retrieval and citation behaviour
- Bilingual usability feedback and issue list

### Definition of done

At least one non-English user path can submit a question, receive an understandable response, inspect the original-source citation, and safely receive an abstention when evidence is insufficient.

---

## Phase 7 - Offline-ready demo, user testing, and presentation

### Objective

Deliver a reliable prototype that clearly proves the product's evidence, safety, multilingual, and local-update capabilities.

### Work items

1. Package a local demo startup procedure with no network dependency for core flows. Test it on the actual presentation device.
2. Seed the local database and vector store with the verified demo corpus, embeddings, source versions, and the approved update scenario.
3. Run task-based testing with representatives from the priority stakeholder groups. Observe whether they understand the citations, confidence, disclaimer, and next step.
4. Fix high-severity usability, citation, and offline-startup issues. Keep a known-good backup of the local data folder and configuration.
5. Rehearse the demonstration: stakeholder problem, formulation classification, multilingual path, source-cited answer, safe abstention, and offline source-update proof.
6. Prepare a transparent feature-status slide separating implemented, tested prototype functions from future ideas such as broad voice support, international country advice, knowledge graphs, and production accounts.

### Deliverables

- Offline demo runbook and recovery checklist
- Seeded local database and vector store backup
- Stakeholder usability-test summary and fixes
- Demo script with fallback paths
- Final evaluation report and feature-status matrix

### Definition of done

On the presentation device and without internet, the team can complete the core user journey, show evidence and citations, demonstrate a source update changing the retrieved answer basis, and explain all limitations honestly.

---

## Phase 8 - Post-MVP enhancements

Only begin these after Phase 7 has been demonstrated and the core corpus-update workflow is stable.

- Expand verified India corpus coverage and establish a regular source-review schedule.
- Add more reviewed languages and, where feasible, voice support.
- Add controlled International treaty awareness and clearly labelled comparison flows. Do not provide destination-country legal advice without verified country-specific sources and expert review.
- Add richer formulation, ABS, trademark, GI, and plant-variety guided checklists.
- Add optional accounts, privacy-preserving analytics, and audit controls where justified by user research.
- Evaluate knowledge-graph or advanced workflow features only when they solve documented retrieval or navigation problems.
- Plan production hosting and synchronization only after offline-first source integrity has been retained.

## Suggested ownership

| Workstream | Primary responsibility | Early output |
|---|---|---|
| Stakeholder and product research | Product and research lead | Questionnaire, interviews, user needs, gold questions |
| Source governance | Legal-source lead with subject reviewers | Verified source register and update policy |
| Local data and ingestion | Data/RAG lead | Versioned local corpus and repeatable ingestion |
| Backend and safety | Backend lead | Retrieval, answer validation, offline modes, audit trail |
| Frontend and multilingual UX | Frontend lead | Evidence viewer, language flow, source-version display |
| Quality and demo | Quality and integration lead | Evaluation report, offline runbook, presentation rehearsal |

## Completion checklist

- [ ] Stakeholder questionnaire and interviews have informed MVP priorities.
- [ ] The first corpus uses verified official sources with version metadata.
- [ ] Local SQLite metadata and local vector retrieval work without internet.
- [ ] Source versions, ingestion runs, and answer evidence are auditable.
- [ ] A controlled, approved source update changes the retrieved evidence shown to the user.
- [ ] The chat response uses only validated retrieved citations or abstains.
- [ ] At least one non-English experience is reviewed and tested.
- [ ] The offline demo has been rehearsed on the presentation device.
