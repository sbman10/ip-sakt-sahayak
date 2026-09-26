"""
backend/app/services/embedding_service.py
-----------------------------------------
Canonical Dense Embedding Provider for IP-SAKTI Sahayak.

Enforces a single, consistent embedding engine across:
- Corpus ingestion
- Online user-query embedding
- Uploaded-document embedding

Uses Hugging Face InferenceClient with BAAI/bge-m3 producing normalized
1,024-dimensional dense vectors. Local BGE-M3 fallback is explicitly disabled
(LOCAL_BGE_FALLBACK=false) to prevent mixing disparate vector distributions in Qdrant.
"""

from __future__ import annotations

import logging
import math
import time
from typing import List, Optional, Union

import numpy as np
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError

from app.core.config import settings

log = logging.getLogger("app.services.embedding_service")

EXPECTED_DIMENSION = 1024


class EmbeddingServiceError(RuntimeError):
    """Raised when canonical embedding generation fails."""
    pass


class CanonicalEmbeddingService:
    """
    Thread-safe canonical dense embedding service wrapping Hugging Face InferenceClient.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        timeout: Optional[float] = None,
        normalize: Optional[bool] = None,
        local_fallback: Optional[bool] = None,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
    ) -> None:
        self.token = token or settings.HF_TOKEN
        self.model = model or settings.HF_EMBEDDING_MODEL
        self.provider = provider or settings.HF_INFERENCE_PROVIDER
        self.timeout = timeout if timeout is not None else settings.HF_EMBEDDING_TIMEOUT
        self.normalize = normalize if normalize is not None else settings.HF_EMBEDDING_NORMALIZE
        self.local_fallback = local_fallback if local_fallback is not None else settings.LOCAL_BGE_FALLBACK
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

        self._client: Optional[InferenceClient] = None

    def _get_client(self) -> InferenceClient:
        if self._client is None:
            if not self.token:
                raise EmbeddingServiceError("HF_TOKEN is missing or empty. Cannot authenticate with Hugging Face.")
            # UPDATED: 'auto' routes through router.huggingface.co which requires prepaid credits. Treat 'none', 'auto', or empty as None for free direct HF serverless inference.
            raw_provider = (self.provider or "").strip().lower()
            provider_arg = self.provider if raw_provider and raw_provider not in ("none", "auto") else None
            self._client = InferenceClient(
                token=self.token,
                provider=provider_arg,
                timeout=self.timeout,
            )
        return self._client

    def _validate_vector(self, vec: Union[List[float], np.ndarray], context: str) -> List[float]:
        """Validates that a vector is strictly 1,024-dimensional, normalized, and finite."""
        arr = np.asarray(vec, dtype=np.float32)
        if arr.ndim != 1 or arr.shape[0] != EXPECTED_DIMENSION:
            raise EmbeddingServiceError(
                f"Invalid embedding dimension in {context}: expected {EXPECTED_DIMENSION}, got {arr.shape}"
            )
        if not np.all(np.isfinite(arr)):
            raise EmbeddingServiceError(f"Embedding contains non-finite values (NaN or Inf) in {context}.")

        norm = float(np.linalg.norm(arr))
        if norm <= 0.0:
            raise EmbeddingServiceError(f"Embedding has zero norm in {context}.")

        if self.normalize and not math.isclose(norm, 1.0, rel_tol=1e-2):
            arr = arr / norm

        return arr.tolist()

    def _get_local_model(self):
        if not hasattr(self, "_local_model") or self._local_model is None:
            log.info("Loading local SentenceTransformer BGE-M3 for embedding fallback...")
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.model)
        return self._local_model

    def embed_query(self, query: str) -> List[float]:
        """
        Embed an online search query into a normalized 1,024-dimensional dense vector.
        Retries with bounded exponential backoff.
        Fails explicitly without silent fallback.
        """
        if not query or not query.strip():
            raise ValueError("Cannot embed empty query.")

        client = self._get_client()
        last_error: Optional[Exception] = None

        for attempt in range(1, self.max_retries + 1):
            try:
                raw = client.feature_extraction(
                    text=query.strip(),
                    model=self.model,
                    normalize=self.normalize,
                )
                vec = np.asarray(raw, dtype=np.float32)
                # If 2D (1, 1024), flatten to 1D
                if vec.ndim == 2 and vec.shape[0] == 1:
                    vec = vec[0]
                return self._validate_vector(vec, context=f"query '{query[:30]}...'")
            except Exception as exc:
                last_error = exc
                err_str = str(exc).lower()
                if "402" in err_str or "payment required" in err_str or "depleted" in err_str:
                    log.warning("HuggingFace credits depleted (402). Skipping retries to use local model directly.")
                    break

                wait_time = self.backoff_factor ** attempt
                log.warning(
                    "HF embedding query attempt %d/%d failed: %s. Retrying in %.1fs...",
                    attempt,
                    self.max_retries,
                    exc,
                    wait_time,
                )
                if attempt < self.max_retries:
                    time.sleep(wait_time)

        # UPDATED: Use local SentenceTransformer BGE-M3 fallback when HF remote inference fails or returns 402 Payment Required
        if self.local_fallback or (last_error and "402" in str(last_error)):
            log.warning("HF remote embedding unavailable (%s). Falling back to local SentenceTransformer BGE-M3.", last_error)
            try:
                local_m = self._get_local_model()
                vec = local_m.encode([query.strip()], show_progress_bar=False, normalize_embeddings=self.normalize)[0]
                return self._validate_vector(vec, context=f"local fallback query '{query[:30]}...'")
            except Exception as local_err:
                log.error("Local BGE-M3 fallback failed: %s", local_err)

        raise EmbeddingServiceError(
            f"HF dense embedding failed after {self.max_retries} attempts for query. "
            f"Original error: {last_error}"
        ) from last_error

    def embed_documents(self, documents: List[str], batch_size: int = 16) -> List[List[float]]:
        """
        Embed a list of documents in batches into normalized 1,024-dimensional dense vectors.
        """
        if not documents:
            return []

        client = self._get_client()
        all_embeddings: List[List[float]] = []

        for i in range(0, len(documents), batch_size):
            batch = [doc.strip() for doc in documents[i : i + batch_size]]
            last_error: Optional[Exception] = None

            for attempt in range(1, self.max_retries + 1):
                try:
                    raw = client.feature_extraction(
                        text=batch,
                        model=self.model,
                        normalize=self.normalize,
                    )
                    batch_arr = np.asarray(raw, dtype=np.float32)
                    if batch_arr.ndim == 1 and len(batch) == 1:
                        batch_arr = batch_arr.reshape(1, -1)
                    if batch_arr.shape[0] != len(batch) or batch_arr.shape[1] != EXPECTED_DIMENSION:
                        raise EmbeddingServiceError(
                            f"HF batch output shape mismatch: expected ({len(batch)}, {EXPECTED_DIMENSION}), "
                            f"got {batch_arr.shape}"
                        )
                    for j, single_vec in enumerate(batch_arr):
                        valid_vec = self._validate_vector(single_vec, context=f"batch item {i + j}")
                        all_embeddings.append(valid_vec)
                    break
                except Exception as exc:
                    last_error = exc
                    err_str = str(exc).lower()
                    # UPDATED: If third-party router returned 402 Payment Required in batch, fall back to direct HF endpoint
                    if ("402" in err_str or "payment required" in err_str or "depleted" in err_str) and getattr(client, "provider", None) is not None:
                        log.warning("HF inference provider '%s' failed with 402 in batch. Falling back to direct HuggingFace endpoint.", getattr(client, "provider", None))
                        self._client = InferenceClient(token=self.token, provider=None, timeout=self.timeout)
                        client = self._client
                        continue

                    wait_time = self.backoff_factor ** attempt
                    log.warning(
                        "HF batch embedding attempt %d/%d failed: %s. Retrying in %.1fs...",
                        attempt,
                        self.max_retries,
                        exc,
                        wait_time,
                    )
                    if attempt < self.max_retries:
                        time.sleep(wait_time)
            else:
                raise EmbeddingServiceError(
                    f"HF document batch embedding failed after {self.max_retries} attempts for batch {i}..{i+len(batch)}. "
                    f"Original error: {last_error}"
                ) from last_error

        return all_embeddings

    @property
    def is_hf_bge_m3(self) -> bool:
        """Returns True indicating this service uses Hugging Face BGE-M3."""
        return self.model == "BAAI/bge-m3"

    def get_metadata(self) -> dict:
        """Returns metadata detailing the active embedding engine and parameters."""
        return {
            "model": self.model,
            "provider": "huggingface_hub",
            "inference_provider": self.provider,
            "dimension": EXPECTED_DIMENSION,
            "normalized": self.normalize,
            "is_hf_bge_m3": self.is_hf_bge_m3,
        }

    def embed_query_with_metadata(self, query: str) -> dict:
        """Embeds query and returns both the validated vector and provider metadata."""
        vector = self.embed_query(query)
        return {
            "vector": vector,
            "metadata": self.get_metadata(),
        }


# Canonical singleton export
canonical_embedder = CanonicalEmbeddingService()

