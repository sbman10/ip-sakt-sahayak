"""
backend/app/services/llm_providers/__init__.py
-----------------------------------------------
Public exports for the dual-provider LLM package.
"""

from app.services.llm_providers.base import (
    BaseLLMProvider,
    LLMResponse,
    ProviderAuthError,
    ProviderConfigError,
    ProviderError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
)
from app.services.llm_providers.cerebras_provider import CerebrasProvider
from app.services.llm_providers.gemini_provider import GeminiProvider
from app.services.llm_providers.orchestrator import (
    DualProviderOrchestrator,
    llm_orchestrator,
    _trim_to_sentence_boundary,
)

__all__ = [
    "BaseLLMProvider",
    "LLMResponse",
    "ProviderError",
    "ProviderQuotaError",
    "ProviderTransientError",
    "ProviderTimeoutError",
    "ProviderConfigError",
    "ProviderAuthError",
    "CerebrasProvider",
    "GeminiProvider",
    "DualProviderOrchestrator",
    "llm_orchestrator",
    "_trim_to_sentence_boundary",
]
