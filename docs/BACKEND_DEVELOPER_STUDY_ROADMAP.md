# Backend Developer Study Roadmap

## Purpose

This roadmap gives **sbman** a practical sequence for understanding the backend, language-model integration, debugging, credentials, GPU use, operating cost, and user impact of this project. It is organised by dependency: build reliable services first, then connect external services, then make informed performance and cost decisions.

## Starting point

sbman has already watched four videos from the **Harish Neel AI** channel on RAG retrieval and ingestion pipelines. Treat that as completed background knowledge. This roadmap therefore concentrates on the backend responsibilities around that work: serving requests, validating data, securing credentials, inspecting failures, running locally, and explaining cost and impact.

## What the project is actually going to implement

The attached USP and strategy guide expands the implementation beyond a generic chat screen. The intended product flow is:

```text
Text or voice input in a supported language
        -> translated or transcribed input with user confirmation
        -> structured formulation and business facts
        -> deterministic classification and missing-input checks
        -> Shastra-Anchor formulation matching
        -> jurisdiction and date-filtered source retrieval
        -> RAG answer generation from approved evidence
        -> citation and effective-date validation
        -> Protection Map with answer, uncertainty, and next steps
        -> translated text and optional speech output
```

### Core implementation modules

| Module | What will be implemented | What the backend developer must understand |
|---|---|---|
| RAG question answering | Retrieve approved legal and classical-formulation passages, provide them as context to the language model, and return source-linked answers. | Retrieval filters, context construction, prompt constraints, structured output, citation validation, confidence, and abstention. |
| Shastra-Anchor | A small, transparent index of curated classical formulations. It compares ingredients, plant parts, approximate ratios, synonyms, and process classes with a user-submitted formulation. | Canonical schemas, synonym mapping, similarity or overlap scoring, explainable match results, provenance, and coverage limits. It is a lawful prior-art pointer, not unrestricted TKDL access. |
| Kaal-Sakshi | Version every legal record with publication or effective dates, status, source URL, checksum, ingestion date, and superseded versions. | Time-aware retrieval, date filters, source lifecycle, stale-record warnings, and audit history. |
| Deterministic classification | Route the user through classical, modified or proprietary, and food or nutraceutical possibilities before explanation. | Rule schemas, required fields, missing-input prompts, user confirmation, and the boundary between system-selected rules and model explanation. |
| Protection Map | Produce one practical result containing likely regulatory category, patent posture, naming posture, ABS posture, advertising posture, evidence, uncertainty, and next steps. | Aggregating validated outputs without presenting a legal conclusion as certainty. |
| Naam-Sanket | Provide a narrow, explainable pre-search for possible conflicts across relevant trademarks, GIs, classical names, and generic names. | Normalisation, exact and fuzzy matching, source scope, false-positive handling, and human review. |
| Bhashini language layer | Add language translation, speech-to-text input, and text-to-speech output for the languages prioritised by user research. | Preserve the original utterance, translated text, language code, confidence, provider errors, consent, and an accessible fallback when the service is unavailable. |
| Safety and audit layer | Block unsupported citations, expose missing or stale evidence, minimise sensitive recipe retention, record source versions, and provide escalation. | Foreign-key citation checks, PII minimisation, audit records, safe logging, and reproducible failure states. |

### Scope boundaries from the strategy guide

Build the transparent core first: Shastra-Anchor, Kaal-Sakshi, Protection Map, calibrated abstention, RAG question answering, the formulation wizard, jurisdiction controls, language support, the disclaimer, escalation workflow, and audit logging. Treat international export-market readiness, paid source connectors, practitioner registries, community biodiversity links, and mobile or public API deployment as later work. Do not make researcher matchmaking, an Innovation Genome, an automatically generated timeline, a user-facing knowledge-graph visualisation, or a single-number IP Health Score part of the first prototype.

## Recommended learning order

1. **Python and backend foundations**: write predictable functions, work with files and JSON, manage environments, and understand HTTP.
2. **API service construction**: build and test FastAPI endpoints with validated inputs and stable response formats.
3. **Data and local persistence**: use SQLite for structured records and ChromaDB for local similarity search, with clear source metadata.
4. **Language-model integration**: understand prompts, context limits, tokens, response formats, and failure handling.
5. **Retrieval-augmented generation implementation**: connect local retrieval, deterministic rules, the formulation index, and a constrained language-model explanation step.
6. **Multilingual and Bhashini integration**: add translation, speech-to-text, text-to-speech, language fallback, and human review for terminology.
7. **Credentials and integrations**: use environment variables, provider tokens, request logs, rate limits, and error handling safely.
8. **Debugging and observability**: trace a request across frontend, backend, database, language services, and external provider.
9. **GPU and runtime performance**: understand memory, batching, precision, and why hardware affects speed and feasible model size.
10. **Economics and user impact**: choose an operating approach that balances quality, latency, privacy, availability, and cost.
11. **Integration practice**: build a small local flow, test failures deliberately, and document what was verified.

## Topic table and resources

| Topic | Brief description | Essential concepts and practical skills | Suggested YouTube resources |
|---|---|---|---|
| Python and backend foundations | The programming and web foundations behind a reliable service. | Virtual environments, packages, functions, exceptions, type hints, file paths, JSON, HTTP methods, status codes, request and response flow. Build a small JSON endpoint and return meaningful error codes. | [Python backend learning search](https://www.youtube.com/results?search_query=Python+backend+fundamentals+HTTP+JSON+virtual+environment) |
| FastAPI and REST APIs | Build the server endpoints used by the web application. | Routes, request body, query parameters, response status, dependency injection, CORS, async functions, OpenAPI docs, automated endpoint tests. Build `GET /health` and a validated `POST /api/chat`. | [FastAPI and Pydantic full course](https://www.youtube.com/watch?v=SfAhJr3fkT0), [FastAPI full-stack course](https://www.youtube.com/watch?v=iukOehU5aF4) |
| Pydantic and data contracts | Define exactly what the backend accepts and returns. | `BaseModel`, field types, optional fields, validation errors, constrained values, nested objects, serializers, and backward-compatible API changes. Create request and response schemas for chat, citations, confidence, and errors. | [Pydantic tutorial search](https://www.youtube.com/results?search_query=Pydantic+Python+tutorial+validation+FastAPI) |
| Local data and ChromaDB | Store structured metadata locally and search local text representations. | SQLite tables, primary keys, migrations, transactions, ChromaDB collections, metadata filters, persistent storage, collection separation, deletion and re-indexing. Store source version, chunk identifier, jurisdiction, and page or section with every record. | [ChromaDB tutorial search](https://www.youtube.com/results?search_query=ChromaDB+tutorial+Python+persistent+client+metadata+filters), [SQLite with Python search](https://www.youtube.com/results?search_query=SQLite+Python+tutorial+database+CRUD) |
| Language-model concepts | Understand the behaviour and limits of a language-model call before placing it in a backend route. | Prompt and system instruction, input and output tokens, context window, temperature, structured JSON output, streaming, timeout, retry, grounding, citation validation, abstention, and provider-specific limits. Implement a small adapter that can be replaced without changing the API route. | [LLM application development search](https://www.youtube.com/results?search_query=LLM+application+development+prompt+tokens+context+window+structured+output), [function calling and structured output search](https://www.youtube.com/results?search_query=LLM+structured+output+JSON+function+calling+tutorial) |
| Retrieval-augmented generation pipeline | Connect retrieval to a constrained explanation step while keeping deterministic rules and citations outside the model's control. | Query preparation, jurisdiction and date filters, top-k retrieval, reranking, context packing, prompt boundaries, answer schema, citation resolver, source-version checks, confidence, partial answers, and calibrated abstention. Build a test where unsupported citations are rejected. | [RAG pipeline implementation search](https://www.youtube.com/results?search_query=RAG+pipeline+retrieval+context+citation+validation+Python+tutorial), [grounded generation search](https://www.youtube.com/results?search_query=grounded+generation+citations+abstention+LLM+tutorial) |
| Formulation index and deterministic rules | Implement the project-specific reasoning path before language-model explanation. | Formulation schema, dravya and synonym normalisation, ingredient and plant-part matching, ratios, process class, overlap bands, classification rules, Section 3(p) exposure bands, ABS tiers, missing facts, and explainable results. Keep source provenance for every mapping. | [knowledge graph and entity matching search](https://www.youtube.com/results?search_query=Python+entity+matching+synonyms+knowledge+base+tutorial), [rule engine Python search](https://www.youtube.com/results?search_query=Python+deterministic+rule+engine+decision+tree+tutorial) |
| Bhashini and multilingual voice | Make the interface usable in selected Indian languages across text and voice. | Language codes, translation direction, speech-to-text, text-to-speech, pronunciation, translated-query retention, original-source citation preservation, consent, confidence, retries, quotas, audio formats, and offline text fallback. Test a Hindi or Kannada question from speech through translated answer audio. | [Bhashini API tutorial search](https://www.youtube.com/results?search_query=Bhashini+API+speech+to+text+text+to+speech+translation+tutorial), [multilingual speech pipeline search](https://www.youtube.com/results?search_query=Indian+language+speech+to+text+translation+text+to+speech+API+tutorial) |
| API keys, Hugging Face, Kaggle, and providers | Safely authenticate to external services and diagnose failed requests. | Environment variables, `.env` files, `.gitignore`, secret rotation, least privilege, bearer headers, token scopes, request identifiers, quota, rate limits, 401 versus 403 versus 429 responses, and avoiding secrets in logs. Create a key-loading function that fails safely when a required value is absent. | [Hugging Face access token search](https://www.youtube.com/results?search_query=Hugging+Face+access+token+API+Python+tutorial), [Kaggle API key setup search](https://www.youtube.com/results?search_query=Kaggle+API+key+setup+Python+tutorial), [API-key security search](https://www.youtube.com/results?search_query=API+key+security+environment+variables+Python+tutorial) |
| Debugging and observability | Find the real source of a fault instead of guessing. | Reproduce the issue, read stack traces, breakpoint debugging, structured logs, correlation IDs, request timing, health checks, configuration inspection, tests, mock providers, and minimal reproducible examples. Trace one user request end to end and document the failure point. | [Python debugging search](https://www.youtube.com/results?search_query=Python+debugging+VS+Code+breakpoints+logging+tutorial), [FastAPI logging and testing search](https://www.youtube.com/results?search_query=FastAPI+logging+testing+pytest+tutorial) |
| GPU and runtime performance | Learn how compute hardware affects speed, memory use, and the feasible size of a local model. | CPU versus GPU roles, VRAM, RAM, CUDA compatibility, model weights, precision, quantization, batch size, throughput, latency, warm-up, out-of-memory errors, and monitoring. Measure latency and memory for one fixed prompt before and after a configuration change. | [GPU, VRAM, and inference search](https://www.youtube.com/results?search_query=GPU+VRAM+LLM+inference+quantization+tutorial), [CUDA and PyTorch GPU search](https://www.youtube.com/results?search_query=PyTorch+CUDA+GPU+memory+tutorial) |
| Model selection and economics | Make transparent choices about hosted versus local operation and their consequences for users. | Per-request token cost, infrastructure cost, storage, GPU rental or hardware cost, latency, concurrency, rate limits, quality evaluation, privacy, offline availability, energy use, and total cost of ownership. Calculate cost per successful user task, not only cost per request. | [LLM inference cost search](https://www.youtube.com/results?search_query=LLM+inference+cost+tokens+latency+GPU+economics), [hosted versus local models search](https://www.youtube.com/results?search_query=hosted+vs+local+LLM+cost+privacy+latency) |
| Security, reliability, and deployment | Keep the service usable and safe outside a developer laptop. | Input limits, CORS policy, dependency pinning, backups, health checks, graceful errors, local startup, container basics, configuration by environment, audit logs, and recovery testing. Start the complete backend from a clean environment using documented instructions. | [FastAPI deployment search](https://www.youtube.com/results?search_query=FastAPI+deployment+Docker+environment+variables+tutorial), [backend security basics search](https://www.youtube.com/results?search_query=Python+FastAPI+security+best+practices+tutorial) |

## What to master in each stage

### 1. Backend foundations

- Explain the route from browser request to backend response in your own words.
- Read and write JSON files without losing encoding or structure.
- Use a virtual environment and install dependencies from a requirements file.
- Distinguish client errors, server errors, and unavailable-service errors.
- Write a small test for both a successful request and an invalid request.

### 2. API contracts and validation

- Use Pydantic models to prevent malformed data from entering business logic.
- Return stable error messages that help the frontend guide the user.
- Keep fields such as `question`, `jurisdiction`, `language`, `answer`, `citations`, and `confidence` explicit and documented.
- Use FastAPI's generated `/docs` interface to exercise routes before connecting the frontend.

### 3. Local persistence and source traceability

- Keep structured records in SQLite and searchable text records in ChromaDB.
- Design identifiers so an answer can be traced to a source, version, section, page, and local chunk.
- Test source replacement safely: add a newer version, re-index it, confirm the old version is no longer selected for current answers, and retain an audit record.
- Back up local databases and verify that a backup restores correctly.

### 4. Language-model integration

- Treat a provider call as an unreliable network dependency: set timeouts, handle failures, and return a safe fallback.
- Count or estimate input and output tokens because they affect limits and cost.
- Require a structured output format so the backend can validate answer fields before returning them.
- Never let the service present unsupported citations. Validate every cited source against retrieved local metadata.
- Keep provider-specific code in one adapter module so changing provider does not rewrite the application.

### 5. Retrieval-augmented generation implementation

- Keep retrieval, classification, date selection, and citation selection as inspectable backend steps.
- Apply jurisdiction and effective-date filters before assembling context.
- Give the language model only the selected evidence plus a response schema. It may explain the selected evidence, but it must not invent classifications, citations, or source dates.
- Validate every returned citation against the source and chunk identifiers supplied to the request.
- Support `Answer`, `Partial`, and `Abstain` states. A missing or stale source must be visible to the user.
- Test the same question before and after a source-version update, and record why the answer changed.

### 6. Formulation matching and Protection Map

- Design a canonical formulation record containing ingredients, synonyms, plant parts, approximate ratios, process class, source, and coverage status.
- Preserve both the user's original wording and the normalised terms used for matching.
- Return the nearest classical formulation, the overlap or difference, the match explanation, and the relevant legal or regulatory questions.
- Use deterministic rules to identify missing information and classification branches before the model writes prose.
- Build the Protection Map from validated fields: product category, possible IP routes, licensing questions, ABS questions, naming checks, advertising checks, evidence, dates, and next steps.

### 7. Multilingual and Bhashini integration

- Separate the language pipeline into language detection or selection, speech-to-text, text normalisation, translation, retrieval, answer generation, answer translation, and text-to-speech.
- Preserve the original audio or text only for the minimum time needed, subject to the privacy decision. Do not send private recipes for provider training without explicit consent.
- Store the original question, translated query, language code, translation confidence, and provider metadata for debugging, while minimising personal data.
- Keep legal citations linked to the authoritative source language. Label translated explanations as translations or summaries.
- Add graceful degradation: if Bhashini is unavailable, allow typed input and display the answer in a supported fallback language; if text-to-speech fails, keep the translated text available.
- Evaluate multilingual parity with bilingual reviewers. Check not only translation quality, but also whether legal qualifiers, uncertainty, dates, and abstentions survive translation.

### 8. Credential handling and external-service debugging

- Place secrets in `.env` locally and list only placeholder names in `.env.example`.
- Ensure `.env`, notebooks containing secrets, and token files are ignored by Git.
- Know the difference between an invalid key, an insufficient scope, a blocked account, an exhausted quota, and a rate limit.
- Log the provider, endpoint, status code, request ID, and safe error message. Never log a full key or private user content unnecessarily.
- Rotate a key when it may have been exposed, then invalidate the old one at the provider.

### 9. GPU use and performance

- Explain that VRAM limits the weights, temporary working memory, and input context that can fit during a request.
- Understand why a larger model may need more VRAM and may respond more slowly, even when it gives better output.
- Compare CPU and GPU measurements using the same test input, settings, and number of concurrent requests.
- Learn basic quantization trade-offs: lower precision can reduce memory and cost, while potentially changing answer quality or speed.
- Plan a truthful CPU or deterministic fallback for a demo device without a suitable GPU.

### 10. Economic choices and user impact

- Separate one-time costs from recurring costs: development hardware, hosted requests, storage, monitoring, and support.
- Measure cost per completed task and include failed or retried requests in the calculation.
- Balance speed and answer quality against affordability for students, practitioners, and small organisations.
- Consider privacy and connectivity: local operation can improve availability and reduce data transfer, but may require capable hardware and maintenance.
- State assumptions clearly. Do not present cost estimates as facts unless they come from the current provider pricing and measured usage.

## Practical capability checkpoints

After completing this roadmap, sbman should be able to:

1. Start the FastAPI service locally and verify `/health` and `/docs`.
2. Add a Pydantic field safely, update the route, and test both success and validation failure.
3. Store a source record locally, retrieve it by metadata, and expose its citation in an API response.
4. Run a retrieval-augmented generation request where the answer cites only validated local evidence.
5. Add a formulation record, match it through Shastra-Anchor, and expose the result in a Protection Map.
6. Configure a Hugging Face, Kaggle, Bhashini, or language-model provider token through an environment variable without committing it.
7. Diagnose a failed provider call from its status code, safe logs, and configuration state.
8. Send one supported-language voice question through speech-to-text, retrieval, translated response, and text-to-speech, with a typed fallback.
9. Explain whether a task needs a GPU, how VRAM affects feasibility, and what fallback is available.
10. Compare two operating approaches using cost, latency, privacy, availability, and user accessibility.

## PowerPoint guidance: economic usage slide

Add one slide titled **Economic Usage and User Impact** after the architecture or feasibility slide. Keep it factual and visual rather than crowded.

Suggested slide structure:

| Slide area | Content to cover |
|---|---|
| Cost drivers | Requests, input and output tokens, hosted provider charges, local GPU or device cost, storage, and maintenance. |
| Choice comparison | Compare hosted service, local operation, and a hybrid approach on cost predictability, latency, offline availability, privacy, and hardware needs. |
| Project decision | State the prototype approach: local source database and retrieval reduce dependence on connectivity; a hosted language-model call may be used when internet is available; an offline evidence-summary fallback supports demonstrations. |
| User impact | Explain how this approach can make the tool more accessible during poor connectivity, improve trust through local source evidence, and avoid unnecessary recurring calls. |
| Measurement plan | Show that the team will record request volume, average token use, response time, failure rate, and cost per successful task before making scale-up claims. |

Use a simple three-column comparison or a small flow from **user question** to **local evidence** to **optional hosted response** to **cited answer**. Avoid unsupported price figures. If costs are included later, show the provider, pricing date, assumptions, and calculation method in a small footnote.

## Study method

For every topic, follow this loop:

1. Learn the concept from one resource.
2. Build the smallest possible working example in this repository.
3. Break it deliberately with one invalid input or missing configuration value.
4. Read the logs and fix the real cause.
5. Add a short note to `docs/LEARNING.md` explaining what changed, how it was verified, and what remains uncertain.

This turns passive viewing into backend capability.
