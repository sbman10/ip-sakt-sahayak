"""
backend/app/services/retrieval_gate.py
--------------------------------------
Retrieval Gate & Abstention Evaluator for IP-SAKTI Sahayak.
Enforces safety and hallucination prevention by inspecting retrieval relevance
and triggering fast, compliant legal abstention when evidence is insufficient.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from backend.app.core.config import settings
except ImportError:
    from app.core.config import settings

log = logging.getLogger("app.services.retrieval_gate")


def evaluate_retrieval_quality(
    candidates: list[dict],
    similarity_threshold: float = 0.65,
) -> dict:
    """
    Evaluates whether retrieved passages meet quality and relevance thresholds
    to safely ground a statutory response without hallucination.

    Parameters
    ----------
    candidates : list[dict]
        Retrieved candidate items containing 'distance', 'vector_distance', or 'vector_similarity'.
    similarity_threshold : float
        Maximum distance threshold for acceptable relevance (default: 0.65).
        Note: If vector distance > similarity_threshold, relevance is deemed insufficient.

    Returns
    -------
    dict
        Evaluation decision dictionary containing:
        - is_sufficient: bool
        - reason: str
        - best_distance: float
        - top_rrf_score: float
    """
    if not candidates:
        log.warning("Retrieval quality gate: zero candidates provided.")
        return {
            "is_sufficient": False,
            "reason": "Insufficient evidence in legal registers",
            "best_distance": 1.0,
            "top_rrf_score": 0.0,
        }

    # Inspect best vector distance and top RRF score
    distances = [
        float(c.get("distance", c.get("vector_distance", 1.0)))
        for c in candidates
        if c.get("distance") is not None or c.get("vector_distance") is not None
    ]
    best_distance = min(distances) if distances else 1.0

    rrf_scores = [float(c.get("rrf_score", 0.0)) for c in candidates]
    top_rrf_score = max(rrf_scores) if rrf_scores else 0.0

    log.info(
        "Evaluating retrieval quality: best_distance=%.4f, top_rrf_score=%.4f, threshold=%.2f",
        best_distance,
        top_rrf_score,
        similarity_threshold,
    )

    # If best_distance > similarity_threshold (indicating weak relevance)
    if best_distance > similarity_threshold:
        log.warning(
            "Gate check failed: best distance %.4f exceeds threshold %.2f.",
            best_distance,
            similarity_threshold,
        )
        return {
            "is_sufficient": False,
            "reason": "Insufficient evidence in legal registers",
            "best_distance": best_distance,
            "top_rrf_score": top_rrf_score,
        }

    return {
        "is_sufficient": True,
        "reason": "Sufficient statutory evidence found",
        "best_distance": best_distance,
        "top_rrf_score": top_rrf_score,
    }


def get_abstention_response() -> dict:
    """
    Returns a safe, standardized fallback dictionary when grounding fails or
    query is out of scope.

    Returns
    -------
    dict
        Structured abstention response conforming to statutory guardrails.
    """
    return {
        "answer": (
            "I could not find this in the current verified knowledge base, so "
            "I won't guess an answer. This may be outside the topics I currently "
            "cover, or phrased differently from my sources — try rewording it "
            "(for example, name the specific Act, section, or scheme). "
            "If it is important, a qualified IP professional can give authoritative guidance."
        ),
        "citations": [],
        "confidence": {
            "score": 15,
            "label": "Low",
            "reason": "No matching source found in the verified knowledge base.",
        },
        "disclaimer": "This is an informational prototype, not formal legal advice.",
        "status": "no_data",
    }
