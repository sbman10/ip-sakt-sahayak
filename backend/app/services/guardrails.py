"""
backend/app/services/guardrails.py
----------------------------------
Domain guardrails and statutory safety checks for IP-SAKTI Sahayak.
Prevents ungrounded hallucination, enforces legal scope, and handles abstention.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple

from app.core.config import settings

log = logging.getLogger("app.services.guardrails")

# Out-of-domain conversational triggers
_OUT_OF_SCOPE_PATTERNS = [
    r"\b(weather|cricket|football|movie|recipe|celebrity|horoscope|joke|song|poem)\b",
    r"\b(crypto|bitcoin|stock market prediction|lottery)\b",
]


class GuardrailService:
    """
    Validates input safety, domain relevance, and statutory grounding before/after LLM generation.
    """

    def __init__(self, min_similarity: float = 0.20) -> None:
        self.min_similarity = min_similarity

    def check_input_relevance(self, question: str) -> Tuple[bool, Optional[str]]:
        """
        Fast preliminary filter for off-topic or conversational queries.

        Returns
        -------
        Tuple[bool, Optional[str]]
            (is_safe, abstention_message_if_blocked)
        """
        q_lower = question.lower().strip()

        # Check trivial greetings
        if q_lower in ("hi", "hello", "hey", "good morning", "good evening", "namaste"):
            return False, (
                "Namaste! I am IP-SAKTI Sahayak, your AI assistant for Ayurvedic and Indian "
                "Intellectual Property Law. How may I assist you with patentability, traditional knowledge (TKDL), "
                "or regulatory compliance today?"
            )

        for pattern in _OUT_OF_SCOPE_PATTERNS:
            if re.search(pattern, q_lower):
                return False, (
                    "This inquiry falls outside the legal scope of IP-SAKTI Sahayak. "
                    "I am specialized in Indian Intellectual Property law, Patents Act 1970, "
                    "Biological Diversity Act 2002, Traditional Knowledge Digital Library (TKDL), "
                    "and AYUSH regulatory compliance."
                )

        return True, None

    def check_retrieval_grounding(
        self,
        top_similarity: float,
        candidate_count: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Determines whether retrieved context is sufficient to safely answer.

        Returns
        -------
        Tuple[bool, Optional[str]]
            (is_grounded, abstention_message_if_insufficient)
        """
        if candidate_count == 0:
            log.warning("Guardrail triggered abstention: 0 candidates retrieved.")
            return False, (
                "I cannot find an authoritative statutory ground or legal record in the knowledge registers "
                "to answer this question with sufficient certainty.\n\n"
                "To protect against incorrect legal advice, I abstain from generating an ungrounded response. "
                "Please consult a qualified Indian Patent Agent or legal professional."
            )

        return True, None


# Global singleton instance
guardrail_service = GuardrailService(min_similarity=0.20)
