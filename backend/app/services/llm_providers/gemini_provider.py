"""
backend/app/services/llm_providers/gemini_provider.py
------------------------------------------------------
Google Gemini LLM Provider adapter using google-genai SDK.
Integrates Key Manager pool rotation and strict bounded retries.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Iterator, Optional

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.services.key_manager import key_manager
from app.services.llm_providers.base import (
    BaseLLMProvider,
    LLMResponse,
    ProviderAuthError,
    ProviderConfigError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
)

log = logging.getLogger("app.services.llm_providers.gemini")


class GeminiProvider(BaseLLMProvider):
    """
    Adapter for Google Gemini using the official google-genai SDK
    with automatic key pool rotation and bounded transient retries.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        max_retries: Optional[int] = None,
    ) -> None:
        self._model = model or getattr(settings, "GEMINI_MODEL", settings.PRIMARY_MODEL)
        self._max_retries = max_retries if max_retries is not None else settings.GENERATION_MAX_RETRIES

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def is_available(self) -> bool:
        return bool(settings.get_gemini_keys())

    @property
    def default_model(self) -> str:
        return self._model

    def _get_client_and_key(self) -> tuple[genai.Client, str]:
        try:
            import app.services.llm as llm_service_module
            if hasattr(llm_service_module, "_get_client_and_key"):
                return llm_service_module._get_client_and_key()
        except Exception:
            pass

        if not self.is_available:
            raise ProviderConfigError("No Gemini API keys configured.", provider=self.name)
        active_key = key_manager.get_active_key()
        client = genai.Client(api_key=active_key)
        return client, active_key

    def _is_quota_error(self, err: Exception) -> bool:
        msg = str(err).lower()
        return "429" in msg or "resource_exhausted" in msg or "quota" in msg

    def _is_transient_error(self, err: Exception) -> bool:
        msg = str(err).lower()
        return "503" in msg or "502" in msg or "504" in msg or "unavailable" in msg or "overloaded" in msg

    def _is_auth_error(self, err: Exception) -> bool:
        msg = str(err).lower()
        return "401" in msg or "403" in msg or "api_key_invalid" in msg or "permission_denied" in msg

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 1400,
        temperature: float = 0.2,
    ) -> LLMResponse:
        """
        Executes asynchronous generation using asyncio.to_thread on the synchronous SDK client.
        """
        return await asyncio.to_thread(
            self._sync_generate,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
        )

    def _sync_generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 1400,
        temperature: float = 0.2,
    ) -> LLMResponse:
        client, active_key = self._get_client_and_key()
        attempts = 0
        max_attempts = 1 + max(0, self._max_retries)

        while attempts < max_attempts:
            attempts += 1
            try:
                response = client.models.generate_content(
                    model=self._model,
                    contents=user_prompt,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=temperature,
                        top_p=0.9,
                        max_output_tokens=max_output_tokens,
                    ),
                )

                raw_text = response.text or ""
                finish_reason = "STOP"
                if response.candidates:
                    raw_fr = getattr(response.candidates[0], "finish_reason", None)
                    if raw_fr is not None:
                        finish_reason = str(raw_fr).split(".")[-1].upper()

                is_completed = finish_reason not in ("MAX_TOKENS", "LENGTH")

                usage_data = None
                if getattr(response, "usage_metadata", None):
                    um = response.usage_metadata
                    usage_data = {
                        "prompt_tokens": getattr(um, "prompt_token_count", None),
                        "candidates_tokens": getattr(um, "candidates_token_count", None),
                        "total_tokens": getattr(um, "total_token_count", None),
                    }

                return LLMResponse(
                    text=raw_text or "No response generated by model.",
                    provider=self.name,
                    model=self._model,
                    finish_reason=finish_reason,
                    completed=is_completed,
                    usage=usage_data,
                    status="answered",
                )

            except Exception as e:
                if self._is_quota_error(e):
                    log.warning("Gemini 429/quota hit on key ...%s. Marking key rate-limited without retry.", active_key[-6:] if len(active_key) >= 6 else active_key)
                    key_manager.mark_rate_limited(active_key)
                    raise ProviderQuotaError("Gemini API quota exceeded.", provider=self.name, status_code=429) from e

                if self._is_auth_error(e):
                    log.error("Gemini auth error on key ...%s: %s", active_key[-6:] if len(active_key) >= 6 else active_key, e)
                    raise ProviderAuthError(f"Gemini authentication failed: {e}", provider=self.name, status_code=401) from e

                if self._is_transient_error(e):
                    log.warning("Gemini transient server error on attempt %d: %s", attempts, e)
                    if attempts < max_attempts:
                        time.sleep(1.5)
                        try:
                            client, active_key = self._get_client_and_key()
                        except Exception:
                            pass
                        continue
                    raise ProviderTransientError(f"Gemini server unavailable: {e}", provider=self.name, status_code=503) from e

                log.error("Gemini generation error: %s", e)
                raise ProviderTransientError(f"Gemini generation error: {e}", provider=self.name) from e

        raise ProviderTransientError("Gemini generation failed after retry limit.", provider=self.name)

    def stream(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 1400,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        client, active_key = self._get_client_and_key()

        try:
            response_stream = client.models.generate_content_stream(
                model=self._model,
                contents=user_prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    top_p=0.9,
                    max_output_tokens=max_output_tokens,
                ),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            if self._is_quota_error(e):
                log.warning("Gemini streaming quota hit on key ...%s", active_key[-6:] if len(active_key) >= 6 else active_key)
                key_manager.mark_rate_limited(active_key)
                raise ProviderQuotaError("Gemini quota exceeded during streaming.", provider=self.name, status_code=429) from e

            if self._is_auth_error(e):
                raise ProviderAuthError(f"Gemini authentication failed: {e}", provider=self.name, status_code=401) from e

            if self._is_transient_error(e):
                raise ProviderTransientError(f"Gemini server unavailable during stream: {e}", provider=self.name, status_code=503) from e

            log.error("Gemini streaming error: %s", e)
            raise ProviderTransientError(f"Gemini streaming error: {e}", provider=self.name) from e
