"""
backend/app/services/hybrid_retriever.py
----------------------------------------
Hybrid Retrieval Engine combining ChromaDB dense vector search with
PersistedBM25Index sparse keyword search using Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import chromadb
from app.core.async_utils import async_get_embeddings, run_in_threadpool
from app.core.config import settings
from app.services.bm25_service import get_bm25_index

log = logging.getLogger("app.services.hybrid_retriever")

RRF_K = 60  # Standard constant for Reciprocal Rank Fusion


class HybridRetriever:
    """
    Hybrid search engine combining dense semantic retrieval (ChromaDB)
    and sparse lexical retrieval (BM25) with Reciprocal Rank Fusion.
    """

    def __init__(self, chroma_path: Optional[str] = None) -> None:
        self.chroma_path = chroma_path or settings.CHROMA_DB_DIR
        self._chroma_client: Optional[chromadb.PersistentClient] = None

    def _get_client(self) -> chromadb.PersistentClient:
        if self._chroma_client is None:
            self._chroma_client = chromadb.PersistentClient(path=self.chroma_path)
        return self._chroma_client

    def _get_collection(self, jurisdiction: str) -> Any:
        client = self._get_client()
        col_name = (
            "international_treaties"
            if jurisdiction.strip().capitalize() == "International"
            else "india_statutes"
        )
        try:
            return client.get_collection(col_name)
        except Exception:
            log.warning("Collection '%s' not found, falling back to 'india_statutes'", col_name)
            return client.get_or_create_collection("india_statutes")

    async def vector_search(
        self,
        query: str,
        jurisdiction: str = "India",
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Perform dense semantic search in ChromaDB using precomputed query embeddings.
        """
        try:
            # 1. Asynchronously encode query text
            query_vectors = await async_get_embeddings([query])
            if not query_vectors:
                return []

            collection = self._get_collection(jurisdiction)

            def _query_sync() -> Dict[str, Any]:
                return collection.query(
                    query_embeddings=query_vectors,
                    n_results=min(top_k, max(1, collection.count())),
                    include=["documents", "metadatas", "distances"],
                )

            res = await run_in_threadpool(_query_sync)

            results: List[Dict[str, Any]] = []
            if res and res.get("documents") and res["documents"][0]:
                docs = res["documents"][0]
                metas = res.get("metadatas", [[]])[0]
                dists = res.get("distances", [[]])[0]

                for i, doc_text in enumerate(docs):
                    meta = metas[i] if i < len(metas) and metas[i] else {}
                    dist = float(dists[i]) if i < len(dists) else 1.0
                    # Cosine similarity = 1 - cosine distance
                    sim = max(0.0, min(1.0, 1.0 - dist))

                    results.append({
                        "text": doc_text,
                        "source": meta.get("source", "Statute/Treaty"),
                        "section": meta.get("section", "General"),
                        "jurisdiction": meta.get("jurisdiction", jurisdiction),
                        "vector_distance": dist,
                        "vector_similarity": sim,
                        "retrieval_source": "vector",
                    })

            return results
        except Exception as e:
            log.error("ChromaDB vector search failed: %s", e, exc_info=True)
            return []

    async def bm25_search(
        self,
        query: str,
        jurisdiction: str = "India",
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Perform sparse keyword search using disk-persisted BM25 index.
        """
        try:
            bm25_idx = get_bm25_index()
            if not bm25_idx.is_loaded:
                bm25_idx.load_from_disk(settings.BM25_INDEX_PATH)

            def _search_sync() -> List[Dict[str, Any]]:
                raw_matches = bm25_idx.search(query, top_k=top_k, jurisdiction=jurisdiction)
                matches = []
                for m in raw_matches:
                    m_copy = dict(m)
                    m_copy["retrieval_source"] = "bm25"
                    matches.append(m_copy)
                return matches

            return await run_in_threadpool(_search_sync)
        except Exception as e:
            log.error("BM25 search failed: %s", e, exc_info=True)
            return []

    async def hybrid_retrieve(
        self,
        query: str,
        jurisdiction: str = "India",
        top_k: int = 5,
        vector_top_k: int = 10,
        bm25_top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Execute parallel Vector + BM25 search and fuse results using Reciprocal Rank Fusion (RRF).

        RRF Score = sum( 1 / (60 + rank_i) )
        """
        # Execute vector and BM25 search in parallel
        vector_results, bm25_results = await run_in_threadpool(
            lambda: ([], [])
        )  # placeholder to invoke async routines properly

        import asyncio
        vector_task = asyncio.create_task(
            self.vector_search(query, jurisdiction=jurisdiction, top_k=vector_top_k)
        )
        bm25_task = asyncio.create_task(
            self.bm25_search(query, jurisdiction=jurisdiction, top_k=bm25_top_k)
        )
        vector_results, bm25_results = await asyncio.gather(vector_task, bm25_task)

        # Merge and calculate RRF scores
        doc_map: Dict[str, Dict[str, Any]] = {}

        # 1. Score vector results
        for rank, item in enumerate(vector_results, start=1):
            key = item.get("text", "").strip()
            if not key:
                continue
            rrf_score = 1.0 / (RRF_K + rank)
            if key not in doc_map:
                doc_map[key] = dict(item)
                doc_map[key]["rrf_score"] = rrf_score
                doc_map[key]["vector_rank"] = rank
                doc_map[key]["bm25_rank"] = None
            else:
                doc_map[key]["rrf_score"] += rrf_score
                doc_map[key]["vector_rank"] = rank
                doc_map[key]["vector_distance"] = item.get("vector_distance", 1.0)
                doc_map[key]["vector_similarity"] = item.get("vector_similarity", 0.0)

        # 2. Score BM25 results
        for rank, item in enumerate(bm25_results, start=1):
            key = item.get("text", "").strip()
            if not key:
                continue
            rrf_score = 1.0 / (RRF_K + rank)
            if key not in doc_map:
                doc_map[key] = dict(item)
                doc_map[key]["rrf_score"] = rrf_score
                doc_map[key]["bm25_rank"] = rank
                doc_map[key]["vector_rank"] = None
                doc_map[key]["vector_distance"] = 1.0
                doc_map[key]["vector_similarity"] = 0.0
            else:
                doc_map[key]["rrf_score"] += rrf_score
                doc_map[key]["bm25_rank"] = rank
                doc_map[key]["bm25_score"] = item.get("bm25_score", 0.0)

        # Sort descending by fused RRF score
        fused_candidates = list(doc_map.values())
        fused_candidates.sort(key=lambda x: x.get("rrf_score", 0.0), reverse=True)

        log.info(
            "Hybrid retrieval returned %d combined candidates (Vector: %d, BM25: %d) for query '%s'",
            len(fused_candidates),
            len(vector_results),
            len(bm25_results),
            query[:40],
        )

        return fused_candidates[:top_k]


# Global singleton instance
hybrid_retriever = HybridRetriever()
