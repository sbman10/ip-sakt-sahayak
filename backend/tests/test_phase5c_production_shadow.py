"""
backend/tests/test_phase5c_production_shadow.py
------------------------------------------------
Phase 5C Failure-Containment and Safety Unit Tests for Production Qdrant Shadow Retrieval.

Tests:
1. test_01_shadow_disabled_zero_qdrant_calls
2. test_02_production_shadow_targets_ragvyn_prod_v1
3. test_03_test_collections_strictly_rejected
4. test_04_preflight_verifies_collection_points_and_status
5. test_05_qdrant_timeout_zero_impact_on_user
6. test_06_qdrant_exception_isolated
7. test_07_circuit_breaker_trips_and_recovers
8. test_08_sampling_rate_limits_execution
9. test_09_retrieval_score_type_differentiated
10. test_10_privacy_and_immutability_guarantees
"""

from __future__ import annotations

import copy
import hashlib
import json
import pathlib
import sys
import time
import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings
from app.services.shadow_retrieval import (
    CircuitBreaker,
    PROHIBITED_COLLECTIONS,
    _VERIFIED_SHADOW_COLLECTIONS,
    compare_retrieval_results,
    log_and_record_shadow_comparison,
    shadow_circuit_breaker,
    verify_shadow_collection_preflight,
)

SAMPLE_CHROMA_RESULTS: List[Dict[str, Any]] = [
    {
        "id": "chunk_001",
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "rrf_score": 0.85,
        "vector_distance": 0.15,
        "bm25_score": 14.2,
        "metadata": {
            "chunk_id": "chunk_001",
            "document_id": "patents_act_1970",
            "source": "Patents Act 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
        },
    },
    {
        "id": "chunk_002",
        "text": "Section 3(d) requires significant enhancement of known efficacy.",
        "source": "Patents Act 1970",
        "section": "Section 3(d)",
        "jurisdiction": "India",
        "rrf_score": 0.72,
        "vector_distance": 0.28,
        "bm25_score": 10.5,
        "metadata": {
            "chunk_id": "chunk_002",
            "document_id": "patents_act_1970",
            "source": "Patents Act 1970",
            "section": "Section 3(d)",
            "jurisdiction": "India",
        },
    },
]

SAMPLE_QDRANT_RESULTS: List[Dict[str, Any]] = [
    {
        "point_id": "00000000-0000-0000-0000-000000000001",
        "chunk_id": "chunk_001",
        "document_id": "patents_act_1970",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "document_type": "statute",
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "score": 0.8333333,
        "payload": {
            "chunk_id": "chunk_001",
            "document_id": "patents_act_1970",
            "source": "Patents Act 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "authority": "Indian Patent Office",
            "document_type": "statute",
            "domain": "patent_law",
            "language": "en",
            "text": "Section 3(p) bars patenting of traditional knowledge.",
        },
    }
]


# ---------------------------------------------------------------------------
# Test 1: Shadow disabled results in zero Qdrant calls
# ---------------------------------------------------------------------------
def test_01_shadow_disabled_zero_qdrant_calls():
    """Verify when QDRANT_SHADOW_RETRIEVAL is False, zero Qdrant calls are made."""
    with patch("app.services.shadow_retrieval.settings") as mock_settings:
        mock_settings.QDRANT_SHADOW_RETRIEVAL = False
        mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"

        with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
            result = log_and_record_shadow_comparison(
                query="What is Section 3(p)?",
                jurisdiction="India",
                top_k=5,
                chroma_results=SAMPLE_CHROMA_RESULTS,
            )
            mock_qdrant.query_hybrid.assert_not_called()
            mock_qdrant.get_client.assert_not_called()
            assert result is None


# ---------------------------------------------------------------------------
# Test 2: Production shadow targets ragvyn_prod_v1
# ---------------------------------------------------------------------------
def test_02_production_shadow_targets_ragvyn_prod_v1():
    """Verify shadow retrieval queries ragvyn_prod_v1 by default in Phase 5C."""
    _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

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
                    query="Section 3(p) traditional knowledge",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                )

                assert mock_qdrant.query_hybrid.called
                call_kwargs = mock_qdrant.query_hybrid.call_args
                collection_called = call_kwargs.kwargs.get("collection_name") or call_kwargs.args[1]
                assert collection_called == "ragvyn_prod_v1"
                assert result is not None
                assert result["counts"]["qdrant_candidates"] == 1


# ---------------------------------------------------------------------------
# Test 3: Test collections are strictly rejected
# ---------------------------------------------------------------------------
def test_03_test_collections_strictly_rejected():
    """Verify that targeting ragvyn_hybrid_test or ragvyn_hybrid_test_v2 is strictly blocked."""
    # 1. Config level rejection
    with pytest.raises((ValidationError, ValueError)):
        Settings(QDRANT_SHADOW_COLLECTION="ragvyn_hybrid_test_v2")

    with pytest.raises((ValidationError, ValueError)):
        Settings(QDRANT_SHADOW_COLLECTION="ragvyn_hybrid_test")

    # 2. Service level rejection
    assert not verify_shadow_collection_preflight("ragvyn_hybrid_test_v2")
    assert not verify_shadow_collection_preflight("ragvyn_hybrid_test")

    with patch("app.services.shadow_retrieval.settings") as mock_settings:
        mock_settings.QDRANT_SHADOW_RETRIEVAL = True
        mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_hybrid_test_v2"

        with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
            result = log_and_record_shadow_comparison(
                query="Section 3(p)",
                jurisdiction="India",
                top_k=5,
                chroma_results=SAMPLE_CHROMA_RESULTS,
                collection_name="ragvyn_hybrid_test_v2",
            )
            mock_qdrant.query_hybrid.assert_not_called()
            assert result is None


# ---------------------------------------------------------------------------
# Test 4: Preflight verifies point count and green status
# ---------------------------------------------------------------------------
def test_04_preflight_verifies_collection_points_and_status():
    """Verify preflight rejects collections that are not green or lack exactly 753 points."""
    _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

    with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
        mock_qdrant.verify_collection_schema.return_value = True

        # Case A: status is yellow/red
        mock_col_bad_status = MagicMock(status="yellow", points_count=753)
        mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_bad_status
        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")
        assert not verify_shadow_collection_preflight("ragvyn_prod_v1")

        # Case B: point count mismatch (e.g. 750 instead of 753)
        mock_col_bad_points = MagicMock(status="green", points_count=750)
        mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_bad_points
        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")
        assert not verify_shadow_collection_preflight("ragvyn_prod_v1")

        # Case C: perfectly healthy (status="green", points_count=753)
        mock_col_healthy = MagicMock(status="green", points_count=753)
        mock_qdrant.get_client.return_value.get_collection.return_value = mock_col_healthy
        _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")
        assert verify_shadow_collection_preflight("ragvyn_prod_v1")


# ---------------------------------------------------------------------------
# Test 5: Qdrant timeout causes zero impact on user request
# ---------------------------------------------------------------------------
def test_05_qdrant_timeout_zero_impact_on_user():
    """Verify Qdrant timeout in shadow thread fails gracefully without raising."""
    _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

    with patch("app.services.shadow_retrieval.settings") as mock_settings:
        mock_settings.QDRANT_SHADOW_RETRIEVAL = True
        mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
        mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
        mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 0.01
        mock_settings.QDRANT_SHADOW_MAX_FAILURES = 5

        with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
            mock_qdrant.verify_collection_schema.return_value = True
            mock_col = MagicMock(status="green", points_count=753)
            mock_qdrant.get_client.return_value.get_collection.return_value = mock_col

            def slow_query(*args, **kwargs):
                time.sleep(1.0)
                return SAMPLE_QDRANT_RESULTS

            mock_qdrant.query_hybrid.side_effect = slow_query
            shadow_circuit_breaker.reset()

            with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                result = log_and_record_shadow_comparison(
                    query="Section 3(p) traditional knowledge",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                )
                assert result is not None
                assert result["timing_ms"]["timeout_status"] is True
                assert result["counts"]["qdrant_candidates"] == 0
                assert shadow_circuit_breaker.consecutive_failures == 1


# ---------------------------------------------------------------------------
# Test 6: Qdrant exception is isolated
# ---------------------------------------------------------------------------
def test_06_qdrant_exception_isolated():
    """Verify unhandled exceptions in Qdrant do not escape shadow function."""
    _VERIFIED_SHADOW_COLLECTIONS.discard("ragvyn_prod_v1")

    with patch("app.services.shadow_retrieval.settings") as mock_settings:
        mock_settings.QDRANT_SHADOW_RETRIEVAL = True
        mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
        mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 1.0
        mock_settings.QDRANT_SHADOW_TIMEOUT_SECONDS = 5.0
        mock_settings.QDRANT_SHADOW_MAX_FAILURES = 5

        with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
            mock_qdrant.verify_collection_schema.return_value = True
            mock_col = MagicMock(status="green", points_count=753)
            mock_qdrant.get_client.return_value.get_collection.return_value = mock_col
            mock_qdrant.query_hybrid.side_effect = RuntimeError("Qdrant internal grpc abort")

            shadow_circuit_breaker.reset()

            with patch("app.services.shadow_retrieval.record_shadow_report", return_value=None):
                result = log_and_record_shadow_comparison(
                    query="Section 3(p) traditional knowledge",
                    jurisdiction="India",
                    top_k=5,
                    chroma_results=SAMPLE_CHROMA_RESULTS,
                )
                assert result is not None
                assert result["counts"]["qdrant_candidates"] == 0
                assert shadow_circuit_breaker.consecutive_failures == 1


# ---------------------------------------------------------------------------
# Test 7: Circuit breaker trips and recovers
# ---------------------------------------------------------------------------
def test_07_circuit_breaker_trips_and_recovers():
    """Verify circuit breaker trips to OPEN after max failures and recovers on success."""
    cb = CircuitBreaker(max_failures=3, cooldown_seconds=0.1)

    # Initial state
    assert cb.can_execute() is True
    assert cb.state == "CLOSED"

    # Failures 1 and 2
    cb.record_failure("error 1")
    assert cb.state == "CLOSED"
    cb.record_failure("error 2")
    assert cb.state == "CLOSED"

    # Failure 3 -> OPEN
    cb.record_failure("error 3")
    assert cb.state == "OPEN"
    assert cb.can_execute() is False

    # Wait for cooldown to expire
    time.sleep(0.15)
    assert cb.can_execute() is True
    assert cb.state == "HALF_OPEN"

    # Success resets to CLOSED
    cb.record_success()
    assert cb.state == "CLOSED"
    assert cb.consecutive_failures == 0


# ---------------------------------------------------------------------------
# Test 8: Sampling rate limits execution
# ---------------------------------------------------------------------------
def test_08_sampling_rate_limits_execution():
    """Verify sampling rate of 0.0 skips all executions."""
    with patch("app.services.shadow_retrieval.settings") as mock_settings:
        mock_settings.QDRANT_SHADOW_RETRIEVAL = True
        mock_settings.QDRANT_SHADOW_COLLECTION = "ragvyn_prod_v1"
        mock_settings.QDRANT_SHADOW_SAMPLE_RATE = 0.0  # zero sample rate

        with patch("app.services.shadow_retrieval.qdrant_hybrid_store") as mock_qdrant:
            result = log_and_record_shadow_comparison(
                query="Sample query",
                jurisdiction="India",
                top_k=5,
                chroma_results=SAMPLE_CHROMA_RESULTS,
            )
            mock_qdrant.query_hybrid.assert_not_called()
            assert result is None


# ---------------------------------------------------------------------------
# Test 9: Retrieval score type differentiated and native score preserved
# ---------------------------------------------------------------------------
def test_09_retrieval_score_type_differentiated():
    """Verify comparison record includes retrieval_score_type for both backends."""
    comparison = compare_retrieval_results(
        query="Section 3(p) traditional knowledge",
        jurisdiction_requested="India",
        top_k=5,
        chroma_results=SAMPLE_CHROMA_RESULTS,
        qdrant_results=SAMPLE_QDRANT_RESULTS,
    )

    chroma_top = comparison["chroma_top_k"]
    qdrant_top = comparison["qdrant_top_k"]

    assert len(chroma_top) == 2
    assert chroma_top[0]["retrieval_score_type"] == "chroma_rrf"
    assert chroma_top[1]["retrieval_score_type"] == "chroma_rrf"

    assert len(qdrant_top) == 1
    assert qdrant_top[0]["retrieval_score_type"] == "qdrant_rrf"
    # Native score preserved
    assert qdrant_top[0]["qdrant_score"] == 0.8333333


# ---------------------------------------------------------------------------
# Test 10: Privacy and immutability guarantees
# ---------------------------------------------------------------------------
def test_10_privacy_and_immutability_guarantees():
    """Verify no plaintext query or secrets in reports, and Chroma inputs remain unchanged."""
    raw_query = "Sensitive user patent question with secret text"
    chroma_copy = copy.deepcopy(SAMPLE_CHROMA_RESULTS)

    comparison = compare_retrieval_results(
        query=raw_query,
        jurisdiction_requested="India",
        top_k=5,
        chroma_results=SAMPLE_CHROMA_RESULTS,
        qdrant_results=SAMPLE_QDRANT_RESULTS,
    )

    # 1. Chroma results untouched
    assert SAMPLE_CHROMA_RESULTS == chroma_copy

    # 2. Raw query not stored, only SHA-256 hash
    json_str = json.dumps(comparison)
    assert raw_query not in json_str
    expected_hash = hashlib.sha256(raw_query.strip().encode("utf-8")).hexdigest()[:16]
    assert comparison["query_hash"] == expected_hash

    # 3. No secrets leaked
    for secret in ["api_key", "password", "secret", "bearer", "hf_token"]:
        assert secret not in json_str.lower()


if __name__ == "__main__":
    tests = [
        test_01_shadow_disabled_zero_qdrant_calls,
        test_02_production_shadow_targets_ragvyn_prod_v1,
        test_03_test_collections_strictly_rejected,
        test_04_preflight_verifies_collection_points_and_status,
        test_05_qdrant_timeout_zero_impact_on_user,
        test_06_qdrant_exception_isolated,
        test_07_circuit_breaker_trips_and_recovers,
        test_08_sampling_rate_limits_execution,
        test_09_retrieval_score_type_differentiated,
        test_10_privacy_and_immutability_guarantees,
    ]
    passed = 0
    for t in tests:
        t0 = time.time()
        print(f"Running {t.__name__}...", end=" ", flush=True)
        t()
        print(f"PASSED in {time.time()-t0:.3f}s")
        passed += 1
    print(f"\nALL {passed}/{len(tests)} TESTS PASSED!")
