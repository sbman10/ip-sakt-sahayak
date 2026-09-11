"""
backend/app/rag/service.py
----------------------------
Orchestration boundary between retrieval and Gemini generation.

This module is the single entry point used by the chat router.  It
coordinates PII scrubbing, context retrieval, relevance evaluation,
Gemini generation (or abstention), and response formatting.

No FastAPI types are imported here — the module operates on plain dicts
and dataclasses, making it testable and reusable outside the HTTP layer.
"""

from __future__ import annotations

import logging

from app.rag.retrieval import retrieve_context
from app.services.llm import generate_grounded_answer
from app.services.pii_scrubber import scrub_pii

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DISCLAIMER = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional or registered patent agent."
)

_ABSTAIN_ANSWER = (
    "I cannot find an authoritative source in our verified legal registers to "
    "safely answer this query. To protect your IP interests, you can escalate "
    "this case to our human facilitation desk."
)


def answer_question(
    question: str,
    jurisdiction: str,
    language: str,
) -> dict:
    """
    Full RAG pipeline: scrub → retrieve → evaluate → generate → format.

    Parameters
    ----------
    question:
        The raw user question (may contain PII).
    jurisdiction:
        "india" or "international" (lowercase, from frontend).
    language:
        ISO language code (e.g. "en", "hi", "kn").

    Returns
    -------
    dict
        A dict matching the ChatResponse schema:
        {
            "answer": str,
            "citations": list[dict],
            "confidence": str,
            "disclaimer": str,
            "query_scrubbed": str,  # for audit logging by the router
        }

    Raises
    ------
    RuntimeError
        If the Gemini API call fails.
    """
    # ------------------------------------------------------------------
    # Stage 1: PII scrubbing
    # ------------------------------------------------------------------
    query_scrubbed = scrub_pii(question)
    if query_scrubbed != question:
        log.info("PII detected and redacted from query.")

    # ------------------------------------------------------------------
    # Stage 2: Retrieve context
    # ------------------------------------------------------------------
    chunks, citations, confidence = retrieve_context(query_scrubbed)

    # ------------------------------------------------------------------
    # Stage 3: Evaluate — abstain if relevance is insufficient
    # ------------------------------------------------------------------
    if confidence == "low" or not chunks:
        log.info("Abstaining — insufficient retrieval relevance.")
        return {
            "answer": _ABSTAIN_ANSWER,
            "citations": [],
            "confidence": "low",
            "disclaimer": _DISCLAIMER,
            "query_scrubbed": query_scrubbed,
        }

    # ------------------------------------------------------------------
    # Stage 4: Call Gemini with retrieved context
    # ------------------------------------------------------------------
    context_texts = [c.text for c in chunks]

    # generate_grounded_answer raises RuntimeError on failure —
    # the router catches this and returns HTTP 500.
    answer_text = generate_grounded_answer(
        question=question,  # use original (not scrubbed) for LLM context
        context_chunks=context_texts,
    )

    # ------------------------------------------------------------------
    # Stage 5: Format response
    # ------------------------------------------------------------------
    citation_dicts = [
        {
            "source": c.source,
            "section": c.section,
            "text": c.text,
        }
        for c in citations
    ]

    return {
        "answer": answer_text,
        "citations": citation_dicts,
        "confidence": confidence,
        "disclaimer": _DISCLAIMER,
        "query_scrubbed": query_scrubbed,
    }
