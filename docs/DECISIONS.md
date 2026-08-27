# DECISIONS.md — Architecture Decisions
# IP-SAKTI Sahayak | SIH 2026

This document lists the architectural decisions we made, the reasons behind them, and the alternatives we considered. This helps new team members understand why the system is built this way.

---

## ADR 1: React + Vite + Vanilla CSS for Frontend

* **Decision:** Use React + Vite with custom Vanilla CSS for the initial UI mockup instead of Next.js + Tailwind + shadcn/ui.
* **Reason:** Next.js introduces server routing overhead, layout complications (e.g. Server vs Client Components), and hydration states that make learning harder. Vanilla CSS lets us build a custom, visually distinct dark theme from scratch, avoiding the standard "SaaS wrapper" look.
* **Alternatives Considered:** 
  - *Next.js (App Router):* Too complex for the initial mockup step; harder to deploy simple static pages.
  - *Tailwind CSS:* Rejected to avoid configuration overhead and keep layout code completely transparent.
* **Consequences:** We write more custom wrapper classes in `src/index.css`, but we have full layout control and a lightweight frontend.

---

## ADR 2: SQLite-based local ChromaDB for Vector Search

* **Decision:** Use local ChromaDB as the primary vector store instead of Pinecone or Qdrant Cloud.
* **Reason:** Pinecone requires active internet access, API key tokens, and managing external database endpoints. ChromaDB runs locally, creates a standard database directory in our project root, and has a simple client API.
* **Alternatives Considered:**
  - *Pinecone / Milvus:* Good for million-scale datasets, but introduces setup complexity during initial prototyping.
  - *pgvector:* Good choice for combining SQL + Vector operations, but requires setting up Docker PostgreSQL images locally. We will evaluate migrating here if we need structured user databases later.
* **Consequences:** We must commit raw scrapers to local disk, but development can proceed offline with zero hosting fees.

---

## ADR 3: Google Gemini API as Foundation LLM

* **Decision:** Use Gemini 1.5 Flash via standard API calls instead of HuggingFace local models.
* **Reason:** Flash has a very large context layout, is fast, and offers a free tier for developers. Running a local 7B parameter LLM on average student laptops causes slow responses and crashes due to low RAM.
* **Alternatives Considered:**
  - *Local Llama-3-8B:* Slow on standard CPUs (less than 1 token/sec).
  - *OpenAI GPT-4o-mini:* Good, but does not offer the same free-tier credits that Google AI Studio provides standard developers.
* **Consequences:** We must have an active internet connection to query the LLM, and API keys must be kept secure.
