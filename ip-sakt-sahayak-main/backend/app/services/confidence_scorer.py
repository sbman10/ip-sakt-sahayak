"""
backend/app/services/confidence_scorer.py
-----------------------------------------
Composite Confidence Scoring Engine.
Calculates multi-dimensional confidence:
  Score = (0.30 * Retrieval) + (0.25 * Reranker) + (0.30 * Entailment) + (0.15 * Coverage)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.schemas.chat import CitationScore, ConfidenceScore

log = logging.getLogger("app.services.confidence_scorer")


class ConfidenceScorer:
    """
    Evaluates multi-component groundedness confidence for generated legal answers.
    """

    def calculate_confidence(
        self,
        retrieval_similarity: float,
        rerank_score: float,
        citation_scores: List[CitationScore],
        is_abstention: bool = False,
    ) -> ConfidenceScore:
        """
        Computes weighted composite confidence score and structured breakdown.

        Parameters
        ----------
        retrieval_similarity : float
            Cosine similarity of the best retrieved passage (0.0 to 1.0).
        rerank_score : float
            Normalized CrossEncoder score of top passage (0.0 to 1.0).
        citation_scores : List[CitationScore]
            Per-source entailment and claim verification scores.
        is_abstention : bool, optional
            Whether the guardrail triggered an out-of-scope abstention.

        Returns
        -------
        ConfidenceScore
            Pydantic model with score, label, reason, and citation scores.
        """
        if is_abstention or not citation_scores:
            return ConfidenceScore(
                score=15,
                label="Low",
                reason="Question falls outside authoritative statutory coverage or lacks grounding data.",
                citation_scores=citation_scores or [],
            )

        # 1. Retrieval Score (30%)
        s_retrieval = max(0.0, min(1.0, retrieval_similarity))

        # 2. Reranker Score (25%)
        s_rerank = max(0.0, min(1.0, rerank_score))

        # 3. Entailment Score (30%)
        avg_entailment = (
            sum(c.support_score for c in citation_scores) / len(citation_scores)
            if citation_scores
            else 0.0
        )
        s_entailment = max(0.0, min(1.0, avg_entailment))

        # 4. Coverage Score (15%)
        total_claims = sum(c.total_claims for c in citation_scores)
        supported_claims = sum(c.supported_claims for c in citation_scores)
        s_coverage = (supported_claims / total_claims) if total_claims > 0 else 0.8
        s_coverage = max(0.0, min(1.0, s_coverage))

        # Composite Calculation
        raw_composite = (
            (0.30 * s_retrieval)
            + (0.25 * s_rerank)
            + (0.30 * s_entailment)
            + (0.15 * s_coverage)
        )
        final_score = int(round(raw_composite * 100))
        final_score = max(5, min(99, final_score))

        # Categorical Label
        if final_score >= 80:
            label = "High"
            reason = (
                f"High confidence ({final_score}%): Strong statutory grounding in primary acts "
                f"with high semantic entailment and consistent claim support."
            )
        elif final_score >= 50:
            label = "Moderate"
            reason = (
                f"Moderate confidence ({final_score}%): Grounded in relevant statutory provisions "
                f"with adequate claim coverage, though some terms require specific legal verification."
            )
        else:
            label = "Low"
            reason = (
                f"Low confidence ({final_score}%): Limited direct statutory overlap in retrieved records. "
                f"Independent legal review recommended."
            )

        return ConfidenceScore(
            score=final_score,
            label=label,
            reason=reason,
            citation_scores=citation_scores,
        )


# Global singleton instance
confidence_scorer = ConfidenceScorer()
