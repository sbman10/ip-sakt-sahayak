"""
backend/app/services/confidence_calculator.py
---------------------------------------------
Composite Confidence Calculator for IP-SAKTI Sahayak.
Implements the 4-pillar weighted evaluation formula:
  - 30% Retrieval Relevance
  - 25% Reranker Relevance
  - 30% Citation Entailment
  - 15% Claim Coverage
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

try:
    from app.schemas.chat import CitationScore, ConfidenceScore
except ImportError:
    from backend.app.schemas.chat import CitationScore, ConfidenceScore

log = logging.getLogger("app.services.confidence_calculator")


def _normalize_reranker_score(raw_score: float) -> float:
    """
    Normalizes a reranker score into the [0.0, 1.0] interval.
    If the score is already in [0.0, 1.0] (e.g. from skipped rerank or sigmoid),
    it is clamped. If it is an unbound logit (like -7.0 to +5.0), sigmoid is applied.
    """
    if 0.0 <= raw_score <= 1.0:
        return raw_score
    if raw_score > 1.0:
        # Score might be a positive logit or already scaled
        return min(1.0, 1.0 / (1.0 + math.exp(-raw_score)))
    # Negative logit: apply sigmoid
    try:
        sig = 1.0 / (1.0 + math.exp(-raw_score))
        return min(1.0, max(0.0, sig))
    except OverflowError:
        return 0.0 if raw_score < 0 else 1.0


def compute_composite_confidence(
    best_vector_distance: float,
    reranker_score: float,
    citation_entailment: float,
    citation_coverage: float,
    citation_scores: list[dict],
) -> ConfidenceScore:
    """
    Computes multi-dimensional composite confidence score based on the 4 weighted pillars.

    Parameters
    ----------
    best_vector_distance : float
        Best cosine distance from vector search (lower is better, [0.0, 1.0]).
    reranker_score : float
        CrossEncoder relevance score or 1.0 if skipped.
    citation_entailment : float
        Claim entailment support ratio ([0.0, 1.0]).
    citation_coverage : float
        Ratio of claims supported by at least one citation ([0.0, 1.0]).
    citation_scores : list[dict]
        List of per-source claim support statistics dicts.

    Returns
    -------
    ConfidenceScore
        Populated Pydantic model with score, label, reason, and citation_scores.
    """
    # 1. Normalize retrieval relevance = max(0.0, 1.0 - best_vector_distance)
    retrieval_relevance = max(0.0, min(1.0, 1.0 - best_vector_distance))

    # 2. Normalize reranker relevance = min(1.0, max(0.0, reranker_score))
    reranker_relevance = _normalize_reranker_score(reranker_score)

    # 3. Clamp entailment and coverage
    entailment_norm = max(0.0, min(1.0, citation_entailment))
    coverage_norm = max(0.0, min(1.0, citation_coverage))

    # 4. Compute final composite score:
    #    composite_score = int((0.30 * retrieval + 0.25 * reranker + 0.30 * entailment + 0.15 * coverage) * 100)
    weighted_sum = (
        (0.30 * retrieval_relevance)
        + (0.25 * reranker_relevance)
        + (0.30 * entailment_norm)
        + (0.15 * coverage_norm)
    )
    composite_score = int(round(weighted_sum * 100))
    composite_score = max(0, min(100, composite_score))

    # 5. Assign label
    if composite_score >= 80:
        label = "High"
    elif composite_score >= 60:
        label = "Moderate"
    else:
        label = "Low"

    # 6. Construct human-readable reason string
    reason = (
        f"{composite_score}% confidence: "
        f"{int(round(retrieval_relevance * 100))}% retrieval relevance, "
        f"{int(round(entailment_norm * 100))}% citation support, and "
        f"{int(round(coverage_norm * 100))}% claim coverage."
    )

    # 7. Convert citation_scores dictionaries to CitationScore Pydantic models
    parsed_citation_scores: list[CitationScore] = []
    for cs in citation_scores:
        if isinstance(cs, CitationScore):
            parsed_citation_scores.append(cs)
        elif isinstance(cs, dict):
            parsed_citation_scores.append(
                CitationScore(
                    source=str(cs.get("source", "Legal Statute")),
                    support_score=float(cs.get("support_score", 0.0)),
                    supported_claims=int(cs.get("supported_claims", 0)),
                    total_claims=int(cs.get("total_claims", 0)),
                )
            )

    log.info(
        "Computed composite confidence: %d (%s) [Retrieval=%.2f, Reranker=%.2f, Entailment=%.2f, Coverage=%.2f]",
        composite_score,
        label,
        retrieval_relevance,
        reranker_relevance,
        entailment_norm,
        coverage_norm,
    )

    return ConfidenceScore(
        score=composite_score,
        label=label,
        reason=reason,
        citation_scores=parsed_citation_scores,
    )
