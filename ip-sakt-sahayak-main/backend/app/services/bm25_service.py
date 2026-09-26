"""
backend/app/services/bm25_service.py
------------------------------------
In-memory BM25 keyword index using rank_bm25 for IP-SAKTI Sahayak.
Reconstructs lexical index from Qdrant payloads in RAM at application startup.
Supports dynamic in-memory chunk addition and deletion on user uploads without
relying on runtime disk serialization (stateless cloud architecture).
"""

from __future__ import annotations

import logging
import os
import pickle
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from rank_bm25 import BM25Okapi

from app.core.config import settings

log = logging.getLogger("app.services.bm25_service")


class PersistedBM25Index:
    """
    In-memory BM25Okapi keyword index with dynamic reconstruction from Qdrant.
    Keeps all documents and inverted indices in RAM without runtime disk writes.
    """

    def __init__(self) -> None:
        self.bm25: Optional[BM25Okapi] = None
        self.documents: List[Dict[str, Any]] = []
        self.is_loaded: bool = False
        self._lock = threading.Lock()

    def _tokenize(self, text: str) -> List[str]:
        """Simple whitespace and lowercasing tokenization for lexical search."""
        if not text:
            return []
        return [w.strip(".,;:!?\"'()[]{}") for w in text.lower().split() if w.strip(".,;:!?\"'()[]{}")]

    def rebuild_from_qdrant(self, q_service: Optional[Any] = None) -> bool:
        """
        Reconstructs the BM25 index entirely in-memory by scrolling payloads
        from Qdrant collections (india_statutes, international_treaties, user_uploads).
        Zero disk persistence required.
        """
        with self._lock:
            try:
                from app.services.qdrant_service import qdrant_service
                svc = q_service or qdrant_service

                target_collections = [
                    settings.QDRANT_INDIA_COLLECTION,
                    settings.QDRANT_INTERNATIONAL_COLLECTION,
                    settings.QDRANT_USER_UPLOADS_COLLECTION,
                ]

                all_docs: List[Dict[str, Any]] = []
                for col in target_collections:
                    try:
                        payloads = svc.get_all_payloads(col)
                        all_docs.extend(payloads)
                    except Exception as col_err:
                        log.warning("Could not fetch payloads from Qdrant collection '%s': %s", col, col_err)

                if all_docs:
                    corpus_tokens = [self._tokenize(d.get("text", "")) for d in all_docs]
                    self.bm25 = BM25Okapi(corpus_tokens)
                    if hasattr(self.bm25, "idf"):
                        self.bm25.idf = {k: max(v, 0.25) for k, v in self.bm25.idf.items()}
                    self.documents = list(all_docs)
                    self.is_loaded = True
                    log.info("BM25 in-memory index rebuilt from Qdrant with %d documents.", len(self.documents))
                    return True
                else:
                    log.info("Qdrant returned 0 documents for BM25 rebuild.")
            except Exception as e:
                log.warning("Failed to rebuild BM25 from Qdrant: %s", e)

            # Local development fallback: try loading from disk if Qdrant was empty/unavailable
            if os.path.exists(settings.BM25_INDEX_PATH):
                log.info("Attempting local development BM25 disk fallback...")
                return self._load_from_disk_internal(settings.BM25_INDEX_PATH)

            return False

    def add_chunks(self, new_chunks: List[Dict[str, Any]]) -> None:
        """
        Dynamically appends new document chunks to the in-memory index and
        reconstructs the BM25Okapi model in RAM.
        """
        with self._lock:
            if not new_chunks:
                return

            self.documents.extend(new_chunks)
            corpus_tokens = [self._tokenize(d.get("text", "")) for d in self.documents]
            self.bm25 = BM25Okapi(corpus_tokens)
            if hasattr(self.bm25, "idf"):
                self.bm25.idf = {k: max(v, 0.25) for k, v in self.bm25.idf.items()}
            self.is_loaded = True
            log.info(
                "BM25 in-memory index updated with %d new chunks (total documents: %d).",
                len(new_chunks),
                len(self.documents),
            )

    def remove_by_document_id(self, document_id: str) -> int:
        """
        Removes all chunks belonging to a document from the in-memory BM25 index.
        """
        with self._lock:
            doc_id_str = str(document_id).strip()
            initial_count = len(self.documents)
            self.documents = [
                d for d in self.documents
                if str(d.get("document_id", "")).strip() != doc_id_str
            ]
            removed = initial_count - len(self.documents)

            if removed > 0:
                if self.documents:
                    corpus_tokens = [self._tokenize(d.get("text", "")) for d in self.documents]
                    self.bm25 = BM25Okapi(corpus_tokens)
                    if hasattr(self.bm25, "idf"):
                        self.bm25.idf = {k: max(v, 0.25) for k, v in self.bm25.idf.items()}
                    self.is_loaded = True
                else:
                    self.bm25 = None
                    self.is_loaded = False
                log.info(
                    "BM25 index removed %d chunks for document %s (remaining: %d).",
                    removed,
                    document_id,
                    len(self.documents),
                )
            return removed

    def search(
        self,
        query: str,
        top_k: int = 5,
        jurisdiction: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform keyword search using BM25 scoring with jurisdiction and user scoping.

        Parameters
        ----------
        query : str
            Search query string.
        top_k : int, optional
            Number of top results to return, by default 5.
        jurisdiction : Optional[str], optional
            Optional jurisdiction filter ('India', 'International', 'Both').
        user_id : Optional[str], optional
            Optional user ID to include authorized user-uploaded chunks.

        Returns
        -------
        List[Dict[str, Any]]
            Top matching document dicts with added 'bm25_score' key.
        """
        if not self.is_loaded or self.bm25 is None or not self.documents:
            log.warning("BM25 search called but index is not loaded.")
            return []

        tokenized_query = self._tokenize(query)
        if not tokenized_query:
            return []

        scores = self.bm25.get_scores(tokenized_query)
        if len(scores) == 0:
            return []

        # Pair scores with document indices
        doc_scores = [(idx, float(score)) for idx, score in enumerate(scores)]

        # Apply jurisdiction and user isolation filters
        filtered_doc_scores = []
        jur_clean = jurisdiction.strip().lower() if jurisdiction else "india"

        for idx, score in doc_scores:
            doc = self.documents[idx]
            doc_jur = str(doc.get("jurisdiction", "")).lower()
            doc_user_id = doc.get("user_id")
            is_user_upload = bool(doc.get("document_id"))

            # 1. User upload isolation: user chunks only match for the owning user
            if is_user_upload:
                if user_id is None or str(doc_user_id).strip() != str(user_id).strip():
                    continue
                # If owned by user, it matches either jurisdiction
                filtered_doc_scores.append((idx, score))
                continue

            # 2. Statutory jurisdiction filter
            if jur_clean == "both":
                filtered_doc_scores.append((idx, score))
            elif "international" in jur_clean:
                if doc_jur in ("international", ""):
                    filtered_doc_scores.append((idx, score))
            else:
                # Default India
                if doc_jur in ("india", ""):
                    filtered_doc_scores.append((idx, score))

        doc_scores = filtered_doc_scores

        # Sort descending by score
        doc_scores.sort(key=lambda x: x[1], reverse=True)

        results: List[Dict[str, Any]] = []
        for idx, score in doc_scores[:top_k]:
            if score <= 0:
                continue
            doc_copy = dict(self.documents[idx])
            doc_copy["bm25_score"] = float(score)
            results.append(doc_copy)

        return results

    def build_and_save(self, chunks: List[Dict[str, Any]], save_path: str) -> None:
        """Offline utility to build and save a BM25 index to disk (for dev testing)."""
        with self._lock:
            if not chunks:
                return
            corpus_tokens = [self._tokenize(chunk.get("text", "")) for chunk in chunks]
            self.bm25 = BM25Okapi(corpus_tokens)
            self.documents = list(chunks)
            self.is_loaded = True

            out_path = Path(save_path)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                pickle.dump({"bm25": self.bm25, "documents": self.documents}, f, protocol=pickle.HIGHEST_PROTOCOL)

    def load_from_disk(self, load_path: str) -> bool:
        """Loads index from disk (local dev fallback)."""
        with self._lock:
            return self._load_from_disk_internal(load_path)

    def _load_from_disk_internal(self, load_path: str) -> bool:
        """Internal helper for disk loading without re-acquiring lock."""
        if not os.path.exists(load_path):
            return False
        try:
            with open(load_path, "rb") as f:
                data = pickle.load(f)
            if isinstance(data, dict) and "bm25" in data and "documents" in data:
                self.bm25 = data["bm25"]
                self.documents = data["documents"]
                self.is_loaded = True
                log.info("BM25 index loaded from disk fallback with %d documents.", len(self.documents))
                return True
            return False
        except Exception as e:
            log.warning("Could not load BM25 from disk fallback (%s): %s", load_path, e)
            return False


# Global singleton instance
_bm25_singleton: Optional[PersistedBM25Index] = None
_singleton_lock = threading.Lock()


def get_bm25_index() -> PersistedBM25Index:
    """Thread-safe accessor for the global PersistedBM25Index instance."""
    global _bm25_singleton
    if _bm25_singleton is None:
        with _singleton_lock:
            if _bm25_singleton is None:
                _bm25_singleton = PersistedBM25Index()
    return _bm25_singleton


def load_bm25_index_on_startup(index_path: Optional[str] = None) -> bool:
    """
    Initializes and reconstructs the BM25 index on application startup.
    Prioritizes in-memory reconstruction from Qdrant payloads with zero disk writes.
    """
    index = get_bm25_index()
    # 1. Primary: Rebuild in-memory from Qdrant
    success = index.rebuild_from_qdrant()
    if success:
        return True

    # 2. Local fallback if Qdrant was not available/populated
    target_path = index_path or settings.BM25_INDEX_PATH
    return index.load_from_disk(target_path)
