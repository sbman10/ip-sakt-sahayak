"""
backend/app/services/llm_providers/cerebras_provider.py
--------------------------------------------------------
Cerebras LLM Provider adapter using OpenAI-compatible REST API.
Endpoint: https://api.cerebras.ai/v1/chat/completions
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, Iterator, Optional

import httpx

from app.core.config import settings
from app.services.llm_providers.base import (
    BaseLLMProvider,
    LLMResponse,
    ProviderAuthError,
    ProviderConfigError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
)

log = logging.getLogger("app.services.llm_providers.cerebras")


class CerebrasProvider(BaseLLMProvider):
    """
    Adapter for ultra-fast statutory inference using Cerebras Wafer-Scale Engine.
    Exposes OpenAI-compatible completions and streaming via HTTPX.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
    ) -> None:
        self._explicit_api_key = api_key
        self._explicit_base_url = base_url
        self._explicit_model = model
        self._timeout = timeout_seconds or settings.GENERATION_TIMEOUT_SECONDS
        self._max_retries = max_retries if max_retries is not None else settings.GENERATION_MAX_RETRIES

    @property
    def api_key(self) -> str:
        return self._explicit_api_key if self._explicit_api_key is not None else (settings.CEREBRAS_API_KEY or "")

    @property
    def base_url(self) -> str:
        raw = self._explicit_base_url if self._explicit_base_url is not None else (settings.CEREBRAS_BASE_URL or "https://api.cerebras.ai/v1")
        return raw.rstrip("/")

    @property
    def name(self) -> str:
        return "cerebras"

    @property
    def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    @property
    def default_model(self) -> str:
        return self._explicit_model if self._explicit_model is not None else settings.CEREBRAS_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_available:
            raise ProviderConfigError("Cerebras API key is missing or not configured.", provider=self.name)
        return {
            "Authorization": f"Bearer {self.api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "RAGVYN-AI/1.0",
        }

    def _handle_http_error(self, response: httpx.Response) -> None:
        status_code = response.status_code
        err_text = response.text
        try:
            err_json = response.json()
            if isinstance(err_json, dict) and "error" in err_json:
                err_text = str(err_json["error"])
        except Exception:
            pass

        log.error("Cerebras API error [%d]: %s", status_code, err_text)

        if status_code in (401, 403):
            raise ProviderAuthError(f"Cerebras authentication failed: {err_text}", provider=self.name, status_code=status_code)
        elif status_code == 429:
            raise ProviderQuotaError(f"Cerebras rate limit/quota exceeded: {err_text}", provider=self.name, status_code=status_code)
        elif status_code in (500, 502, 503, 504):
            raise ProviderTransientError(f"Cerebras server error ({status_code}): {err_text}", provider=self.name, status_code=status_code)
        else:
            raise ProviderTransientError(f"Cerebras HTTP {status_code}: {err_text}", provider=self.name, status_code=status_code)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        """
        Executes an asynchronous completion call to Cerebras with bounded retries for transient errors.
        """
        if not self.is_available:
            raise ProviderConfigError("Cerebras API key is not configured.", provider=self.name)

        url = f"{self.base_url}/chat/completions"
        headers = self._get_headers()
        payload = {
            "model": self.default_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_output_tokens,
            "temperature": temperature,
            "stream": False,
        }

        attempts = 0
        max_attempts = 1 + max(0, self._max_retries)

        while attempts < max_attempts:
            attempts += 1
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code != 200:
                        self._handle_http_error(resp)

                    data = resp.json()
                    choice = data.get("choices", [{}])[0]
                    content = choice.get("message", {}).get("content", "") or ""
                    raw_fr = str(choice.get("finish_reason", "stop")).upper()
                    is_completed = raw_fr not in ("LENGTH", "MAX_TOKENS")

                    return LLMResponse(
                        text=content,
                        provider=self.name,
                        model=self._model,
                        finish_reason=raw_fr,
                        completed=is_completed,
                        usage=data.get("usage"),
                        status="answered",
                    )

            except (ProviderAuthError, ProviderQuotaError):
                # Never retry quota (429) or auth (401)
                raise

            except (httpx.TimeoutException, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
                log.warning("Cerebras timeout on attempt %d: %s", attempts, e)
                if attempts >= max_attempts:
                    raise ProviderTimeoutError(f"Cerebras request timed out after {self._timeout}s", provider=self.name) from e
                await asyncio.sleep(1.0)

            except ProviderTransientError as e:
                log.warning("Cerebras transient error on attempt %d: %s", attempts, e)
                if attempts >= max_attempts:
                    raise
                await asyncio.sleep(1.5)

            except Exception as e:
                log.error("Unexpected Cerebras client error: %s", e)
                raise ProviderTransientError(f"Cerebras client error: {e}", provider=self.name) from e

        raise ProviderTransientError("Cerebras generation failed after retry limit.", provider=self.name)

    def stream(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        """
        Streams response tokens from Cerebras via SSE (chunk-by-chunk).
        """
        if not self.is_available:
            raise ProviderConfigError("Cerebras API key is not configured.", provider=self.name)

        url = f"{self.base_url}/chat/completions"
        headers = self._get_headers()
        payload = {
            "model": self.default_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_output_tokens,
            "temperature": temperature,
            "stream": True,
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if resp.status_code != 200:
                        # Consume error body for diagnosis
                        resp.read()
                        self._handle_http_error(resp)

                    for line in resp.iter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue

                        raw_data = line[5:].strip()
                        if raw_data == "[DONE]":
                            break

                        try:
                            parsed = json.loads(raw_data)
                            choices = parsed.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                token = delta.get("content")
                                if token:
                                    yield token
                        except json.JSONDecodeError:
                            continue

        except (ProviderAuthError, ProviderQuotaError, ProviderTransientError, ProviderTimeoutError):
            raise
        except (httpx.TimeoutException, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
            log.error("Cerebras stream timed out: %s", e)
            raise ProviderTimeoutError(f"Cerebras streaming timed out: {e}", provider=self.name) from e
        except Exception as e:
            log.error("Cerebras stream failed: %s", e)
            raise ProviderTransientError(f"Cerebras streaming error: {e}", provider=self.name) from e
