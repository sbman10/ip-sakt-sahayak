"""
backend/app/services/claim_verifier.py
---------------------------------------
Claim Extraction & Citation Entailment Service for IP-SAKTI Sahayak.
Extracts discrete factual claims from LLM responses and measures support
and entailment across cited statutory passages.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Tuple

try:
    from backend.app.core.async_utils import async_rerank, run_in_threadpool
except ImportError:
    from app.core.async_utils import async_rerank, run_in_threadpool

log = logging.getLogger("app.services.claim_verifier")

# Punctuation & sentence splitter regex
_SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
_BULLET_PREFIX_REGEX = re.compile(r"^(\d+[\.\)]|\*|-|•)\s*")


class ClaimVerifier:
    """
    NLP service to extract verifiable factual claims from legal answers
    and assess claim-to-passage entailment and coverage.
    """

    def extract_claims(self, answer_text: str) -> list[str]:
        """
        Splits generated answer into distinct factual/statutory claims using
        sentence boundary parsing, bullet unwrapping, and punctuation normalization.

        Parameters
        ----------
        answer_text : str
            Generated LLM response text.

        Returns
        -------
        list[str]
            Discrete factual claims.
        """
        if not answer_text or not answer_text.strip():
            return []

        # 1. Normalize line breaks and remove markdown headings
        clean_text = re.sub(r"#{1,6}\s+.*?\n", "\n", answer_text)
        lines = clean_text.split("\n")

        claims: list[str] = []
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            # Strip leading markdown bullets / numbers
            line_clean = _BULLET_PREFIX_REGEX.sub("", line_str).strip()
            if not line_clean:
                continue

            # Split by punctuation boundaries
            sentences = _SENTENCE_SPLIT_REGEX.split(line_clean)
            for sent in sentences:
                s = sent.strip()
                # Filter out conversational conversational fillers, greetings, disclaimers
                if len(s) < 15:
                    continue
                if re.match(
                    r"(?i)^(hello|hi|greetings|dear|thank you|regards|please note|disclaimer)",
                    s,
                ):
                    continue
                claims.append(s)

        if not claims and answer_text.strip():
            # Fallback if no full sentence detected
            claims = [answer_text.strip()]

        log.debug("Extracted %d claims from answer text of %d chars", len(claims), len(answer_text))
        return claims

    def verify_claim_support(self, claim: str, passage: str) -> float:
        """
        Calculates lexical, token-overlap, and n-gram containment support score
        (0.0 to 1.0) of a claim against a cited passage.

        Parameters
        ----------
        claim : str
            A single proposition/claim sentence.
        passage : str
            The cited legal passage text.

        Returns
        -------
        float
            Support score between 0.0 and 1.0.
        """
        if not claim or not passage:
            return 0.0

        claim_clean = re.sub(r"[^\w\s]", "", claim.lower())
        passage_clean = re.sub(r"[^\w\s]", "", passage.lower())

        claim_tokens = [w for w in claim_clean.split() if len(w) > 2]
        passage_tokens = set(passage_clean.split())

        if not claim_tokens or not passage_tokens:
            return 0.0

        # 1. Keyword overlap
        matched_tokens = [w for w in claim_tokens if w in passage_tokens]
        token_overlap_ratio = len(matched_tokens) / float(len(claim_tokens))

        # 2. Bigram overlap for phrasal alignment
        claim_bigrams = [
            f"{claim_tokens[i]} {claim_tokens[i+1]}"
            for i in range(len(claim_tokens) - 1)
        ]
        if claim_bigrams:
            matched_bigrams = [bg for bg in claim_bigrams if bg in passage_clean]
            bigram_ratio = len(matched_bigrams) / float(len(claim_bigrams))
        else:
            bigram_ratio = token_overlap_ratio

        # Weighted support score: 60% token overlap + 40% phrasal bigram overlap
        raw_support = (0.60 * token_overlap_ratio) + (0.40 * bigram_ratio)
        support_score = round(max(0.0, min(1.0, raw_support)), 4)

        return support_score

    async def evaluate_citations(
        self,
        answer_text: str,
        citations: list[dict],
    ) -> tuple[float, float, list[dict]]:
        """
        Evaluates lexical citation support and coverage of cited passages against claims.

        Parameters
        ----------
        answer_text : str
            The generated legal response.
        citations : list[dict]
            List of citation dictionaries containing 'source' and 'text'.

        Returns
        -------
        tuple[float, float, list[dict]]
            - citation_support: average lexical overlap support score across supported claims.
            - claim_coverage: ratio of total claims supported by at least one passage (supported_claims / total_claims).
            - citation_scores: list of dicts with:
              `[{"source": str, "support_score": float, "supported_claims": int, "total_claims": int}]`
        """
        claims = self.extract_claims(answer_text)
        total_claims = len(claims)

        if total_claims == 0 or not citations:
            return 0.0, 0.0, []

        # Track support per citation source
        per_source_stats: dict[str, dict[str, Any]] = {}
        for c in citations:
            src_name = c.get("source", "Legal Register")
            if src_name not in per_source_stats:
                per_source_stats[src_name] = {
                    "source": src_name,
                    "supported_claims": 0,
                    "total_claims": total_claims,
                    "scores": [],
                    "texts": [],
                }
            per_source_stats[src_name]["texts"].append(c.get("text", ""))

        # Evaluate each claim against available citations
        claim_max_supports: list[float] = []
        supported_claims_count = 0
        SUPPORT_THRESHOLD = 0.35  # minimum support score to count as supported

        for claim in claims:
            best_claim_score = 0.0
            best_source: str | None = None

            for src_name, data in per_source_stats.items():
                combined_passage = " ".join(data["texts"])
                score = self.verify_claim_support(claim, combined_passage)
                data["scores"].append(score)

                if score > best_claim_score:
                    best_claim_score = score
                    best_source = src_name

            claim_max_supports.append(best_claim_score)
            if best_claim_score >= SUPPORT_THRESHOLD:
                supported_claims_count += 1
                if best_source:
                    per_source_stats[best_source]["supported_claims"] += 1

        # 1. Claim Coverage: supported_claims / total_claims
        claim_coverage = round(supported_claims_count / float(total_claims), 4)

        # 2. Citation Support: average support score across supported claims (or max supports)
        supported_scores = [s for s in claim_max_supports if s >= SUPPORT_THRESHOLD]
        if supported_scores:
            citation_support = round(sum(supported_scores) / float(len(supported_scores)), 4)
        else:
            citation_support = round(sum(claim_max_supports) / float(len(claim_max_supports)), 4) if claim_max_supports else 0.0

        citation_support = max(0.0, min(1.0, citation_support))
        claim_coverage = max(0.0, min(1.0, claim_coverage))

        # 3. Format per-source citation_scores
        citation_scores_list: list[dict] = []
        for src_name, data in per_source_stats.items():
            scores = data["scores"]
            avg_src_score = round(sum(scores) / float(len(scores)), 4) if scores else 0.0
            citation_scores_list.append({
                "source": src_name,
                "support_score": max(0.0, min(1.0, avg_src_score)),
                "supported_claims": data["supported_claims"],
                "total_claims": total_claims,
            })

        log.info(
            "Claim verification completed: citation_support=%.2f, coverage=%.2f (%d/%d claims supported)",
            citation_support,
            claim_coverage,
            supported_claims_count,
            total_claims,
        )

        return citation_support, claim_coverage, citation_scores_list


# Global singleton instance
claim_verifier = ClaimVerifier()
