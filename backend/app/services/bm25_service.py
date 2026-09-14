"""
backend/app/services/bm25_service.py
------------------------------------
Disk-persisted BM25 keyword index using rank_bm25 and pickle serialization.
Avoids rebuild overhead on process restart and provides fast lexical retrieval.
"""

from __future__ import annotations

import logging
import os
import pickle
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from rank_bm25 import BM25Okapi

from app.core.config import settings

log = logging.getLogger("app.services.bm25_service")


class PersistedBM25Index:
    """
    Disk-persisted BM25Okapi keyword index with document metadata storage.
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

    def build_and_save(self, chunks: List[Dict[str, Any]], save_path: str) -> None:
        """
        Build a BM25 index from a list of chunk dictionaries and serialize to disk.

        Parameters
        ----------
        chunks : List[Dict[str, Any]]
            List of chunk dictionaries with at least a 'text' key.
        save_path : str
            Filepath where pickled index and metadata will be saved.
        """
        with self._lock:
            if not chunks:
                log.warning("No chunks provided to build BM25 index.")
                return

            log.info("Tokenizing %d chunks for BM25 indexing...", len(chunks))
            corpus_tokens = [self._tokenize(chunk.get("text", "")) for chunk in chunks]

            log.info("Constructing BM25Okapi index...")
            self.bm25 = BM25Okapi(corpus_tokens)
            self.documents = list(chunks)
            self.is_loaded = True

            # Ensure parent directory exists
            out_path = Path(save_path)
            out_path.parent.mkdir(parents=True, exist_ok=True)

            log.info("Serializing BM25 index to %s...", save_path)
            payload = {
                "bm25": self.bm25,
                "documents": self.documents,
            }
            with open(save_path, "wb") as f:
                pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)

            log.info("BM25 index saved successfully (%d docs).", len(self.documents))

    def load_from_disk(self, load_path: str) -> bool:
        """
        Load a pickled BM25 index and documents from disk.

        Parameters
        ----------
        load_path : str
            Filepath to the serialized pickle file.

        Returns
        -------
        bool
            True if loaded successfully, False otherwise.
        """
        with self._lock:
            if not os.path.exists(load_path):
                log.warning("BM25 index file not found at %s", load_path)
                return False

            try:
                log.info("Loading BM25 index from %s...", load_path)
                with open(load_path, "rb") as f:
                    data = pickle.load(f)

                if isinstance(data, dict) and "bm25" in data and "documents" in data:
                    self.bm25 = data["bm25"]
                    self.documents = data["documents"]
                    self.is_loaded = True
                    log.info("BM25 index loaded successfully with %d documents.", len(self.documents))
                    return True
                else:
                    log.error("Invalid format in BM25 index pickle file.")
                    return False
            except Exception as e:
                log.error("Failed to load BM25 index from %s: %s", load_path, e, exc_info=True)
                return False

    def search(self, query: str, top_k: int = 5, jurisdiction: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Perform keyword search using BM25 scoring.

        Parameters
        ----------
        query : str
            Search query string.
        top_k : int, optional
            Number of top results to return, by default 5.
        jurisdiction : Optional[str], optional
            Optional filter ('India' or 'International').

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

        # Filter by jurisdiction if requested and metadata available
        if jurisdiction:
            jur_lower = jurisdiction.lower()
            filtered_doc_scores = []
            for idx, score in doc_scores:
                doc = self.documents[idx]
                doc_jur = str(doc.get("jurisdiction", "")).lower()
                if not doc_jur or doc_jur == jur_lower:
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
    """Helper to initialize and load the BM25 index on application startup."""
    target_path = index_path or settings.BM25_INDEX_PATH
    index = get_bm25_index()
    return index.load_from_disk(target_path)
