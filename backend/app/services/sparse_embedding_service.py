"""
backend/app/services/sparse_embedding_service.py
------------------------------------------------
Reusable Sparse BM25 Embedding Service for IP-SAKTI Sahayak using FastEmbed.

Enforces:
- Model: Qdrant/bm25
- Document embedding: passage_embed()
- Query embedding: query_embed()
- Output format: integer token indices and float values
- Singleton lifecycle: FastEmbed model instantiated once and reused
- Clear error handling for empty or invalid text
- Direct conversion to qdrant_client.models.SparseVector
"""

from __future__ import annotations

import logging
import threading
from typing import List, Optional, Union

from fastembed import SparseTextEmbedding
from qdrant_client import models as qmodels

log = logging.getLogger("app.services.sparse_embedding_service")

SPARSE_VECTOR_NAME = "bm25"
DEFAULT_SPARSE_MODEL = "Qdrant/bm25"


class SparseEmbeddingService:
    """
    Thread-safe reusable FastEmbed BM25 sparse embedding service.
    """

    def __init__(self, model_name: str = DEFAULT_SPARSE_MODEL) -> None:
        self.model_name = model_name
        self.sparse_vector_name = SPARSE_VECTOR_NAME
        self._model: Optional[SparseTextEmbedding] = None
        self._lock = threading.Lock()

    def _get_model(self) -> SparseTextEmbedding:
        if self._model is None:
            with self._lock:
                if self._model is None:
                    log.info("Initializing FastEmbed SparseTextEmbedding with model: %s", self.model_name)
                    self._model = SparseTextEmbedding(model_name=self.model_name)
                    log.info("FastEmbed SparseTextEmbedding initialized successfully.")
        return self._model

    def embed_query(self, query: str) -> qmodels.SparseVector:
        """
        Embed a single search query into a Qdrant SparseVector using query_embed().
        Returns integer token indices and float values.
        Raises ValueError for empty or invalid text.
        """
        if not isinstance(query, str) or not query.strip():
            raise ValueError("Query text must be a non-empty string.")

        model = self._get_model()
        cleaned_query = query.strip()

        try:
            generator = model.query_embed(cleaned_query)
            emb = next(iter(generator))
        except StopIteration:
            raise ValueError(f"FastEmbed produced no sparse embedding for query: '{cleaned_query}'")
        except Exception as exc:
            log.error("FastEmbed query_embed error for '%s': %s", cleaned_query, exc)
            raise RuntimeError(f"FastEmbed query_embed failed: {exc}") from exc

        indices = [int(idx) for idx in emb.indices]
        values = [float(val) for val in emb.values]

        if not indices or not values:
            raise ValueError(f"FastEmbed produced 0 sparse tokens for query: '{cleaned_query}'")

        return qmodels.SparseVector(indices=indices, values=values)

    def embed_passages(
        self,
        passages: List[str],
        batch_size: int = 32,
    ) -> List[qmodels.SparseVector]:
        """
        Embed a list of document passages into Qdrant SparseVectors using passage_embed().
        Returns a list of SparseVector objects with integer indices and float values.
        Raises ValueError if any passage is empty or invalid.
        """
        if not isinstance(passages, list):
            raise TypeError(f"Passages must be a list of strings, got {type(passages).__name__}")
        if len(passages) == 0:
            return []

        cleaned: List[str] = []
        for i, p in enumerate(passages):
            if not isinstance(p, str) or not p.strip():
                raise ValueError(f"Passage at index {i} is empty or not a string.")
            cleaned.append(p.strip())

        model = self._get_model()

        try:
            results: List[qmodels.SparseVector] = []
            for emb in model.passage_embed(cleaned, batch_size=batch_size):
                indices = [int(idx) for idx in emb.indices]
                values = [float(val) for val in emb.values]
                if not indices or not values:
                    raise ValueError("FastEmbed produced empty sparse vector for a passage.")
                results.append(qmodels.SparseVector(indices=indices, values=values))
            return results
        except Exception as exc:
            log.error("FastEmbed passage_embed error: %s", exc)
            raise RuntimeError(f"FastEmbed passage_embed failed: {exc}") from exc


# Reusable singleton instance
sparse_embedder = SparseEmbeddingService()
