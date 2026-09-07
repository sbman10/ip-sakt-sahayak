# AyuSync — IP-SAKTI Sahayak Team Briefing

> **Use this document to explain the project to the team before we write the next major feature.**
> It is a project plan, not legal advice.

---

## 1. The project in one sentence

**IP-SAKTI Sahayak is a multilingual, source-citing digital guide that helps people in Ayurveda understand intellectual-property, regulatory and biodiversity-compliance questions in India and internationally.**

It must not behave like a generic chatbot that confidently invents an answer. It should locate relevant official material, show the exact source, explain it in simple language, state uncertainty when it cannot find adequate evidence, and guide the user towards an appropriate official portal or human IP facilitator.

---

## 2. The official challenge in plain language

The Ministry of AYUSH problem statement says that people working with Ayurveda often have a difficult question:

> “I have an Ayurvedic product, formulation, herb, process, brand or research result. What can I legally protect, what approvals may I need, and what are my obligations?”

Today, the answer may involve several different systems at the same time:

- **Patent:** protects a genuinely new invention or process for a limited period.
- **Trademark:** protects a brand name, logo or identity.
- **Geographical Indication (GI):** protects products whose reputation/qualities are linked to a place.
- **Design:** protects the visual appearance of a product.
- **Copyright:** protects original expression, such as software, text or artwork.
- **Trade secret:** protects valuable confidential business information when kept secret.
- **Plant-variety rights:** protect eligible plant varieties and recognise relevant breeder/farmer rights.
- **ABS (Access and Benefit Sharing):** duties around accessing biological resources and sharing benefits fairly.
- **Drug/food/cosmetic regulation:** rules that decide how an Ayurvedic product may be classified, licensed, labelled and advertised.

This is confusing for a practitioner, farmer, researcher or small startup. As a result, some real innovation is not protected, while traditional knowledge can be misused or patented elsewhere.

### What the problem statement expects from us

We need to build a deployable assistant that:

1. Gives **plain-language guidance** for Ayurveda-specific IP and regulatory questions.
2. Keeps **India** and **International** answers visibly separate with a jurisdiction switch.
3. Helps classify an Ayurvedic formulation before giving complex advice.
4. Uses **official, curated and version-tracked sources**.
5. Shows a citation for every legal claim: statute, rule, treaty, registry record or other source.
6. Gives a confidence level and says “I do not have enough evidence” when necessary.
7. Includes an “information, not legal advice” disclaimer and a path to a human IP facilitator.
8. Works in multiple languages, eventually using tools such as Bhashini.
9. Protects privacy, records appropriate audit information and avoids fabricating authority.

---

## 3. What we are building — and what we are not building

### We are building

A web application with a guided chat experience. A user can choose India or International, describe a product/question, answer a few classification questions, and receive an answer with sources and next steps.

Example user question:

> “Our startup changed the delivery form of an old herbal formulation. What protection and approvals should we investigate in India?”

The assistant should not jump to a legal conclusion. It should first ask only the necessary clarifying questions, retrieve relevant official texts, explain possible routes, cite the texts it used, and recommend professional review where needed.

### We are not building

- A replacement for a lawyer, patent agent, regulator or clinician.
- A chatbot that guesses legal sections from its general training.
- A system that automatically submits legal applications or spends money through paid databases.
- A complete national legal database on day one.
- A magical “patent approved/not approved” button.

---

## 4. Who will use it

| User | Their real problem | What AyuSync/IP-SAKTI should do |
|---|---|---|
| Vaidya / Ayurvedic practitioner | “Can this traditional formulation be patented?” | Explain the difference between traditional knowledge and a potentially new invention; point to sources and experts. |
| AYUSH startup / MSME | “How do IP, licensing and branding fit together?” | Give a guided checklist and cited pathways. |
| Researcher / student | “Which rules apply before using biological resources?” | Surface the relevant ABS and IP sources, with clear limitations. |
| Herb cultivator / producer group | “Can our place-linked product get recognition?” | Point toward GI, trademark and plant-variety-related routes. |
| IP facilitator | “Where is the source?” | Show retrievable, precise citations rather than opaque model answers. |

---

## 5. The most important product idea: classify before answering

In this domain, the same word “Ayurvedic product” can mean very different things. Before an answer, the assistant needs a short **formulation-classification flow**.

It may ask questions like:

1. Is the formulation/method directly drawn from an authoritative classical text?
2. Is there a new process, delivery method, dosage, combination or evidence-based change?
3. Is it intended as medicine, a food/nutraceutical, cosmetic or another category?
4. Does it use biological resources and, if so, what is the relevant access/benefit-sharing context?
5. Is the question about India or another jurisdiction?

This does not decide the law for the user. It routes them to the correct information path.

```text
User describes product
        ↓
Minimum clarifying questions
        ↓
Product/formulation category
        ↓
Relevant IP + regulatory + ABS source collection
        ↓
Source-cited guidance + confidence + next steps
        ↓
Human escalation when the question needs expert judgment
```

---

## 6. The system in plain English

```text
Browser screen (React)
    User selects jurisdiction, language and submits a question
                ↓
Backend API (FastAPI / Python)
    Checks the request and coordinates the work
                ↓
Retrieval system (RAG)
    Searches our approved legal/source library for relevant passages
                ↓
Language model (LLM)
    Writes a clear answer only from the retrieved passages
                ↓
Answer screen
    Shows answer + citations + confidence + disclaimer + next step
```

### The jurisdiction rule

India and International are not cosmetic toggle colours. They are a safety rule.

- When the user selects **India**, retrieval must use the India source collection.
- When the user selects **International**, retrieval must use treaty/international source collections.
- If comparison is required, the product must clearly label and cite each jurisdiction instead of mixing them into one answer.

---

## 7. Essential jargon — explained normally

| Term | Plain meaning | Why it matters here |
|---|---|---|
| **Frontend** | The website screen the user sees and clicks. | Landing page, chat, toggle, language selector and citations panel. |
| **Backend** | The server-side program that receives requests and returns data. | Keeps sensitive logic, documents and API keys out of the browser. |
| **API** | A structured way for two programs to talk. | React sends the question to FastAPI and receives a response. |
| **HTTP** | The standard request/response system used on the web. | `POST /api/chat` sends a question; the server returns an answer. |
| **JSON** | A simple text format for structured data. | Carries questions, answers, citations and confidence between frontend and backend. |
| **React** | A JavaScript library for building interactive screens from components. | Powers our interface. |
| **Vite** | A development tool that runs/builds the React app quickly. | Lets us work locally with fast refresh. |
| **FastAPI** | A Python framework for making APIs. | Powers our first backend endpoints and automatic API docs. |
| **Pydantic** | Python validation rules for incoming/outgoing data. | Ensures a chat request has the right fields and types. |
| **Database** | Organised long-term storage. | Stores source metadata, later user/audit records and structured application data. |
| **PostgreSQL** | A reliable relational database. | Strong future home for structured source and application data. |
| **RAG** | *Retrieval-Augmented Generation*: search trusted documents first, then ask a language model to answer using those documents. | The core defence against invented legal claims. |
| **Corpus** | The approved collection of documents the system can search. | Includes statutes, rules, treaties, standards, registry records and selected case law. |
| **Chunk** | A small, traceable slice of a long document. | Search works on useful passages, while page/section metadata preserves the citation. |
| **Embedding** | A numerical representation of text meaning. | Helps search for relevant text even when the user uses different words. |
| **Vector database** | Storage/search designed for embeddings. | Helps retrieve semantically similar legal passages. |
| **Hybrid search** | Keyword search plus meaning-based vector search. | Legal questions need both exact section names and semantic matching. |
| **Reranking** | A second pass that sorts retrieved passages more carefully. | Helps send the best evidence to the answer-generation step. |
| **LLM** | Large Language Model, such as Gemini or an OpenAI model. | Writes the plain-language answer; it must be constrained by retrieved evidence. |
| **Hallucination** | A plausible but false model output. | Especially dangerous for legal information; our system must abstain rather than invent. |
| **Citation** | A precise pointer to the material behind a claim. | Users and judges must be able to inspect the source. |
| **Confidence** | A signal about evidence quality, not a guarantee of legal correctness. | Low confidence should trigger a human referral. |
| **Knowledge graph** | A map of entities and relationships. | Later: connects laws, sections, IP types, authorities, treaties and forms. |
| **Agentic workflow** | A controlled sequence of specialised steps/tools. | Later: classification → retrieval → verification → answer; not autonomous chaos. |
| **Multilingual** | Supports users in more than one language. | Needed for accessibility; citations remain tied to authoritative source text. |
| **Bhashini** | India’s language-AI infrastructure/services. | A future option for Indian-language translation and speech. |
| **OCR** | Optical Character Recognition: converting an image/scanned PDF into text. | Needed when an official source is scanned instead of digitally searchable. |
| **CORS** | Browser permission rules for a frontend calling a backend on another address. | Needed for local React-to-FastAPI development. |
| **Environment variable / `.env`** | A secret/configuration stored outside source code. | Protects API keys and environment-specific settings. |
| **Git** | A history system for code. | Lets a team collaborate, review and recover changes. |

---

## 8. Our build journey: small milestones, not one huge jump

### Milestone 1 — Product shell (complete or nearly complete)

**Goal:** A polished prototype that explains the idea.

- Landing page and chat workspace
- India/International toggle
- Language selector placeholder
- Citations, confidence and disclaimer UI placeholders
- Mock responses

**Demo sentence:** “This is how a source-cited Ayurveda IP assistant will feel to use.”

### Milestone 2 — Real frontend-to-backend connection

**Goal:** Replace the mock response with a real API response.

- Create FastAPI `GET /health` and `POST /api/chat`
- Validate requests/responses with Pydantic
- Use Axios in React to call the backend
- Show loading and error states
- Return honest fixed development JSON at first

**Demo sentence:** “The UI now talks to our real Python server.”

### Milestone 3 — Trusted source library

**Goal:** Build a small, auditable corpus before building AI.

- Begin with a few official, public documents
- Store raw files safely
- Extract text and preserve page/section/source metadata
- Create a source register: title, official URL, jurisdiction, publication/version date, access date and checksum
- Manually verify sample extracts

**Demo sentence:** “Every future answer begins from a controlled source library, not the model’s memory.”

### Milestone 4 — Search before generation

**Goal:** Prove that the system retrieves the correct material.

- Keyword search first
- Then embeddings/vector search
- Add jurisdiction filters
- Test with known questions and expected sources
- Add hybrid retrieval and reranking only when basic search is working

**Demo sentence:** “Before we ask an AI to explain anything, we can show the exact relevant source passage.”

### Milestone 5 — Citation-grounded RAG MVP

**Goal:** Create the minimum working AI assistant.

- Retrieve only relevant approved chunks
- Give those chunks to one LLM
- Require a source-grounded answer format
- Return citations, confidence and disclaimer
- Abstain when evidence is missing
- Include a human-escalation path

**Demo sentence:** “The assistant answers in simple language, but every legal claim traces back to a source.”

### Milestone 6 — Accuracy, safety and usability

**Goal:** Make the MVP trustworthy enough to demonstrate.

- Build a test set of known questions and expected citations
- Test citation correctness, retrieval quality and safe abstention
- Add source updates/version tracking
- Improve classification flow and error messages
- Add audit/privacy/security controls appropriate to the prototype

### Milestone 7 — Advanced enhancements

**Goal:** Extend only after the MVP is reliable.

- Bhashini-supported multilingual delivery
- Text translation, then speech/voice
- Knowledge graph for connected multi-step questions
- Agentic orchestration with controlled tools
- Paid-source connectors only with explicit user permission and logging
- Deployment, monitoring and collaboration automation

---

## 9. Recommended team roles for five people

People can help one another, but each area needs a clear owner.

| Role | Main responsibility now | First deliverable |
|---|---|---|
| **1. Product & legal-source lead** | Turns the problem statement into user flows; verifies source provenance; maintains source register. | List of initial official documents and 20 test questions. |
| **2. Frontend lead** | React screens, chat interaction, accessibility, responsive layout and citation display. | React UI connected to the backend. |
| **3. Backend/API lead** | FastAPI routes, Pydantic models, error handling, environment configuration and tests. | Working `/health` and `/api/chat` endpoints. |
| **4. Data/RAG lead** | Document extraction, chunking, metadata, retrieval experiments and evaluation. | Searchable mini-corpus with verified results. |
| **5. Quality, integration & documentation lead** | Git hygiene, test cases, release checklist, user scenarios, demo flow and learning journal. | Test checklist, evaluated demo and updated project docs. |

Every team member should understand the end-to-end flow. Ownership does not mean isolation.

---

## 10. What everyone needs to install and set up

### Required on every team member’s laptop

- **Git** and a GitHub account
- **VS Code or Antigravity IDE**
- **Node.js (current LTS)** for React/Vite
- **Python 3.12+**
- A modern browser such as Chrome/Edge/Firefox
- Access to the team GitHub repository

### Required project setup

- Shared GitHub repository with protected main branch if possible
- A simple task board: GitHub Projects, Notion, Trello or GitHub Issues
- Shared `.env.example` file — never share actual secret keys in chat or Git
- `README.md` with local run instructions
- `docs/LEARNING.md` for short learning notes
- `docs/DECISIONS.md` for decisions such as “which vector database did we select and why?”

### Install later, when the relevant milestone begins

- PostgreSQL
- A vector-search tool/database
- Docker and Docker Compose
- OCR tools
- Redis/Celery
- Neo4j
- Bhashini/translation/speech integrations
- Cloud deployment accounts

Do not ask five people to install every advanced tool now. It creates setup problems without moving the product forward.

---

## 11. Our team rules

1. **No legal claim without a source.**
2. **No source means a clear abstention, not a guess.**
3. **Never mix India and International source sets invisibly.**
4. **Never commit API keys, passwords or paid-source credentials.**
5. **Use official sources first; record every source’s URL and version/access date.**
6. **Keep the first corpus small and verified.**
7. **Do not add a technology because it sounds advanced. Add it only when a milestone needs it.**
8. **Every major change needs a short explanation in `LEARNING.md`.**
9. **Every feature has a normal-case test and a failure-case test.**
10. **The assistant provides information, not legal advice.**

---

## 12. Suggested first team meeting agenda (45–60 minutes)

1. Read the one-sentence project statement aloud.
2. Explain the user problem: Ayurveda questions involve IP + regulation + biodiversity, not one law.
3. Show the current UI prototype.
4. Explain the safety promise: source-cited, jurisdiction-separated, disclaimer, abstention.
5. Show the milestone roadmap.
6. Assign the five initial roles.
7. Agree on the first two-week target: **React → FastAPI connection, small trusted corpus, retrieval proof, then RAG MVP.**
8. Create GitHub Issues for the next small tasks only.

---

## 13. The demo story we should eventually tell judges

> “An AYUSH startup founder enters a question about a herbal formulation. IP-SAKTI first asks a few focused questions so it does not treat every Ayurvedic product as identical. The user chooses India. The system searches an approved Indian source collection, retrieves relevant text, and provides a plain-language answer with visible citations, confidence and a disclaimer. If the evidence is weak, it says so and directs the user to a qualified facilitator. International material is shown only when the user deliberately switches or requests a clearly labelled comparison. This helps people navigate a complex process without pretending that AI is a lawyer.”

---

## 14. The first practical goal

Before any advanced AI work, the team should complete this:

```text
React chat screen
      ↓ sends JSON
FastAPI endpoint
      ↓ returns validated JSON
React shows answer, citation placeholder, confidence and disclaimer
```

Then build the source library. Only after retrieval gives correct, inspectable passages should an LLM be added.

That order is how we avoid making “vibecoded slop”: we understand the data flow, verify the evidence, and add intelligence one controlled layer at a time.

