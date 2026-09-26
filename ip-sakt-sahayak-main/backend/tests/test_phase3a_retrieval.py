"""
backend/tests/test_phase3a_retrieval.py
---------------------------------------
Phase 3A Retrieval Quality & Filter Leakage Test Suite.

Verifies:
- Filter builder correctness (jurisdiction, document_type, section, etc.)
- Strict filter isolation (no cross-jurisdiction leakage)
- Evaluation dataset completeness (18 queries across 5 categories)
- Out-of-scope query safety handling
- Protection against targeting 'ragvyn_prod_v1'
- Optional live smoke tests against 'ragvyn_hybrid_test'
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest
from qdrant_client import models as qmodels

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.services.qdrant_hybrid_store import (
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
    qdrant_hybrid_store,
)


@pytest.fixture
def eval_queries() -> List[Dict[str, Any]]:
    queries_file = BACKEND_DIR / "tests" / "data" / "phase3a_eval_queries.json"
    assert queries_file.exists(), f"Evaluation queries file missing: {queries_file}"
    with open(queries_file, "r", encoding="utf-8") as f:
        return json.load(f)


def test_eval_queries_dataset_structure(eval_queries):
    """Verifies that all 18 deterministic evaluation queries are present and well-structured."""
    assert len(eval_queries) == 18, f"Expected 18 queries, got {len(eval_queries)}"

    categories = set(q["category"] for q in eval_queries)
    assert len(categories) == 5, f"Expected 5 categories, got {len(categories)}"
    assert "A. Indian patent law" in categories
    assert "B. AYUSH and traditional knowledge" in categories
    assert "C. Biodiversity and ABS" in categories
    assert "D. International law" in categories
    assert "E. Out-of-scope queries" in categories

    # Verify query IDs Q01 to Q18
    query_ids = [q["id"] for q in eval_queries]
    expected_ids = [f"Q{i:02d}" for i in range(1, 19)]
    assert query_ids == expected_ids

    # Verify out-of-scope queries
    oos_queries = [q for q in eval_queries if q["is_out_of_scope"]]
    assert len(oos_queries) == 3


def test_build_filter_jurisdiction():
    """Verify build_filter constructs exact MatchValue for jurisdiction."""
    filt_india = qdrant_hybrid_store.build_filter(jurisdiction="India")
    assert filt_india is not None
    assert len(filt_india.must) == 1
    cond = filt_india.must[0]
    assert cond.key == "jurisdiction"
    assert cond.match.value == "India"

    filt_intl = qdrant_hybrid_store.build_filter(jurisdiction="International")
    assert filt_intl is not None
    assert filt_intl.must[0].match.value == "International"

    # 'Both' or empty should produce no condition
    assert qdrant_hybrid_store.build_filter(jurisdiction="Both") is None
    assert qdrant_hybrid_store.build_filter(jurisdiction="") is None


def test_build_filter_document_type_and_section():
    """Verify composite filters with document_type and section."""
    filt = qdrant_hybrid_store.build_filter(
        jurisdiction="India",
        document_type="statute",
        section="Section 3(p)",
    )
    assert filt is not None
    assert len(filt.must) == 3

    keys = {cond.key: cond.match.value for cond in filt.must}
    assert keys["jurisdiction"] == "India"
    assert keys["document_type"] == "statute"
    assert keys["section"] == "Section 3(p)"


def test_prohibited_collection_safety():
    """Verify that targeting 'ragvyn_prod_v1' is blocked in ingestion pipeline."""
    WORKSPACE_ROOT = BACKEND_DIR.parent
    KB_DIR = WORKSPACE_ROOT / "knowledge-base"
    if str(KB_DIR) not in sys.path:
        sys.path.insert(0, str(KB_DIR))

    from qdrant_ingest import QdrantIngestor

    with pytest.raises(ValueError, match="prohibited"):
        QdrantIngestor(collection_name="ragvyn_prod_v1")


def test_query_hybrid_mocked_filter_isolation():
    """Verify query_hybrid applies filter correctly to prefetch clauses."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_point = MagicMock()
    mock_point.id = "mock-uuid"
    mock_point.score = 0.033
    mock_point.payload = {
        "text": "Section 3(p) details",
        "chunk_id": "chunk_001",
        "document_id": "in_patents_act_1970",
        "jurisdiction": "India",
        "authority": "IP India",
        "document_type": "statute",
        "section": "Section 3(p)",
        "source": "Patents Act 1970",
    }
    mock_response.points = [mock_point]
    mock_client.query_points.return_value = mock_response

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client), \
         patch.object(qdrant_hybrid_store, "verify_collection_schema"):

        results = qdrant_hybrid_store.query_hybrid(
            query_text="What does Section 3(p) say?",
            collection_name="ragvyn_hybrid_test",
            jurisdiction="India",
            top_k=5,
        )

        assert len(results) == 1
        assert results[0]["jurisdiction"] == "India"
        assert results[0]["score"] == 0.033

        # Verify query_points was called with prefetch containing the filter
        mock_client.query_points.assert_called_once()
        _, kwargs = mock_client.query_points.call_args
        prefetch = kwargs.get("prefetch")
        assert len(prefetch) == 2  # Dense and sparse branches
        for p in prefetch:
            assert p.filter is not None
            assert len(p.filter.must) == 1
            assert p.filter.must[0].key == "jurisdiction"
            assert p.filter.must[0].match.value == "India"


# ---------------------------------------------------------------------------
# Live Integration Smoke Tests (Opt-in via RUN_LIVE_INTEGRATION_TESTS=true)
# ---------------------------------------------------------------------------
@pytest.mark.skipif(
    os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() != "true",
    reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true",
)
def test_live_filter_leakage_india_on_ragvyn_hybrid_test():
    """Live smoke test: verify jurisdiction=India filter never returns International documents."""
    results = qdrant_hybrid_store.query_hybrid(
        query_text="TRIPS agreement patent provisions and compulsory licensing",
        collection_name="ragvyn_hybrid_test",
        jurisdiction="India",
        top_k=5,
    )
    for r in results:
        assert r["jurisdiction"] == "India", f"Leakage detected: {r}"


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() != "true",
    reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true",
)
def test_live_filter_leakage_international_on_ragvyn_hybrid_test():
    """Live smoke test: verify jurisdiction=International filter never returns Indian statutes."""
    results = qdrant_hybrid_store.query_hybrid(
        query_text="Section 3(p) traditional knowledge patent exclusion in India",
        collection_name="ragvyn_hybrid_test",
        jurisdiction="International",
        top_k=5,
    )
    for r in results:
        assert r["jurisdiction"] == "International", f"Leakage detected: {r}"
