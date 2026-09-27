"""
backend/app/services/retrieval_service.py
-----------------------------------------
LangChain Vector + BM25 Hybrid Retriever with Reciprocal Rank Fusion (RRF)
for IP-SAKTI Sahayak.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings

# Accommodate both absolute workspace imports and package relative imports
try:
    from backend.app.services.bm25_service import PersistedBM25Index, get_bm25_index
    from backend.app.services.qdrant_service import qdrant_service
    from backend.app.core.config import settings
    from backend.app.core.models import model_registry
except ImportError:
    from app.services.bm25_service import PersistedBM25Index, get_bm25_index
    from app.services.qdrant_service import qdrant_service
    from app.core.config import settings
    from app.core.models import model_registry

log = logging.getLogger("app.services.retrieval_service")


try:
    from backend.app.services.embedding_service import canonical_embedder
except ImportError:
    from app.services.embedding_service import canonical_embedder


class RetrievedCandidate:
    """Standardized candidate document object compatible with LangChain Document interface."""

    def __init__(self, page_content: str, metadata: dict[str, Any]):
        self.page_content = page_content
        self.metadata = metadata


class CanonicalBgeM3EmbeddingsAdapter(Embeddings):

    """
    LangChain compatible Embeddings adapter connecting to the canonical
    Hugging Face BGE-M3 InferenceClient embedding service.
    """

    def __init__(self) -> None:
        pass

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return canonical_embedder.embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        return canonical_embedder.embed_query(text)


# Backwards compatibility alias
SentenceTransformerEmbeddingsAdapter = CanonicalBgeM3EmbeddingsAdapter


def get_chroma_vectorstore(collection_name: str) -> Chroma:
    """
    Initializes or returns a LangChain Chroma vector store instance
    connected to the local persistent database (available as fallback).
    """
    chroma_dir = settings.CHROMA_DB_DIR
    embeddings_adapter = SentenceTransformerEmbeddingsAdapter()
    client = chromadb.PersistentClient(path=chroma_dir)

    return Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=embeddings_adapter,
    )


def hybrid_rrf_search(
    query: str,
    jurisdiction: str = "India",
    top_k: int = 5,
    rrf_k: int = 60,
    user_id: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
) -> list[dict]:
    """
    Combines dense semantic vector search (Qdrant Cloud with ChromaDB fallback)
    and sparse lexical search (in-memory BM25) using Reciprocal Rank Fusion (RRF).

    Parameters
    ----------
    query : str
        User's search / legal query.
    jurisdiction : str
        Legal jurisdiction filter: 'India' -> 'india_statutes' or
        'International' -> 'international_treaties'.
    top_k : int
        Number of final fused candidates to return (default: 5).
    rrf_k : int
        RRF smoothing constant (default: 60).
    user_id : Optional[str]
        Optional user identifier to include authorized user-uploaded documents.
    document_ids : Optional[list[str]]
        Optional list of specific document IDs to scope retrieval to (user-uploaded docs).
        When provided, ONLY searches the user_uploads collection filtered by these doc IDs.

    Returns
    -------
    list[dict]
        Top fused candidate documents with text, metadata, distances, and rrf_score.
    """
    if not query or not query.strip():
        return []

    _chroma_t_start = time.perf_counter()

    # SPECIAL CASE: When document_ids provided, ONLY search user_uploads collection
    # This enables "ask about my uploaded document" feature
    if document_ids and len(document_ids) > 0:
        log.info(
            "Document-scoped search: query='%s' scoped to document_ids=%s",
            query[:50],
            document_ids,
        )
        collection_specs = [(settings.QDRANT_USER_UPLOADS_COLLECTION, "User")]
    else:
        # 1. Route to the correct ChromaDB collection(s) based on jurisdiction.
        #    'India' -> india_statutes, 'International' -> international_treaties,
        #    'Both' -> query BOTH collections and fuse the combined candidate pool.
        jur_clean = jurisdiction.strip().lower()
        if jur_clean == "both":
            collection_specs = [
                (settings.QDRANT_INDIA_COLLECTION, "India"),
                (settings.QDRANT_INTERNATIONAL_COLLECTION, "International"),
            ]
        elif "international" in jur_clean:
            collection_specs = [(settings.QDRANT_INTERNATIONAL_COLLECTION, "International")]
        else:
            collection_specs = [(settings.QDRANT_INDIA_COLLECTION, "India")]

        # If user_id provided, also query user uploads
        if user_id:
            collection_specs.append((settings.QDRANT_USER_UPLOADS_COLLECTION, "User"))

    collection_names = [c[0] for c in collection_specs]

    log.info(
        "Executing hybrid RRF search for query '%s' under jurisdiction '%s' (collections: %s, user: %s)",
        query[:50],
        jurisdiction,
        collection_names,
        user_id,
    )

    # 2. Dense Vector Search: Try Qdrant Cloud first, falling back to ChromaDB
    vector_candidates: list[tuple[Any, float, int, str]] = []
    qdrant_success = False

    try:
        if qdrant_service.is_healthy():
            emb_model = model_registry.get_embedding_model()
            query_vector = emb_model.encode(
                [query],
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )[0].tolist()

            total_qdrant_hits = 0
            for collection_name, col_jur in collection_specs:
                target_user = user_id if collection_name == settings.QDRANT_USER_UPLOADS_COLLECTION else None
                # Pass document_ids filter for user_uploads collection
                target_doc_ids = document_ids if collection_name == settings.QDRANT_USER_UPLOADS_COLLECTION else None
                q_hits = qdrant_service.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=top_k * 2,
                    user_id=target_user,
                    document_ids=target_doc_ids,
                )
                if q_hits:
                    total_qdrant_hits += len(q_hits)
                    for rank, hit in enumerate(q_hits, start=1):
                        payload = hit.get("payload") or hit.get("metadata") or {}
                        score = float(hit.get("score", 0.0))
                        # Cosine distance: dist = 1 - score (bounded to [0, 2])
                        dist = max(0.0, 1.0 - score)
                        content = payload.get("text") or payload.get("page_content") or ""
                        doc_candidate = RetrievedCandidate(
                            page_content=content,
                            metadata=payload,
                        )
                        vector_candidates.append((doc_candidate, dist, rank, col_jur))

            if total_qdrant_hits > 0:
                qdrant_success = True
                log.info("Qdrant retrieval returned %d candidates", total_qdrant_hits)
    except Exception as q_exc:
        log.warning("Qdrant vector search failed: %s; falling back to ChromaDB", q_exc)
        qdrant_success = False

    # Fallback to ChromaDB if Qdrant didn't produce candidates
    if not qdrant_success or len(vector_candidates) == 0:
        log.info("Using ChromaDB vectorstore fallback for query: '%s'", query[:50])
        vector_candidates.clear()
        for collection_name, col_jur in collection_specs:
            try:
                vectorstore = get_chroma_vectorstore(collection_name)
                raw_vector_results = vectorstore.similarity_search_with_score(
                    query=query,
                    k=top_k * 2,
                )
                for rank, (doc, distance) in enumerate(raw_vector_results, start=1):
                    vector_candidates.append((doc, float(distance), rank, col_jur))
            except Exception as e:
                log.error(
                    "Vector search query error in ChromaDB collection '%s': %s",
                    collection_name, e, exc_info=True,
                )

    # 3. Query In-Memory BM25Index for candidates and record (doc, bm25_score).
    bm25_candidates: list[tuple[dict, float, int]] = []
    try:
        bm25_idx = get_bm25_index()
        if not bm25_idx.is_loaded:
            bm25_idx.rebuild_from_qdrant()

        bm25_jurs = [c[1] for c in collection_specs if c[1] != "User"]
        if not bm25_jurs:
            bm25_jurs = [jurisdiction]

        for bm_jur in bm25_jurs:
            bm25_results = bm25_idx.search(
                query=query,
                top_k=top_k * 2,
                jurisdiction=bm_jur,
                user_id=user_id,
            )
            for rank, b_doc in enumerate(bm25_results, start=1):
                score = float(b_doc.get("bm25_score", 0.0))
                bm25_candidates.append((b_doc, score, rank))
    except Exception as e:
        log.error("BM25 search query error: %s", e, exc_info=True)

    # 4. Apply Reciprocal Rank Fusion (RRF) formula:
    #    RRF_Score(doc) = (1 / (rrf_k + vector_rank)) + (1 / (rrf_k + bm25_rank))
    fused_docs: dict[str, dict] = {}

    # Ingest vector rankings
    for doc, dist, v_rank, col_jur in vector_candidates:
        doc_text = doc.page_content if hasattr(doc, "page_content") else str(doc)
        metadata = doc.metadata if hasattr(doc, "metadata") and doc.metadata else {}
        doc_id = str(metadata.get("original_id") or metadata.get("id") or metadata.get("chunk_id") or doc_text.strip())

        rrf_contrib = 1.0 / (rrf_k + v_rank)
        # Cosine distance to similarity
        vector_sim = max(0.0, min(1.0, 1.0 - dist))

        if doc_id not in fused_docs:
            fused_docs[doc_id] = {
                "id": doc_id,
                "text": doc_text,
                "source": metadata.get("source", "Legal Statute"),
                "section": metadata.get("section", "General"),
                "jurisdiction": metadata.get("jurisdiction", col_jur),
                "distance": dist,
                "vector_distance": dist,
                "vector_similarity": vector_sim,
                "vector_rank": v_rank,
                "bm25_rank": None,
                "bm25_score": 0.0,
                "rrf_score": rrf_contrib,
                "metadata": metadata,
            }
        else:
            fused_docs[doc_id]["rrf_score"] += rrf_contrib
            fused_docs[doc_id]["vector_rank"] = v_rank
            fused_docs[doc_id]["vector_distance"] = dist
            fused_docs[doc_id]["vector_similarity"] = vector_sim
            fused_docs[doc_id]["distance"] = min(fused_docs[doc_id].get("distance", 1.0), dist)

    # Ingest BM25 rankings
    for b_doc, b_score, b_rank in bm25_candidates:
        b_text = b_doc.get("text", "").strip()
        b_id = str(b_doc.get("id") or b_doc.get("chunk_id") or b_text)

        rrf_contrib = 1.0 / (rrf_k + b_rank)

        if b_id not in fused_docs:
            fused_docs[b_id] = {
                "id": b_id,
                "text": b_text,
                "source": b_doc.get("source", "Legal Statute"),
                "section": b_doc.get("section", "General"),
                "jurisdiction": b_doc.get("jurisdiction", jurisdiction),
                "distance": 1.0,
                "vector_distance": 1.0,
                "vector_similarity": 0.0,
                "vector_rank": None,
                "bm25_rank": b_rank,
                "bm25_score": b_score,
                "rrf_score": rrf_contrib,
                "metadata": b_doc,
            }
        else:
            fused_docs[b_id]["rrf_score"] += rrf_contrib
            fused_docs[b_id]["bm25_rank"] = b_rank
            fused_docs[b_id]["bm25_score"] = b_score

    # 5. Sort descending by total rrf_score
    ranked_results = sorted(
        fused_docs.values(),
        key=lambda x: x["rrf_score"],
        reverse=True,
    )

    top_results = ranked_results[:top_k]

    log.info(
        "RRF Fusion yielded %d candidates (from %d vector, %d bm25). Top RRF: %.4f",
        len(top_results),
        len(vector_candidates),
        len(bm25_candidates),
        top_results[0]["rrf_score"] if top_results else 0.0,
    )

    _chroma_latency_ms = (time.perf_counter() - _chroma_t_start) * 1000.0

    # 6. Optional Shadow Retrieval (non-destructive comparison)
    #    Shadow runs AFTER the user response is fully assembled; no blocking wait.
    if getattr(settings, "QDRANT_SHADOW_RETRIEVAL", False):
        try:
            from app.services.shadow_retrieval import log_and_record_shadow_comparison

            log_and_record_shadow_comparison(
                query=query,
                jurisdiction=jurisdiction,
                top_k=top_k,
                chroma_results=top_results,
                collection_name=getattr(settings, "QDRANT_SHADOW_COLLECTION", None),
                chroma_latency_ms=_chroma_latency_ms,
            )
        except Exception as shadow_err:
            log.warning("Shadow retrieval non-blocking error: %s", shadow_err)

    return top_results
