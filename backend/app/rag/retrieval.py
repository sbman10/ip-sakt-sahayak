"""
backend/app/rag/retrieval.py
------------------------------
Query embedding, top-k vector retrieval, relevance evaluation, and
citation construction.

This module is the bridge between a user question and the raw chunks
stored in ChromaDB.  It embeds the query with the BGE model (using the
query prefix), retrieves the most similar chunks, evaluates whether
the best match is relevant enough, and builds citation objects from
the chunk metadata.
"""

from __future__ import annotations

import logging

from app.rag.config import get_settings
from app.rag.embeddings import embed_query
from app.rag.models import CitationResult, RetrievedChunk
from app.rag.vector_store import get_collection_count, query_similar

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Confidence thresholds (cosine DISTANCE — lower = more similar)
# ---------------------------------------------------------------------------
# distance < 0.20  => similarity > 0.80 => high confidence
# distance < 0.35  => similarity > 0.65 => moderate confidence
# distance >= 0.35 => similarity <= 0.65 => low (abstain)
_DISTANCE_HIGH: float = 0.20
_DISTANCE_ALLOW: float = 0.35


def _distance_to_confidence(best_distance: float) -> str:
    """Map the best cosine distance to a confidence label."""
    if best_distance < _DISTANCE_HIGH:
        return "high"
    if best_distance < _DISTANCE_ALLOW:
        return "moderate"
    return "low"


def _format_section(page_start: int, page_end: int) -> str:
    """Build a human-readable page citation string."""
    if page_start == page_end:
        return f"Page {page_start}"
    return f"Pages {page_start}-{page_end}"


def _build_citations(
    chunks: list[RetrievedChunk],
    max_snippet_len: int = 400,
) -> list[CitationResult]:
    """Build API-ready citation objects from retrieved chunks."""
    citations: list[CitationResult] = []
    for chunk in chunks:
        snippet = chunk.text[:max_snippet_len]
        if len(chunk.text) > max_snippet_len:
            snippet += "..."

        citations.append(
            CitationResult(
                source=chunk.source_filename,
                section=_format_section(chunk.page_start, chunk.page_end),
                text=snippet,
            )
        )
    return citations


def retrieve_context(
    query: str,
    top_k: int | None = None,
) -> tuple[list[RetrievedChunk], list[CitationResult], str]:
    """
    Embed a query, retrieve similar chunks, and evaluate relevance.

    Parameters
    ----------
    query:
        The (PII-scrubbed) user question.
    top_k:
        Override for the number of results.  Defaults to config.

    Returns
    -------
    tuple[list[RetrievedChunk], list[CitationResult], str]
        - The retrieved chunks (may be empty).
        - The formatted citations (may be empty).
        - The confidence label: "high", "moderate", or "low".
    """
    settings = get_settings()
    if top_k is None:
        top_k = settings.rag_top_k

    # Check if the corpus has any documents
    count = get_collection_count()
    if count == 0:
        log.warning("Corpus is empty — no documents have been ingested.")
        return [], [], "low"

    # Embed the query with BGE prefix
    log.debug("Embedding query for retrieval...")
    query_embedding = embed_query(query)

    # Retrieve top-k chunks
    chunks = query_similar(query_embedding, top_k=top_k)

    if not chunks:
        log.warning("No chunks returned from ChromaDB.")
        return [], [], "low"

    # Evaluate relevance using the best (smallest) distance
    best_distance = min(c.distance for c in chunks)
    confidence = _distance_to_confidence(best_distance)

    log.info(
        "Retrieved %d chunks | best_distance=%.4f | confidence=%s",
        len(chunks),
        best_distance,
        confidence,
    )

    # If confidence is too low, return empty to trigger abstention
    if confidence == "low":
        log.info("Relevance too low (distance %.4f >= %.4f) — will abstain.", best_distance, _DISTANCE_ALLOW)
        return [], [], "low"

    # Build citations
    citations = _build_citations(chunks)

    return chunks, citations, confidence
