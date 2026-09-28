"""
backend/app/services/confidence_scorer.py
-----------------------------------------
Confidence Scoring Engine Adapter.
Delegates to the deterministic Evidence Confidence Calculator to ensure
unified formulas and thresholds across the entire application.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.schemas.chat import CitationScore, ConfidenceScore
from app.services.confidence_calculator import compute_composite_confidence

log = logging.getLogger("app.services.confidence_scorer")


class ConfidenceScorer:
    """
    Evaluates multi-component evidence confidence for generated legal answers.
    """

    def calculate_confidence(
        self,
        retrieval_similarity: float,
        rerank_score: float,
        citation_scores: List[CitationScore],
        is_abstention: bool = False,
    ) -> ConfidenceScore:
        """
        Computes deterministic Evidence Confidence using unified 5-pillar weights
        and consistent safety caps.
        """
        if is_abstention:
            return compute_composite_confidence(
                gate_failed=True,
                status="no_data",
                citation_scores=[],
            )

        # Average support score from citations
        avg_support = (
            sum(c.support_score for c in citation_scores) / len(citation_scores)
            if citation_scores
            else None
        )
        total_claims = sum(c.total_claims for c in citation_scores) if citation_scores else 0
        supported_claims = sum(c.supported_claims for c in citation_scores) if citation_scores else 0
        claim_coverage = (supported_claims / total_claims) if total_claims > 0 else 0.0

        return compute_composite_confidence(
            dense_semantic_score=retrieval_similarity,
            reranker_score=rerank_score,
            citation_support_score=avg_support,
            claim_coverage_score=claim_coverage,
            citation_scores=citation_scores,
            citations_present=bool(citation_scores),
        )


# Global singleton instance
confidence_scorer = ConfidenceScorer()
