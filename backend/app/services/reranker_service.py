"""
backend/app/services/reranker_service.py
----------------------------------------
Conditional CrossEncoder Reranking Engine for IP-SAKTI Sahayak.
Optimizes latency by conditionally skipping heavy neural reranking
when high-confidence semantic vector matches are detected.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

try:
    from backend.app.core.async_utils import async_rerank
    from backend.app.core.config import settings
except ImportError:
    from app.core.async_utils import async_rerank
    from app.core.config import settings

log = logging.getLogger("app.services.reranker_service")


async def conditional_rerank(
    query: str,
    candidates: list[dict],
    skip_threshold: float = 0.25,
    final_k: int = 3,
) -> tuple[list[dict], bool]:
    """
    Conditionally applies CrossEncoder reranking to candidate passages.

    If the top candidate's vector distance is already lower than or equal to
    `skip_threshold` (indicating a very high-confidence vector match), CrossEncoder
    reranking is bypassed to eliminate latency (~100-300ms savings).
    Otherwise, neural CrossEncoder reranking is executed in a background threadpool.

    Parameters
    ----------
    query : str
        The user query text.
    candidates : list[dict]
        Retrieved candidate documents containing 'distance' or 'vector_distance' and 'text'.
    skip_threshold : float
        Vector distance threshold below which reranking is skipped (default: 0.25).
    final_k : int
        Number of top candidates to return after selection/reranking (default: 3).

    Returns
    -------
    tuple[list[dict], bool]
        - Filtered & sorted top_candidates (up to final_k items)
        - reranker_skipped boolean: True if CrossEncoder was bypassed, False if reranked
    """
    if not candidates:
        log.info("No candidates supplied to conditional_rerank; returning empty list.")
        return [], True


    if not settings.ENABLE_CROSS_ENCODER:
        log.info("CrossEncoder reranking disabled (ENABLE_CROSS_ENCODER=false). Preserving candidate ordering.")
        for c in candidates:
            dist = float(c.get("distance", c.get("vector_distance", 1.0 - c.get("vector_similarity", 0.5))))
            sim = float(c.get("vector_similarity", round(max(0.0, min(1.0, 1.0 - dist)), 4)))
            c["reranker_score"] = sim
            c["rerank_skipped"] = True
        return candidates[:final_k], True



    # Inspect the best vector distance among candidates
    distances = [
        float(c.get("distance", c.get("vector_distance", 1.0)))
        for c in candidates
        if c.get("distance") is not None or c.get("vector_distance") is not None
    ]
    best_distance = min(distances) if distances else 1.0

    log.info(
        "Candidate evaluation: %d items, best vector distance: %.4f (skip_threshold: %.2f)",
        len(candidates),
        best_distance,
        skip_threshold,
    )

    # Condition 1: High confidence match -> Skip CrossEncoder
    if best_distance <= skip_threshold:
        log.info(
            "High confidence vector match detected (%.4f <= %.2f). Bypassing CrossEncoder reranker.",
            best_distance,
            skip_threshold,
        )
        # Assign estimated reranker score based on vector distance
        for c in candidates:
            dist = float(c.get("distance", c.get("vector_distance", 1.0)))
            c["reranker_score"] = round(max(0.0, min(1.0, 1.0 - dist)), 4)
            c["rerank_skipped"] = True

        return candidates[:final_k], True

    # Condition 2: Moderate/low confidence match -> Execute CrossEncoder
    log.info(
        "Best vector distance %.4f > %.2f threshold. Executing CrossEncoder reranking...",
        best_distance,
        skip_threshold,
    )

    try:
        # Extract document texts
        texts = [c.get("text", "") for c in candidates]

        # Call async_rerank via worker thread pool
        scores = await async_rerank(query=query, passage_list=texts)

        # Attach reranker_score to each candidate dictionary
        for i, score in enumerate(scores):
            candidates[i]["reranker_score"] = float(score)
            candidates[i]["rerank_skipped"] = False

        # Sort candidates by reranker_score descending
        sorted_candidates = sorted(
            candidates,
            key=lambda x: x.get("reranker_score", 0.0),
            reverse=True,
        )

        return sorted_candidates[:final_k], False

    except Exception as e:
        log.error("CrossEncoder reranking failed: %s. Falling back to vector order.", e, exc_info=True)
        for c in candidates:
            c["reranker_score"] = float(c.get("vector_similarity", 0.5))
            c["rerank_skipped"] = True
        return candidates[:final_k], True
