"""
backend/app/services/claim_guardrails.py
----------------------------------------
Post-Generation Claim Guardrails & Safety Filter for IP-SAKTI Sahayak.
Safely detects weakly grounded claims or unverified citations and appends
statutory warning advisories to prevent reliance on hallucinated facts.
"""

from __future__ import annotations

import logging
from typing import Tuple

try:
    from backend.app.schemas.chat import ConfidenceScore
except ImportError:
    from app.schemas.chat import ConfidenceScore

log = logging.getLogger("app.services.claim_guardrails")

_STATUTORY_WARNING_CALLOUT = (
    "\n\n⚠️ Note: Some claims in this summary could not be verified against "
    "official statutory registers. Please verify with a qualified legal professional."
)


def enforce_claim_guardrails(
    answer_text: str,
    confidence: ConfidenceScore,
) -> tuple[str, ConfidenceScore]:
    """
    Enforces post-generation claim safety guardrails.

    If confidence score is under 60 (Low) or total supported claims across citations is 0,
    ensures confidence is categorized as 'Low' and appends a legal verification disclaimer.

    Parameters
    ----------
    answer_text : str
        The raw generated LLM answer text.
    confidence : ConfidenceScore
        The composite confidence evaluation model.

    Returns
    -------
    tuple[str, ConfidenceScore]
        (sanitized_answer_text, updated_confidence)
    """
    if confidence.score is None:
        # Non-grounded or out-of-scope response, no disclaimer modification needed
        return answer_text, confidence

    total_supported_claims = sum(
        cs.supported_claims for cs in (confidence.citation_scores or [])
    )

    should_downgrade = (confidence.score < 60) or (
        bool(confidence.citation_scores) and total_supported_claims == 0
    )

    if should_downgrade:
        log.warning(
            "Claim guardrail triggered: confidence=%d, supported_claims=%d. Ensuring Low label and warning.",
            confidence.score,
            total_supported_claims,
        )

        updated_confidence = confidence.model_copy(
            update={"label": "Low"}
        )

        if _STATUTORY_WARNING_CALLOUT.strip() not in answer_text:
            sanitized_text = answer_text.rstrip() + _STATUTORY_WARNING_CALLOUT
        else:
            sanitized_text = answer_text

        return sanitized_text, updated_confidence

    log.debug("Claim guardrail passed cleanly (score=%d, label=%s).", confidence.score, confidence.label)
    return answer_text, confidence
