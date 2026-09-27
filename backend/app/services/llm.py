"""
backend/app/services/llm.py
----------------------------
LLM orchestration service for IP-SAKTI Sahayak.
Coordinates Groq LLM (primary) with automatic failover, mode-aware token limits,
sentence boundary trimming, and unified streaming protocol.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Iterator, Optional, Union

from app.core.config import settings
from app.services.prompt_builder import prompt_builder
from app.services.llm_providers import (
    DualProviderOrchestrator,
    LLMResponse,
    ProviderAuthError,
    ProviderConfigError,
    ProviderError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
    _trim_to_sentence_boundary,
    llm_orchestrator,
)

from app.services.key_manager import key_manager

log = logging.getLogger("app.services.llm")

# Provider error aliases
GroqQuotaExceededError = ProviderQuotaError
GroqGenerationError = ProviderTransientError
GeminiQuotaExceededError = ProviderQuotaError
GeminiGenerationError = ProviderTransientError


class GroundedAnswerText(str):
    """
    Subclass of str providing 100% backward compatibility with string operations
    while carrying generation completion metadata, provider identification, and usage.
    """
    completed: bool = True
    finish_reason: str = "STOP"
    status: str = "answered"
    provider: str = ""
    model: str = ""
    usage: Optional[Dict[str, Any]] = None

    def __new__(
        cls,
        content: str,
        completed: bool = True,
        finish_reason: str = "STOP",
        status: str = "answered",
        provider: str = "",
        model: str = "",
        usage: Optional[Dict[str, Any]] = None,
    ):
        obj = super().__new__(cls, content)
        obj.completed = completed
        obj.finish_reason = finish_reason
        obj.status = status
        obj.provider = provider
        obj.model = model
        obj.usage = usage
        return obj


def _get_client_and_key() -> tuple[Any, str]:
    """Retrieves an active client configured with a rotated key (legacy Gemini helper)."""
    from google import genai
    from app.services.key_manager import key_manager
    active_key = key_manager.get_active_key()
    client = genai.Client(api_key=active_key)
    return client, active_key


async def async_generate_grounded_answer(
    question: str,
    context: str,
    jurisdiction: str = "India",
    language: str = "EN",
    answer_mode: str = "standard",
    user_context: Optional[dict] = None,
    product_context: Optional[dict] = None,
    user_intent: Optional[str] = None,
    requested_information: Optional[Union[list[str], str]] = None,
) -> GroundedAnswerText:
    """
    Asynchronous generation using DualProviderOrchestrator.
    """
    max_tokens = settings.get_mode_token_limit(answer_mode)
    user_prompt = prompt_builder.build_user_prompt(
        question=question,
        context=context,
        jurisdiction=jurisdiction,
        language=language,
        answer_mode=answer_mode,
        user_context=user_context,
        product_context=product_context,
        user_intent=user_intent,
        requested_information=requested_information,
    )
    system_prompt = prompt_builder.SYSTEM_PROMPT

    resp = await llm_orchestrator.generate_answer(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_output_tokens=max_tokens,
        temperature=0.2,
        raise_on_failure=True,
    )

    return GroundedAnswerText(
        resp.text,
        completed=resp.completed,
        finish_reason=resp.finish_reason,
        status=resp.status,
        provider=resp.provider,
        model=resp.model,
        usage=resp.usage,
    )


def generate_grounded_answer(
    question: str,
    context: str,
    jurisdiction: str = "India",
    language: str = "EN",
    answer_mode: str = "standard",
    user_context: Optional[dict] = None,
    product_context: Optional[dict] = None,
    user_intent: Optional[str] = None,
    requested_information: Optional[Union[list[str], str]] = None,
) -> GroundedAnswerText:
    """
    Synchronous execution wrapper.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(
                asyncio.run,
                async_generate_grounded_answer(
                    question=question,
                    context=context,
                    jurisdiction=jurisdiction,
                    language=language,
                    answer_mode=answer_mode,
                    user_context=user_context,
                    product_context=product_context,
                    user_intent=user_intent,
                    requested_information=requested_information,
                ),
            ).result()

    return asyncio.run(
        async_generate_grounded_answer(
            question=question,
            context=context,
            jurisdiction=jurisdiction,
            language=language,
            answer_mode=answer_mode,
            user_context=user_context,
            product_context=product_context,
            user_intent=user_intent,
            requested_information=requested_information,
        )
    )


def stream_grounded_answer(
    question: str,
    context: str,
    jurisdiction: str = "India",
    language: str = "EN",
    answer_mode: str = "standard",
    user_context: Optional[dict] = None,
    product_context: Optional[dict] = None,
    user_intent: Optional[str] = None,
    requested_information: Optional[Union[list[str], str]] = None,
) -> Iterator[str]:
    """
    Streams response tokens using DualProviderOrchestrator.
    Raises exceptions on failure so that the caller can emit an SSE error frame.
    """
    max_tokens = settings.get_mode_token_limit(answer_mode)
    user_prompt = prompt_builder.build_user_prompt(
        question=question,
        context=context,
        jurisdiction=jurisdiction,
        language=language,
        answer_mode=answer_mode,
        user_context=user_context,
        product_context=product_context,
        user_intent=user_intent,
        requested_information=requested_information,
    )
    system_prompt = prompt_builder.SYSTEM_PROMPT

    return llm_orchestrator.stream_answer(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_output_tokens=max_tokens,
        temperature=0.2,
    )


def get_llm_diagnostics() -> Dict[str, Any]:
    """Safe health diagnostics reporting active provider topology without exposing secrets."""
    return llm_orchestrator.get_diagnostics()
