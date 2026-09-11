"""
backend/app/rag/embeddings.py
-------------------------------
Shared lazy-singleton BGE embedding model loader.

The model is loaded once per backend process and reused for both ingestion
and query-time embedding.  BGE models require a specific query instruction
prefix for retrieval tasks, which is handled transparently by embed_query().
"""

from __future__ import annotations

import logging
from typing import Optional

from sentence_transformers import SentenceTransformer

from app.rag.config import get_settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# BGE query instruction prefix
# ---------------------------------------------------------------------------
# bge-small-en-v1.5 documentation specifies this prefix for retrieval tasks.
# It is applied only to QUERIES, never to documents during ingestion.
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

# ---------------------------------------------------------------------------
# Lazy singleton
# ---------------------------------------------------------------------------
_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """
    Return the shared SentenceTransformer model instance.

    The model is loaded on first call and cached at module level.
    Subsequent calls return the same instance.
    """
    global _model
    if _model is None:
        settings = get_settings()
        model_name = settings.rag_embedding_model
        log.info("Loading embedding model: %s ...", model_name)
        _model = SentenceTransformer(model_name)
        log.info("Embedding model '%s' loaded successfully.", model_name)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of document texts (no query prefix).

    Parameters
    ----------
    texts:
        List of text strings to embed.

    Returns
    -------
    list[list[float]]
        List of normalized embedding vectors.
    """
    if not texts:
        return []

    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=len(texts) > 50,
        normalize_embeddings=True,
    )
    return embeddings.tolist()


def embed_query(query: str) -> list[float]:
    """
    Embed a single search query with the BGE query instruction prefix.

    The prefix is specified by the BGE model documentation and improves
    retrieval quality by signalling that this is a search query rather
    than a document passage.

    Parameters
    ----------
    query:
        The search query text.

    Returns
    -------
    list[float]
        Normalized embedding vector.
    """
    model = get_embedding_model()
    prefixed = f"{_BGE_QUERY_PREFIX}{query}"
    embedding = model.encode(
        prefixed,
        normalize_embeddings=True,
    )
    return embedding.tolist()
