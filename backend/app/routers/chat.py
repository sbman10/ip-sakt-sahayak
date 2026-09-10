"""
backend/app/routers/chat.py
----------------------------
FastAPI router powering the POST /api/chat endpoint — the central RAG pipeline.

Pipeline stages (in order)
---------------------------
1.  Record start time for latency measurement.
2.  Scrub PII from the incoming question (DPDP Act compliance).
3.  Embed the scrubbed question with the local all-MiniLM-L6-v2 bi-encoder.
4.  Query the appropriate ChromaDB collection (india_statutes or
    international_treaties) and retrieve the top-5 candidate chunks.
5.  Re-rank those 5 candidates with cross-encoder/ms-marco-MiniLM-L-6-v2
    and select the top-3 most relevant chunks.
6.  Guardrail check — if the best cosine similarity from the vector search
    is below 0.65, abstain immediately without calling Gemini.
7.  If the guardrail passes, call generate_grounded_answer() and return a
    fully-structured ChatResponse with citations and a legal disclaimer.
8.  Compute end-to-end latency and write the audit trail asynchronously.

Lazy singletons
---------------
Heavy objects (ChromaDB client, embedding model, cross-encoder) are
initialised once on first request via module-level globals.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, CitationItem
from app.services.audit import log_transaction
from app.services.llm import generate_grounded_answer
from app.services.pii_scrubber import scrub_pii

# ---------------------------------------------------------------------------
# Third-party imports with startup guards
# ---------------------------------------------------------------------------
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
except ImportError:
    sys.exit("ERROR: chromadb is not installed. Run:  pip install chromadb")

try:
    from sentence_transformers import CrossEncoder, SentenceTransformer
except ImportError:
    sys.exit(
        "ERROR: sentence-transformers is not installed. "
        "Run:  pip install sentence-transformers"
    )

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
#   __file__  = backend/app/routers/chat.py
#   .parents[0] = backend/app/routers/
#   .parents[1] = backend/app/
#   .parents[2] = backend/
#   .parents[3] = project root
#   .parents[4] = (one above project — not needed)
_CORPUS_ROOT = Path(__file__).parents[3] / "corpus"
CHROMA_DB_PATH = str(_CORPUS_ROOT / "chroma_db")

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

COLLECTION_INDIA = "india_statutes"
COLLECTION_INTERNATIONAL = "international_treaties"

# Number of candidate chunks to retrieve from ChromaDB before re-ranking.
TOP_K_RETRIEVE = 5
# Number of top chunks to pass to Gemini after re-ranking.
TOP_K_FINAL = 3

# Guardrail thresholds — based on cosine DISTANCE returned by ChromaDB.
# ChromaDB's default metric is cosine distance (0 = identical, 2 = opposite).
# Distance < 0.35  => similarity > 0.65 => allow
# Distance < 0.20  => similarity > 0.80 => high confidence
_DISTANCE_THRESHOLD_ALLOW: float = 0.35   # similarity >= 0.65
_DISTANCE_THRESHOLD_HIGH: float = 0.20    # similarity >= 0.80

_DISCLAIMER = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional or registered patent agent."
)

_ABSTAIN_ANSWER = (
    "I cannot find an authoritative source in our verified legal registers to "
    "safely answer this query. To protect your IP interests, you can escalate "
    "this case to our human facilitation desk."
)

# ---------------------------------------------------------------------------
# Lazy singletons (module-level, initialised on first request)
# ---------------------------------------------------------------------------
_chroma_client: Optional[chromadb.PersistentClient] = None
_embedding_model: Optional[SentenceTransformer] = None
_reranker_model: Optional[CrossEncoder] = None


def _get_chroma_client() -> chromadb.PersistentClient:
    """Return (or lazily initialise) the ChromaDB PersistentClient."""
    global _chroma_client
    if _chroma_client is None:
        os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")
        log.info("Initialising ChromaDB client at: %s", CHROMA_DB_PATH)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_DB_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def _get_embedding_model() -> SentenceTransformer:
    """Return (or lazily initialise) the SentenceTransformer bi-encoder."""
    global _embedding_model
    if _embedding_model is None:
        log.info("Loading embedding model: %s ...", EMBEDDING_MODEL_NAME)
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        log.info("Embedding model loaded.")
    return _embedding_model


def _get_reranker() -> CrossEncoder:
    """Return (or lazily initialise) the CrossEncoder re-ranker."""
    global _reranker_model
    if _reranker_model is None:
        log.info("Loading re-ranker model: %s ...", RERANKER_MODEL_NAME)
        _reranker_model = CrossEncoder(RERANKER_MODEL_NAME)
        log.info("Re-ranker model loaded.")
    return _reranker_model


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_collection_name(jurisdiction: str) -> str:
    """Map the request jurisdiction to the correct ChromaDB collection name."""
    return COLLECTION_INDIA if jurisdiction == "India" else COLLECTION_INTERNATIONAL


def _distance_to_confidence(best_distance: float) -> str:
    """
    Translate the best ChromaDB cosine distance to a confidence label.

    ChromaDB returns cosine DISTANCE (lower = more similar):
      distance < 0.20  -> similarity > 0.80 -> "high"
      distance < 0.35  -> similarity > 0.65 -> "moderate"
      distance >= 0.35 -> similarity <= 0.65 -> "low"  (guardrail fires)
    """
    if best_distance < _DISTANCE_THRESHOLD_HIGH:
        return "high"
    if best_distance < _DISTANCE_THRESHOLD_ALLOW:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# Router definition
# ---------------------------------------------------------------------------
router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="RAG-powered Ayurvedic IP legal Q&A",
    description=(
        "Accepts a legal question and jurisdiction toggle, retrieves the most "
        "relevant passages from the local ChromaDB corpus using bi-encoder "
        "vector search, re-ranks them with a cross-encoder, applies a "
        "similarity guardrail, and returns a Gemini-generated grounded answer "
        "with source citations and an immutable legal disclaimer."
    ),
)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """
    Full RAG pipeline: PII scrub -> embed -> retrieve -> re-rank -> guardrail -> LLM -> audit.

    Parameters
    ----------
    payload:
        Validated ChatRequest from the FastAPI request body.

    Returns
    -------
    ChatResponse
        Structured response with answer, citations, confidence, and disclaimer.

    Raises
    ------
    HTTPException 503
        When the ChromaDB collection does not yet exist (corpus not ingested).
    HTTPException 500
        When the Gemini API call fails unexpectedly.
    """
    # ------------------------------------------------------------------
    # Stage 1: Start latency timer
    # ------------------------------------------------------------------
    t_start = time.perf_counter()

    log.info(
        "Chat request | jurisdiction=%s | language=%s | question='%.80s...'",
        payload.jurisdiction,
        payload.language,
        payload.question,
    )

    # ------------------------------------------------------------------
    # Stage 2: DPDP PII scrubbing
    # ------------------------------------------------------------------
    query_scrubbed = scrub_pii(payload.question)
    if query_scrubbed != payload.question:
        log.info("PII detected and redacted from query.")

    # ------------------------------------------------------------------
    # Stage 3: Resolve resources (lazy init on first call)
    # ------------------------------------------------------------------
    chroma_client = _get_chroma_client()
    bi_encoder = _get_embedding_model()
    reranker = _get_reranker()

    collection_name = _resolve_collection_name(payload.jurisdiction)

    try:
        collection = chroma_client.get_collection(name=collection_name)
    except Exception:  # noqa: BLE001
        log.error(
            "ChromaDB collection '%s' not found. Has the corpus been ingested?",
            collection_name,
        )
        raise HTTPException(
            status_code=503,
            detail=(
                f"The '{collection_name}' knowledge base has not been initialised. "
                "Please run the corpus ingestion script first: python corpus/ingest.py"
            ),
        )

    # ------------------------------------------------------------------
    # Stage 4: Bi-encoder vector search — retrieve top-5 candidates
    # ------------------------------------------------------------------
    log.debug("Embedding question for ChromaDB query...")
    question_embedding: list[float] = bi_encoder.encode(
        query_scrubbed, convert_to_list=True
    )

    n_results = min(TOP_K_RETRIEVE, collection.count())
    if n_results == 0:
        log.warning("Collection '%s' is empty — corpus may not be ingested.", collection_name)
        latency_ms = (time.perf_counter() - t_start) * 1000
        await asyncio.to_thread(
            log_transaction,
            payload.question,
            query_scrubbed,
            payload.jurisdiction,
            payload.language,
            "low",
            latency_ms,
        )
        return ChatResponse(
            answer=_ABSTAIN_ANSWER,
            citations=[],
            confidence="low",
            disclaimer=_DISCLAIMER,
        )

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    candidate_docs: list[str] = results["documents"][0]
    candidate_metas: list[dict] = results["metadatas"][0]
    candidate_distances: list[float] = results["distances"][0]

    if not candidate_docs:
        log.warning("No candidates returned from ChromaDB for collection '%s'.", collection_name)
        latency_ms = (time.perf_counter() - t_start) * 1000
        await asyncio.to_thread(
            log_transaction,
            payload.question,
            query_scrubbed,
            payload.jurisdiction,
            payload.language,
            "low",
            latency_ms,
        )
        return ChatResponse(
            answer=_ABSTAIN_ANSWER,
            citations=[],
            confidence="low",
            disclaimer=_DISCLAIMER,
        )

    log.debug("Retrieved %d candidates from ChromaDB.", len(candidate_docs))

    # ------------------------------------------------------------------
    # Stage 5: Cosine similarity guardrail check (pre-reranking)
    # The best (minimum) distance among retrieved chunks represents the
    # closest match.  If even the best candidate exceeds our threshold,
    # no re-ranking or LLM call is worthwhile.
    # ------------------------------------------------------------------
    best_distance: float = min(candidate_distances)
    log.info(
        "Best cosine distance from vector search: %.4f  (allow threshold: %.4f)",
        best_distance,
        _DISTANCE_THRESHOLD_ALLOW,
    )

    if best_distance >= _DISTANCE_THRESHOLD_ALLOW:
        # Similarity is too low — guardrail fires, no Gemini call.
        log.warning(
            "Guardrail fired — best distance %.4f >= threshold %.4f. Abstaining.",
            best_distance,
            _DISTANCE_THRESHOLD_ALLOW,
        )
        latency_ms = (time.perf_counter() - t_start) * 1000
        await asyncio.to_thread(
            log_transaction,
            payload.question,
            query_scrubbed,
            payload.jurisdiction,
            payload.language,
            "low",
            latency_ms,
        )
        return ChatResponse(
            answer=_ABSTAIN_ANSWER,
            citations=[],
            confidence="low",
            disclaimer=_DISCLAIMER,
        )

    # ------------------------------------------------------------------
    # Stage 6: Cross-encoder re-ranking — select top-3 from top-5
    # ------------------------------------------------------------------
    reranker_pairs = [(query_scrubbed, doc) for doc in candidate_docs]
    reranker_scores: list[float] = reranker.predict(reranker_pairs).tolist()

    # Sort by descending re-ranker score and take top-k
    ranked = sorted(
        zip(reranker_scores, candidate_docs, candidate_metas, candidate_distances),
        key=lambda x: x[0],
        reverse=True,
    )
    top_ranked = ranked[:TOP_K_FINAL]

    best_reranker_score: float = top_ranked[0][0]
    log.info("Re-ranker best score: %.4f", best_reranker_score)

    # ------------------------------------------------------------------
    # Stage 7: Build citations and call Gemini
    # ------------------------------------------------------------------
    top_chunks: list[str] = [doc for _, doc, _, _ in top_ranked]
    citations: list[CitationItem] = [
        CitationItem(
            source=meta.get("source", "Unknown Source"),
            section=meta.get("section", "Unknown Section"),
            text=doc[:400] + ("..." if len(doc) > 400 else ""),
        )
        for _, doc, meta, _ in top_ranked
    ]

    try:
        answer_text = generate_grounded_answer(
            question=payload.question,  # use original (not scrubbed) for LLM context
            context_chunks=top_chunks,
        )
    except RuntimeError as exc:
        log.error("Gemini service failure: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="The language model service encountered an error. Please try again.",
        )

    # Confidence is derived from the original vector-search distance
    # (the most objective similarity signal we have).
    confidence_label = _distance_to_confidence(best_distance)
    log.info(
        "Returning answer | confidence=%s | citations=%d | reranker_best=%.4f",
        confidence_label,
        len(citations),
        best_reranker_score,
    )

    # ------------------------------------------------------------------
    # Stage 8: Async audit logging — must not block the HTTP response
    # ------------------------------------------------------------------
    latency_ms = (time.perf_counter() - t_start) * 1000
    await asyncio.to_thread(
        log_transaction,
        payload.question,
        query_scrubbed,
        payload.jurisdiction,
        payload.language,
        confidence_label,
        latency_ms,
    )

    return ChatResponse(
        answer=answer_text,
        citations=citations,
        confidence=confidence_label,
        disclaimer=_DISCLAIMER,
    )
