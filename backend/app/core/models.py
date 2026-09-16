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
from typing import Optional

from sentence_transformers import CrossEncoder, SentenceTransformer

from app.core.config import settings

log = logging.getLogger("app.core.models")


class ModelRegistry:
    """
    Thread-safe Singleton registry holding preloaded ML models.
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
        """Returns True if models are successfully loaded and warmed up."""
        return self._is_ready

    def load_models(
        self,
        embedding_model_name: str | None = None,
        reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
    ) -> None:
        """
        Load and warmup the embedding and reranker models.
        Thread-safe and idempotent.
        """
        embedding_model_name = embedding_model_name or settings.EMBEDDING_MODEL_NAME
        with self._load_lock:
            if self._is_ready and self._embedding_model is not None and self._reranker_model is not None:
                log.info("[PID %s] Models already initialized and ready.", os.getpid())
                return

            pid = os.getpid()
            log.info("[PID %s] Preloading ML models...", pid)

            try:
                # 1. Load SentenceTransformer
                log.info("[PID %s] Loading embedding model: %s", pid, embedding_model_name)
                self._embedding_model = SentenceTransformer(embedding_model_name)

                # Warmup embedding model
                _ = self._embedding_model.encode(["Warmup query for IP-SAKTI Sahayak embedding model"])
                log.info("[PID %s] Embedding model loaded and warmed up successfully.", pid)

                # 2. Load CrossEncoder
                log.info("[PID %s] Loading reranker model: %s", pid, reranker_model_name)
                self._reranker_model = CrossEncoder(reranker_model_name)

                # Warmup reranker model
                _ = self._reranker_model.predict([("Warmup legal query", "Warmup statutory passage")])
                log.info("[PID %s] Reranker model loaded and warmed up successfully.", pid)

                self._is_ready = True
                log.info("[PID %s] All models successfully registered and marked ready.", pid)

            except Exception as e:
                self._is_ready = False
                log.exception("[PID %s] Failed to preload ML models: %s", pid, e)
                raise RuntimeError(f"Model preload failure on PID {pid}: {e}") from e

    def get_embedding_model(self) -> SentenceTransformer:
        """
        Retrieve the initialized embedding model instance.
        If not yet ready, triggers synchronous lazy initialization as fallback.
        """
        if not self._is_ready or self._embedding_model is None:
            log.warning("[PID %s] Embedding model accessed before startup preloading finished. Loading lazily...", os.getpid())
            self.load_models()
        return self._embedding_model

    def get_reranker_model(self) -> CrossEncoder:
        """
        Retrieve the initialized reranker model instance.
        If not yet ready, triggers synchronous lazy initialization as fallback.
        """
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
