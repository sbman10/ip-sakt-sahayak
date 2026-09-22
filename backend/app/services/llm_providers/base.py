"""
backend/app/services/llm_providers/base.py
-------------------------------------------
Provider-independent abstractions and data models for LLM inference.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, Optional


class ProviderError(Exception):
    """Base exception for provider-level errors."""
    def __init__(self, message: str, provider: str = "", status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class ProviderQuotaError(ProviderError):
    """Raised when a provider hits rate limits or quota exhaustion (HTTP 429)."""
    pass


class ProviderTransientError(ProviderError):
    """Raised on transient network or server errors (HTTP 502, 503, 504)."""
    pass


class ProviderTimeoutError(ProviderError):
    """Raised when an inference request times out."""
    pass


class ProviderConfigError(ProviderError):
    """Raised when a provider is unconfigured or missing API credentials."""
    pass


class ProviderAuthError(ProviderError):
    """Raised on authentication/permission failure (HTTP 401, 403)."""
    pass


@dataclass
class LLMResponse:
    """
    Standardized result object returned by all LLM provider adapters.
    """
    text: str
    provider: str
    model: str
    finish_reason: str = "STOP"
    completed: bool = True
    usage: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    status: str = "answered"
    error_obj: Optional[Exception] = None


class BaseLLMProvider(ABC):
    """
    Abstract interface for LLM provider adapters.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier ('cerebras' or 'gemini')."""
        pass

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the provider credentials and configuration are present."""
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        """Returns the configured model name for this provider."""
        pass

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> LLMResponse:
        """
        Executes a non-blocking asynchronous generation request.
        """
        pass

    @abstractmethod
    def stream(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        """
        Streams response tokens synchronously.
        """
        pass
