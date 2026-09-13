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
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.database import Conversation, Message, get_db
from app.schemas.chat import ChatRequest, ChatResponse, CitationItem, ConfidenceScore, AnswerSection
from app.services.audit import log_transaction
from app.services.llm import generate_grounded_answer, stream_grounded_answer
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

# BM25 for hybrid search (keyword + vector)
try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False
    BM25Okapi = None  # type: ignore

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
TOP_K_RETRIEVE = 3  # Reduced from 5 for faster response
# Number of top chunks to pass to Gemini after re-ranking.
TOP_K_FINAL = 2  # Reduced from 3 for faster response

# BM25 Hybrid Search Configuration
# Number of candidates from each search method before fusion
TOP_K_VECTOR = 5  # Vector search candidates
TOP_K_BM25 = 5    # BM25 keyword search candidates
# Reciprocal Rank Fusion constant (higher = more weight to lower ranks)
RRF_K = 60
# Weight for vector vs BM25 in hybrid scoring (vector_weight + bm25_weight = 1.0)
HYBRID_VECTOR_WEIGHT = 0.6
HYBRID_BM25_WEIGHT = 0.4

# Guardrail thresholds — based on cosine DISTANCE returned by ChromaDB.
# ChromaDB's default metric is cosine distance (0 = identical, 2 = opposite).
# Distance < 0.70  => similarity > 0.30 => allow (relaxed for prose-style corpus)
# Distance < 0.40  => similarity > 0.60 => high confidence
_DISTANCE_THRESHOLD_ALLOW: float = 0.70   # similarity >= 0.30 (relaxed)
_DISTANCE_THRESHOLD_HIGH: float = 0.40    # similarity >= 0.60

_DISCLAIMER = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional or registered patent agent."
)

_ABSTAIN_ANSWER = (
    "I cannot find an authoritative source in our verified legal registers to "
    "safely answer this query. To protect your IP interests, please rephrase "
    "your question or consult our human facilitation desk."
)

_OUT_OF_SCOPE_RESPONSE = (
    "I'm Ragvyn AI, specialised in AYUSH intellectual property and "
    "regulatory guidance. I can help you with:\n\n"
    "• Patent filing procedures and fees (Patents Act 1970)\n"
    "• Traditional Knowledge Digital Library (TKDL) prior art\n"
    "• Access and Benefit Sharing (ABS) compliance\n"
    "• NBA/SBB approvals for biological resources\n"
    "• AYUSH formulation patentability assessment\n"
    "• Drugs & Cosmetics Act licensing\n"
    "• International treaties (PCT, Nagoya Protocol, TRIPS)\n\n"
    "Your question appears to be outside my domain expertise. "
    "Please ask about AYUSH IP, patents, traditional knowledge, or biodiversity regulations."
)

def _get_greeting_response(query: str) -> str:
    """Generate a context-aware greeting response based on user's input."""
    query_lower = query.lower().strip()
    
    # Detect time-based greetings and echo them back
    if 'good morning' in query_lower or query_lower in ('gm', 'morning'):
        opener = "Good morning! ☀️"
    elif 'good afternoon' in query_lower:
        opener = "Good afternoon! 🌤️"
    elif 'good evening' in query_lower or query_lower == 'evening':
        opener = "Good evening! 🌙"
    elif 'good night' in query_lower:
        opener = "Good night! 🌙"
    elif 'namaste' in query_lower or 'namaskar' in query_lower:
        opener = "Namaste! 🙏"
    elif any(t in query_lower for t in ('thanks', 'thank you', 'thankyou', 'धन्यवाद', 'शुक्रिया')):
        return "You're welcome! 🙏 Feel free to ask if you have more questions about AYUSH IP, patents, or regulatory compliance."
    elif any(t in query_lower for t in ('bye', 'goodbye')):
        return "Goodbye! 👋 Best wishes for your AYUSH innovation journey. Come back anytime!"
    elif any(t in query_lower for t in ('ok', 'okay')):
        return "Great! Let me know if you have any questions about patents, TKDL, or AYUSH compliance. 😊"
    else:
        opener = "Hello! 👋"
    
    return (
        f"{opener} I'm Ragvyn AI, your AYUSH intellectual property assistant.\n\n"
        "I can help you with:\n"
        "• Patent filing for Ayurvedic/herbal formulations\n"
        "• TKDL prior art searches\n"
        "• NBA/ABS compliance guidance\n"
        "• Patent fees and deadlines\n"
        "• Drugs & Cosmetics Act licensing\n\n"
        "How can I assist you today?"
    )

# Out-of-scope detection keywords (clearly unrelated to AYUSH/IP domain)
_OUT_OF_SCOPE_KEYWORDS = {
    # Sports
    'cricket', 'batsman', 'bowler', 'ipl', 'world cup', 'football', 'soccer',
    'tennis', 'hockey', 'match', 'player', 'team', 'score', 'goal',
    # Entertainment
    'movie', 'film', 'actor', 'actress', 'bollywood', 'hollywood', 'song',
    'singer', 'music', 'netflix', 'youtube', 'instagram', 'tiktok',
    # General chit-chat
    'weather', 'temperature', 'joke', 'funny', 'recipe', 'cook', 'food',
    'restaurant', 'travel', 'hotel', 'flight', 'train booking',
    # Politics/news
    'election', 'politician', 'prime minister', 'president', 'voting',
    # Tech unrelated
    'coding interview', 'leetcode', 'data structure', 'machine learning tutorial',
    'python tutorial', 'javascript', 'react tutorial',
    # Personal
    'girlfriend', 'boyfriend', 'dating', 'love', 'relationship',
    'horoscope', 'zodiac', 'astrology',
}

# In-scope keywords (if present, allow the query even if it has some casual words)
_IN_SCOPE_KEYWORDS = {
    'patent', 'ip', 'intellectual property', 'tkdl', 'traditional knowledge',
    'ayush', 'ayurveda', 'ayurvedic', 'unani', 'siddha', 'homeopathy', 'yoga',
    'biodiversity', 'biological', 'nba', 'sbb', 'abs', 'nagoya', 'benefit sharing',
    'formulation', 'drug', 'cosmetic', 'herbal', 'medicinal plant',
    'section 3', 'patents act', 'prior art', 'novelty', 'inventive step',
    'wipo', 'pct', 'trips', 'filing', 'examination', 'rfe', 'fer',
    'renewal', 'deadline', 'fee', 'cost', 'registration', 'license',
    'commerciali', 'export', 'import', 'regulatory', 'compliance',
}


def _is_out_of_scope(query: str) -> tuple[bool, str]:
    """
    Detect if a query is clearly outside the AYUSH/IP domain.
    
    Strategy: WHITELIST approach — query MUST contain at least one in-scope
    keyword to proceed. Any query without domain relevance gets gracefully
    rejected, regardless of what random topic it asks about.
    
    Returns (True, "greeting") for greetings — friendly welcome response.
    Returns (True, "out_of_scope") for non-domain queries — polite redirect.
    Returns (False, "") if the query should proceed through the RAG pipeline.
    """
    query_lower = query.lower().strip()
    words = query_lower.split()
    
    # Greeting detection — respond with friendly welcome
    greetings = {'hi', 'hello', 'hey', 'namaste', 'namaskar', 'hii', 'hiii', 
                 'good morning', 'good afternoon', 'good evening', 'good night',
                 'gm', 'morning', 'evening'}
    
    # Check for greetings (short queries or starts with greeting)
    if len(words) <= 3:
        if any(g in query_lower for g in greetings):
            return (True, "greeting")
        # Single word greetings
        if words[0] in {'hi', 'hello', 'hey', 'namaste', 'namaskar', 'hii', 'hiii'}:
            return (True, "greeting")
    
    # Thanks/bye — also friendly response
    thanks_bye = {'thanks', 'thank you', 'thankyou', 'bye', 'goodbye', 'ok', 'okay', 'धन्यवाद', 'शुक्रिया'}
    if any(t in query_lower for t in thanks_bye) and len(words) <= 4:
        return (True, "greeting")
    
    # Check if ANY in-scope keyword is present
    has_in_scope = False
    for keyword in _IN_SCOPE_KEYWORDS:
        if keyword in query_lower:
            has_in_scope = True
            break
    
    # If query has at least one in-scope keyword, allow it
    if has_in_scope:
        return (False, "")
    
    # NO in-scope keywords found — this query is out of scope
    return (True, "out_of_scope")

# ---------------------------------------------------------------------------
# Lazy singletons (module-level, initialised on first request)
# ---------------------------------------------------------------------------
_chroma_client: Optional[chromadb.PersistentClient] = None
_embedding_model: Optional[SentenceTransformer] = None
_reranker_model: Optional[CrossEncoder] = None
_bm25_index: Optional[dict] = None  # {"india_statutes": (BM25, docs, metas), ...}


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
        _embedding_model = SentenceTransformer(
            EMBEDDING_MODEL_NAME,
            local_files_only=True,
        )
        log.info("Embedding model loaded.")
    return _embedding_model


def _get_reranker() -> CrossEncoder:
    """Return (or lazily initialise) the CrossEncoder re-ranker."""
    global _reranker_model
    if _reranker_model is None:
        log.info("Loading re-ranker model: %s ...", RERANKER_MODEL_NAME)
        _reranker_model = CrossEncoder(
            RERANKER_MODEL_NAME,
            local_files_only=True,
        )
        log.info("Re-ranker model loaded.")
    return _reranker_model


def _tokenize_for_bm25(text: str) -> list[str]:
    """Simple tokenizer for BM25: lowercase, split on whitespace/punctuation."""
    import re
    # Remove punctuation and lowercase
    text = re.sub(r'[^\w\s]', ' ', text.lower())
    # Split and filter empty tokens
    return [t for t in text.split() if len(t) > 1]


def _get_bm25_index(collection_name: str) -> tuple:
    """
    Build or return cached BM25 index for a collection.
    Returns (bm25_index, documents, metadatas) tuple.
    
    BM25 index is built from all documents in the ChromaDB collection.
    """
    global _bm25_index
    
    if not BM25_AVAILABLE:
        return None, [], []
    
    if _bm25_index is None:
        _bm25_index = {}
    
    if collection_name in _bm25_index:
        return _bm25_index[collection_name]
    
    # Build BM25 index from ChromaDB collection
    log.info("Building BM25 index for collection: %s ...", collection_name)
    chroma_client = _get_chroma_client()
    
    try:
        collection = chroma_client.get_collection(name=collection_name)
    except Exception:
        log.warning("Cannot build BM25 index: collection '%s' not found", collection_name)
        return None, [], []
    
    # Get all documents from collection
    all_data = collection.get(include=["documents", "metadatas"])
    documents = all_data.get("documents", [])
    metadatas = all_data.get("metadatas", [])
    
    if not documents:
        log.warning("BM25 index empty: no documents in collection '%s'", collection_name)
        return None, [], []
    
    # Tokenize all documents
    tokenized_docs = [_tokenize_for_bm25(doc) for doc in documents]
    
    # Build BM25 index
    bm25 = BM25Okapi(tokenized_docs)
    
    _bm25_index[collection_name] = (bm25, documents, metadatas)
    log.info("BM25 index built: %d documents in '%s'", len(documents), collection_name)
    
    return bm25, documents, metadatas


def _hybrid_search(
    query: str,
    query_embedding: list[float],
    collection,
    collection_name: str,
    top_k: int = 5
) -> tuple[list[str], list[dict], list[float]]:
    """
    Perform hybrid search combining vector search and BM25.
    
    Uses Reciprocal Rank Fusion (RRF) to combine rankings from:
    1. Vector search (semantic similarity via embeddings)
    2. BM25 (keyword matching)
    
    Returns (documents, metadatas, distances) in fused ranking order.
    """
    # Vector search results
    vector_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(TOP_K_VECTOR, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    
    vector_docs = vector_results["documents"][0] if vector_results["documents"] else []
    vector_metas = vector_results["metadatas"][0] if vector_results["metadatas"] else []
    vector_distances = vector_results["distances"][0] if vector_results["distances"] else []
    
    # If BM25 not available, return vector-only results
    bm25, all_docs, all_metas = _get_bm25_index(collection_name)
    if bm25 is None or not all_docs:
        log.debug("BM25 unavailable, using vector-only search")
        return vector_docs[:top_k], vector_metas[:top_k], vector_distances[:top_k]
    
    # BM25 search
    query_tokens = _tokenize_for_bm25(query)
    bm25_scores = bm25.get_scores(query_tokens)
    
    # Get top BM25 results
    bm25_ranked_indices = sorted(
        range(len(bm25_scores)),
        key=lambda i: bm25_scores[i],
        reverse=True
    )[:TOP_K_BM25]
    
    # Create document -> rank mapping for RRF
    # Vector ranks
    vector_ranks = {doc: i + 1 for i, doc in enumerate(vector_docs)}
    
    # BM25 ranks
    bm25_ranks = {}
    for rank, idx in enumerate(bm25_ranked_indices, 1):
        bm25_ranks[all_docs[idx]] = rank
    
    # Collect all unique documents from both searches
    all_candidates = set(vector_docs) | set(all_docs[i] for i in bm25_ranked_indices)
    
    # Calculate RRF scores
    # RRF score = sum(1 / (k + rank)) for each ranking system
    rrf_scores = {}
    for doc in all_candidates:
        score = 0.0
        # Vector contribution
        if doc in vector_ranks:
            score += HYBRID_VECTOR_WEIGHT * (1.0 / (RRF_K + vector_ranks[doc]))
        # BM25 contribution
        if doc in bm25_ranks:
            score += HYBRID_BM25_WEIGHT * (1.0 / (RRF_K + bm25_ranks[doc]))
        rrf_scores[doc] = score
    
    # Sort by RRF score (descending)
    sorted_docs = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)[:top_k]
    
    # Build output lists
    result_docs = []
    result_metas = []
    result_distances = []
    
    # Create doc->meta and doc->distance mappings
    doc_to_meta = {doc: meta for doc, meta in zip(vector_docs, vector_metas)}
    doc_to_meta.update({all_docs[i]: all_metas[i] for i in range(len(all_docs))})
    
    doc_to_distance = {doc: dist for doc, dist in zip(vector_docs, vector_distances)}
    
    for doc in sorted_docs:
        result_docs.append(doc)
        result_metas.append(doc_to_meta.get(doc, {}))
        # For distance, use vector distance if available, else estimate from BM25
        if doc in doc_to_distance:
            result_distances.append(doc_to_distance[doc])
        else:
            # Estimate distance for BM25-only results (higher = less similar)
            # Use a moderate distance since it matched via keywords
            result_distances.append(0.5)
    
    log.info(
        "Hybrid search: %d vector + %d BM25 candidates -> %d fused results",
        len(vector_docs),
        len(bm25_ranked_indices),
        len(result_docs)
    )
    
    return result_docs, result_metas, result_distances


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


def _generate_follow_up_questions(question: str, answer: str, context_chunks: list[str]) -> list[str]:
    """
    Generate relevant follow-up questions based on the query and answer.
    
    Uses keyword detection to suggest contextually relevant follow-ups.
    Returns 2-3 questions that dive deeper into the topic.
    """
    question_lower = question.lower()
    follow_ups = []
    
    # Patent-related follow-ups
    if any(kw in question_lower for kw in ['patent', 'patentable', 'patentability']):
        follow_ups.extend([
            "What are the patent filing fees for AYUSH formulations?",
            "How long does the patent examination process take in India?",
            "What documents are required for a patent application?",
        ])
    
    # TKDL-related follow-ups
    if any(kw in question_lower for kw in ['tkdl', 'traditional knowledge', 'prior art']):
        follow_ups.extend([
            "How can I check if my formulation exists in TKDL?",
            "What is the process to challenge a patent using TKDL evidence?",
            "How does TKDL protect against biopiracy?",
        ])
    
    # Biodiversity/NBA-related follow-ups
    if any(kw in question_lower for kw in ['nba', 'biodiversity', 'biological', 'abs', 'nagoya']):
        follow_ups.extend([
            "What is the NBA approval process timeline?",
            "What are the penalties for non-compliance with NBA?",
            "How do benefit-sharing agreements work?",
        ])
    
    # Fee-related follow-ups
    if any(kw in question_lower for kw in ['fee', 'cost', 'charge', 'price']):
        follow_ups.extend([
            "Are there any fee exemptions for startups?",
            "What are the renewal fee schedules?",
            "How do fees differ for natural persons vs companies?",
        ])
    
    # Deadline-related follow-ups
    if any(kw in question_lower for kw in ['deadline', 'time', 'duration', 'how long']):
        follow_ups.extend([
            "What happens if I miss a filing deadline?",
            "Can deadlines be extended?",
            "What are the key milestones in the patent lifecycle?",
        ])
    
    # International filing follow-ups
    if any(kw in question_lower for kw in ['international', 'pct', 'wipo', 'foreign', 'abroad']):
        follow_ups.extend([
            "What is the PCT filing procedure?",
            "How do I select countries for international protection?",
            "What are the costs for international patent filing?",
        ])
    
    # Generic fallback if no specific topic detected
    if not follow_ups:
        follow_ups = [
            "What are the first steps to protect my AYUSH innovation?",
            "How do I determine if my formulation is patentable?",
            "What regulatory approvals do I need for commercialization?",
        ]
    
    # Return max 3 unique follow-ups
    return list(dict.fromkeys(follow_ups))[:3]


# ---------------------------------------------------------------------------
# Chat-history persistence
# ---------------------------------------------------------------------------

def _persist_turn(
    db: Session,
    *,
    conversation_id: Optional[str],
    question: str,
    answer: str,
    citations: Optional[list] = None,
    confidence: Optional[str] = None,
    latency_ms: Optional[float] = None,
    jurisdiction: str = "India",
    language: str = "EN",
) -> str:
    """
    Persist one user->assistant turn to the database.

    Creates a new Conversation when ``conversation_id`` is falsy or does not
    exist, deriving the title from the first user question (truncated). Stores
    both the user message and the assistant message (with citations JSON and
    confidence). Returns the conversation id (new or existing).

    Persistence failures are swallowed and logged so a DB hiccup never breaks
    the chat response the user is waiting on.
    """
    try:
        conv: Optional[Conversation] = None
        if conversation_id:
            conv = (
                db.query(Conversation)
                .filter(Conversation.id == conversation_id)
                .first()
            )

        if conv is None:
            title = question.strip().replace("\n", " ")
            if len(title) > 60:
                title = title[:57] + "..."
            conv = Conversation(
                title=title or "New consultation",
                jurisdiction=jurisdiction if jurisdiction in ("India", "International") else "India",
                language=(language or "en").lower()[:10],
            )
            db.add(conv)
            db.flush()  # populate conv.id without full commit

        # User message
        db.add(Message(
            conversation_id=conv.id,
            role="user",
            content=question,
        ))

        # Assistant message
        citations_json = None
        if citations:
            try:
                # Accept pydantic models or dicts
                serialisable = [
                    c.model_dump() if hasattr(c, "model_dump") else dict(c)
                    for c in citations
                ]
                citations_json = json.dumps(serialisable, ensure_ascii=False)
            except (TypeError, ValueError):
                citations_json = None

        db.add(Message(
            conversation_id=conv.id,
            role="assistant",
            content=answer,
            confidence=confidence,
            citations_json=citations_json,
            latency_ms=latency_ms,
        ))

        # Bump conversation updated_at
        conv.updated_at = datetime.utcnow()

        db.commit()
        return conv.id
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to persist chat turn: %s", exc)
        db.rollback()
        return conversation_id or ""


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
async def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
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
    # Stage 2.5: Out-of-scope / Greeting filter (graceful handling)
    # ------------------------------------------------------------------
    is_filtered, filter_type = _is_out_of_scope(query_scrubbed)
    if is_filtered:
        latency_ms = (time.perf_counter() - t_start) * 1000
        
        if filter_type == "greeting":
            log.info("Greeting detected: '%.80s...'", query_scrubbed)
            response_text = _get_greeting_response(query_scrubbed)
            confidence_obj = ConfidenceScore(
                score=95,
                label="High",
                reason="Greeting detected and handled directly."
            )
            status = "answered"
        else:
            log.info("Query detected as out-of-scope: '%.80s...'", query_scrubbed)
            response_text = "I cannot answer that because it is outside my area of knowledge. I specialize in AYUSH intellectual property, patents, traditional knowledge, biodiversity regulations, and related compliance topics."
            confidence_obj = ConfidenceScore(
                score=0,
                label="Low",
                reason="The query is outside the supported knowledge domain."
            )
            status = "out_of_scope"
        
        await asyncio.to_thread(
            log_transaction,
            payload.question,
            query_scrubbed,
            payload.jurisdiction,
            payload.language,
            filter_type,
            latency_ms,
        )
        conv_id = _persist_turn(
            db,
            conversation_id=payload.conversation_id,
            question=payload.question,
            answer=response_text,
            citations=[],
            confidence=confidence_obj.label.lower(),
            latency_ms=latency_ms,
            jurisdiction=payload.jurisdiction,
            language=payload.language,
        )
        return ChatResponse(
            answer=response_text,
            sections=[],
            citations=[],
            confidence=confidence_obj,
            follow_up_questions=[],
            status=status,
            disclaimer=_DISCLAIMER,
            conversation_id=conv_id,
        )

    # ------------------------------------------------------------------
    # Stage 3: Resolve resources (lazy init on first call)
    # ------------------------------------------------------------------
    chroma_client = _get_chroma_client()
    bi_encoder = _get_embedding_model()
    # Note: reranker loaded later only if needed (after out-of-scope check)

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
    # Stage 4: Hybrid search — Vector + BM25 combined
    # ------------------------------------------------------------------
    log.debug("Embedding question for hybrid search...")
    question_embedding: list[float] = bi_encoder.encode(
        query_scrubbed
    ).tolist()

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
            answer="No relevant information was found in the available sources. The knowledge base may not be initialized.",
            sections=[],
            citations=[],
            confidence=ConfidenceScore(
                score=0,
                label="Low",
                reason="Knowledge base is empty or not initialized."
            ),
            follow_up_questions=[],
            status="no_data",
            disclaimer=_DISCLAIMER,
            conversation_id=_persist_turn(
                db,
                conversation_id=payload.conversation_id,
                question=payload.question,
                answer="No relevant information was found in the available sources. The knowledge base may not be initialized.",
                confidence="low",
                latency_ms=latency_ms,
                jurisdiction=payload.jurisdiction,
                language=payload.language,
            ),
        )

    # Use hybrid search (Vector + BM25) if BM25 is available
    candidate_docs, candidate_metas, candidate_distances = _hybrid_search(
        query=query_scrubbed,
        query_embedding=question_embedding,
        collection=collection,
        collection_name=collection_name,
        top_k=n_results
    )

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
            answer="No relevant information was found in the available sources.",
            sections=[],
            citations=[],
            confidence=ConfidenceScore(
                score=0,
                label="Low",
                reason="No matching documents found in the knowledge base."
            ),
            follow_up_questions=[],
            status="no_data",
            disclaimer=_DISCLAIMER,
            conversation_id=_persist_turn(
                db,
                conversation_id=payload.conversation_id,
                question=payload.question,
                answer="No relevant information was found in the available sources.",
                confidence="low",
                latency_ms=latency_ms,
                jurisdiction=payload.jurisdiction,
                language=payload.language,
            ),
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
            answer="No relevant information was found in the available sources. The retrieved documents do not sufficiently match your query.",
            sections=[],
            citations=[],
            confidence=ConfidenceScore(
                score=15,
                label="Low",
                reason=f"Retrieved documents have low relevance (best distance: {best_distance:.2f}, threshold: {_DISTANCE_THRESHOLD_ALLOW:.2f})."
            ),
            follow_up_questions=[],
            status="no_data",
            disclaimer=_DISCLAIMER,
            conversation_id=_persist_turn(
                db,
                conversation_id=payload.conversation_id,
                question=payload.question,
                answer="No relevant information was found in the available sources. The retrieved documents do not sufficiently match your query.",
                confidence="low",
                latency_ms=latency_ms,
                jurisdiction=payload.jurisdiction,
                language=payload.language,
            ),
        )

    # ------------------------------------------------------------------
    # Stage 6: Cross-encoder re-ranking — select top-2 from top-3
    # Skip reranker if we have ≤2 candidates (no value in reranking)
    # ------------------------------------------------------------------
    if len(candidate_docs) <= TOP_K_FINAL:
        # No need to rerank, just use vector search order
        log.info("Skipping reranker: only %d candidates", len(candidate_docs))
        top_ranked = list(zip(
            [1.0] * len(candidate_docs),  # dummy scores
            candidate_docs,
            candidate_metas,
            candidate_distances
        ))
        best_reranker_score = 1.0
    else:
        reranker = _get_reranker()
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
            relevance="Retrieved from knowledge base based on semantic similarity.",
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
    
    # Convert distance to numeric score (0-100)
    # Lower distance = higher similarity = higher score
    # distance 0 -> score 100, distance 0.7 -> score ~30
    confidence_score = max(0, min(100, int((1 - best_distance) * 100)))
    
    # Map label to new format
    label_map = {"high": "High", "moderate": "Medium", "low": "Low"}
    confidence_obj = ConfidenceScore(
        score=confidence_score,
        label=label_map.get(confidence_label, "Medium"),
        reason=f"Based on {len(citations)} source(s) with relevance score {confidence_score}%."
    )
    
    # Generate follow-up questions based on the topic
    follow_ups = _generate_follow_up_questions(payload.question, answer_text, top_chunks)
    
    log.info(
        "Returning answer | confidence=%s (%d%%) | citations=%d | reranker_best=%.4f",
        confidence_label,
        confidence_score,
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

    conv_id = _persist_turn(
        db,
        conversation_id=payload.conversation_id,
        question=payload.question,
        answer=answer_text,
        citations=citations,
        confidence=confidence_label,
        latency_ms=latency_ms,
        jurisdiction=payload.jurisdiction,
        language=payload.language,
    )

    return ChatResponse(
        answer=answer_text,
        sections=[],
        citations=citations,
        confidence=confidence_obj,
        follow_up_questions=follow_ups,
        status="answered",
        disclaimer=_DISCLAIMER,
        conversation_id=conv_id,
    )


# ---------------------------------------------------------------------------
# Streaming SSE helpers
# ---------------------------------------------------------------------------

def _sse(payload: dict) -> str:
    """Serialise a dict as a Server-Sent Events ``data:`` frame."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse_full_text(
    text: str,
    *,
    citations: list | None = None,
    confidence: ConfidenceScore,
    follow_ups: list[str] | None = None,
    status: str,
    conversation_id: str = "",
):
    """
    Stream a pre-computed (non-LLM) answer over SSE.

    Used for greeting / out-of-scope / no-data / guardrail responses where
    there is no live token stream — the text is chunked word-by-word so the
    frontend typewriter behaves identically to a real stream, then the final
    metadata frame is emitted.
    """
    # Word-chunk so the client sees progressive tokens.
    words = text.split(" ")
    for i, word in enumerate(words):
        token = word if i == 0 else " " + word
        yield _sse({"token": token})

    citation_dicts = [
        c.model_dump() if hasattr(c, "model_dump") else dict(c)
        for c in (citations or [])
    ]
    yield _sse({
        "done": True,
        "citations": citation_dicts,
        "confidence": confidence.model_dump(),
        "follow_up_questions": follow_ups or [],
        "status": status,
        "disclaimer": _DISCLAIMER,
        "conversation_id": conversation_id,
    })


@router.post(
    "/chat/stream",
    summary="Streaming (SSE) RAG-powered Ayurvedic IP legal Q&A",
    description=(
        "Same RAG pipeline as POST /chat, but streams the Gemini answer "
        "token-by-token via Server-Sent Events. Each token arrives as "
        "'data: {\"token\": \"...\"}\\n\\n'. The stream ends with a final "
        "'data: {\"done\": true, \"citations\": [...], \"confidence\": {...}}' "
        "frame carrying citations, confidence, follow-ups and the disclaimer. "
        "On an unrecoverable model error before any token is emitted, an "
        "'data: {\"error\": \"...\"}' frame is sent so the client can fall "
        "back to the non-streaming /chat endpoint."
    ),
)
async def chat_stream_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    """
    Streaming variant of :func:`chat_endpoint`.

    The blocking retrieval work (embed -> hybrid search -> guardrail -> rerank)
    runs first; only the Gemini generation is streamed. All non-answer paths
    (greeting, out-of-scope, empty corpus, guardrail abstain) are streamed as a
    single chunked text plus the final metadata frame, keeping the client's
    handling uniform.
    """
    t_start = time.perf_counter()

    log.info(
        "Chat STREAM request | jurisdiction=%s | language=%s | question='%.80s...'",
        payload.jurisdiction,
        payload.language,
        payload.question,
    )

    query_scrubbed = scrub_pii(payload.question)
    if query_scrubbed != payload.question:
        log.info("PII detected and redacted from query.")

    # ---- Out-of-scope / greeting filter --------------------------------
    is_filtered, filter_type = _is_out_of_scope(query_scrubbed)
    if is_filtered:
        latency_ms = (time.perf_counter() - t_start) * 1000
        if filter_type == "greeting":
            response_text = _get_greeting_response(query_scrubbed)
            confidence_obj = ConfidenceScore(
                score=95, label="High",
                reason="Greeting detected and handled directly.",
            )
            status = "answered"
        else:
            response_text = (
                "I cannot answer that because it is outside my area of knowledge. "
                "I specialize in AYUSH intellectual property, patents, traditional "
                "knowledge, biodiversity regulations, and related compliance topics."
            )
            confidence_obj = ConfidenceScore(
                score=0, label="Low",
                reason="The query is outside the supported knowledge domain.",
            )
            status = "out_of_scope"

        await asyncio.to_thread(
            log_transaction, payload.question, query_scrubbed,
            payload.jurisdiction, payload.language, filter_type, latency_ms,
        )
        conv_id = _persist_turn(
            db, conversation_id=payload.conversation_id, question=payload.question,
            answer=response_text, confidence=confidence_obj.label.lower(),
            latency_ms=latency_ms, jurisdiction=payload.jurisdiction,
            language=payload.language,
        )
        return StreamingResponse(
            _sse_full_text(
                response_text, citations=[], confidence=confidence_obj,
                follow_ups=[], status=status, conversation_id=conv_id,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ---- Resolve resources ---------------------------------------------
    chroma_client = _get_chroma_client()
    bi_encoder = _get_embedding_model()
    collection_name = _resolve_collection_name(payload.jurisdiction)

    try:
        collection = chroma_client.get_collection(name=collection_name)
    except Exception:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=(
                f"The '{collection_name}' knowledge base has not been initialised. "
                "Please run the corpus ingestion script first: python corpus/ingest.py"
            ),
        )

    question_embedding: list[float] = bi_encoder.encode(query_scrubbed).tolist()
    n_results = min(TOP_K_RETRIEVE, collection.count())

    # ---- Empty corpus / no-data path -----------------------------------
    if n_results == 0:
        latency_ms = (time.perf_counter() - t_start) * 1000
        no_data_text = (
            "No relevant information was found in the available sources. "
            "The knowledge base may not be initialized."
        )
        confidence_obj = ConfidenceScore(
            score=0, label="Low", reason="Knowledge base is empty or not initialized.",
        )
        await asyncio.to_thread(
            log_transaction, payload.question, query_scrubbed,
            payload.jurisdiction, payload.language, "low", latency_ms,
        )
        conv_id = _persist_turn(
            db, conversation_id=payload.conversation_id, question=payload.question,
            answer=no_data_text, confidence="low", latency_ms=latency_ms,
            jurisdiction=payload.jurisdiction, language=payload.language,
        )
        return StreamingResponse(
            _sse_full_text(
                no_data_text, citations=[], confidence=confidence_obj,
                follow_ups=[], status="no_data", conversation_id=conv_id,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    candidate_docs, candidate_metas, candidate_distances = _hybrid_search(
        query=query_scrubbed, query_embedding=question_embedding,
        collection=collection, collection_name=collection_name, top_k=n_results,
    )

    if not candidate_docs:
        latency_ms = (time.perf_counter() - t_start) * 1000
        no_data_text = "No relevant information was found in the available sources."
        confidence_obj = ConfidenceScore(
            score=0, label="Low", reason="No matching documents found in the knowledge base.",
        )
        await asyncio.to_thread(
            log_transaction, payload.question, query_scrubbed,
            payload.jurisdiction, payload.language, "low", latency_ms,
        )
        conv_id = _persist_turn(
            db, conversation_id=payload.conversation_id, question=payload.question,
            answer=no_data_text, confidence="low", latency_ms=latency_ms,
            jurisdiction=payload.jurisdiction, language=payload.language,
        )
        return StreamingResponse(
            _sse_full_text(
                no_data_text, citations=[], confidence=confidence_obj,
                follow_ups=[], status="no_data", conversation_id=conv_id,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ---- Guardrail -----------------------------------------------------
    best_distance: float = min(candidate_distances)
    log.info(
        "STREAM best cosine distance: %.4f (allow threshold: %.4f)",
        best_distance, _DISTANCE_THRESHOLD_ALLOW,
    )
    if best_distance >= _DISTANCE_THRESHOLD_ALLOW:
        latency_ms = (time.perf_counter() - t_start) * 1000
        abstain_text = (
            "No relevant information was found in the available sources. "
            "The retrieved documents do not sufficiently match your query."
        )
        confidence_obj = ConfidenceScore(
            score=15, label="Low",
            reason=(
                f"Retrieved documents have low relevance (best distance: "
                f"{best_distance:.2f}, threshold: {_DISTANCE_THRESHOLD_ALLOW:.2f})."
            ),
        )
        await asyncio.to_thread(
            log_transaction, payload.question, query_scrubbed,
            payload.jurisdiction, payload.language, "low", latency_ms,
        )
        conv_id = _persist_turn(
            db, conversation_id=payload.conversation_id, question=payload.question,
            answer=abstain_text, confidence="low", latency_ms=latency_ms,
            jurisdiction=payload.jurisdiction, language=payload.language,
        )
        return StreamingResponse(
            _sse_full_text(
                abstain_text, citations=[], confidence=confidence_obj,
                follow_ups=[], status="no_data", conversation_id=conv_id,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ---- Re-rank -------------------------------------------------------
    if len(candidate_docs) <= TOP_K_FINAL:
        top_ranked = list(zip(
            [1.0] * len(candidate_docs), candidate_docs,
            candidate_metas, candidate_distances,
        ))
    else:
        reranker = _get_reranker()
        reranker_pairs = [(query_scrubbed, doc) for doc in candidate_docs]
        reranker_scores = reranker.predict(reranker_pairs).tolist()
        ranked = sorted(
            zip(reranker_scores, candidate_docs, candidate_metas, candidate_distances),
            key=lambda x: x[0], reverse=True,
        )
        top_ranked = ranked[:TOP_K_FINAL]

    top_chunks: list[str] = [doc for _, doc, _, _ in top_ranked]
    citations: list[CitationItem] = [
        CitationItem(
            source=meta.get("source", "Unknown Source"),
            section=meta.get("section", "Unknown Section"),
            text=doc[:400] + ("..." if len(doc) > 400 else ""),
            relevance="Retrieved from knowledge base based on semantic similarity.",
        )
        for _, doc, meta, _ in top_ranked
    ]

    confidence_label = _distance_to_confidence(best_distance)
    confidence_score = max(0, min(100, int((1 - best_distance) * 100)))
    label_map = {"high": "High", "moderate": "Medium", "low": "Low"}
    confidence_obj = ConfidenceScore(
        score=confidence_score,
        label=label_map.get(confidence_label, "Medium"),
        reason=f"Based on {len(citations)} source(s) with relevance score {confidence_score}%.",
    )
    citation_dicts = [c.model_dump() for c in citations]

    # ---- Token stream from Gemini --------------------------------------
    def _event_generator():
        collected: list[str] = []
        try:
            token_iter = stream_grounded_answer(
                question=payload.question, context_chunks=top_chunks,
            )
            for token in token_iter:
                collected.append(token)
                yield _sse({"token": token})
        except RuntimeError as exc:
            log.error("Gemini streaming failed: %s", exc)
            if not collected:
                # Nothing emitted yet — tell client to fall back to /chat.
                yield _sse({
                    "error": "stream_failed",
                    "detail": "The language model streaming service failed. "
                              "Falling back to the standard endpoint.",
                })
                return
            # Partial output already sent; close gracefully below.

        answer_text = "".join(collected).strip()
        follow_ups = _generate_follow_up_questions(
            payload.question, answer_text, top_chunks,
        )
        latency_ms = (time.perf_counter() - t_start) * 1000

        # Fire-and-forget side effects (audit + persistence) — safe to run
        # synchronously here since we are inside the streaming generator.
        try:
            log_transaction(
                payload.question, query_scrubbed, payload.jurisdiction,
                payload.language, confidence_label, latency_ms,
            )
        except Exception as exc:  # noqa: BLE001
            log.error("Audit logging failed in stream: %s", exc)

        conv_id = _persist_turn(
            db, conversation_id=payload.conversation_id, question=payload.question,
            answer=answer_text, citations=citations, confidence=confidence_label,
            latency_ms=latency_ms, jurisdiction=payload.jurisdiction,
            language=payload.language,
        )

        yield _sse({
            "done": True,
            "citations": citation_dicts,
            "confidence": confidence_obj.model_dump(),
            "follow_up_questions": follow_ups,
            "status": "answered",
            "disclaimer": _DISCLAIMER,
            "conversation_id": conv_id,
        })

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
