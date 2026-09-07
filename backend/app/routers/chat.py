"""
backend/app/routers/chat.py
----------------------------
FastAPI router that powers the POST /api/chat endpoint.

RAG Pipeline
------------
1.  Receive and validate the ChatRequest (question, jurisdiction, language).
2.  Embed the question with all-MiniLM-L6-v2.
3.  Query the appropriate ChromaDB collection (india_statutes or
    international_treaties) and retrieve the top-5 candidate chunks.
4.  Re-rank those 5 candidates with cross-encoder/ms-marco-MiniLM-L-6-v2
    and select the top-3 most relevant chunks.
5.  Guardrail check — if the best re-ranker score is below the confidence
    threshold, abstain immediately without calling Gemini.
6.  If the guardrail passes, call the Gemini LLM service and return a
    fully-structured ChatResponse with citations and a legal disclaimer.

Lazy singletons
---------------
Heavy objects (ChromaDB client, embedding model, cross-encoder) are
initialised once on first request via module-level globals.  FastAPI's
async event loop means these are initialised in the main thread and
shared safely across sync endpoint calls.
"""

from __future__ import annotations

import logging
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, CitationItem
from app.services.llm import generate_answer

# ---------------------------------------------------------------------------
# Third-party imports with startup guards
# ---------------------------------------------------------------------------
try:
    import chromadb
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
_CORPUS_ROOT = Path(__file__).parents[4] / "corpus"
CHROMA_DB_PATH = str(_CORPUS_ROOT / "chroma_db")

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

COLLECTION_INDIA = "india_statutes"
COLLECTION_INTERNATIONAL = "international_treaties"

# Number of candidate chunks to retrieve from ChromaDB before re-ranking
TOP_K_RETRIEVE = 5
# Number of top chunks to pass to Gemini after re-ranking
TOP_K_FINAL = 3

# Guardrail threshold: if the best re-ranker logit score is below this,
# we abstain from calling Gemini.  The cross-encoder's raw scores are
# unbounded logits; empirically values above ~-2.0 signal genuine relevance.
RERANKER_ABSTAIN_THRESHOLD: float = -2.0

_DISCLAIMER = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional."
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
            settings=chromadb.config.Settings(anonymized_telemetry=False),
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
# Helper: map jurisdiction → collection name
# ---------------------------------------------------------------------------

def _resolve_collection_name(jurisdiction: str) -> str:
    """
    Map the request's jurisdiction field to the correct ChromaDB collection.

    Parameters
    ----------
    jurisdiction:
        Validated value from ChatRequest — either "India" or "International".

    Returns
    -------
    str
        The ChromaDB collection name.
    """
    return COLLECTION_INDIA if jurisdiction == "India" else COLLECTION_INTERNATIONAL


# ---------------------------------------------------------------------------
# Helper: compute confidence label from re-ranker best score
# ---------------------------------------------------------------------------

def _score_to_confidence(best_score: float) -> str:
    """
    Translate the cross-encoder's best logit score to a human-readable label.

    The cross-encoder returns raw logits (not probabilities).  These
    empirical thresholds were calibrated on the ms-marco dataset:

    - score >= 3.0   → "high"
    - score >= 0.0   → "moderate"
    - score <  0.0   → "low"  (below RERANKER_ABSTAIN_THRESHOLD means abstain)

    Parameters
    ----------
    best_score:
        The highest cross-encoder score among the re-ranked chunks.

    Returns
    -------
    str
        One of "high", "moderate", or "low".
    """
    if best_score >= 3.0:
        return "high"
    if best_score >= 0.0:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# Router definition
# ---------------------------------------------------------------------------
router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="RAG-powered legal Q&A endpoint",
    description=(
        "Accepts a legal question and jurisdiction toggle, retrieves the most "
        "relevant passages from the local ChromaDB corpus, re-ranks them, and "
        "returns a Gemini-generated grounded answer with source citations."
    ),
)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """
    Full RAG pipeline: embed → retrieve → re-rank → guardrail → LLM → respond.

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
    log.info(
        "Chat request | jurisdiction=%s | language=%s | question='%.80s…'",
        payload.jurisdiction,
        payload.language,
        payload.question,
    )

    # ------------------------------------------------------------------
    # 1. Resolve resources (lazy init on first call)
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
    # 2. Bi-encoder: embed question and query ChromaDB
    # ------------------------------------------------------------------
    log.debug("Embedding question for ChromaDB query...")
    question_embedding: list[float] = bi_encoder.encode(
        payload.question, convert_to_list=True
    )

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=min(TOP_K_RETRIEVE, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    candidate_docs: list[str] = results["documents"][0]
    candidate_metas: list[dict] = results["metadatas"][0]

    if not candidate_docs:
        log.warning("No candidates returned from ChromaDB for collection '%s'.", collection_name)
        return ChatResponse(
            answer=(
                "I cannot find an authoritative source in our verified legal "
                "registers to answer this safely."
            ),
            citations=[],
            confidence="low",
            disclaimer=_DISCLAIMER,
        )

    log.debug("Retrieved %d candidates from ChromaDB.", len(candidate_docs))

    # ------------------------------------------------------------------
    # 3. Cross-encoder re-ranking
    # ------------------------------------------------------------------
    reranker_pairs = [(payload.question, doc) for doc in candidate_docs]
    reranker_scores: list[float] = reranker.predict(reranker_pairs).tolist()

    # Sort by descending score and take the top-k
    ranked = sorted(
        zip(reranker_scores, candidate_docs, candidate_metas),
        key=lambda x: x[0],
        reverse=True,
    )
    top_ranked = ranked[:TOP_K_FINAL]

    best_score: float = top_ranked[0][0]
    log.info("Re-ranker best score: %.4f  (threshold: %.4f)", best_score, RERANKER_ABSTAIN_THRESHOLD)

    # ------------------------------------------------------------------
    # 4. Guardrail / abstention check
    # ------------------------------------------------------------------
    if best_score < RERANKER_ABSTAIN_THRESHOLD:
        log.warning(
            "Guardrail fired — score %.4f below threshold %.4f. Abstaining.",
            best_score,
            RERANKER_ABSTAIN_THRESHOLD,
        )
        return ChatResponse(
            answer=(
                "I cannot find an authoritative source in our verified legal "
                "registers to answer this safely."
            ),
            citations=[],
            confidence="low",
            disclaimer=_DISCLAIMER,
        )

    # ------------------------------------------------------------------
    # 5. Build citations list from top-ranked chunks
    # ------------------------------------------------------------------
    top_chunks: list[str] = [doc for _, doc, _ in top_ranked]
    citations: list[CitationItem] = [
        CitationItem(
            source=meta.get("source", "Unknown Source"),
            section=meta.get("section", "Unknown Section"),
            text=doc[:400] + ("…" if len(doc) > 400 else ""),
        )
        for _, doc, meta in top_ranked
    ]

    # ------------------------------------------------------------------
    # 6. Call Gemini LLM service
    # ------------------------------------------------------------------
    try:
        answer_text = generate_answer(
            question=payload.question,
            context_chunks=top_chunks,
        )
    except RuntimeError as exc:
        log.error("Gemini service failure: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="The language model service encountered an error. Please try again.",
        )

    confidence_label = _score_to_confidence(best_score)
    log.info("Returning answer | confidence=%s | citations=%d", confidence_label, len(citations))

    return ChatResponse(
        answer=answer_text,
        citations=citations,
        confidence=confidence_label,
        disclaimer=_DISCLAIMER,
    )
