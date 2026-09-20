"""
backend/app/core/models.py
--------------------------
Thread-safe Singleton container for preloading and serving ML models
(SentenceTransformer embedding model and CrossEncoder reranker model).

Avoids cold-start latency by initializing and warming up models during
FastAPI application startup.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Optional

CrossEncoder: Any = None
SentenceTransformer: Any = None


from app.core.config import settings

log = logging.getLogger("app.core.models")


class CanonicalBgeM3ModelAdapter:
    """
    Drop-in SentenceTransformer-compatible interface delegating to CanonicalEmbeddingService.
    Avoids loading heavy local SentenceTransformer/PyTorch models while preserving
    compatibility with callers expecting .encode([text]).
    """

    def encode(
        self,
        texts: list[str] | str,
        batch_size: int = 32,
        show_progress_bar: bool = False,
        convert_to_numpy: bool = True,
        normalize_embeddings: bool = True,
        **kwargs: Any,
    ) -> Any:
        import numpy as np
        from app.services.embedding_service import canonical_embedder

        if isinstance(texts, str):
            texts = [texts]

        embeddings = canonical_embedder.embed_documents(list(texts), batch_size=batch_size)
        if convert_to_numpy:
            return np.array(embeddings, dtype=np.float32)
        return embeddings


class ModelRegistry:
    """
    Thread-safe Singleton registry holding preloaded ML models.
    Supports headless/remote operation where local BGE-M3 or CrossEncoder
    are disabled to stay within low-memory environments (e.g. Render Free 512MB).
    """

    _instance: Optional[ModelRegistry] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> ModelRegistry:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
                    cls._instance._is_ready = False
                    cls._instance._embedding_model = None
                    cls._instance._reranker_model = None
                    cls._instance._load_lock = threading.Lock()
        return cls._instance

    @property
    def is_ready(self) -> bool:
        """Returns True if models initialization sequence has finished."""
        return self._is_ready

    def load_models(
        self,
        embedding_model_name: str | None = None,
        reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
    ) -> None:
        """
        Load and warmup the embedding and reranker models when enabled.
        Thread-safe and idempotent.
        """
        embedding_model_name = embedding_model_name or settings.EMBEDDING_MODEL_NAME
        with self._load_lock:
            if self._is_ready:
                log.info("[PID %s] Models already initialized and ready.", os.getpid())
                return

            pid = os.getpid()
            log.info("[PID %s] Evaluating ML model preload configurations...", pid)

            try:
                # 1. Local SentenceTransformer BGE-M3
                if settings.ENABLE_LOCAL_BGE_PRELOAD:
                    log.info("[PID %s] Loading local embedding model: %s", pid, embedding_model_name)
                    from sentence_transformers import SentenceTransformer
                    self._embedding_model = SentenceTransformer(embedding_model_name)
                    _ = self._embedding_model.encode(["Warmup query for IP-SAKTI Sahayak embedding model"])
                    log.info("[PID %s] Embedding model loaded and warmed up successfully.", pid)
                else:
                    log.info(
                        "[PID %s] Local BGE-M3 preload disabled (ENABLE_LOCAL_BGE_PRELOAD=false). "
                        "Using Hugging Face InferenceClient for dense embeddings.",
                        pid,
                    )
                    self._embedding_model = None

                # 2. CrossEncoder Reranker
                if settings.ENABLE_CROSS_ENCODER:
                    log.info("[PID %s] Loading reranker model: %s", pid, reranker_model_name)
                    from sentence_transformers import CrossEncoder
                    self._reranker_model = CrossEncoder(reranker_model_name)
                    _ = self._reranker_model.predict([("Warmup legal query", "Warmup statutory passage")])
                    log.info("[PID %s] Reranker model loaded and warmed up successfully.", pid)
                else:
                    log.info(
                        "[PID %s] CrossEncoder disabled (ENABLE_CROSS_ENCODER=false). "
                        "Skipping neural reranker to conserve memory.",
                        pid,
                    )
                    self._reranker_model = None

                self._is_ready = True
                log.info(
                    "[PID %s] Model registry ready. (ENABLE_LOCAL_BGE_PRELOAD=%s, ENABLE_CROSS_ENCODER=%s)",
                    pid,
                    settings.ENABLE_LOCAL_BGE_PRELOAD,
                    settings.ENABLE_CROSS_ENCODER,
                )

            except Exception as e:
                self._is_ready = False
                log.exception("[PID %s] Failed to preload ML models: %s", pid, e)
                raise RuntimeError(f"Model preload failure on PID {pid}: {e}") from e

    def get_embedding_model(self) -> Any:
        """
        Retrieve the initialized embedding model instance.
        If ENABLE_LOCAL_BGE_PRELOAD is false, returns CanonicalBgeM3ModelAdapter
        which delegates to Hugging Face InferenceClient without local model loading.
        """
        if not settings.ENABLE_LOCAL_BGE_PRELOAD:
            return CanonicalBgeM3ModelAdapter()

        if not self._is_ready or self._embedding_model is None:
            log.warning("[PID %s] Embedding model accessed before startup preloading finished. Loading lazily...", os.getpid())
            self.load_models()
        return self._embedding_model


    def get_reranker_model(self) -> Optional[Any]:
        """
        Retrieve the initialized reranker model instance if CrossEncoder is enabled.
        Returns None if ENABLE_CROSS_ENCODER is False.
        """
        if not settings.ENABLE_CROSS_ENCODER:
            log.debug("[PID %s] CrossEncoder requested but ENABLE_CROSS_ENCODER is false.", os.getpid())
            return None

        if not self._is_ready or self._reranker_model is None:
            log.warning("[PID %s] Reranker model accessed before startup preloading finished. Loading lazily...", os.getpid())
            self.load_models()
        return self._reranker_model

    def unload_models(self) -> None:
        """Clean up model references on application shutdown."""
        with self._load_lock:
            pid = os.getpid()
            log.info("[PID %s] Unloading ML models from memory...", pid)
            self._embedding_model = None
            self._reranker_model = None
            self._is_ready = False
            log.info("[PID %s] Models unloaded.", pid)



# Global singleton instance export
model_registry = ModelRegistry()
