"""
backend/app/services/retrieval_service.py
-----------------------------------------
LangChain Vector + BM25 Hybrid Retriever with Reciprocal Rank Fusion (RRF)
for IP-SAKTI Sahayak.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings

# Accommodate both absolute workspace imports and package relative imports
try:
    from backend.app.services.bm25_service import PersistedBM25Index, get_bm25_index
    from backend.app.core.config import settings
    from backend.app.core.models import model_registry
except ImportError:
    from app.services.bm25_service import PersistedBM25Index, get_bm25_index
    from app.core.config import settings
    from app.core.models import model_registry

log = logging.getLogger("app.services.retrieval_service")


class SentenceTransformerEmbeddingsAdapter(Embeddings):
    """
    LangChain compatible Embeddings adapter that connects to the
    pre-warmed SentenceTransformer model in model_registry.
    """

    def __init__(self) -> None:
        pass

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        model = model_registry.get_embedding_model()
        embs = model.encode(
            texts,
            batch_size=8,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return [vec.tolist() for vec in embs]

    def embed_query(self, text: str) -> list[float]:
        model = model_registry.get_embedding_model()
        emb = model.encode(
            [text],
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return emb[0].tolist()


def get_chroma_vectorstore(collection_name: str) -> Chroma:
    """
    Initializes or returns a LangChain Chroma vector store instance
    connected to the local persistent database.
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
) -> list[dict]:
    """
    Combines dense semantic vector search (ChromaDB) and sparse lexical search (BM25)
    using Reciprocal Rank Fusion (RRF).

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

    Returns
    -------
    list[dict]
        Top fused candidate documents with text, metadata, distances, and rrf_score.
    """
    if not query or not query.strip():
        return []

    # 1. Route to correct ChromaDB collection based on jurisdiction
    jur_clean = jurisdiction.strip().lower()
    collection_name = (
        "international_treaties"
        if "international" in jur_clean
        else "india_statutes"
    )

    log.info(
        "Executing hybrid RRF search for query '%s' under jurisdiction '%s' (collection: %s)",
        query[:50],
        jurisdiction,
        collection_name,
    )

    # 2. Query ChromaDB vector store for candidates and record (doc, distance)
    vector_candidates: list[tuple[Any, float, int]] = []
    try:
        vectorstore = get_chroma_vectorstore(collection_name)
        # similarity_search_with_score returns list of (Document, score/distance)
        raw_vector_results = vectorstore.similarity_search_with_score(
            query=query,
            k=top_k * 2,
        )
        for rank, (doc, distance) in enumerate(raw_vector_results, start=1):
            vector_candidates.append((doc, float(distance), rank))
    except Exception as e:
        log.error("Vector search query error in ChromaDB: %s", e, exc_info=True)

    # 3. Query PersistedBM25Index for candidates and record (doc, bm25_score)
    bm25_candidates: list[tuple[dict, float, int]] = []
    try:
        bm25_idx = get_bm25_index()
        if not bm25_idx.is_loaded:
            bm25_idx.load_from_disk(settings.BM25_INDEX_PATH)

        bm25_results = bm25_idx.search(
            query=query,
            top_k=top_k * 2,
            jurisdiction=jurisdiction,
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
    for doc, dist, v_rank in vector_candidates:
        doc_text = doc.page_content if hasattr(doc, "page_content") else str(doc)
        metadata = doc.metadata if hasattr(doc, "metadata") and doc.metadata else {}
        doc_id = str(metadata.get("id") or metadata.get("chunk_id") or doc_text.strip())

        rrf_contrib = 1.0 / (rrf_k + v_rank)
        # Cosine distance to similarity
        vector_sim = max(0.0, min(1.0, 1.0 - dist))

        if doc_id not in fused_docs:
            fused_docs[doc_id] = {
                "id": doc_id,
                "text": doc_text,
                "source": metadata.get("source", "Legal Statute"),
                "section": metadata.get("section", "General"),
                "jurisdiction": metadata.get("jurisdiction", jurisdiction),
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

    return top_results
