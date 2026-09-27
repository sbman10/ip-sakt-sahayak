"""
backend/app/services/embedding_service.py
-----------------------------------------
Canonical Dense Embedding Provider for IP-SAKTI Sahayak.

Enforces a single, consistent embedding engine across:
- Corpus ingestion
- Online user-query embedding
- Uploaded-document embedding

Uses Hugging Face InferenceClient with BAAI/bge-m3 producing normalized
1,024-dimensional dense vectors via the free serverless 'hf-inference' provider.
Local BGE-M3 fallback is strictly opt-in and disabled by default (LOCAL_BGE_FALLBACK=false)
to prevent mixing disparate vector distributions in Qdrant.
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any, Dict, List, Optional, Union

import numpy as np
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError

from app.core.config import settings

log = logging.getLogger("app.services.embedding_service")

EXPECTED_DIMENSION = 1024
REQUIRED_PROVIDER = "hf-inference"
REQUIRED_MODEL = "BAAI/bge-m3"


class EmbeddingServiceError(RuntimeError):
    """Raised when canonical embedding generation fails."""
    pass


def _sanitize(text: Any, token: Optional[str] = None) -> str:
    """Sanitizes text by removing raw Hugging Face tokens to prevent leaks in logs and exceptions."""
    msg = str(text)
    active_tokens = [t for t in (token, getattr(settings, "HF_TOKEN", "")) if t and len(t) > 6]
    for t in active_tokens:
        if t in msg:
            msg = msg.replace(t, "[REDACTED_HF_TOKEN]")
    return msg


def _is_transient_error(exc: Exception) -> bool:
    """
    Determines if an error from Hugging Face is transient and safe to retry.
    Retry:
      - Timeouts (socket, httpx, TimeoutError)
      - Connection errors
      - HTTP 429 (Rate limit)
      - HTTP 500, 502, 503, 504 (Server error / Service unavailable)
    Do NOT retry:
      - HTTP 400 (Bad request)
      - HTTP 401 (Unauthorized / Invalid token)
      - HTTP 403 (Forbidden / Missing permission)
      - HTTP 402 (Payment / Credits depleted)
      - HTTP 404 (Model unavailable)
    """
    status_code = getattr(exc, "status_code", None)
    if status_code is None:
        resp = getattr(exc, "response", None)
        if resp is not None:
            status_code = getattr(resp, "status_code", None)

    if status_code is not None:
        if status_code in {400, 401, 402, 403, 404}:
            return False
        if status_code in {429, 500, 502, 503, 504}:
            return True

    err_str = str(exc).lower()
    # Explicit non-retryable keywords
    if any(k in err_str for k in ("401", "unauthorized", "invalid username or password", "403", "forbidden", "402", "payment required", "credit", "depleted", "400", "bad request", "404", "not found")):
        return False

    # Explicit retryable keywords
    if any(k in err_str for k in ("timeout", "timed out", "connect", "connection", "429", "too many requests", "503", "service unavailable", "502", "bad gateway", "504", "gateway timeout")):
        return True

    return False


class CanonicalEmbeddingService:
    """
    Thread-safe canonical dense embedding service wrapping Hugging Face InferenceClient
    using the free serverless 'hf-inference' provider.
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
        self.token = token if token is not None else settings.HF_TOKEN
        self.model = model if model is not None else settings.HF_EMBEDDING_MODEL
        self.provider = provider if provider is not None else settings.HF_INFERENCE_PROVIDER
        self.timeout = timeout if timeout is not None else settings.HF_EMBEDDING_TIMEOUT
        self.normalize = normalize if normalize is not None else settings.HF_EMBEDDING_NORMALIZE
        self.local_fallback = local_fallback if local_fallback is not None else settings.LOCAL_BGE_FALLBACK
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

        self._client: Optional[InferenceClient] = None

    def _get_client(self) -> InferenceClient:
        """
        Initializes and returns the Hugging Face InferenceClient with:
        - provider='hf-inference'
        - model='BAAI/bge-m3'
        - timeout from settings
        """
        if self._client is None:
            if not self.token or not self.token.strip():
                raise EmbeddingServiceError("HF_TOKEN is missing or empty. Cannot authenticate with Hugging Face.")

            raw_provider = (self.provider or "").strip().lower()
            if raw_provider != REQUIRED_PROVIDER:
                raise EmbeddingServiceError(
                    f"Invalid HF inference provider '{self.provider}'. Must be exactly '{REQUIRED_PROVIDER}'."
                )

            raw_model = (self.model or "").strip()
            if raw_model != REQUIRED_MODEL:
                raise EmbeddingServiceError(
                    f"Invalid embedding model '{self.model}'. Dense model must remain '{REQUIRED_MODEL}'."
                )

            self._client = InferenceClient(
                token=self.token,
                provider=REQUIRED_PROVIDER,
                timeout=self.timeout,
            )
        return self._client

    def _validate_vector(self, vec: Union[List[float], np.ndarray], context: str) -> List[float]:
        """
        Validates that a dense vector satisfies:
        - numeric values only
        - exactly 1,024 dimensions
        - all values are finite (no NaN or Inf)
        - non-zero Euclidean norm
        - normalized to unit length when normalization is enabled
        """
        try:
            arr = np.asarray(vec, dtype=np.float32)
        except (ValueError, TypeError) as conv_err:
            raise EmbeddingServiceError(
                f"Embedding contains non-numeric values in {context}: {conv_err}"
            ) from conv_err

        if arr.ndim != 1 or arr.shape[0] != EXPECTED_DIMENSION:
            raise EmbeddingServiceError(
                f"Invalid embedding dimension in {context}: expected {EXPECTED_DIMENSION}, got {arr.shape}"
            )
        if not np.all(np.isfinite(arr)):
            raise EmbeddingServiceError(f"Embedding contains non-finite values (NaN or Inf) in {context}.")

        norm = float(np.linalg.norm(arr))
        if norm <= 0.0 or math.isclose(norm, 0.0, abs_tol=1e-9):
            raise EmbeddingServiceError(f"Embedding has zero norm in {context}.")

        if self.normalize and not math.isclose(norm, 1.0, rel_tol=1e-2):
            arr = arr / norm

        return arr.tolist()

    def _can_use_local(self) -> bool:
        """Local fallback is opt-in only and strictly guarded by settings."""
        return bool(self.local_fallback and settings.LOCAL_BGE_FALLBACK)

    def _get_local_model(self):
        """Loads local SentenceTransformer BGE-M3 only when explicitly permitted."""
        if not self._can_use_local():
            raise EmbeddingServiceError(
                "Local BGE-M3 model loading is disabled (LOCAL_BGE_FALLBACK=false). "
                "Disparate vector distributions cannot be mixed in production Qdrant."
            )
        if not hasattr(self, "_local_model") or self._local_model is None:
            log.info("Loading local SentenceTransformer BGE-M3 for opt-in local embedding...")
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.model)
        return self._local_model

    def embed_query(self, query: str) -> List[float]:
        """
        Embed an online search query into a normalized 1,024-dimensional dense vector
        using Hugging Face serverless 'hf-inference'.
        """
        if not query or not isinstance(query, str) or not query.strip():
            raise ValueError("Cannot embed empty query.")

        # If explicitly configured for local embedding only
        if getattr(settings, "EMBEDDING_PROVIDER", "").strip().lower() == "local":
            if not self._can_use_local():
                raise EmbeddingServiceError("EMBEDDING_PROVIDER is 'local' but LOCAL_BGE_FALLBACK is false.")
            local_m = self._get_local_model()
            vec = local_m.encode([query.strip()], show_progress_bar=False, normalize_embeddings=self.normalize)[0]
            return self._validate_vector(vec, context=f"local query '{query[:30]}...'")

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
                if vec.ndim == 2 and vec.shape[0] == 1:
                    vec = vec[0]
                return self._validate_vector(vec, context=f"query '{query[:30]}...'")
            except Exception as exc:
                last_error = exc
                sanitized_msg = _sanitize(exc, self.token)

                if not _is_transient_error(exc):
                    log.error("Non-retryable error during HF query embedding: %s", sanitized_msg)
                    break

                wait_time = self.backoff_factor ** attempt
                log.warning(
                    "HF embedding query attempt %d/%d failed: %s. Retrying in %.1fs...",
                    attempt,
                    self.max_retries,
                    sanitized_msg,
                    wait_time,
                )
                if attempt < self.max_retries:
                    time.sleep(wait_time)

        # Fallback only if strictly opt-in enabled
        if self._can_use_local():
            try:
                log.warning("Falling back to local SentenceTransformer BGE-M3 (opt-in enabled).")
                local_m = self._get_local_model()
                vec = local_m.encode([query.strip()], show_progress_bar=False, normalize_embeddings=self.normalize)[0]
                return self._validate_vector(vec, context=f"local fallback query '{query[:30]}...'")
            except Exception as local_err:
                log.error("Local BGE-M3 fallback failed: %s", _sanitize(local_err, self.token))

        raise EmbeddingServiceError(
            f"HF dense embedding failed after {self.max_retries} attempts for query. "
            f"Original error: {_sanitize(last_error, self.token)}"
        ) from last_error

    def embed_documents(self, documents: List[str], batch_size: int = 16) -> List[List[float]]:
        """
        Embed a list of documents in batches into normalized 1,024-dimensional dense vectors
        using Hugging Face serverless 'hf-inference'.
        """
        if not documents:
            return []

        if getattr(settings, "EMBEDDING_PROVIDER", "").strip().lower() == "local":
            if not self._can_use_local():
                raise EmbeddingServiceError("EMBEDDING_PROVIDER is 'local' but LOCAL_BGE_FALLBACK is false.")
            local_m = self._get_local_model()
            all_embeddings: List[List[float]] = []
            for i in range(0, len(documents), batch_size):
                batch = [doc.strip() for doc in documents[i : i + batch_size]]
                raw_vecs = local_m.encode(batch, show_progress_bar=False, normalize_embeddings=self.normalize)
                for j, single_vec in enumerate(raw_vecs):
                    all_embeddings.append(self._validate_vector(single_vec, context=f"local batch item {i + j}"))
            return all_embeddings

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
                    sanitized_msg = _sanitize(exc, self.token)

                    if not _is_transient_error(exc):
                        log.error("Non-retryable error during HF batch embedding: %s", sanitized_msg)
                        break

                    wait_time = self.backoff_factor ** attempt
                    log.warning(
                        "HF batch embedding attempt %d/%d failed: %s. Retrying in %.1fs...",
                        attempt,
                        self.max_retries,
                        sanitized_msg,
                        wait_time,
                    )
                    if attempt < self.max_retries:
                        time.sleep(wait_time)
            else:
                if self._can_use_local():
                    try:
                        log.warning("Falling back to local SentenceTransformer BGE-M3 for batch %d..%d", i, i + len(batch))
                        local_m = self._get_local_model()
                        raw_vecs = local_m.encode(batch, show_progress_bar=False, normalize_embeddings=self.normalize)
                        for j, single_vec in enumerate(raw_vecs):
                            all_embeddings.append(self._validate_vector(single_vec, context=f"local batch item {i + j}"))
                        continue
                    except Exception as local_err:
                        log.error("Local BGE-M3 fallback failed for batch: %s", _sanitize(local_err, self.token))

                raise EmbeddingServiceError(
                    f"HF document batch embedding failed after {self.max_retries} attempts for batch {i}..{i+len(batch)}. "
                    f"Original error: {_sanitize(last_error, self.token)}"
                ) from last_error

        return all_embeddings

    def preflight_check(self) -> Dict[str, Any]:
        """
        Safe, non-destructive embedding preflight check.
        - Sends 1 small test sentence to Hugging Face serverless inference.
        - Confirms status ok, 1,024 dimensions, numeric, finite, non-zero norm.
        - Does NOT write to Qdrant or ingest documents.
        - Redacts tokens from all error messages.
        - Reports authentication (401), permission (403), quota (402),
          model_unavailable (404), rate_limited (429), or transient errors separately.
        """
        test_sentence = "IP-SAKTI Sahayak statutory patent verification test sentence."
        try:
            client = self._get_client()
            raw = client.feature_extraction(
                text=test_sentence,
                model=self.model,
                normalize=self.normalize,
            )
            vec = np.asarray(raw, dtype=np.float32)
            if vec.ndim == 2 and vec.shape[0] == 1:
                vec = vec[0]
            valid_vec = self._validate_vector(vec, context="preflight test sentence")
            return {
                "status": "ok",
                "provider": REQUIRED_PROVIDER,
                "model": self.model,
                "dimension": len(valid_vec),
                "normalized": self.normalize,
                "message": "Hugging Face serverless BGE-M3 embedding preflight check passed successfully.",
            }
        except Exception as exc:
            sanitized_msg = _sanitize(exc, self.token)
            status_code = getattr(exc, "status_code", None)
            if status_code is None:
                resp = getattr(exc, "response", None)
                if resp is not None:
                    status_code = getattr(resp, "status_code", None)

            err_lower = sanitized_msg.lower()
            if status_code == 401 or "401" in err_lower or "unauthorized" in err_lower or "invalid username or password" in err_lower:
                error_type = "authentication"
                reason = "Invalid or expired Hugging Face token (HTTP 401)."
            elif status_code == 403 or "403" in err_lower or "forbidden" in err_lower:
                error_type = "permission"
                reason = "Hugging Face token lacks required permissions (HTTP 403)."
            elif status_code == 402 or "402" in err_lower or "payment required" in err_lower or "depleted" in err_lower:
                error_type = "quota"
                reason = "Hugging Face serverless inference quota or credits exhausted (HTTP 402)."
            elif status_code == 404 or "404" in err_lower or "not found" in err_lower:
                error_type = "model_unavailable"
                reason = f"Model '{self.model}' is not available on serverless {REQUIRED_PROVIDER} (HTTP 404)."
            elif status_code == 429 or "429" in err_lower or "too many requests" in err_lower:
                error_type = "rate_limited"
                reason = "Hugging Face serverless rate limit exceeded (HTTP 429)."
            else:
                error_type = "transient"
                reason = sanitized_msg

            log.error("Embedding preflight check failed [%s]: %s", error_type, reason)
            return {
                "status": "error",
                "error_type": error_type,
                "reason": reason,
                "provider": REQUIRED_PROVIDER,
                "model": self.model,
            }

    @property
    def is_hf_bge_m3(self) -> bool:
        """Returns True indicating this service uses Hugging Face BGE-M3."""
        return self.model == REQUIRED_MODEL

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
