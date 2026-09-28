"""
backend/tests/test_evidence_confidence.py
-----------------------------------------
Comprehensive test suite verifying deterministic Evidence Confidence:
1. Same inputs always produce the same score.
2. No citations cannot produce High confidence (capped <= 20).
3. Weak claim coverage cannot produce High confidence (capped <= 49).
4. Weak citation support cannot produce High confidence (capped <= 49).
5. Retrieval gate failure produces Low/no-data confidence (capped <= 20).
6. RRF is not treated as cosine similarity or fake vector distance.
7. BM25 raw scores are not directly shown as percentages (hyperbolic saturation).
8. Missing branch metrics are marked unavailable and weight redistributed.
9. Chitchat does not display legal evidence confidence (score=None, Not source-grounded).
10. Out-of-scope response does not display normal confidence (score=None, Out of Scope).
11. Threshold consistency (>=80 High, >=60 Moderate, <60 Low).
12. Claim coverage is strictly 0.0 when claims or citations are missing (no 0.8 default).
13. Backward-compatible ConfidenceScorer delegates to unified calculator.
"""

import pytest
from app.schemas.chat import CitationScore, ConfidenceBreakdown, ConfidenceScore
from app.services.confidence_calculator import (
    compute_composite_confidence,
    normalize_bm25_score,
    normalize_reranker_score,
)
from app.services.confidence_scorer import confidence_scorer
from app.services.claim_verifier import claim_verifier
from app.services.retrieval_gate import evaluate_retrieval_quality, get_abstention_response
from app.services.intent_classifier import (
    build_chitchat_response,
    build_out_of_scope_response,
    build_unsafe_response,
    IntentClassification,
    ExtractedEntities,
)


def test_same_inputs_always_produce_same_score():
    """Requirement 1: Same inputs always produce the identical deterministic score."""
    kwargs = {
        "dense_semantic_score": 0.85,
        "sparse_keyword_score": 0.70,
        "reranker_score": 0.80,
        "citation_support_score": 0.75,
        "claim_coverage_score": 0.90,
        "citations_present": True,
    }
    res1 = compute_composite_confidence(**kwargs)
    res2 = compute_composite_confidence(**kwargs)

    assert res1.score == res2.score
    assert res1.label == res2.label
    assert res1.score is not None
    # 0.25*0.85 + 0.15*0.70 + 0.20*0.80 + 0.25*0.75 + 0.15*0.90 = 0.2125 + 0.105 + 0.16 + 0.1875 + 0.135 = 0.80 -> 80
    assert res1.score == 80
    assert res1.label == "High"
    assert res1.breakdown.dense_semantic_score == 0.85
    assert res1.breakdown.sparse_keyword_score == 0.70
    assert res1.breakdown.reranker_score == 0.80
    assert res1.breakdown.citation_support_score == 0.75
    assert res1.breakdown.claim_coverage_score == 0.90


def test_no_citations_cannot_produce_high():
    """Requirement 2: No citations cannot produce High confidence (safety cap <= 20)."""
    res = compute_composite_confidence(
        dense_semantic_score=0.95,
        sparse_keyword_score=0.90,
        reranker_score=0.95,
        citation_support_score=0.0,
        claim_coverage_score=0.0,
        citations_present=False,
    )
    assert res.score <= 20
    assert res.label == "Low"
    assert any("No statutory passages were cited" in lim for lim in res.limitations)


def test_weak_claim_coverage_cannot_produce_high():
    """Requirement 3: Claim coverage below 0.50 cannot exceed 49 (Low/capped)."""
    res = compute_composite_confidence(
        dense_semantic_score=0.90,
        sparse_keyword_score=0.85,
        reranker_score=0.90,
        citation_support_score=0.80,
        claim_coverage_score=0.30,  # below 0.50
        citations_present=True,
    )
    assert res.score <= 49
    assert res.label == "Low"
    assert any("claim coverage" in lim.lower() for lim in res.limitations)


def test_weak_citation_support_cannot_produce_high():
    """Requirement 4: Citation support below 0.35 cannot exceed 49."""
    res = compute_composite_confidence(
        dense_semantic_score=0.90,
        sparse_keyword_score=0.85,
        reranker_score=0.90,
        citation_support_score=0.25,  # below 0.35
        claim_coverage_score=0.90,
        citations_present=True,
    )
    assert res.score <= 49
    assert res.label == "Low"
    assert any("citation support is low" in lim.lower() for lim in res.limitations)


def test_retrieval_gate_failure_produces_low_or_no_data():
    """Requirement 5: Retrieval gate failure produces Low/no-data confidence."""
    # Test via gate evaluation failure
    eval_res = evaluate_retrieval_quality(candidates=[])
    assert not eval_res["is_sufficient"]

    res = compute_composite_confidence(
        gate_failed=True,
        status="no_data",
        citation_scores=[],
    )
    assert res.score == 0 or res.score <= 20
    assert res.label == "Low"
    assert "insufficient" in res.reason.lower()


def test_rrf_not_treated_as_cosine_similarity():
    """Requirement 6: RRF score is not converted to fake cosine distance (1 - rrf)."""
    qdrant_candidate = {
        "retrieval_score_type": "qdrant_rrf",
        "rrf_score": 0.032,
        "dense_score": 0.72,  # real cosine similarity
        "sparse_score": 0.55,
    }
    gate_res = evaluate_retrieval_quality(candidates=[qdrant_candidate])
    assert gate_res["is_sufficient"]
    assert gate_res["top_rrf_score"] == 0.032
    # Dense score is preserved as 0.72, NOT 1 - 0.032 = 0.968
    assert gate_res["best_dense_score"] == 0.72
    assert gate_res["best_distance"] == pytest.approx(1.0 - 0.72, rel=1e-3)


def test_bm25_raw_scores_not_directly_shown_as_percentages():
    """Requirement 7: Raw BM25 scores (e.g. 15.0) are normalized deterministically."""
    # When BM25 raw is None
    assert normalize_bm25_score(None) is None
    # When BM25 raw is 0
    assert normalize_bm25_score(0.0) == 0.0
    # Hyperbolic saturation: raw / (raw + 10.0)
    # raw = 10.0 -> 10 / 20 = 0.50
    assert normalize_bm25_score(10.0) == 0.50
    # raw = 15.0 -> 15 / 25 = 0.60 (NOT 1500%!)
    assert normalize_bm25_score(15.0) == 0.60
    # raw = 30.0 -> 30 / 40 = 0.75
    assert normalize_bm25_score(30.0) == 0.75


def test_missing_branch_metrics_marked_unavailable_and_weight_redistributed():
    """Requirement 8: Missing branch metrics are marked unavailable and weight redistributed."""
    # Suppose dense and reranker are missing, only sparse, support, and coverage exist
    res = compute_composite_confidence(
        dense_semantic_score=None,
        sparse_keyword_score=0.80,  # weight 0.15
        reranker_score=None,
        reranker_skipped=True,      # weight 0.20 skipped
        citation_support_score=0.80, # weight 0.25
        claim_coverage_score=0.80,   # weight 0.15
        citations_present=True,
    )
    # Available weights sum to 0.15 + 0.25 + 0.15 = 0.55
    # Weighted average: (0.15*0.8 + 0.25*0.8 + 0.15*0.8)/0.55 = 0.80 -> 80
    assert res.score == 80
    assert res.label == "High"
    assert res.breakdown.dense_semantic_score is None
    assert res.breakdown.reranker_score is None
    assert res.breakdown.reranker_skipped is True
    assert any("Dense semantic score was unavailable" in lim for lim in res.limitations)
    assert any("Cross-encoder reranking was skipped" in lim for lim in res.limitations)


def test_chitchat_does_not_display_legal_evidence_confidence():
    """Requirement 9: Chitchat does not display legal evidence confidence."""
    classification = IntentClassification(
        intent="CHITCHAT",
        confidence=1.0,
        reason="Greeting",
        rewritten_query="",
        clarification_question="",
        entities=ExtractedEntities(),
    )
    resp = build_chitchat_response(classification)
    assert resp.confidence.score is None
    assert resp.confidence.label == "Not source-grounded"
    assert "conversational" in resp.confidence.reason.lower()


def test_out_of_scope_does_not_display_normal_confidence():
    """Requirement 10: Out of scope responses do not display normal confidence percentage."""
    classification = IntentClassification(
        intent="OUT_OF_SCOPE",
        confidence=1.0,
        reason="Real estate query",
        rewritten_query="",
        clarification_question="",
        entities=ExtractedEntities(),
    )
    resp = build_out_of_scope_response(classification)
    assert resp.confidence.score is None
    assert resp.confidence.label == "Out of Scope"


def test_thresholds_consistency():
    """Requirement 11: Single consistent threshold system: >=80 High, 60-79 Moderate, <60 Low."""
    # Test High threshold (80)
    high_res = compute_composite_confidence(
        dense_semantic_score=0.80,
        sparse_keyword_score=0.80,
        reranker_score=0.80,
        citation_support_score=0.80,
        claim_coverage_score=0.80,
        citations_present=True,
    )
    assert high_res.score == 80
    assert high_res.label == "High"

    # Test Moderate threshold (60)
    mod_res = compute_composite_confidence(
        dense_semantic_score=0.60,
        sparse_keyword_score=0.60,
        reranker_score=0.60,
        citation_support_score=0.60,
        claim_coverage_score=0.60,
        citations_present=True,
    )
    assert mod_res.score == 60
    assert mod_res.label == "Moderate"

    # Test Low threshold (59)
    low_res = compute_composite_confidence(
        dense_semantic_score=0.59,
        sparse_keyword_score=0.59,
        reranker_score=0.59,
        citation_support_score=0.59,
        claim_coverage_score=0.59,
        citations_present=True,
    )
    assert low_res.score == 59
    assert low_res.label == "Low"


def test_claim_verifier_no_arbitrary_default():
    """Requirement 12: Claim coverage returns 0.0 when claims or citations missing (no 0.8 default)."""
    import asyncio

    async def _test():
        # No citations
        support, coverage, scores = await claim_verifier.evaluate_citations(
            answer_text="Section 3(p) bars patenting of traditional knowledge.",
            citations=[],
        )
        assert support == 0.0
        assert coverage == 0.0
        assert scores == []

        # Empty answer
        support_empty, coverage_empty, scores_empty = await claim_verifier.evaluate_citations(
            answer_text="",
            citations=[{"source": "Patents Act", "text": "Section 3(p)"}],
        )
        assert support_empty == 0.0
        assert coverage_empty == 0.0

    asyncio.run(_test())


def test_confidence_scorer_delegates_to_calculator():
    """Requirement 13: ConfidenceScorer class delegates to unified calculation."""
    cs = CitationScore(
        source="Patents Act 1970",
        support_score=0.85,
        supported_claims=2,
        total_claims=2,
    )
    res = confidence_scorer.calculate_confidence(
        retrieval_similarity=0.85,
        rerank_score=0.80,
        citation_scores=[cs],
    )
    assert res.score is not None
    assert res.score >= 80
    assert res.label == "High"
    assert res.breakdown is not None
    assert res.breakdown.dense_semantic_score == 0.85
