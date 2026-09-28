"""
backend/app/services/confidence_calculator.py
---------------------------------------------
Deterministic Evidence Confidence Calculator for IP-SAKTI Sahayak.

Calculates multi-dimensional evidence confidence based strictly on real
retrieval and verification signals (no random, hardcoded, or fake distance conversions):
  - 25% Dense semantic relevance (BGE-M3 cosine similarity)
  - 15% Sparse keyword relevance (BM25 normalized relevance)
  - 20% Cross-encoder reranker relevance (normalized CrossEncoder score)
  - 25% Citation support (lexical token and n-gram overlap)
  - 15% Claim coverage (supported_claims / total_claims)

Safety Caps:
  - No citations: final score capped at 20.
  - Retrieval gate failure: final score capped at 20.
  - Citation support < 0.35: final score capped at 49.
  - Claim coverage < 0.50: final score capped at 49.
  - status="no_data": Low (score <= 20) with insufficient-evidence reason.
  - status="degraded": Low/Moderate capped at 49, not presented as normally verified.
  - CHITCHAT: score=None, label="Not source-grounded".
  - OUT_OF_SCOPE / UNSAFE_OR_DISALLOWED: score=None, unrated legal confidence.

Single Threshold System:
  - 80-100: High
  - 60-79: Moderate
  - 0-59: Low
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

try:
    from app.schemas.chat import CitationScore, ConfidenceBreakdown, ConfidenceScore
except ImportError:
    from backend.app.schemas.chat import CitationScore, ConfidenceBreakdown, ConfidenceScore

log = logging.getLogger("app.services.confidence_calculator")

# Core weights (sum to 1.0)
WEIGHT_DENSE: float = 0.25
WEIGHT_SPARSE: float = 0.15
WEIGHT_RERANKER: float = 0.20
WEIGHT_CITATION_SUPPORT: float = 0.25
WEIGHT_CLAIM_COVERAGE: float = 0.15


def normalize_reranker_score(raw_score: Optional[float]) -> Optional[float]:
    """
    Normalizes a CrossEncoder reranker score into the [0.0, 1.0] interval.
    If the score is in [0.0, 1.0], it is clamped.
    If it is an unbound logit (e.g. -10 to +10), standard logistic sigmoid is applied.
    """
    if raw_score is None:
        return None
    try:
        val = float(raw_score)
    except (ValueError, TypeError):
        return None

    if 0.0 <= val <= 1.0:
        return round(val, 4)
    try:
        sig = 1.0 / (1.0 + math.exp(-val))
        return round(min(1.0, max(0.0, sig)), 4)
    except OverflowError:
        return 0.0 if val < 0 else 1.0


def normalize_bm25_score(raw_bm25: Optional[float], k: float = 10.0) -> Optional[float]:
    """
    Deterministically normalizes raw BM25 score into [0.0, 1.0] using hyperbolic saturation:
        S_sparse = raw_bm25 / (raw_bm25 + k)

    Parameters
    ----------
    raw_bm25 : Optional[float]
        Raw BM25 score from FastEmbed / Qdrant BM25 branch.
    k : float
        Half-saturation constant (default 10.0). A raw score of 10.0 yields 0.50.

    Returns
    -------
    Optional[float]
        Normalized score in [0.0, 1.0], or None if input was None.
    """
    if raw_bm25 is None:
        return None
    try:
        val = float(raw_bm25)
    except (ValueError, TypeError):
        return None

    if val <= 0.0:
        return 0.0
    norm = val / (val + k)
    return round(min(1.0, max(0.0, norm)), 4)


def compute_composite_confidence(
    best_vector_distance: Optional[float] = None,
    reranker_score: Optional[float] = None,
    citation_entailment: Optional[float] = None,
    citation_coverage: Optional[float] = None,
    citation_scores: Optional[list[dict | CitationScore]] = None,
    # New deterministic metric inputs:
    dense_semantic_score: Optional[float] = None,
    sparse_keyword_score: Optional[float] = None,
    citation_support_score: Optional[float] = None,
    claim_coverage_score: Optional[float] = None,
    reranker_skipped: bool = False,
    citations_present: Optional[bool] = None,
    gate_failed: bool = False,
    status: str = "answered",
    intent: Optional[str] = None,
) -> ConfidenceScore:
    """
    Computes deterministic Evidence Confidence from real retrieval and verification signals.

    Parameters
    ----------
    best_vector_distance : Optional[float]
        Legacy distance parameter. If dense_semantic_score is None, distance is converted:
        dense_semantic_score = max(0.0, min(1.0, 1.0 - best_vector_distance)).
    reranker_score : Optional[float]
        Normalized CrossEncoder score.
    citation_entailment : Optional[float]
        Legacy name for citation support.
    citation_coverage : Optional[float]
        Legacy name for claim coverage.
    citation_scores : Optional[list]
        Per-source claim verification records.
    dense_semantic_score : Optional[float]
        Actual dense cosine similarity from BGE-M3 (0.0 to 1.0).
    sparse_keyword_score : Optional[float]
        Normalized BM25 keyword relevance (0.0 to 1.0).
    citation_support_score : Optional[float]
        Lexical token and n-gram overlap score (0.0 to 1.0).
    claim_coverage_score : Optional[float]
        Fraction of claims supported by citations (0.0 to 1.0).
    reranker_skipped : bool
        True if reranker was skipped.
    citations_present : Optional[bool]
        Whether answer cites any statutory passages.
    gate_failed : bool
        Whether retrieval gate rejected candidates.
    status : str
        Chat response status ('answered', 'no_data', 'degraded', 'chitchat', etc.).
    intent : Optional[str]
        Classified intent ('KNOWLEDGE_SEEK', 'CHITCHAT', 'OUT_OF_SCOPE', etc.).

    Returns
    -------
    ConfidenceScore
        Pydantic model containing score, label, reason, breakdown, limitations, and citation_scores.
    """
    # ── 1. Special Intent & Non-grounded Responses ───────────────
    if intent == "CHITCHAT" or status == "chitchat":
        return ConfidenceScore(
            score=None,
            label="Not source-grounded",
            reason="Conversational response not grounded in statutory legal registers.",
            breakdown=None,
            limitations=["Response is conversational and contains no statutory legal citations."],
            citation_scores=[],
        )

    if intent in ("OUT_OF_SCOPE", "UNSAFE_OR_DISALLOWED") or status in ("out_of_scope", "disallowed"):
        label = "Out of Scope" if intent == "OUT_OF_SCOPE" else "Disallowed"
        return ConfidenceScore(
            score=None,
            label=label,
            reason="Query determined to fall outside the statutory knowledge base or blocked by safety rules.",
            breakdown=None,
            limitations=["Query falls outside authoritative statutory corpus."],
            citation_scores=[],
        )

    if status == "no_data" or gate_failed:
        return ConfidenceScore(
            score=0,
            label="Low",
            reason="Insufficient statutory evidence retrieved to ground an authoritative answer.",
            breakdown=ConfidenceBreakdown(
                dense_semantic_score=dense_semantic_score,
                sparse_keyword_score=sparse_keyword_score,
                reranker_score=None,
                citation_support_score=0.0,
                claim_coverage_score=0.0,
                reranker_skipped=True,
            ),
            limitations=["Retrieval found insufficient statutory evidence in legal registers."],
            citation_scores=[],
        )

    # ── 2. Resolve Component Scores & Aliases ─────────────────────
    # Dense semantic score
    s_dense: Optional[float] = None
    if dense_semantic_score is not None:
        s_dense = round(max(0.0, min(1.0, float(dense_semantic_score))), 4)
    elif best_vector_distance is not None:
        # Backward compatibility for legacy callers passing distance
        s_dense = round(max(0.0, min(1.0, 1.0 - float(best_vector_distance))), 4)

    # Sparse keyword score
    s_sparse: Optional[float] = None
    if sparse_keyword_score is not None:
        s_sparse = round(max(0.0, min(1.0, float(sparse_keyword_score))), 4)

    # Reranker score
    s_rerank: Optional[float] = None
    if not reranker_skipped and reranker_score is not None:
        s_rerank = normalize_reranker_score(reranker_score)

    # Citation support (renamed from citation_entailment)
    s_support: Optional[float] = None
    support_input = citation_support_score if citation_support_score is not None else citation_entailment
    if support_input is not None:
        s_support = round(max(0.0, min(1.0, float(support_input))), 4)

    # Claim coverage
    s_coverage: Optional[float] = None
    coverage_input = claim_coverage_score if claim_coverage_score is not None else citation_coverage
    if coverage_input is not None:
        s_coverage = round(max(0.0, min(1.0, float(coverage_input))), 4)
    elif citation_scores is not None:
        total_c = sum(getattr(c, "total_claims", c.get("total_claims", 0) if isinstance(c, dict) else 0) for c in citation_scores)
        supp_c = sum(getattr(c, "supported_claims", c.get("supported_claims", 0) if isinstance(c, dict) else 0) for c in citation_scores)
        s_coverage = round(supp_c / float(total_c), 4) if total_c > 0 else 0.0

    # Parse citation scores objects
    parsed_citation_scores: list[CitationScore] = []
    if citation_scores:
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

    # Determine if citations are present
    has_citations = citations_present
    if has_citations is None:
        has_citations = len(parsed_citation_scores) > 0 or (s_coverage is not None and s_coverage > 0)

    # ── 3. Weighted Score with Proportional Redistribution ───────
    # Weights: Dense 25%, Sparse 15%, Reranker 20%, Support 25%, Coverage 15%
    available_metrics: list[tuple[float, float, str]] = []

    if s_dense is not None:
        available_metrics.append((WEIGHT_DENSE, s_dense, "dense"))
    if s_sparse is not None:
        available_metrics.append((WEIGHT_SPARSE, s_sparse, "sparse"))
    if s_rerank is not None and not reranker_skipped:
        available_metrics.append((WEIGHT_RERANKER, s_rerank, "rerank"))
    if s_support is not None:
        available_metrics.append((WEIGHT_CITATION_SUPPORT, s_support, "support"))
    if s_coverage is not None:
        available_metrics.append((WEIGHT_CLAIM_COVERAGE, s_coverage, "coverage"))

    if available_metrics:
        total_weight = sum(w for w, _, _ in available_metrics)
        weighted_sum = sum(w * val for w, val, _ in available_metrics) / total_weight
        # Round only once at final stage
        raw_final_score = int(round(weighted_sum * 100))
    else:
        raw_final_score = 0

    raw_final_score = max(0, min(100, raw_final_score))
    final_score = raw_final_score

    # ── 4. Safety Caps (applied AFTER weighted score) ────────────
    limitations: list[str] = []
    caps_applied: list[str] = []

    # Safety Cap 1: No citations -> cannot exceed 20
    if not has_citations:
        if final_score > 20:
            final_score = 20
            caps_applied.append("No citations present (score capped at 20%)")
        limitations.append("No statutory passages were cited to ground this answer.")

    # Safety Cap 2: Retrieval gate failure -> cannot exceed 20
    if gate_failed:
        if final_score > 20:
            final_score = 20
            caps_applied.append("Retrieval gate failure (score capped at 20%)")
        limitations.append("Evidence relevance fell below statutory retrieval quality threshold.")

    # Safety Cap 3: Citation support below 0.35 -> cannot exceed 49
    if s_support is not None and s_support < 0.35:
        if final_score > 49:
            final_score = 49
            caps_applied.append(f"Citation support {int(s_support * 100)}% is below 35% threshold (score capped at 49%)")
        limitations.append("Citation support is low (< 35% lexical overlap).")

    # Safety Cap 4: Claim coverage below 0.50 -> cannot exceed 49
    if s_coverage is not None and s_coverage < 0.50:
        if final_score > 49:
            final_score = 49
            caps_applied.append(f"Claim coverage {int(s_coverage * 100)}% is below 50% threshold (score capped at 49%)")
        limitations.append("Claim coverage is incomplete (< 50% of claims supported by cited passages).")

    # Safety Cap 5: Degraded status -> cannot exceed 49, not presented as normally verified
    if status == "degraded":
        if final_score > 49:
            final_score = 49
            caps_applied.append("Answer generated in degraded mode (score capped at 49%)")
        limitations.append("Answer was generated under degraded pipeline status.")

    if reranker_skipped:
        limitations.append("Cross-encoder reranking was skipped; weight redistributed proportionally across available signals.")

    if s_dense is None:
        limitations.append("Dense semantic score was unavailable.")

    if s_sparse is None:
        limitations.append("Sparse BM25 score was unavailable.")

    # Clamp to [0, 100]
    final_score = max(0, min(100, final_score))

    # ── 5. Single Threshold System ───────────────────────────────
    # 80-100: High
    # 60-79: Moderate
    # 0-59: Low
    if final_score >= 80:
        label = "High"
    elif final_score >= 60:
        label = "Moderate"
    else:
        label = "Low"

    # ── 6. Reason Explanation Construction ───────────────────────
    reason_parts: list[str] = []
    if s_dense is not None:
        reason_parts.append(f"{int(round(s_dense * 100))}% semantic")
    if s_sparse is not None:
        reason_parts.append(f"{int(round(s_sparse * 100))}% keyword")
    if s_rerank is not None and not reranker_skipped:
        reason_parts.append(f"{int(round(s_rerank * 100))}% rerank")
    if s_support is not None:
        reason_parts.append(f"{int(round(s_support * 100))}% support")
    if s_coverage is not None:
        reason_parts.append(f"{int(round(s_coverage * 100))}% coverage")

    breakdown_summary = ", ".join(reason_parts) if reason_parts else "insufficient metrics"

    if caps_applied:
        reason = f"{label} Evidence Confidence ({final_score}%): Capped due to {'; '.join(caps_applied)}."
    elif label == "High":
        reason = f"High Evidence Confidence ({final_score}%): Strong statutory grounding ({breakdown_summary})."
    elif label == "Moderate":
        reason = f"Moderate Evidence Confidence ({final_score}%): Supported by retrieved provisions ({breakdown_summary}), but some claims have partial coverage."
    else:
        reason = f"Low Evidence Confidence ({final_score}%): Limited direct statutory overlap ({breakdown_summary}). Independent legal verification advised."

    breakdown = ConfidenceBreakdown(
        dense_semantic_score=s_dense,
        sparse_keyword_score=s_sparse,
        reranker_score=s_rerank if not reranker_skipped else None,
        citation_support_score=s_support,
        claim_coverage_score=s_coverage,
        reranker_skipped=reranker_skipped,
    )

    log.info(
        "Deterministic Evidence Confidence: %d (%s) [Dense=%s, Sparse=%s, Rerank=%s, Support=%s, Coverage=%s, Caps=%s]",
        final_score,
        label,
        s_dense,
        s_sparse,
        s_rerank if not reranker_skipped else "skipped",
        s_support,
        s_coverage,
        caps_applied or "none",
    )

    return ConfidenceScore(
        score=final_score,
        label=label,
        reason=reason,
        breakdown=breakdown,
        limitations=limitations,
        citation_scores=parsed_citation_scores,
    )


# Backward-compatible alias
calculate_evidence_confidence = compute_composite_confidence
