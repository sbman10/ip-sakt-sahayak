"""
backend/app/core/async_utils.py
-------------------------------
Asynchronous worker threadpool wrappers for heavy CPU-bound operations
(SentenceTransformer vector encoding, CrossEncoder reranking, etc.) to prevent
blocking the FastAPI async event loop.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any, Callable, TypeVar

from app.core.config import settings
from app.core.models import model_registry

log = logging.getLogger("app.core.async_utils")

T = TypeVar("T")


async def run_in_threadpool(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """
    Executes a synchronous, blocking callable inside an asyncio worker thread pool.
    """
    loop = asyncio.get_running_loop()
    p_func = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(None, p_func)


async def async_get_embeddings(text_list: list[str]) -> list[list[float]]:
    """
    Asynchronously generate dense vector embeddings for a list of strings.
    If local BGE-M3 preload is disabled, utilizes the canonical Hugging Face
    InferenceClient embedding service.

    Parameters
    ----------
    text_list : list[str]
        List of texts to embed.

    Returns
    -------
    list[list[float]]
        List of embedding vectors (float lists).
    """
    if not text_list:
        return []

    start_time = time.perf_counter()

    # When local model preload is disabled, delegate to canonical HF Inference service
    if not settings.ENABLE_LOCAL_BGE_PRELOAD:
        try:
            from app.services.embedding_service import canonical_embedder
            result = await run_in_threadpool(canonical_embedder.embed_documents, text_list)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            log.debug("Embedded %d text items via HF InferenceClient in %.2f ms", len(text_list), elapsed_ms)
            return result
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            log.error("Failed to generate embeddings via HF InferenceClient after %.2f ms: %s", elapsed_ms, e, exc_info=True)
            raise RuntimeError(f"HF Embedding generation error: {e}") from e

    try:
        model = model_registry.get_embedding_model()
        if model is None:
            from app.services.embedding_service import canonical_embedder
            return await run_in_threadpool(canonical_embedder.embed_documents, text_list)

        def _encode_sync() -> list[list[float]]:
            embeddings = model.encode(
                text_list,
                batch_size=32,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
            return [vec.tolist() for vec in embeddings]

        result = await run_in_threadpool(_encode_sync)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log.debug("Embedded %d text items locally in %.2f ms", len(text_list), elapsed_ms)
        return result

    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log.error("Failed to generate embeddings after %.2f ms: %s", elapsed_ms, e, exc_info=True)
        raise RuntimeError(f"Embedding generation error: {e}") from e


async def async_rerank(query: str, passage_list: list[str]) -> list[float]:
    """
    Asynchronously compute cross-encoder relevance scores for a query across passages.
    When ENABLE_CROSS_ENCODER is false or reranker is uninitialized, safely returns
    neutral scores preserving upstream hybrid retrieval ordering.

    Parameters
    ----------
    query : str
        The user query / search string.
    passage_list : list[str]
        The candidate text passages to score against the query.

    Returns
    -------
    list[float]
        Relevance scores predicted by the CrossEncoder, or neutral 1.0 scores if disabled.
    """
    if not passage_list:
        return []

    if not settings.ENABLE_CROSS_ENCODER:
        log.debug("CrossEncoder is disabled (ENABLE_CROSS_ENCODER=false). Returning default neutral scores.")
        return [1.0] * len(passage_list)

    start_time = time.perf_counter()
    try:
        reranker = model_registry.get_reranker_model()
        if reranker is None:
            log.warning("CrossEncoder model instance is None. Returning neutral scores.")
            return [1.0] * len(passage_list)

        pairs = [(query, passage) for passage in passage_list]

        def _rerank_sync() -> list[float]:
            scores = reranker.predict(pairs, show_progress_bar=False)
            return [float(score) for score in scores]

        scores = await run_in_threadpool(_rerank_sync)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log.debug("Reranked %d passages for query in %.2f ms", len(passage_list), elapsed_ms)
        return scores

    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        log.error("Failed to rerank passages after %.2f ms: %s", elapsed_ms, e, exc_info=True)
        # Soft-fail with neutral scores instead of failing the request
        return [1.0] * len(passage_list)

