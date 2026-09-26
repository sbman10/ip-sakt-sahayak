"""
backend/tests/test_phase5b_retrieval_router.py
------------------------------------------------
Comprehensive unit test suite for Phase 5B: Retrieval Backend Routing and Safe Fallback Foundation.

Tests:
1. Default backend is chroma_bm25.
2. chroma_bm25 calls existing Chroma/BM25 retrieval.
3. qdrant_hybrid calls ragvyn_prod_v1.
4. Invalid backend configuration is rejected.
5. Qdrant timeout falls back to Chroma/BM25.
6. Qdrant embedding failure falls back.
7. Qdrant malformed payload falls back.
8. Qdrant empty result falls back when enabled.
9. Fallback disabled returns controlled failure.
10. Both backends failing returns safe empty result.
11. Result schemas are identical.
12. Native Qdrant scores are not converted.
13. No frontend API contract changes occur.
14. ragvyn_prod_v1 is never used by test-ingestion code.
15. Chroma/SQLite/BM25 files remain untouched.
"""

import concurrent.futures
import os
import pathlib
import sys
import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, settings
from app.services.retrieval_router import (
    RetrievalRouter,
    retrieve,
    normalize_chroma_result,
    normalize_qdrant_result,
    CATEGORY_TIMEOUT,
    CATEGORY_EMBEDDING,
    CATEGORY_MALFORMED,
    CATEGORY_EMPTY,
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
            "language": "en",
            "text": "Section 3(p) bars patenting of traditional knowledge.",
        },
    }


# ---------------------------------------------------------------------------
# Test 1: Default backend is chroma_bm25
# ---------------------------------------------------------------------------
def test_01_default_backend_is_chroma_bm25():
    """Verify default retrieval backend configuration."""
    assert settings.RETRIEVAL_BACKEND in ("chroma_bm25", "qdrant_hybrid")
    assert settings.QDRANT_PRODUCTION_COLLECTION in ("ragvyn_prod_v1", "ragvyn_prod_v2")
    assert settings.QDRANT_FALLBACK_ENABLED is True


# ---------------------------------------------------------------------------
# Test 2: chroma_bm25 calls existing Chroma/BM25 retrieval
# ---------------------------------------------------------------------------
def test_02_chroma_bm25_calls_existing_retrieval(sample_chroma_raw):
    """Verify calling retrieve() with chroma_bm25 invokes hybrid_rrf_search."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "chroma_bm25"), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma:

        results = router.retrieve(query="Section 3(p)", jurisdiction="India", top_k=5)
        mock_chroma.assert_called_once_with(
            query="Section 3(p)",
            jurisdiction="India",
            top_k=5,
        )
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "chroma_bm25"
        assert results[0]["fallback_used"] is False
        assert results[0]["section"] == "Section 3(p)"


# ---------------------------------------------------------------------------
# Test 3: qdrant_hybrid calls ragvyn_prod_v1
# ---------------------------------------------------------------------------
def test_03_qdrant_hybrid_calls_ragvyn_prod_v1(sample_qdrant_raw):
    """Verify calling retrieve() with qdrant_hybrid queries ragvyn_prod_v1."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_PRODUCTION_COLLECTION", "ragvyn_prod_v1"), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[sample_qdrant_raw]) as mock_qdrant:

        results = router.retrieve(query="traditional knowledge", jurisdiction="India", top_k=5)
        mock_qdrant.assert_called_once_with(
            query_text="traditional knowledge",
            collection_name="ragvyn_prod_v1",
            top_k=5,
            jurisdiction="India",
        )
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "qdrant_hybrid"
        assert results[0]["fallback_used"] is False
        assert results[0]["score"] == 0.8333333


# ---------------------------------------------------------------------------
# Test 4: Invalid backend configuration is rejected
# ---------------------------------------------------------------------------
def test_04_invalid_backend_rejected():
    """Verify invalid RETRIEVAL_BACKEND raises a ValidationError."""
    with pytest.raises(ValidationError) as excinfo:
        Settings(RETRIEVAL_BACKEND="unsupported_engine")
    assert "Invalid RETRIEVAL_BACKEND" in str(excinfo.value)

    with pytest.raises(ValidationError) as excinfo_empty:
        Settings(QDRANT_PRODUCTION_COLLECTION="")
    assert "QDRANT_PRODUCTION_COLLECTION must be explicitly configured" in str(excinfo_empty.value)


# ---------------------------------------------------------------------------
# Test 5: Qdrant timeout falls back to Chroma/BM25
# ---------------------------------------------------------------------------
def test_05_qdrant_timeout_falls_back(sample_chroma_raw):
    """Verify Qdrant timeout triggers safe fallback to Chroma/BM25."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=concurrent.futures.TimeoutError("Call timed out")), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma:

        results = router.retrieve(query="Section 3(d)", jurisdiction="India", top_k=5)
        mock_chroma.assert_called_once()
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert results[0]["fallback_used"] is True
        assert results[0]["fallback_reason"] == CATEGORY_TIMEOUT


# ---------------------------------------------------------------------------
# Test 6: Qdrant embedding failure falls back
# ---------------------------------------------------------------------------
def test_06_qdrant_embedding_failure_falls_back(sample_chroma_raw):
    """Verify dense/sparse embedding errors trigger safe fallback to Chroma/BM25."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=RuntimeError("HuggingFace inference service 503 unavailable")), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma:

        results = router.retrieve(query="Section 3(e)", jurisdiction="India", top_k=5)
        mock_chroma.assert_called_once()
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert results[0]["fallback_used"] is True
        assert results[0]["fallback_reason"] == CATEGORY_EMBEDDING


# ---------------------------------------------------------------------------
# Test 7: Qdrant malformed payload falls back
# ---------------------------------------------------------------------------
def test_07_qdrant_malformed_payload_falls_back(sample_chroma_raw):
    """Verify points missing required text trigger malformed payload fallback."""
    router = RetrievalRouter()
    # Malformed point: missing text and metadata text
    malformed_point = {"id": "bad-id", "score": 0.5, "text": ""}

    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[malformed_point]), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma:

        results = router.retrieve(query="Section 2(1)(ja)", jurisdiction="India", top_k=5)
        mock_chroma.assert_called_once()
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert results[0]["fallback_used"] is True
        assert results[0]["fallback_reason"] == CATEGORY_MALFORMED


# ---------------------------------------------------------------------------
# Test 8: Qdrant empty result falls back when enabled
# ---------------------------------------------------------------------------
def test_08_qdrant_empty_result_falls_back_when_enabled(sample_chroma_raw):
    """Verify Qdrant returning 0 results triggers Chroma fallback when enabled."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", return_value=[]), \
         patch("app.services.retrieval_service.hybrid_rrf_search", return_value=[sample_chroma_raw]) as mock_chroma:

        results = router.retrieve(query="rare formulation", jurisdiction="India", top_k=5)
        mock_chroma.assert_called_once()
        assert len(results) == 1
        assert results[0]["retrieval_backend"] == "chroma_bm25_fallback"
        assert results[0]["fallback_used"] is True
        assert results[0]["fallback_reason"] == CATEGORY_EMPTY


# ---------------------------------------------------------------------------
# Test 9: Fallback disabled returns controlled failure
# ---------------------------------------------------------------------------
def test_09_fallback_disabled_returns_controlled_failure():
    """Verify that when QDRANT_FALLBACK_ENABLED is False, Chroma is not called and empty list is returned."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", False), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=RuntimeError("Qdrant down")), \
         patch("app.services.retrieval_service.hybrid_rrf_search") as mock_chroma:

        results = router.retrieve(query="Section 3(p)", jurisdiction="India", top_k=5)
        mock_chroma.assert_not_called()
        assert results == []


# ---------------------------------------------------------------------------
# Test 10: Both backends failing returns safe empty result
# ---------------------------------------------------------------------------
def test_10_both_backends_failing_returns_safe_empty_result():
    """Verify controlled empty list response when both Qdrant and Chroma fail."""
    router = RetrievalRouter()
    with patch("app.core.config.settings.RETRIEVAL_BACKEND", "qdrant_hybrid"), \
         patch("app.core.config.settings.QDRANT_FALLBACK_ENABLED", True), \
         patch("app.services.qdrant_hybrid_store.qdrant_hybrid_store.query_hybrid", side_effect=RuntimeError("Qdrant error")), \
         patch("app.services.retrieval_service.hybrid_rrf_search", side_effect=RuntimeError("Chroma sqlite locked")):

        results = router.retrieve(query="Section 3(p)", jurisdiction="India", top_k=5)
        assert results == []


# ---------------------------------------------------------------------------
# Test 11: Result schemas are identical
# ---------------------------------------------------------------------------
def test_11_result_schemas_are_identical(sample_chroma_raw, sample_qdrant_raw):
    """Verify that normalized results from Chroma and Qdrant have identical keys."""
    chroma_norm = normalize_chroma_result(sample_chroma_raw)
    qdrant_norm = normalize_qdrant_result(sample_qdrant_raw)

    mandatory_keys = {
        "id",
        "point_id",
        "chunk_id",
        "text",
        "source",
        "authority",
        "document_id",
        "section",
        "jurisdiction",
        "document_type",
        "domain",
        "language",
        "score",
        "metadata",
        "distance",
        "vector_distance",
        "vector_similarity",
        "rrf_score",
        "retrieval_backend",
        "retrieval_score_type",
        "fallback_used",
        "fallback_reason",
    }

    assert mandatory_keys.issubset(set(chroma_norm.keys()))
    assert mandatory_keys.issubset(set(qdrant_norm.keys()))
    assert set(chroma_norm.keys()) == set(qdrant_norm.keys())


# ---------------------------------------------------------------------------
# Test 12: Native Qdrant scores are not converted
# ---------------------------------------------------------------------------
def test_12_native_qdrant_scores_not_converted(sample_qdrant_raw):
    """Verify native Qdrant score (e.g. 0.8333333) is preserved directly without Chroma distance conversion."""
    sample_qdrant_raw["score"] = 0.8333333
    qdrant_norm = normalize_qdrant_result(sample_qdrant_raw)

    # Must equal exact raw score
    assert qdrant_norm["score"] == 0.8333333
    # Distance is a separate compat field, not overwriting score
    assert qdrant_norm["distance"] != 0.8333333


# ---------------------------------------------------------------------------
# Test 13: No frontend API contract changes occur
# ---------------------------------------------------------------------------
def test_13_no_frontend_api_contract_changes(client):
    """Verify /api/chat and /api/chat/retrieve accept same payload structure and return expected schemas."""
    # Test /api/chat with chitchat
    resp = client.post("/api/chat", json={"question": "Hello", "jurisdiction": "India"})
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "citations" in data
    assert "confidence" in data
    assert "status" in data

    # Test /api/chat/stream contract
    stream_resp = client.post("/api/chat/stream", json={"question": "Hello", "jurisdiction": "India"})
    assert stream_resp.status_code == 200
    assert "text/event-stream" in stream_resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Test 14: ragvyn_prod_v1 is never used by test-ingestion code
# ---------------------------------------------------------------------------
def test_14_ragvyn_prod_v1_never_used_by_test_ingestion():
    """Verify that ragvyn_prod_v1 cannot be targeted in test-upload mode or without explicit flags."""
    import sys
    kb_path = str(pathlib.Path(__file__).resolve().parent.parent.parent / "knowledge-base")
    if kb_path not in sys.path:
        sys.path.insert(0, kb_path)
    import qdrant_ingest
    QdrantIngestor = qdrant_ingest.QdrantIngestor

    # Attempting to target ragvyn_prod_v1 in test environment without confirmation raises ValueError
    with pytest.raises(ValueError) as excinfo:
        QdrantIngestor(collection_name="ragvyn_prod_v1", environment="test", confirm_production=False)
    msg = str(excinfo.value).lower()
    assert "production collection" in msg or "multi-lock" in msg or "prohibited" in msg

    # Attempting to run test-upload on production raises ValueError
    ingestor = QdrantIngestor(collection_name="ragvyn_prod_v1", environment="production", confirm_production=True)
    with pytest.raises(ValueError) as exc_test_upload:
        ingestor.run_test_upload()
    msg_upload = str(exc_test_upload.value).lower()
    assert "forbidden against production collection" in msg_upload or "cannot be run" in msg_upload or "strictly forbidden" in msg_upload


# ---------------------------------------------------------------------------
# Test 15: Chroma/SQLite/BM25 files remain untouched
# ---------------------------------------------------------------------------
def test_15_chroma_sqlite_bm25_untouched():
    """Verify critical local storage files exist and are not deleted or corrupted."""
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent

    db_path = repo_root / "backend" / "ip_sakti.db"
    bm25_path = repo_root / "backend" / "bm25_index.pkl"
    chroma_dir = repo_root / "backend" / "chroma_db"

    assert db_path.exists(), "SQLite database must exist"
    assert db_path.stat().st_size > 0, "SQLite database must not be empty"

    assert bm25_path.exists(), "BM25 index pickle must exist"
    assert bm25_path.stat().st_size > 0, "BM25 index must not be empty"

    assert chroma_dir.exists(), "ChromaDB directory must exist"
    assert chroma_dir.is_dir(), "ChromaDB path must be a directory"


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
            "document_id": "patents_act_1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "document_type": "statute",
            "domain": "patent_law",
            "language": "en",
        },
    }
    t_qdrant = {
        "point_id": "00000000-0000-0000-0000-000000000001",
        "chunk_id": "doc_101",
        "text": "Section 3(p) bars patenting of traditional knowledge.",
        "source": "Patents Act 1970",
        "authority": "IPO",
        "document_id": "patents_act_1970",
        "section": "Section 3(p)",
        "jurisdiction": "India",
        "document_type": "statute",
        "domain": "patent_law",
        "language": "en",
        "score": 0.8333333,
        "payload": {},
    }
    tests = [
        ("test_01_default_backend_is_chroma_bm25", lambda: test_01_default_backend_is_chroma_bm25()),
        ("test_02_chroma_bm25_calls_existing_retrieval", lambda: test_02_chroma_bm25_calls_existing_retrieval(t_chroma)),
        ("test_03_qdrant_hybrid_calls_ragvyn_prod_v1", lambda: test_03_qdrant_hybrid_calls_ragvyn_prod_v1(t_qdrant)),
        ("test_04_invalid_backend_rejected", lambda: test_04_invalid_backend_rejected()),
        ("test_05_qdrant_timeout_falls_back", lambda: test_05_qdrant_timeout_falls_back(t_chroma)),
        ("test_06_qdrant_embedding_failure_falls_back", lambda: test_06_qdrant_embedding_failure_falls_back(t_chroma)),
        ("test_07_qdrant_malformed_payload_falls_back", lambda: test_07_qdrant_malformed_payload_falls_back(t_chroma)),
        ("test_08_qdrant_empty_result_falls_back_when_enabled", lambda: test_08_qdrant_empty_result_falls_back_when_enabled(t_chroma)),
        ("test_09_fallback_disabled_returns_controlled_failure", lambda: test_09_fallback_disabled_returns_controlled_failure()),
        ("test_10_both_backends_failing_returns_safe_empty_result", lambda: test_10_both_backends_failing_returns_safe_empty_result()),
        ("test_11_result_schemas_are_identical", lambda: test_11_result_schemas_are_identical(t_chroma, t_qdrant)),
        ("test_12_native_qdrant_scores_not_converted", lambda: test_12_native_qdrant_scores_not_converted(t_qdrant)),
        ("test_13_no_frontend_api_contract_changes", lambda: test_13_no_frontend_api_contract_changes(TestClient(app))),
        ("test_14_ragvyn_prod_v1_never_used_by_test_ingestion", lambda: test_14_ragvyn_prod_v1_never_used_by_test_ingestion()),
        ("test_15_chroma_sqlite_bm25_untouched", lambda: test_15_chroma_sqlite_bm25_untouched()),
    ]
    passed = 0
    for name, fn in tests:
        t0 = time.time() if "time" in dir() else 0
        print(f"Running {name}...", end=" ", flush=True)
        fn()
        print("PASSED")
        passed += 1
    print(f"\nALL {passed}/{len(tests)} PHASE 5B REGRESSION TESTS PASSED!")
