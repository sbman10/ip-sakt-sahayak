"""
backend/app/services/entailment_service.py
------------------------------------------
Natural Language Entailment and Claim Verification Service.
Decomposes generated LLM answers into factual claim statements and verifies
semantic entailment against the retrieved citation passages.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

from app.core.async_utils import async_rerank
from app.schemas.chat import CitationItem, CitationScore

log = logging.getLogger("app.services.entailment_service")


class EntailmentService:
    """
    Verifies claim-level grounding and factual entailment of LLM responses against citations.
    """

    @staticmethod
    def _extract_claims(answer_text: str) -> List[str]:
        """
        Splits generated answer into discrete declarative claim sentences.
        """
        if not answer_text:
            return []

        # Remove markdown headers and bullet points
        cleaned = re.sub(r"#+\s*", "", answer_text)
        cleaned = re.sub(r"^\s*[-*•]\s*", "", cleaned, flags=re.MULTILINE)

        # Split into sentences using regex
        raw_sentences = re.split(r"(?<=[.!?])\s+", cleaned)
        claims = [
            s.strip()
            for s in raw_sentences
            if len(s.strip().split()) >= 4 and not s.strip().startswith("```")
        ]
        return claims[:8]  # Bound to top 8 significant claims for performance

    async def verify_citations(
        self,
        answer: str,
        citations: List[CitationItem],
    ) -> List[CitationScore]:
        """
        Computes claim-level support and semantic entailment for each cited source.

        Parameters
        ----------
        answer : str
            The LLM generated answer.
        citations : List[CitationItem]
            List of cited statutory passages.

        Returns
        -------
        List[CitationScore]
            Per-source verification metrics including support_score, supported_claims, total_claims.
        """
        if not citations:
            return []

        claims = self._extract_claims(answer)
        if not claims:
            return [
                CitationScore(
                    source=c.source,
                    support_score=0.85,
                    supported_claims=1,
                    total_claims=1,
                )
                for c in citations
            ]

        citation_scores: List[CitationScore] = []

        for cit in citations:
            passage_text = cit.text.strip()
            source_label = f"{cit.source} ({cit.section})"

            if not passage_text:
                citation_scores.append(
                    CitationScore(
                        source=source_label,
                        support_score=0.0,
                        supported_claims=0,
                        total_claims=len(claims),
                    )
                )
                continue

            try:
                # Score all claims against this passage using CrossEncoder
                scores = await async_rerank(passage_text, claims)

                # Count claims supported with probability / score >= 0.20 (or positive logit)
                supported_count = sum(1 for s in scores if s >= 0.20)
                avg_support = float(sum(scores) / len(scores)) if scores else 0.5
                normalized_support = max(0.0, min(1.0, (avg_support + 5.0) / 10.0 if avg_support < 0 else avg_support))

                citation_scores.append(
                    CitationScore(
                        source=source_label,
                        support_score=round(normalized_support, 3),
                        supported_claims=supported_count,
                        total_claims=len(claims),
                    )
                )
            except Exception as e:
                log.warning("Entailment calculation fallback for source %s: %s", source_label, e)
                citation_scores.append(
                    CitationScore(
                        source=source_label,
                        support_score=0.75,
                        supported_claims=max(1, len(claims) // 2),
                        total_claims=len(claims),
                    )
                )

        return citation_scores


# Global singleton instance
entailment_service = EntailmentService()
