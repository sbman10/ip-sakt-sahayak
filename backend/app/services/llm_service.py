"""
backend/app/services/llm_service.py
------------------------------------
Grounded Gemini LLM Service for IP-SAKTI Sahayak.
Uses high-reliability Google Gemini service with dynamic output token limits,
key rotation, and non-blocking async execution.
"""

from __future__ import annotations

import logging
from typing import Optional, Union

from app.core.config import settings
from app.services.llm import (
    GeminiGenerationError,
    GeminiQuotaExceededError,
    GroundedAnswerText,
    async_generate_grounded_answer,
)

log = logging.getLogger("app.services.llm_service")

# Mode token limits synchronized with settings
_TOKEN_LIMITS = {
    "brief": settings.TOKEN_LIMIT_BRIEF,
    "standard": settings.TOKEN_LIMIT_STANDARD,
    "detailed": settings.TOKEN_LIMIT_DETAILED,
}


async def generate_grounded_answer(
    query: str,
    context_str: str,
    answer_mode: str = "standard",
    jurisdiction: str = "India",
    language: str = "EN",
    user_context: Optional[dict] = None,
    product_context: Optional[dict] = None,
    user_intent: Optional[str] = None,
    requested_information: Optional[Union[list[str], str]] = None,
) -> GroundedAnswerText:
    """
    Generates a grounded legal answer using Google Gemini
    with automatic key rotation, master prompt architecture, and finish_reason detection.
    """
    try:
        return await async_generate_grounded_answer(
            question=query,
            context=context_str,
            jurisdiction=jurisdiction,
            language=language,
            answer_mode=answer_mode,
            user_context=user_context,
            product_context=product_context,
            user_intent=user_intent,
            requested_information=requested_information,
        )
    except GeminiQuotaExceededError as e:
        log.error("Gemini API quota exceeded in llm_service: %s", e)
        raise
    except GeminiGenerationError as e:
        log.error("Gemini generation error in llm_service: %s", e)
        raise
    except Exception as e:
        log.error("Unexpected error in generate_grounded_answer: %s", e, exc_info=True)
        raise GeminiGenerationError(str(e)) from e
