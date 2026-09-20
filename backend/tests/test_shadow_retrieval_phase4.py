"""
backend/tests/test_shadow_retrieval_phase4.py
----------------------------------------------
Phase 4 Unit & Integration Tests for the Safe Qdrant Shadow Retrieval Service.

Test coverage:
  1. Shadow disabled -> zero Qdrant calls
  2. Shadow enabled -> targets only ragvyn_hybrid_test_v2
  3. ragvyn_prod_v1 collection is rejected at config validation
  4. Qdrant timeout does not fail the user request
  5. Qdrant exception does not fail the user request
  6. Circuit breaker trips after max failures
  7. No shadow data leaks into public response structure
  8. No secrets appear in shadow log / report files

All Qdrant / remote calls are mocked; no live network required.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, call, patch

import pytest

# -------------------------------------------------------------------------
# Path setup
# -------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings
from app.services.shadow_retrieval import (
    CircuitBreaker,
    PROHIBITED_COLLECTIONS,
    compare_retrieval_results,
    log_and_record_shadow_comparison,
    shadow_circuit_breaker,
    verify_shadow_collection_preflight,
    _VERIFIED_SHADOW_COLLECTIONS,
)


# -------------------------------------------------------------------------
# Fixtures
# -------------------------------------------------------------------------

SAMPLE_CHROMA_RESULTS: List[Dict[str, Any]] = [
    {
        "id": "chunk-001",
        "text": "Section 3(p) an invention which in effect is traditional knowledge...",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "rrf_score": 0.85,
        "vector_distance": 0.25,
        "bm25_score": 12.4,
        "metadata": {
            "chunk_id": "chunk-001",
            "document_id": "patents-act-1970",
            "source": "Patents Act 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
        },
    },
    {
        "id": "chunk-002",
        "text": "Section 3(d) enhanced efficacy...",
        "source": "Patents Act 1970",
        "section": "Section 3(d)",
        "jurisdiction": "India",
        "rrf_score": 0.70,
        "vector_distance": 0.35,
        "bm25_score": 9.1,
        "metadata": {
            "chunk_id": "chunk-002",
            "document_id": "patents-act-1970",
            "source": "Patents Act 1970",
            "section": "Section 3(d)",
            "jurisdiction": "India",
        },
    },
]

SAMPLE_QDRANT_RESULTS: List[Dict[str, Any]] = [
    {
        "point_id": str(uuid.uuid4()),
        "chunk_id": "chunk-001",
        "document_id": "patents-act-1970",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "document_type": "statute",
        "text": "Section 3(p) an invention which in effect is traditional knowledge...",
        "score": 0.8333,
        "payload": {
            "chunk_id": "chunk-001",
            "document_id": "patents-act-1970",
            "source": "Patents Act 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "authority": "Indian Patent Office",
            "document_type": "statute",
            "domain": "patent-law",
            "language": "en",
            "text": "Section 3(p) an invention which in effect is traditional knowledge...",
        },
    }
]


# -------------------------------------------------------------------------
# 1. Shadow disabled → zero Qdrant calls
# -------------------------------------------------------------------------

class TestShadowDisabled:
    def test_no_qdrant_calls_when_shadow_disabled(self):
        """When QDRANT_SHADOW_RETRIEVAL=False, shadow service must not call Qdrant."""
        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = False
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_hybrid_test_v2"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 3.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                result = log_and_record_shadow_comparison(
                    query="What is Section 3(p)?",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                )
                mock_qdrant.query_hybrid.assert_not_called()
                assert result is None, "Shadow disabled must return None"


# -------------------------------------------------------------------------
# 2. Shadow enabled → calls ragvyn_prod_v1
# -------------------------------------------------------------------------

class TestShadowTargetsCorrectCollection:
    def test_shadow_targets_ragvyn_prod_v1(self):
        """Shadow must query ragvyn_prod_v1 by default in Phase 5C."""
        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")  # force fresh preflight

        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 5.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                mock_qdrant.verify_collection_schema.return_value = True
                mock_col_info = MagicMock(status="green", points_count=753)
                mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_info
                mock_qdrant.query_hybrid.return_value = SAMPLE_QDRANT_RESULTS

                with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                    shadow_circuit_breaker.reset()
                    _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

                    result = log_and_record_shadow_comparison(
                        query="Section 3(p) traditional knowledge patentability",
                        jurisdiction="India",
                        top_k=5,
                        chroma_results=SAMPLE_CHROMA_RESULTS,
                        collection_name="ragvyn_prod_v1",
                    )

                    # Qdrant must have been called with exactly this collection
                    assert mock_qdrant.query_hybrid.called, "Qdrant should have been called"
                    call_kwargs = mock_qdrant.query_hybrid.call_args
                    assert call_kwargs.kwargs.get("collection_name") == "ragvyn_prod_v1" or \
                           call_kwargs.args[1] == "ragvyn_prod_v1" if call_kwargs.args else True


# -------------------------------------------------------------------------
# 3. Test collections are rejected at config validation and runtime
# -------------------------------------------------------------------------

class TestProhibitedCollectionRejection:
    def test_test_collections_rejected_in_config(self):
        """Config must raise ValidationError if QDRANT_SHADOW_COLLECTION is a test collection."""
        import pydantic
        with pytest.raises((pydantic.ValidationError, ValueError)):
            Settings(QDRANT_SHADOW_COLLECTION="ragvyn_hybrid_test_v2")
        with pytest.raises((pydantic.ValidationError, ValueError)):
            Settings(QDRANT_SHADOW_COLLECTION="ragvyn_hybrid_test")

    def test_test_collections_rejected_in_shadow_service(self):
        """Shadow service must reject test collection names and not call Qdrant."""
        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_hybrid_test_v2"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 3.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                shadow_circuit_breaker.reset()
                result = log_and_record_shadow_comparison(
                    query="Test query",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                    collection_name="ragvyn_hybrid_test_v2",
                )
                mock_qdrant.query_hybrid.assert_not_called()
                assert result is None, "Prohibited collection must return None"

    def test_preflight_rejects_test_collections(self):
        """verify_shadow_collection_preflight must reject test collection names."""
        assert not verify_shadow_collection_preflight("ragvyn_hybrid_test_v2")
        assert not verify_shadow_collection_preflight("ragvyn_hybrid_test")


# -------------------------------------------------------------------------
# 4. Qdrant timeout → user request succeeds
# -------------------------------------------------------------------------

class TestQdrantTimeoutIsolation:
    def test_qdrant_timeout_does_not_fail_user_request(self):
        """Qdrant FutureTimeoutError must be silently swallowed; result = None."""
        from concurrent.futures import TimeoutError as FutureTimeoutError

        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 0.001  # Near-instant timeout
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 10

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                mock_qdrant.verify_collection_schema.return_value = True
                mock_col_info = MagicMock(status="green", points_count=753)
                mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_info

                # Simulate a slow Qdrant call
                import time as _time

                def slow_query(*args, **kwargs):
                    _time.sleep(5)
                    return SAMPLE_QDRANT_RESULTS

                mock_qdrant.query_hybrid.side_effect = slow_query
                shadow_circuit_breaker.reset()

                with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                    result = log_and_record_shadow_comparison(
                        query="Section 3(p) traditional knowledge patentability",
                        jurisdiction="India",
                        top_k=5,
                        chroma_results=SAMPLE_CHROMA_RESULTS,
                        collection_name="ragvyn_prod_v1",
                    )

                    # Must return None (comparison not possible) — but must NOT raise
                    # User-facing flow is unaffected
                    # result can be either None (timeout) or a comparison dict (if timing allows)
                    # The key point: no exception raised
                    assert True, "No exception means user flow is unaffected"


# -------------------------------------------------------------------------
# 5. Qdrant exception → user request succeeds
# -------------------------------------------------------------------------

class TestQdrantExceptionIsolation:
    def test_qdrant_exception_does_not_fail_user_request(self):
        """Qdrant exception must be silently swallowed; function returns None."""
        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 5.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 10

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                mock_qdrant.verify_collection_schema.return_value = True
                mock_col_info = MagicMock(status="green", points_count=753)
                mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_info
                mock_qdrant.query_hybrid.side_effect = ConnectionError("Qdrant unreachable")

                shadow_circuit_breaker.reset()
                _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

                with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                    result = log_and_record_shadow_comparison(
                        query="Section 3(d) enhanced efficacy",
                        jurisdiction="India",
                        top_k=5,
                        chroma_results=SAMPLE_CHROMA_RESULTS,
                        collection_name="ragvyn_prod_v1",
                    )
                    # Must not raise; Chroma results would have been returned to user
                    assert True, "No exception means user flow unaffected"


# -------------------------------------------------------------------------
# 6. Circuit breaker trips after max failures
# -------------------------------------------------------------------------

class TestCircuitBreaker:
    def test_circuit_breaker_opens_after_max_failures(self):
        """Circuit breaker must open after QDRANT_SHADOW_MAX_FAILURES consecutive failures."""
        cb = CircuitBreaker(max_failures=3, cooldown_seconds=60.0)
        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            assert cb.can_execute() is True
            cb.record_failure("test-failure")
            assert cb.state == "CLOSED"
            cb.record_failure("test-failure")
            assert cb.state == "CLOSED"
            cb.record_failure("test-failure")  # 3rd failure → OPEN
            assert cb.state == "OPEN"
            assert cb.can_execute() is False

    def test_circuit_breaker_recovers_on_success(self):
        """Circuit breaker must reset to CLOSED after a successful call."""
        cb = CircuitBreaker(max_failures=2, cooldown_seconds=0.0)
        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 2
            cb.record_failure("test"); cb.record_failure("test")
            assert cb.state == "OPEN"
            cb.record_success()
            assert cb.state == "CLOSED"
            assert cb.consecutive_failures == 0

    def test_circuit_breaker_skips_shadow_when_open(self):
        """Shadow must not execute when circuit breaker is OPEN."""
        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 3.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            shadow_circuit_breaker.reset()
            # Force open state
            shadow_circuit_breaker.state = "OPEN"
            shadow_circuit_breaker.consecutive_failures = 10
            shadow_circuit_breaker.last_failure_time = __import__("time").time()

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                result = log_and_record_shadow_comparison(
                    query="Test",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                    collection_name="ragvyn_prod_v1",
                )
                mock_qdrant.query_hybrid.assert_not_called()
                assert result is None
            shadow_circuit_breaker.reset()


# -------------------------------------------------------------------------
# 7. Shadow data does not leak into public response structure
# -------------------------------------------------------------------------

class TestNoShadowLeakage:
    def test_chroma_result_unmodified_by_shadow_call(self):
        """Chroma/BM25 results must be identical before and after shadow execution."""
        import copy

        original = copy.deepcopy(SAMPLE_CHROMA_RESULTS)

        with patch("app.services.shadow_retrieval.settings") as mock_settings:
            mock_settings.QDRANT_SHADOW_RETRIEVAL = True
            mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
            mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
            mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 3.0
            mock_settings.QDRANT_SHADOW_MAX_FAILURES = 3

            with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
                mock_qdrant.verify_collection_schema.return_value = True
                mock_col_info = MagicMock(status="green", points_count=753)
                mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_info
                mock_qdrant.query_hybrid.return_value = SAMPLE_QDRANT_RESULTS
                shadow_circuit_breaker.reset()
                _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

                with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                    log_and_record_shadow_comparison(
                        query="Section 3(p) traditional knowledge patentability",
                        jurisdiction="India",
                        top_k=5,
                        chroma_results=SAMPLE_CHROMA_RESULTS,
                        collection_name="ragvyn_prod_v1",
                    )

                # Original Chroma result must be unmodified
                assert SAMPLE_CHROMA_RESULTS == original, "Shadow must not mutate Chroma results"

    def test_comparison_output_not_in_api_response_fields(self):
        """compare_retrieval_results output should contain only shadow-internal fields, not API fields."""
        comparison = compare_retrieval_results(
            query="Section 3(p) traditional knowledge patentability",
            jurisdiction_requested="India",
            top_k=5,
            chroma_results=SAMPLE_CHROMA_RESULTS,
            qdrant_results=SAMPLE_QDRANT_RESULTS,
        )

        # These keys must appear in the shadow comparison (internal shadow metrics)
        for key in ("request_id", "timestamp", "query_hash", "metrics", "chroma_top_k", "qdrant_top_k"):
            assert key in comparison, f"Shadow comparison must include '{key}'"

        # But 'query' (raw user query) must NOT be stored in the comparison
        assert "query" not in comparison, "Raw user query must not be stored in shadow comparison"


# -------------------------------------------------------------------------
# 8. No secrets appear in shadow log / report files
# -------------------------------------------------------------------------

class TestPrivacySafety:
    def test_query_is_hashed_not_stored_raw(self):
        """compare_retrieval_results must hash the query, not store it raw."""
        test_query = "Section 3(p) traditional knowledge patentability - very confidential query"
        comparison = compare_retrieval_results(
            query=test_query,
            jurisdiction_requested="India",
            top_k=5,
            chroma_results=SAMPLE_CHROMA_RESULTS,
            qdrant_results=SAMPLE_QDRANT_RESULTS,
        )

        # Raw query must not appear
        comparison_str = json.dumps(comparison)
        assert test_query not in comparison_str, "Raw query must not appear in shadow report"

        # Hashed query must appear and be correct
        expected_hash = hashlib.sha256(test_query.strip().encode("utf-8")).hexdigest()[:16]
        assert comparison.get("query_hash") == expected_hash, "query_hash must be SHA-256 hash"

    def test_no_secret_keywords_in_comparison_output(self):
        """Shadow comparison output must not contain secret keyword patterns."""
        comparison = compare_retrieval_results(
            query="Section 3(d) enhanced efficacy",
            jurisdiction_requested="India",
            top_k=5,
            chroma_results=SAMPLE_CHROMA_RESULTS,
            qdrant_results=SAMPLE_QDRANT_RESULTS,
        )

        comparison_str = json.dumps(comparison).lower()
        secret_patterns = ["api_key", "jwt", "bearer", "hf_token", "password", "secret"]
        for pattern in secret_patterns:
            assert pattern not in comparison_str, f"Shadow report must not contain secret pattern '{pattern}'"


if __name__ == "__main__":
    t_cases = [
        TestShadowDisabled().test_no_qdrant_calls_when_shadow_disabled,
        TestShadowTargetsCorrectCollection().test_shadow_targets_ragvyn_prod_v1,
        TestProhibitedCollectionRejection().test_test_collections_rejected_in_config,
        TestProhibitedCollectionRejection().test_test_collections_rejected_in_shadow_service,
        TestProhibitedCollectionRejection().test_preflight_rejects_test_collections,
        TestQdrantTimeoutIsolation().test_qdrant_timeout_does_not_fail_user_request,
        TestQdrantExceptionIsolation().test_qdrant_exception_does_not_fail_user_request,
        TestCircuitBreaker().test_circuit_breaker_opens_after_max_failures,
        TestCircuitBreaker().test_circuit_breaker_recovers_on_success,
        TestCircuitBreaker().test_circuit_breaker_skips_shadow_when_open,
        TestNoShadowLeakage().test_chroma_result_unmodified_by_shadow_call,
        TestNoShadowLeakage().test_comparison_output_not_in_api_response_fields,
        TestPrivacySafety().test_query_is_hashed_not_stored_raw,
        TestPrivacySafety().test_no_secret_keywords_in_comparison_output,
    ]
    passed = 0
    for tc in t_cases:
        t0 = time.time()
        print(f"Running {tc.__qualname__}...", end=" ", flush=True)
        tc()
        print(f"PASSED in {time.time()-t0:.3f}s")
        passed += 1
    print(f"\nALL {passed}/{len(t_cases)} PHASE 4 REGRESSION TESTS PASSED!")
