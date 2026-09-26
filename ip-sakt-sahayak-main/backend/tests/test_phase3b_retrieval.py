"""
backend/tests/test_phase3b_retrieval.py
---------------------------------------
Phase 3B Test Suite: Chunker Disambiguation, Section 3 Granularity,
and Retrieval Evaluation Safeguards.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = BACKEND_DIR.parent
KB_DIR = WORKSPACE_ROOT / "knowledge-base"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(KB_DIR) not in sys.path:
    sys.path.insert(0, str(KB_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store
from qdrant_ingest import QdrantIngestor
import scripts.evaluate_phase3a as eval_script


def test_evaluator_prohibited_collection_safety():
    """Verify that targeting 'ragvyn_prod_v1' is strictly rejected."""
    with pytest.raises(ValueError, match="Prohibited collection"):
        with patch("sys.argv", ["evaluate_phase3a.py", "--collection", "ragvyn_prod_v1"]):
            eval_script.main()


def test_evaluator_report_routing_for_v2(tmp_path):
    """Verify report path routing and metadata generation for ragvyn_hybrid_test_v2."""
    fake_completeness = {
        "status": "PASSED",
        "collection_name": "ragvyn_hybrid_test_v2",
        "total_points": 753,
        "expected_corpus_ids": 753,
        "found_corpus_ids": 753,
        "missing_corpus_ids": 0,
        "extra_test_points": 0,
        "extra_test_point_details": [],
        "sampled_vector_checks_passed": 25,
        "chunks_with_omitted_dates": 30,
        "date_integrity_issues": 0,
    }
    fake_filter_leakage = {
        "india_filter_on_international_query": {"passed": True},
        "overall_passed": True,
    }
    fake_eval_results = [
        {
            "query_id": "Q01",
            "category": "A. Indian patent law",
            "query": "What does Section 3(p) say?",
            "is_out_of_scope": False,
            "metrics": {
                "correct_section_at_rank_1": True,
                "correct_section_in_top_5": True,
                "top_hit_is_pure_corpus": True,
                "chunk_overlap_count": 2,
                "doc_overlap_count": 2,
                "section_overlap_count": 1,
                "qdrant_max_score": 0.033,
                "qdrant_min_score": 0.016,
                "out_of_scope_safe": True,
            },
            "qdrant_filtered_top_k": [
                {
                    "rank": 1,
                    "score": 0.033,
                    "point_id": "fake-uuid",
                    "chunk_id": "patents-act-1970_section-3-p_25_a1b2c3d4",
                    "document_id": "patents-act-1970",
                    "source": "Patents Act 1970",
                    "authority": "Indian Patent Office",
                    "section": "Section 3(p)",
                    "jurisdiction": "India",
                    "document_type": "statute",
                    "text_preview": "Section 3(p) an invention which in effect is traditional knowledge...",
                }
            ],
            "chroma_top_k": [],
        }
    ]

    with patch.object(eval_script, "REPORTS_DIR", tmp_path):
        json_path, md_path = eval_script.generate_reports(
            completeness_data=fake_completeness,
            filter_leakage_data=fake_filter_leakage,
            eval_results=fake_eval_results,
            collection_name="ragvyn_hybrid_test_v2",
        )

        assert json_path.name == "qdrant_phase_3b_evaluation.json"
        assert md_path.name == "qdrant_phase_3b_evaluation.md"
        assert json_path.exists()
        assert md_path.exists()

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data["target_collection"] == "ragvyn_hybrid_test_v2"
            assert data["decision"] == "READY FOR SHADOW RETRIEVAL"
            assert data["summary_metrics"]["q01_section_3p_pure_corpus_rank_1"] is True

        md_content = md_path.read_text(encoding="utf-8")
        assert "Phase 3B" in md_content
        assert "ragvyn_hybrid_test_v2" in md_content
        assert "READY FOR SHADOW RETRIEVAL" in md_content


def test_filter_section_3p_condition():
    """Verify Section 3(p) and Section 3(d) exact match filtering."""
    filt_3p = qdrant_hybrid_store.build_filter(jurisdiction="India", section="Section 3(p)")
    assert filt_3p is not None
    assert len(filt_3p.must) == 2
    keys = {c.key: c.match.value for c in filt_3p.must}
    assert keys["jurisdiction"] == "India"
    assert keys["section"] == "Section 3(p)"

    filt_3d = qdrant_hybrid_store.build_filter(jurisdiction="India", section="Section 3(d)")
    assert filt_3d is not None
    assert len(filt_3d.must) == 2
    keys = {c.key: c.match.value for c in filt_3d.must}
    assert keys["jurisdiction"] == "India"
    assert keys["section"] == "Section 3(d)"
