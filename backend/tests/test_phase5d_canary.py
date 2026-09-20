"""
backend/tests/test_phase5d_canary.py
------------------------------------
Comprehensive unit test suite for Phase 5D: Controlled Canary Rollout for Qdrant Retrieval.

Tests:
1. test_01_zero_percent_sends_all_to_chroma
2. test_02_canary_disabled_sends_all_to_chroma
3. test_03_small_percentage_routes_deterministic_subset
4. test_04_hundred_percent_routes_to_qdrant
5. test_05_qdrant_timeout_falls_back_to_chroma
6. test_06_qdrant_exception_falls_back_to_chroma
7. test_07_citation_validation_failure_falls_back
8. test_08_filter_mismatch_falls_back
9. test_09_both_backends_failing_safe_empty_result
10. test_10_rollback_configuration_immediately_disables_qdrant
11. test_11_qdrant_native_scores_not_converted
12. test_12_no_frontend_api_contract_changes
13. test_13_no_secrets_or_raw_queries_in_telemetry
14. test_14_chroma_sqlite_bm25_untouched
"""

import concurrent.futures
import hashlib
import os
import pathlib
import sys
import pytest
from unittest.mock import MagicMock, patch

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.retrieval_router import (
    RetrievalRouter,
    retrieve,
    should_route_to_qdrant,
    validate_qdrant_evidence,
    canary_metrics_tracker,
    normalize_chroma_result,
    normalize_qdrant_result,
    CATEGORY_TIMEOUT,
    CATEGORY_EMBEDDING,
    CATEGORY_MALFORMED,
    CATEGORY_EMPTY,
    CATEGORY_FILTER_MISMATCH,
    CATEGORY_CITATION_FAILURE,
    CATEGORY_UNEXPECTED,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_chroma_raw():
    return {
        "id": "doc_101",
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "distance": 0.18,
        "vector_distance": 0.18,
        "vector_similarity": 0.82,
        "vector_rank": 1,
        "bm25_rank": 1,
        "bm25_score": 14.5,
        "rrf_score": 0.0328,
        "metadata": {
            "chunk_id": "chunk_patents_001",
            "document_id": "patents-act-1970",
            "authority": "IPO",
            "document_type": "statute",
            "domain": "patents",
            "language": "en",
        },
    }


@pytest.fixture
def sample_qdrant_raw():
    return {
        "point_id": "uuid-001-abc",
        "id": "uuid-001-abc",
        "score": 0.8333333,
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "chunk_id": "chunk_patents_001",
        "document_id": "patents-act-1970",
        "source": "Patents Act 1970",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "patents",
        "section": "Section 3(p)",
        "language": "en",
        "publication_date": "2005-01-01",
        "priority_date": "1970-01-01",
        "metadata": {
            "chunk_id": "chunk_patents_001",
            "document_id": "patents-act-1970",
            "authority": "IPO",
            "document_type": "statute",
            "domain": "patents",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "language": "en",
            "text": "Section 3(p) bars patenting of traditional knowledge.",
        },
    }


# ---------------------------------------------------------------------------
# Test 1: Zero percent traffic sends 100% of requests to Chroma
# ---------------------------------------------------------------------------
def test_01_zero_percent_sends_all_to_chroma(sample_chroma_raw):
    """Verify that when QDRANT_TRAFFIC_PERCENT=0, all queries route to Chroma even if canary enabled."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 0), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid") as mock_qdrant:

        for i in range(10):
            res = router.retrieve(query=f"Query test {i}", session_id=f"sess_{i}")
            assert len(res) == 1
            assert res[0]["retrieval_backend"] == "chroma_bm25"
            assert res[0]["fallback_used"] is False

        assert mock_chroma.call_count == 10
        assert mock_qdrant.call_count == 0


# ---------------------------------------------------------------------------
# Test 2: Canary disabled sends 100% of requests to Chroma
# ---------------------------------------------------------------------------
def test_02_canary_disabled_sends_all_to_chroma(sample_chroma_raw):
    """Verify that when QDRANT_CANARY_ENABLED=False, all traffic stays on Chroma regardless of percent."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", False), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 50), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid") as mock_qdrant:

        for i in range(10):
            res = router.retrieve(query=f"Query {i}", session_id=f"sess_{i}")
            assert len(res) == 1
            assert res[0]["retrieval_backend"] == "chroma_bm25"

        assert mock_chroma.call_count == 10
        assert mock_qdrant.call_count == 0


# ---------------------------------------------------------------------------
# Test 3: Small percentage routes a deterministic, stable subset
# ---------------------------------------------------------------------------
def test_03_small_percentage_routes_deterministic_subset(sample_chroma_raw, sample_qdrant_raw):
    """Verify 5% traffic routes a deterministic subset and stays consistent across repeated calls."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 5), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[sample_qdrant_raw]):

        qdrant_routed_sessions = []
        chroma_routed_sessions = []

        # Evaluate 100 distinct sessions
        for i in range(100):
            sess_id = f"user_session_test_{i}"
            res1 = router.retrieve(query="What is Section 3(d)?", session_id=sess_id)
            backend1 = res1[0]["retrieval_backend"]

            # Verify idempotence: same session ID routes identically on repeated call
            res2 = router.retrieve(query="What is Section 3(d)?", session_id=sess_id)
            backend2 = res2[0]["retrieval_backend"]
            assert backend1 == backend2, f"Routing for session {sess_id} was non-deterministic!"

            if backend1 == "qdrant_hybrid":
                qdrant_routed_sessions.append(sess_id)
            else:
                chroma_routed_sessions.append(sess_id)

        # In a uniform SHA-256 distribution modulo 100, 5% traffic should select between 1 and 12 sessions
        assert len(qdrant_routed_sessions) > 0, "5% traffic selected 0 sessions!"
        assert len(qdrant_routed_sessions) < 20, f"5% traffic selected unexpectedly many: {len(qdrant_routed_sessions)}"
        assert len(chroma_routed_sessions) > 80, f"Chroma received too few: {len(chroma_routed_sessions)}"


# ---------------------------------------------------------------------------
# Test 4: 100% traffic routes to Qdrant
# ---------------------------------------------------------------------------
def test_04_hundred_percent_routes_to_qdrant(sample_qdrant_raw):
    """Verify that when QDRANT_TRAFFIC_PERCENT=100 and canary enabled, all queries route to Qdrant."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch("app.services.retrieval_service.hybrid_rrf_search") as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[sample_qdrant_raw]) as mock_qdrant:

        for i in range(5):
            res = router.retrieve(query=f"Query {i}", session_id=f"sess_{i}")
            assert len(res) == 1
            assert res[0]["retrieval_backend"] == "qdrant_hybrid"
            assert res[0]["fallback_used"] is False

        assert mock_qdrant.call_count == 5
        assert mock_chroma.call_count == 0


# ---------------------------------------------------------------------------
# Test 5: Qdrant timeout triggers safe Chroma fallback
# ---------------------------------------------------------------------------
def test_05_qdrant_timeout_falls_back_to_chroma(sample_chroma_raw):
    """Verify Qdrant timeout in canary mode safely falls back to Chroma/BM25."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch.object(settings, "QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=concurrent.futures.TimeoutError("Qdrant timed out")):

        res = router.retrieve(query="Section 3(p) traditional knowledge", jurisdiction="India")
        assert len(res) == 1
        assert res[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert res[0]["fallback_used"] is True
        assert res[0]["fallback_reason"] == CATEGORY_TIMEOUT
        mock_chroma.assert_called_once()


# ---------------------------------------------------------------------------
# Test 6: Unhandled Qdrant exception triggers safe Chroma fallback
# ---------------------------------------------------------------------------
def test_06_qdrant_exception_falls_back_to_chroma(sample_chroma_raw):
    """Verify unhandled Qdrant connection/runtime error safely falls back to Chroma/BM25."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch.object(settings, "QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=RuntimeError("Connection refused by Qdrant cloud")):

        res = router.retrieve(query="Section 3(p) traditional knowledge", jurisdiction="India")
        assert len(res) == 1
        assert res[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert res[0]["fallback_used"] is True
        assert res[0]["fallback_reason"] == "qdrant_connection_error"
        mock_chroma.assert_called_once()


# ---------------------------------------------------------------------------
# Test 7: Citation validation failure triggers safe fallback
# ---------------------------------------------------------------------------
def test_07_citation_validation_failure_falls_back(sample_chroma_raw):
    """Verify points missing required citation metadata (source, authority, doc_id) fail validation and trigger fallback."""
    router = RetrievalRouter()
    # Malformed citation candidate: missing authority and empty source
    invalid_qdrant_pt = {
        "point_id": "uuid-bad-citation",
        "id": "uuid-bad-citation",
        "score": 0.9,
        "text": "Valid text but missing mandatory statutory citation metadata",
        "source": "",
        "authority": "",
        "document_id": "",
        "section": "Section 3",
        "jurisdiction": "India",
        "payload": {
            "text": "Valid text but missing mandatory statutory citation metadata",
            "source": "",
            "authority": "",
            "document_id": "",
        },
    }

    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch.object(settings, "QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[invalid_qdrant_pt]):

        res = router.retrieve(query="Section 3", jurisdiction="India")
        assert len(res) == 1
        assert res[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert res[0]["fallback_used"] is True
        assert res[0]["fallback_reason"] == CATEGORY_CITATION_FAILURE
        mock_chroma.assert_called_once()


# ---------------------------------------------------------------------------
# Test 8: Filter mismatch triggers safe fallback
# ---------------------------------------------------------------------------
def test_08_filter_mismatch_falls_back(sample_chroma_raw):
    """Verify candidate returning mismatched jurisdiction (leakage) triggers fallback."""
    router = RetrievalRouter()
    # Point with International jurisdiction when India was requested
    leaked_pt = {
        "point_id": "uuid-leak-001",
        "id": "uuid-leak-001",
        "score": 0.85,
        "text": "PCT Rule 4 covers international filing requirements.",
        "source": "PCT Regulations",
        "authority": "WIPO",
        "document_id": "pct-rules",
        "section": "Rule 4",
        "jurisdiction": "International",  # Filter mismatch!
        "payload": {
            "text": "PCT Rule 4 covers international filing requirements.",
            "source": "PCT Regulations",
            "authority": "WIPO",
            "document_id": "pct-rules",
            "section": "Rule 4",
            "jurisdiction": "International",
        },
    }

    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch.object(settings, "QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[leaked_pt]):

        res = router.retrieve(query="Section 3(p)", jurisdiction="India")
        assert len(res) == 1
        assert res[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert res[0]["fallback_used"] is True
        assert res[0]["fallback_reason"] == CATEGORY_FILTER_MISMATCH
        mock_chroma.assert_called_once()


# ---------------------------------------------------------------------------
# Test 9: Both backends failing returns safe empty result
# ---------------------------------------------------------------------------
def test_09_both_backends_failing_safe_empty_result():
    """Verify dual failure gracefully returns empty list [] without crashing or 500 error."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch.object(settings, "QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=RuntimeError("Qdrant failure")), \
         patch("app.services.retrieval_service.hybrid_rrf_search", side_effect=RuntimeError("Chroma failure")):

        res = router.retrieve(query="Section 3(p)", jurisdiction="India")
        assert res == []


# ---------------------------------------------------------------------------
# Test 10: Rollback configuration immediately disables Qdrant
# ---------------------------------------------------------------------------
def test_10_rollback_configuration_immediately_disables_qdrant(sample_chroma_raw):
    """Verify setting QDRANT_CANARY_ENABLED=False instantly rolls back all traffic to Chroma without code change."""
    router = RetrievalRouter()
    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 50), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma, \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid") as mock_qdrant:

        # Rollback active: canary disabled
        with patch.object(settings, "QDRANT_CANARY_ENABLED", False):
            for i in range(10):
                res = router.retrieve(query=f"Query {i}", session_id=f"sess_{i}")
                assert res[0]["retrieval_backend"] == "chroma_bm25"

        assert mock_chroma.call_count == 10
        assert mock_qdrant.call_count == 0


# ---------------------------------------------------------------------------
# Test 11: Qdrant native scores are not converted
# ---------------------------------------------------------------------------
def test_11_qdrant_native_scores_not_converted(sample_qdrant_raw):
    """Verify native Qdrant RRF score (0.8333333) is strictly preserved with retrieval_score_type='qdrant_rrf'."""
    router = RetrievalRouter()
    sample_qdrant_raw["score"] = 0.8333333

    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[sample_qdrant_raw]):

        res = router.retrieve(query="Section 3(p)", jurisdiction="India")
        assert len(res) == 1
        item = res[0]
        assert item["score"] == 0.8333333
        assert item["retrieval_score_type"] == "qdrant_rrf"
        assert item["retrieval_backend"] == "qdrant_hybrid"
        # Distance compatibility field is present without overriding native score
        assert item["distance"] != 0.8333333
        assert 0.0 <= item["distance"] <= 1.0


# ---------------------------------------------------------------------------
# Test 12: No frontend API contract changes
# ---------------------------------------------------------------------------
def test_12_no_frontend_api_contract_changes(client):
    """Verify /api/chat and /api/chat/stream response structures remain fully intact."""
    # Test /api/chat
    resp = client.post("/api/chat", json={"question": "Hello", "jurisdiction": "India"})
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "citations" in data
    assert "confidence" in data
    assert "status" in data

    # Test /api/chat/stream
    stream_resp = client.post("/api/chat/stream", json={"question": "Hello", "jurisdiction": "India"})
    assert stream_resp.status_code == 200
    assert "text/event-stream" in stream_resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Test 13: No secrets or raw queries in telemetry
# ---------------------------------------------------------------------------
def test_13_no_secrets_or_raw_queries_in_telemetry(sample_chroma_raw, sample_qdrant_raw):
    """Verify canary telemetry tracks aggregate counts and latencies without logging raw queries or tokens."""
    canary_metrics_tracker.reset()

    router = RetrievalRouter()
    sensitive_query = "Confidential Patent Search for Formula X-999 secret_token_abc"

    with patch.object(settings, "RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch.object(settings, "QDRANT_CANARY_ENABLED", True), \
         patch.object(settings, "QDRANT_TRAFFIC_PERCENT", 100), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[sample_qdrant_raw]):

        router.retrieve(query=sensitive_query, jurisdiction="India")

    metrics = canary_metrics_tracker.get_metrics()
    assert metrics["total_requests"] >= 1
    assert metrics["qdrant_served"] >= 1

    # Ensure metrics dictionary contains zero secrets, raw queries, or PII
    metrics_str = str(metrics)
    assert "Confidential" not in metrics_str
    assert "Formula X-999" not in metrics_str
    assert "secret_token_abc" not in metrics_str


# ---------------------------------------------------------------------------
# Test 14: Chroma/SQLite/BM25 files remain untouched
# ---------------------------------------------------------------------------
def test_14_chroma_sqlite_bm25_untouched():
    """Verify legacy ChromaDB, SQLite database, and BM25 index files exist and have non-zero size."""
    chroma_dir = pathlib.Path(settings.CHROMA_DB_DIR)
    assert chroma_dir.exists(), f"Chroma directory missing: {chroma_dir}"

    bm25_path = pathlib.Path(settings.BM25_INDEX_PATH)
    assert bm25_path.exists(), f"BM25 index missing: {bm25_path}"
    assert bm25_path.stat().st_size > 0, "BM25 index file is empty!"

    db_path = BACKEND_DIR / "ip_sakti.db"
    assert db_path.exists(), f"SQLite DB missing: {db_path}"
    assert db_path.stat().st_size > 0, "SQLite DB is empty!"


# ---------------------------------------------------------------------------
# Standalone execution entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    t_chroma = {
        "id": "doc_101",
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "source": "Patents Act 1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "distance": 0.18,
        "vector_distance": 0.18,
        "vector_similarity": 0.82,
        "rrf_score": 0.82,
        "metadata": {
            "chunk_id": "chunk_patents_001",
            "document_id": "patents-act-1970",
            "authority": "IPO",
            "document_type": "statute",
            "domain": "patents",
            "language": "en",
        },
    }
    t_qdrant = {
        "point_id": "uuid-001-abc",
        "id": "uuid-001-abc",
        "score": 0.8333333,
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "chunk_id": "chunk_patents_001",
        "document_id": "patents-act-1970",
        "source": "Patents Act 1970",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "patents",
        "section": "Section 3(p)",
        "language": "en",
        "payload": {
            "chunk_id": "chunk_patents_001",
            "document_id": "patents-act-1970",
            "authority": "IPO",
            "document_type": "statute",
            "domain": "patents",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "language": "en",
            "text": "Section 3(p) bars patenting of traditional knowledge.",
        },
    }
    tests = [
        ("test_01_zero_percent_sends_all_to_chroma", lambda: test_01_zero_percent_sends_all_to_chroma(t_chroma)),
        ("test_02_canary_disabled_sends_all_to_chroma", lambda: test_02_canary_disabled_sends_all_to_chroma(t_chroma)),
        ("test_03_small_percentage_routes_deterministic_subset", lambda: test_03_small_percentage_routes_deterministic_subset(t_chroma, t_qdrant)),
        ("test_04_hundred_percent_routes_to_qdrant", lambda: test_04_hundred_percent_routes_to_qdrant(t_qdrant)),
        ("test_05_qdrant_timeout_falls_back_to_chroma", lambda: test_05_qdrant_timeout_falls_back_to_chroma(t_chroma)),
        ("test_06_qdrant_exception_falls_back_to_chroma", lambda: test_06_qdrant_exception_falls_back_to_chroma(t_chroma)),
        ("test_07_citation_validation_failure_falls_back", lambda: test_07_citation_validation_failure_falls_back(t_chroma)),
        ("test_08_filter_mismatch_falls_back", lambda: test_08_filter_mismatch_falls_back(t_chroma)),
        ("test_09_both_backends_failing_safe_empty_result", lambda: test_09_both_backends_failing_safe_empty_result()),
        ("test_10_rollback_configuration_immediately_disables_qdrant", lambda: test_10_rollback_configuration_immediately_disables_qdrant(t_chroma)),
        ("test_11_qdrant_native_scores_not_converted", lambda: test_11_qdrant_native_scores_not_converted(t_qdrant)),
        ("test_12_no_frontend_api_contract_changes", lambda: test_12_no_frontend_api_contract_changes(TestClient(app))),
        ("test_13_no_secrets_or_raw_queries_in_telemetry", lambda: test_13_no_secrets_or_raw_queries_in_telemetry(t_chroma, t_qdrant)),
        ("test_14_chroma_sqlite_bm25_untouched", lambda: test_14_chroma_sqlite_bm25_untouched()),
    ]
    passed = 0
    for name, fn in tests:
        print(f"Running {name}...", end=" ", flush=True)
        fn()
        print("PASSED")
        passed += 1
    print(f"\nALL {passed}/{len(tests)} PHASE 5D CANARY TESTS PASSED!")
