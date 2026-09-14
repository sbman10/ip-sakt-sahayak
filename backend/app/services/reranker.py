"""
backend/app/services/reranker.py
--------------------------------
Conditional CrossEncoder Reranking service for IP-SAKTI Sahayak.
Skips expensive reranking passes when top vector retrieval distance is <= 0.25.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List

from app.core.async_utils import async_rerank
from app.core.config import settings

log = logging.getLogger("app.services.reranker")


class ConditionalReranker:
    """
    Intelligent reranking service that optimizes latency by conditionally invoking
    the CrossEncoder model.
    """

    def __init__(self, skip_threshold: float = 0.25) -> None:
        self.skip_threshold = skip_threshold

    @staticmethod
    def _sigmoid(x: float) -> float:
        """Applies sigmoid activation to map cross-encoder logit to [0, 1]."""
        try:
            return 1.0 / (1.0 + math.exp(-float(x)))
        except OverflowError:
            return 0.0 if x < 0 else 1.0

    async def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Reranks a list of candidate passages against the user query.

        Parameters
        ----------
        query : str
            The user query string.
        candidates : List[Dict[str, Any]]
            Candidate document dictionaries returned from hybrid retrieval.
        top_k : int, optional
            Number of top reranked passages to return, by default 3.

        Returns
        -------
        List[Dict[str, Any]]
            Top-k sorted candidate dictionaries with added 'rerank_score' key.
        """
        if not candidates:
            return []

        # Check conditional shortcut: if top candidate has vector_distance <= skip_threshold
        top_cand = candidates[0]
        top_dist = top_cand.get("vector_distance", 1.0)

        if top_dist <= self.skip_threshold:
            log.info(
                "Skipping CrossEncoder reranking (high-confidence vector distance: %.4f <= %.2f)",
                top_dist,
                self.skip_threshold,
            )
            for cand in candidates:
                cand["rerank_score"] = float(cand.get("vector_similarity", 0.95))
                cand["rerank_bypassed"] = True
            return candidates[:top_k]

        # Extract passage texts for scoring
        passage_texts = [c.get("text", "") for c in candidates]

        try:
            log.info("Invoking CrossEncoder reranker on %d candidate passages...", len(passage_texts))
            raw_scores = await async_rerank(query, passage_texts)

            # Attach normalized scores
            for i, cand in enumerate(candidates):
                raw_score = raw_scores[i] if i < len(raw_scores) else 0.0
                cand["raw_rerank_score"] = float(raw_score)
                cand["rerank_score"] = self._sigmoid(raw_score)
                cand["rerank_bypassed"] = False

            # Sort descending by rerank score
            sorted_candidates = sorted(candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
            log.info("CrossEncoder reranking completed. Top score: %.4f", sorted_candidates[0]["rerank_score"])
            return sorted_candidates[:top_k]

        except Exception as e:
            log.error("CrossEncoder reranking failed, falling back to hybrid RRF ordering: %s", e, exc_info=True)
            for cand in candidates:
                cand["rerank_score"] = float(cand.get("vector_similarity", 0.5))
                cand["rerank_bypassed"] = True
            return candidates[:top_k]


# Global singleton instance
conditional_reranker = ConditionalReranker(skip_threshold=settings.RERANK_SKIP_THRESHOLD)
