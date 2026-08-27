# Rules.md — AI & Developer Rules
# IP-SAKTI Sahayak | SIH 2026

---

## 1. Commenting Protocol for Code Modifications

Every time code is changed (by human or AI), the change MUST be annotated with comments in the code. This ensures learning continuity.

* **Every Function:** Add a 1-line comment directly above the definition explaining the purpose (the "WHAT") and the regulatory/IP context (the "WHY").
* **Modification Tags:**
  - Add `# ADDED: [description]` for new code blocks.
  - Add `# UPDATED: [description]` for modified logic.
  - Add `# REMOVED: [description]` if code has been disabled.
* **Review Tagging:** In the Pull Request description, explain why these annotations exist.

*Example:*
```python
# ADDED: Section check to ensure user queries matching public formulas fail early before indexing LLM costs
def check_traditional_formula(ingredients: list[str]) -> bool:
    ...
```

---

## 2. Coding Language & Stack Rules

### Frontend (`ip-sakti/`)
- **Base:** React 19, JavaScript. Keep standard component files cleanly split.
- **Routing:** Use `react-router-dom` for application navigation. Do not implement complex router patterns.
- **State:** React standard state (`useState`, `useContext`) is preferred. If global state becomes vital, use `zustand`. Do not use Redux.
- **Styling:** Vanilla CSS. All custom variables must reside in `src/index.css`. Do not add Tailwind CSS unless specifically approved.

### Backend (`backend/` - Planned)
- **Base:** Python 3.11+.
- **Web Layer:** FastAPI. All routing files go matching `/routers/{endpoint_name}.py`.
- **Data Schemas:** Strict Pydantic models for incoming and outgoing APIs.
- **Orchestration:** Use direct database and LLM client APIs where possible. Avoid complex LCEL (LangChain Expression Language) structures.

---

## 3. RAG Accuracy & Legal Safety Rules

> [!CAUTION]
> **No Hallucinated Citations & Treaties:**
> Under no circumstances should the model invent legal acts, section codes, or case law references. Grounding is the absolute priority of this RAG assistant.

* **Strict Context Constraint:** The prompt to the LLM must declare: *"You are an IP regulatory expert. Answer the query based ONLY on the context below. If you cannot find the answer in the context, say 'I cannot find an authoritative source to confirm this.' Do not invent references."*
* **Abstention Policy:** If the vector database returns similarity scores below a threshold of `0.65` for all chunks, bypass the LLM and return a standard low-signature response telling the user that no direct citations were matched.
* **Separation of Jurisdictions:** India-specific statutes and international treaty files must go into separate vector indices/collections. Combining them is barred. Under the hood, querying the Indian database must be isolated from the international database.

---

## 4. Workspaces & Git Guidelines

* **Working Directory:** All code must live under `ip-sakti/` (frontend) or future `backend/` and `corpus/` directories. No loose operational scripts at the root level.
- **Branching Policy:**
  - **`main`:** Stable, review-approved codebase. Direct pushes to main are deactivated.
  - **`feature/*`:** Branching for new components or pages.
  - **`bugfix/*`:** Resolving isolated bugs.
  - **`research/*`:** Investigative notebooks or script templates.
- **Merge Criteria:** Pull requests require validation logs or compilation tests to merge. The code must be clean, annotated with comments, and verified.
