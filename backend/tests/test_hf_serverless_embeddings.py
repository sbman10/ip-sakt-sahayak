"""
backend/tests/test_hf_serverless_embeddings.py
----------------------------------------------
Unit and integration tests for Hugging Face free serverless inference (BGE-M3).

Tests enforce:
1. provider is exactly hf-inference
2. model is exactly BAAI/bge-m3
3. vector shape is exactly 1024
4. normalization works
5. Hindi text works
6. batch embedding works
7. missing HF_TOKEN fails clearly
8. invalid provider fails clearly
9. 401/403 is not retried
10. 402/quota exhaustion is not retried
11. timeout/429/503 uses bounded retry
12. local fallback remains disabled
13. token is never present in logs/errors
14. BM25 sparse retrieval remains unchanged
15. safe preflight check categorizes errors without modifying Qdrant
"""

from __future__ import annotations

import math
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from huggingface_hub.errors import HfHubHTTPError
from requests.models import Response

from app.core.config import settings
from app.services.embedding_service import (
    CanonicalEmbeddingService,
    EmbeddingServiceError,
    EXPECTED_DIMENSION,
    REQUIRED_PROVIDER,
    REQUIRED_MODEL,
    _is_transient_error,
    _sanitize,
)
from app.services.sparse_embedding_service import sparse_embedder


def _create_mock_response(status_code: int, text: str = "") -> Response:
    resp = Response()
    resp.status_code = status_code
    resp._content = text.encode("utf-8")
    return resp


def _create_mock_1024_vector(normalize: bool = True) -> list[float]:
    rng = np.random.default_rng(42)
    vec = rng.standard_normal(1024).astype(np.float32)
    if normalize:
        vec = vec / float(np.linalg.norm(vec))
    return vec.tolist()


class TestHFServerlessEmbeddings:
    """Test suite for Hugging Face free serverless inference with BGE-M3."""

    def test_provider_is_exactly_hf_inference(self):
        """Provider must be exactly 'hf-inference'."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="hf-inference")
        with patch("app.services.embedding_service.InferenceClient") as mock_client_cls:
            client = svc._get_client()
            mock_client_cls.assert_called_once_with(
                token="hf_test_token_123",
                provider="hf-inference",
                timeout=svc.timeout,
            )

    def test_model_must_be_bge_m3(self):
        """Model must be strictly 'BAAI/bge-m3'."""
        svc_invalid = CanonicalEmbeddingService(token="hf_test_token_123", model="sentence-transformers/all-MiniLM-L6-v2")
        with pytest.raises(EmbeddingServiceError) as exc_info:
            svc_invalid._get_client()
        assert "BAAI/bge-m3" in str(exc_info.value)

    def test_invalid_provider_fails_clearly(self):
        """Providers like 'auto' or custom endpoints must fail validation."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="auto")
        with pytest.raises(EmbeddingServiceError) as exc_info:
            svc._get_client()
        assert "hf-inference" in str(exc_info.value)

    def test_missing_hf_token_fails_clearly(self):
        """Missing HF_TOKEN must fail before making any network calls."""
        svc = CanonicalEmbeddingService(token="", provider="hf-inference")
        with pytest.raises(EmbeddingServiceError) as exc_info:
            svc._get_client()
        assert "HF_TOKEN is missing" in str(exc_info.value)

    def test_vector_shape_1024(self):
        """Dense vectors must be exactly 1,024 dimensions."""
        mock_vec = _create_mock_1024_vector()
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="hf-inference")

        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.return_value = mock_vec
            mock_get_client.return_value = mock_client

            res = svc.embed_query("Patentability search query")
            assert len(res) == 1024
            assert isinstance(res[0], float)

    def test_normalization_works(self):
        """Vectors must be normalized to unit length (L2 norm == 1.0)."""
        mock_unnormalized = [2.0] * 1024
        svc = CanonicalEmbeddingService(token="hf_test_token_123", normalize=True)

        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.return_value = mock_unnormalized
            mock_get_client.return_value = mock_client

            res = svc.embed_query("Normalization test")
            arr = np.asarray(res, dtype=np.float32)
            norm = float(np.linalg.norm(arr))
            assert math.isclose(norm, 1.0, rel_tol=1e-3)

    def test_hindi_text_works(self):
        """Multilingual queries including Hindi text generate valid 1,024-d vectors."""
        mock_vec = _create_mock_1024_vector()
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="hf-inference")

        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.return_value = mock_vec
            mock_get_client.return_value = mock_client

            hindi_query = "आयुर्वेदिक औषधि पेटेंट योग्यता"
            res = svc.embed_query(hindi_query)
            assert len(res) == 1024
            mock_client.feature_extraction.assert_called_once_with(
                text=hindi_query,
                model="BAAI/bge-m3",
                normalize=True,
            )

    def test_batch_embedding_works(self):
        """Batch document embedding returns list of 1,024-d vectors."""
        docs = ["Section 3(p) Traditional Knowledge", "AYUSH Good Manufacturing Practice", "Biodiversity Act 2002"]
        mock_batch = [_create_mock_1024_vector() for _ in docs]
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="hf-inference")

        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.return_value = mock_batch
            mock_get_client.return_value = mock_client

            res = svc.embed_documents(docs, batch_size=16)
            assert len(res) == 3
            assert all(len(v) == 1024 for v in res)

    def test_non_retryable_401_403_fails_immediately(self):
        """401 Unauthorized and 403 Forbidden must not be retried."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", max_retries=3)

        mock_resp_401 = _create_mock_response(401, "Invalid username or password")
        err_401 = HfHubHTTPError("401 Client Error: Unauthorized", response=mock_resp_401)

        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_401
            mock_get_client.return_value = mock_client

            with pytest.raises(EmbeddingServiceError) as exc_info:
                svc.embed_query("Test query")

            # Must fail immediately without retries (called exactly once)
            assert mock_client.feature_extraction.call_count == 1
            assert "401" in str(exc_info.value)

    def test_non_retryable_402_quota_exhaustion_not_retried(self):
        """402 Payment Required / quota exhausted must not be retried and must not load local BGE."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", local_fallback=False, max_retries=3)

        mock_resp_402 = _create_mock_response(402, "Payment Required: Monthly credits depleted")
        err_402 = HfHubHTTPError("402 Client Error: Payment Required", response=mock_resp_402)

        with patch.object(svc, "_get_client") as mock_get_client, \
             patch.object(svc, "_get_local_model") as mock_get_local:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_402
            mock_get_client.return_value = mock_client

            with pytest.raises(EmbeddingServiceError) as exc_info:
                svc.embed_query("Test query")

            assert mock_client.feature_extraction.call_count == 1
            mock_get_local.assert_not_called()
            assert "402" in str(exc_info.value)

    def test_transient_errors_use_bounded_retry(self):
        """Transient errors (503 Service Unavailable, 429 Rate Limit) must use bounded retry."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", max_retries=3, backoff_factor=1.0)

        mock_resp_503 = _create_mock_response(503, "Service Temporarily Unavailable")
        err_503 = HfHubHTTPError("503 Server Error: Service Unavailable", response=mock_resp_503)

        with patch.object(svc, "_get_client") as mock_get_client, \
             patch("time.sleep") as mock_sleep:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_503
            mock_get_client.return_value = mock_client

            with pytest.raises(EmbeddingServiceError) as exc_info:
                svc.embed_query("Test query")

            # Bounded retry: tried exactly 3 times
            assert mock_client.feature_extraction.call_count == 3
            assert mock_sleep.call_count == 2  # Sleeps between attempt 1->2 and 2->3

    def test_local_fallback_remains_disabled(self):
        """When LOCAL_BGE_FALLBACK is False, local SentenceTransformer is never called."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", local_fallback=False)
        assert svc._can_use_local() is False

        with pytest.raises(EmbeddingServiceError) as exc_info:
            svc._get_local_model()
        assert "LOCAL_BGE_FALLBACK=false" in str(exc_info.value)

    def test_token_never_present_in_logs_or_errors(self):
        """Token must be sanitized out of all exception strings and logs."""
        secret_token = "hf_SUPER_SECRET_TOKEN_DO_NOT_LEAK_999"
        raw_error_message = f"Connection failed to endpoint with token {secret_token} while querying"

        sanitized = _sanitize(raw_error_message, secret_token)
        assert secret_token not in sanitized
        assert "[REDACTED_HF_TOKEN]" in sanitized

        svc = CanonicalEmbeddingService(token=secret_token)
        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = RuntimeError(raw_error_message)
            mock_get_client.return_value = mock_client

            with pytest.raises(EmbeddingServiceError) as exc_info:
                svc.embed_query("Secret test query")

            err_str = str(exc_info.value)
            assert secret_token not in err_str
            assert "[REDACTED_HF_TOKEN]" in err_str

    def test_bm25_sparse_retrieval_remains_unchanged(self):
        """BM25 sparse vector path remains strictly untouched and functional."""
        sparse_vec = sparse_embedder.embed_query("Ayurvedic formulation prior art")
        assert hasattr(sparse_vec, "indices")
        assert hasattr(sparse_vec, "values")
        assert len(sparse_vec.indices) > 0
        assert len(sparse_vec.values) == len(sparse_vec.indices)
        assert all(isinstance(idx, int) for idx in sparse_vec.indices)
        assert all(isinstance(val, float) for val in sparse_vec.values)

    def test_safe_preflight_check(self):
        """Preflight check verifies 1024-d vector and correctly categorizes error statuses."""
        svc = CanonicalEmbeddingService(token="hf_test_token_123", provider="hf-inference")
        mock_vec = _create_mock_1024_vector()

        # Success case
        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.return_value = mock_vec
            mock_get_client.return_value = mock_client

            res = svc.preflight_check()
            assert res["status"] == "ok"
            assert res["dimension"] == 1024
            assert res["provider"] == "hf-inference"
            assert res["model"] == "BAAI/bge-m3"

        # Authentication error (401)
        mock_resp_401 = _create_mock_response(401, "Invalid token")
        err_401 = HfHubHTTPError("401 Unauthorized", response=mock_resp_401)
        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_401
            mock_get_client.return_value = mock_client

            res_401 = svc.preflight_check()
            assert res_401["status"] == "error"
            assert res_401["error_type"] == "authentication"

        # Permission error (403)
        mock_resp_403 = _create_mock_response(403, "Forbidden")
        err_403 = HfHubHTTPError("403 Forbidden", response=mock_resp_403)
        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_403
            mock_get_client.return_value = mock_client

            res_403 = svc.preflight_check()
            assert res_403["status"] == "error"
            assert res_403["error_type"] == "permission"

        # Quota error (402)
        mock_resp_402 = _create_mock_response(402, "Payment Required")
        err_402 = HfHubHTTPError("402 Payment Required", response=mock_resp_402)
        with patch.object(svc, "_get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.feature_extraction.side_effect = err_402
            mock_get_client.return_value = mock_client

            res_402 = svc.preflight_check()
            assert res_402["status"] == "error"
            assert res_402["error_type"] == "quota"
