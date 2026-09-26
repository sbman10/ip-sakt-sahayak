"""
backend/app/services/llm_providers/orchestrator.py
---------------------------------------------------
Dual-Provider Orchestrator coordinating primary and fallback LLM inference
between Cerebras and Google Gemini.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, Iterator, List, Optional, Tuple

from app.core.config import settings
from app.services.llm_providers.base import (
    BaseLLMProvider,
    LLMResponse,
    ProviderConfigError,
    ProviderError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
)
from app.services.llm_providers.cerebras_provider import CerebrasProvider
from app.services.llm_providers.gemini_provider import GeminiProvider

log = logging.getLogger("app.services.llm_providers.orchestrator")


def _trim_to_sentence_boundary(text: str) -> str:
    """
    Trims text to the last complete sentence boundary (. ! ?).
    """
    if not text:
        return text
    matches = list(re.finditer(r'([.!?])(\s+|$)', text))
    if matches:
        last_match = matches[-1]
        end_pos = last_match.end(1)
        trimmed = text[:end_pos].strip()
        if len(trimmed) > 30:
            return trimmed
    return text.strip()


class DualProviderOrchestrator:
    """
    Orchestrates LLM generation across primary and fallback providers.
    Supports Cerebras and Google Gemini with failover on quota (429),
    transient errors (500/503), timeouts, and missing credentials.
    """

    def __init__(
        self,
        cerebras_provider: Optional[BaseLLMProvider] = None,
        gemini_provider: Optional[BaseLLMProvider] = None,
    ) -> None:
        self._cerebras = cerebras_provider or CerebrasProvider()
        self._gemini = gemini_provider or GeminiProvider()

    def get_provider(self, name: str) -> BaseLLMProvider:
        normalized = name.strip().lower()
        if normalized == "cerebras":
            return self._cerebras
        if normalized == "gemini":
            return self._gemini
        raise ProviderConfigError(f"Unknown LLM provider: '{name}'. Must be 'cerebras' or 'gemini'.")

    def _resolve_candidate_order(self) -> List[Tuple[str, BaseLLMProvider]]:
        """
        Determines the priority order of providers based on settings and availability.
        Order:
          1. Configured primary provider (if available, or attempted first)
          2. Configured fallback provider (if available and distinct)
        """
        primary_name = settings.LLM_PRIMARY_PROVIDER.strip().lower()
        fallback_name = settings.LLM_FALLBACK_PROVIDER.strip().lower()

        candidates: List[Tuple[str, BaseLLMProvider]] = []

        primary_p = self.get_provider(primary_name)
        fallback_p = self.get_provider(fallback_name)

        # If primary has credentials, use primary first
        if primary_p.is_available:
            candidates.append((primary_name, primary_p))
            if fallback_p.is_available and fallback_name != primary_name:
                candidates.append((fallback_name, fallback_p))
        else:
            # Primary is not available; check fallback
            if fallback_p.is_available:
                log.info(
                    "Primary provider '%s' is not configured. Automatically using fallback provider '%s'.",
                    primary_name, fallback_name
                )
                candidates.append((fallback_name, fallback_p))
            else:
                # Neither is available; include primary so caller receives clear request-time error
                candidates.append((primary_name, primary_p))

        return candidates

    async def generate_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
        raise_on_failure: bool = False,
    ) -> LLMResponse:
        """
        Executes generation against the primary provider with single failover to fallback.
        If both fail, returns a degraded LLMResponse (or raises last_exception if raise_on_failure=True).
        """
        candidates = self._resolve_candidate_order()
        last_error: Optional[str] = None
        last_exception: Optional[Exception] = None
        last_provider_name = ""

        for idx, (p_name, provider) in enumerate(candidates):
            last_provider_name = p_name
            if not provider.is_available:
                log.warning("Provider '%s' is not available (API key missing). Skipping.", p_name)
                last_error = f"Provider '{p_name}' has no API key configured."
                if last_exception is None:
                    last_exception = ProviderConfigError(last_error, provider=p_name)
                continue

            try:
                log.info("Attempting statutory generation via provider: %s", p_name)
                resp = await provider.generate(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_output_tokens=max_output_tokens,
                    temperature=temperature,
                )

                # Truncation check and sentence boundary trimming
                if not resp.completed or resp.finish_reason in ("MAX_TOKENS", "LENGTH"):
                    trimmed = _trim_to_sentence_boundary(resp.text)
                    shortened_notice = "\n\n[The answer was shortened by the generation limit. Please ask for a shorter answer.]"
                    resp.text = f"{trimmed}{shortened_notice}"
                    resp.completed = False

                return resp

            except (ProviderQuotaError, ProviderTransientError, ProviderTimeoutError, ProviderError, Exception) as err:
                last_exception = err
                last_error = f"{type(err).__name__}: {err}"
                log.warning("Provider '%s' failed during generation: %s", p_name, err)

                # If a fallback candidate is available, attempt it once
                if idx < len(candidates) - 1:
                    next_p_name = candidates[idx + 1][0]
                    log.info("Failing over from '%s' to fallback provider '%s'...", p_name, next_p_name)
                    continue

        # If all candidates exhausted, return degraded response (never a fake answer)
        log.error("All configured LLM providers failed. Last error: %s", last_error)
        if raise_on_failure and last_exception is not None:
            raise last_exception

        fallback_msg = (
            "The statutory reasoning engine is temporarily unavailable across all configured providers. "
            "Please try again in a few moments."
        )
        return LLMResponse(
            text=fallback_msg,
            provider=last_provider_name or "none",
            model="none",
            finish_reason="ERROR",
            completed=False,
            error=last_error,
            status="degraded",
            error_obj=last_exception,
        )

    def stream_answer(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        """
        Streams answer tokens from the active provider.
        If the primary provider fails BEFORE emitting any tokens, fails over to fallback.
        If tokens have already been emitted, terminates with exception so stream closes degraded.
        """
        candidates = self._resolve_candidate_order()
        tokens_emitted = 0
        last_err: Optional[Exception] = None

        for idx, (p_name, provider) in enumerate(candidates):
            if not provider.is_available:
                log.warning("Provider '%s' is not available for streaming. Skipping.", p_name)
                continue

            try:
                log.info("Starting token stream via provider: %s", p_name)
                for token in provider.stream(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_output_tokens=max_output_tokens,
                    temperature=temperature,
                ):
                    tokens_emitted += 1
                    yield token

                # If completed successfully, return
                return

            except Exception as stream_err:
                last_err = stream_err
                log.error("Streaming error on provider '%s' (tokens_emitted=%d): %s", p_name, tokens_emitted, stream_err)

                # Invariant: Do NOT call another provider after partial streaming output
                if tokens_emitted > 0:
                    log.warning("Tokens already emitted (%d). Aborting stream without secondary failover.", tokens_emitted)
                    raise stream_err

                # Failover only if ZERO tokens were emitted
                if idx < len(candidates) - 1:
                    next_p_name = candidates[idx + 1][0]
                    log.info("Zero tokens emitted. Failing over to fallback provider '%s' for streaming...", next_p_name)
                    continue
                else:
                    raise stream_err

        if last_err:
            raise last_err
        raise ProviderConfigError("No available LLM providers configured for streaming.")

    def get_diagnostics(self) -> Dict[str, Any]:
        """
        Safe health diagnostics reporting provider status without exposing secrets.
        """
        primary_name = settings.LLM_PRIMARY_PROVIDER.strip().lower()
        fallback_name = settings.LLM_FALLBACK_PROVIDER.strip().lower()

        primary_p = self.get_provider(primary_name)
        fallback_p = self.get_provider(fallback_name)

        return {
            "primary_provider": primary_name,
            "fallback_provider": fallback_name,
            "primary_available": primary_p.is_available,
            "fallback_available": fallback_p.is_available,
            "cerebras_key_present": self._cerebras.is_available,
            "gemini_key_present": self._gemini.is_available,
            "cerebras_model": settings.CEREBRAS_MODEL,
            "gemini_model": getattr(settings, "GEMINI_MODEL", settings.PRIMARY_MODEL),
            "retrieval_backend": settings.RETRIEVAL_BACKEND,
            "qdrant_collection": settings.QDRANT_PRODUCTION_COLLECTION,
            "generation_timeout_seconds": settings.GENERATION_TIMEOUT_SECONDS,
            "generation_max_retries": settings.GENERATION_MAX_RETRIES,
        }


# Global singleton orchestrator
llm_orchestrator = DualProviderOrchestrator()
