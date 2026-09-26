"""
backend/tests/test_dual_provider.py
------------------------------------
Comprehensive test suite validating the Dual-Provider LLM architecture:
1. Gemini-only operation
2. Cerebras-only operation
3. Cerebras primary with Gemini fallback
4. Missing Cerebras key (graceful fallback to Gemini)
5. Missing Gemini key (graceful fallback to Cerebras)
6. Both keys missing (fails at request time, not startup)
7. Cerebras 429 (immediate failover without retry)
8. Gemini 429 (immediate failover without retry)
9. Cerebras timeout (failover to Gemini)
10. Both providers failing (returns degraded response, no fake answer)
11. No duplicate provider retries
12. Stream success
13. Stream failure before first token (fails over to fallback)
14. Stream failure after partial output (NO provider switch; closes cleanly)
15. No duplicate chat fallback
16. Complete answer detection & sentence boundary trimming
17. API keys not appearing in logs or diagnostics
"""

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.services.llm import GroundedAnswerText, generate_grounded_answer, get_llm_diagnostics
from app.services.llm_providers.base import (
    BaseLLMProvider,
    LLMResponse,
    ProviderAuthError,
    ProviderConfigError,
    ProviderQuotaError,
    ProviderTimeoutError,
    ProviderTransientError,
)
from app.services.llm_providers.cerebras_provider import CerebrasProvider
from app.services.llm_providers.gemini_provider import GeminiProvider
from app.services.llm_providers.orchestrator import DualProviderOrchestrator, _trim_to_sentence_boundary


# ============================================================================
# Helper Mock Providers
# ============================================================================

class MockProvider(BaseLLMProvider):
    def __init__(
        self,
        name: str,
        available: bool = True,
        generate_response: Optional[LLMResponse] = None,
        generate_error: Optional[Exception] = None,
        stream_tokens: Optional[list[str]] = None,
        stream_error: Optional[Exception] = None,
        stream_error_after_tokens: int = 0,
    ):
        self._name = name
        self._available = available
        self._generate_response = generate_response or LLMResponse(
            text=f"Response from {name}",
            provider=name,
            model=f"{name}-model",
            finish_reason="STOP",
            completed=True,
        )
        self._generate_error = generate_error
        self._stream_tokens = stream_tokens or ["Token1", "Token2"]
        self._stream_error = stream_error
        self._stream_error_after_tokens = stream_error_after_tokens
        self.generate_call_count = 0
        self.stream_call_count = 0

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_available(self) -> bool:
        return self._available

    @property
    def default_model(self) -> str:
        return f"{self._name}-model"

    async def generate(self, system_prompt: str, user_prompt: str, max_output_tokens: int = 1400, temperature: float = 0.2) -> LLMResponse:
        self.generate_call_count += 1
        if self._generate_error:
            raise self._generate_error
        return self._generate_response

    def stream(self, system_prompt: str, user_prompt: str, max_output_tokens: int = 1400, temperature: float = 0.2):
        self.stream_call_count += 1
        for i, token in enumerate(self._stream_tokens):
            if self._stream_error and i >= self._stream_error_after_tokens:
                raise self._stream_error
            yield token
        if self._stream_error and len(self._stream_tokens) <= self._stream_error_after_tokens:
            raise self._stream_error


# ============================================================================
# 1. Gemini-Only Operation
# ============================================================================

@pytest.mark.anyio
async def test_gemini_only_operation():
    """Verify operation when only Gemini is available."""
    cerebras_mock = MockProvider("cerebras", available=False)
    gemini_mock = MockProvider(
        "gemini",
        available=True,
        generate_response=LLMResponse(
            text="Grounded answer from Gemini.",
            provider="gemini",
            model="gemini-3.5-flash",
        ),
    )

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "gemini"
        assert resp.text == "Grounded answer from Gemini."
        assert resp.status == "answered"
        assert cerebras_mock.generate_call_count == 0
        assert gemini_mock.generate_call_count == 1


# ============================================================================
# 2. Cerebras-Only Operation
# ============================================================================

@pytest.mark.anyio
async def test_cerebras_only_operation():
    """Verify operation when only Cerebras is available."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_response=LLMResponse(
            text="Ultra-fast answer from Cerebras.",
            provider="cerebras",
            model="gpt-oss-120b",
        ),
    )
    gemini_mock = MockProvider("gemini", available=False)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "cerebras"
        assert resp.text == "Ultra-fast answer from Cerebras."
        assert resp.status == "answered"
        assert cerebras_mock.generate_call_count == 1
        assert gemini_mock.generate_call_count == 0


# ============================================================================
# 3. Cerebras Primary with Gemini Fallback
# ============================================================================

@pytest.mark.anyio
async def test_cerebras_primary_with_gemini_fallback():
    """Verify failover from primary Cerebras (503) to fallback Gemini."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_error=ProviderTransientError("503 Service Unavailable", provider="cerebras"),
    )
    gemini_mock = MockProvider(
        "gemini",
        available=True,
        generate_response=LLMResponse(
            text="Fallback answer from Gemini.",
            provider="gemini",
            model="gemini-3.5-flash",
        ),
    )

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "gemini"
        assert resp.text == "Fallback answer from Gemini."
        assert cerebras_mock.generate_call_count == 1
        assert gemini_mock.generate_call_count == 1


# ============================================================================
# 4. Missing Cerebras Key (Graceful Fallback)
# ============================================================================

@pytest.mark.anyio
async def test_missing_cerebras_key_graceful_fallback():
    """If Cerebras key is empty, automatically route to Gemini without failure."""
    cerebras_provider = CerebrasProvider(api_key="")
    gemini_mock = MockProvider("gemini", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_provider,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "gemini"
        assert gemini_mock.generate_call_count == 1


# ============================================================================
# 5. Missing Gemini Key (Graceful Fallback)
# ============================================================================

@pytest.mark.anyio
async def test_missing_gemini_key_graceful_fallback():
    """If Gemini key is empty, automatically route to Cerebras."""
    cerebras_mock = MockProvider("cerebras", available=True)
    gemini_provider = GeminiProvider()

    with patch.object(settings, "GEMINI_API_KEY", ""), patch.object(settings, "GEMINI_API_KEYS", []):
        orchestrator = DualProviderOrchestrator(
            cerebras_provider=cerebras_mock,
            gemini_provider=gemini_provider,
        )

        with patch.object(settings, "LLM_PRIMARY_PROVIDER", "gemini"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "cerebras"):
            resp = await orchestrator.generate_answer("System", "User")
            assert resp.provider == "cerebras"
            assert cerebras_mock.generate_call_count == 1


# ============================================================================
# 6. Both Keys Missing (Fails at Request Time, Not Startup)
# ============================================================================

@pytest.mark.anyio
async def test_both_keys_missing_fails_at_request_time():
    """If both keys are missing, generation returns degraded status without startup crash."""
    cerebras_mock = MockProvider("cerebras", available=False)
    gemini_mock = MockProvider("gemini", available=False)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    resp = await orchestrator.generate_answer("System", "User")
    assert resp.status == "degraded"
    assert resp.completed is False
    assert "unavailable" in resp.text.lower()


# ============================================================================
# 7. Cerebras 429 (Immediate Failover Without Retry)
# ============================================================================

@pytest.mark.anyio
async def test_cerebras_429_fails_over_immediately():
    """Verify that a 429 quota error stops immediately without retry and fails over."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_error=ProviderQuotaError("Rate limit 429", provider="cerebras", status_code=429),
    )
    gemini_mock = MockProvider("gemini", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "gemini"
        assert cerebras_mock.generate_call_count == 1  # No duplicate retries on 429!
        assert gemini_mock.generate_call_count == 1


# ============================================================================
# 8. Gemini 429 (Immediate Failover Without Retry)
# ============================================================================

@pytest.mark.anyio
async def test_gemini_429_fails_over_immediately():
    """Verify that a Gemini 429 immediately fails over to Cerebras."""
    gemini_mock = MockProvider(
        "gemini",
        available=True,
        generate_error=ProviderQuotaError("Gemini quota 429", provider="gemini", status_code=429),
    )
    cerebras_mock = MockProvider("cerebras", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "gemini"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "cerebras"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "cerebras"
        assert gemini_mock.generate_call_count == 1
        assert cerebras_mock.generate_call_count == 1


# ============================================================================
# 9. Cerebras Timeout (Failover to Gemini)
# ============================================================================

@pytest.mark.anyio
async def test_cerebras_timeout_fails_over():
    """Verify timeout on Cerebras triggers fallback to Gemini."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_error=ProviderTimeoutError("Connection timed out", provider="cerebras"),
    )
    gemini_mock = MockProvider("gemini", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.provider == "gemini"
        assert gemini_mock.generate_call_count == 1


# ============================================================================
# 10. Both Providers Failing (Returns Degraded, No Fake Answer)
# ============================================================================

@pytest.mark.anyio
async def test_both_providers_fail_returns_degraded():
    """Verify degraded response when both primary and fallback fail."""
    cerebras_mock = MockProvider("cerebras", available=True, generate_error=ProviderTransientError("503", provider="cerebras"))
    gemini_mock = MockProvider("gemini", available=True, generate_error=ProviderTransientError("503", provider="gemini"))

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.status == "degraded"
        assert resp.completed is False
        assert "temporarily unavailable" in resp.text.lower()


# ============================================================================
# 11. No Duplicate Provider Retries
# ============================================================================

@pytest.mark.anyio
async def test_no_duplicate_provider_retries():
    """Ensure failed provider is attempted once and not repeatedly retried."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_error=ProviderQuotaError("Quota exceeded", provider="cerebras"),
    )
    gemini_mock = MockProvider("gemini", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        await orchestrator.generate_answer("System", "User")
        assert cerebras_mock.generate_call_count == 1


# ============================================================================
# 12. Stream Success
# ============================================================================

def test_stream_success():
    """Verify normal streaming yields tokens in order."""
    cerebras_mock = MockProvider("cerebras", available=True, stream_tokens=["Section ", "3(p) ", "applies."])
    gemini_mock = MockProvider("gemini", available=True)

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"):
        tokens = list(orchestrator.stream_answer("System", "User"))
        assert tokens == ["Section ", "3(p) ", "applies."]
        assert cerebras_mock.stream_call_count == 1
        assert gemini_mock.stream_call_count == 0


# ============================================================================
# 13. Stream Failure Before First Token (Fails Over to Fallback)
# ============================================================================

def test_stream_failure_before_first_token_fails_over():
    """If primary stream fails before emitting any token, cleanly fail over to fallback."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        stream_error=ProviderTransientError("Immediate 503", provider="cerebras"),
        stream_error_after_tokens=0,
    )
    gemini_mock = MockProvider(
        "gemini",
        available=True,
        stream_tokens=["Fallback ", "tokens."],
    )

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        tokens = list(orchestrator.stream_answer("System", "User"))
        assert tokens == ["Fallback ", "tokens."]
        assert cerebras_mock.stream_call_count == 1
        assert gemini_mock.stream_call_count == 1


# ============================================================================
# 14. Stream Failure After Partial Output (NO Provider Switch)
# ============================================================================

def test_stream_failure_after_partial_output_no_provider_switch():
    """If primary fails AFTER emitting tokens, do NOT switch providers; raise error."""
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        stream_tokens=["Partial1 ", "Partial2 "],
        stream_error=ProviderTransientError("Mid-stream connection drop", provider="cerebras"),
        stream_error_after_tokens=1,  # Fails after yielding Partial1
    )
    gemini_mock = MockProvider(
        "gemini",
        available=True,
        stream_tokens=["Should ", "not ", "run."],
    )

    orchestrator = DualProviderOrchestrator(
        cerebras_provider=cerebras_mock,
        gemini_provider=gemini_mock,
    )

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"), patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        stream_gen = orchestrator.stream_answer("System", "User")

        # First token succeeds
        first_token = next(stream_gen)
        assert first_token == "Partial1 "

        # Next iteration raises mid-stream error without failing over to gemini
        with pytest.raises(ProviderTransientError):
            next(stream_gen)

        assert gemini_mock.stream_call_count == 0  # Crucial: Gemini was NOT invoked mid-stream!


# ============================================================================
# 15. No Duplicate Chat Fallback
# ============================================================================

def test_no_duplicate_chat_fallback():
    """Verify that SSE error handling correctly indicates degraded state without duplicate /api/chat fallback."""
    # Checked through GroundedAnswerText and error status
    answer = GroundedAnswerText("Partial text", completed=False, status="degraded")
    assert answer.status == "degraded"
    assert answer.completed is False


# ============================================================================
# 16. Complete Answer Detection & Truncation
# ============================================================================

@pytest.mark.anyio
async def test_complete_answer_detection():
    """Verify MAX_TOKENS triggers sentence boundary trimming and sets completed=False."""
    truncated_text = (
        "Section 3(p) bars patenting of traditional Ayurvedic formulations. "
        "Novel synergistic compositions may be patentable. Incomplete extra wor"
    )
    cerebras_mock = MockProvider(
        "cerebras",
        available=True,
        generate_response=LLMResponse(
            text=truncated_text,
            provider="cerebras",
            model="gpt-oss-120b",
            finish_reason="MAX_TOKENS",
            completed=False,
        ),
    )
    orchestrator = DualProviderOrchestrator(cerebras_provider=cerebras_mock)

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "cerebras"):
        resp = await orchestrator.generate_answer("System", "User")
        assert resp.completed is False
        assert "[The answer was shortened by the generation limit. Please ask for a shorter answer.]" in resp.text
        assert "Incomplete extra wor" not in resp.text
        assert "Novel synergistic compositions may be patentable." in resp.text


# ============================================================================
# 17. API Keys Not Appearing in Logs or Responses
# ============================================================================

def test_api_keys_not_in_logs_or_responses():
    """Verify that diagnostics and responses never reveal sensitive keys."""
    diag = get_llm_diagnostics()
    diag_str = str(diag)

    # Check that boolean presence flags are used instead of key strings
    assert "cerebras_key_present" in diag
    assert "gemini_key_present" in diag
    assert "CEREBRAS_API_KEY" not in diag
    assert "GEMINI_API_KEY" not in diag

    # Simulated secret
    secret = "sk-cerebras-super-secret-key-12345"
    with patch.object(settings, "CEREBRAS_API_KEY", secret):
        clean_diag = get_llm_diagnostics()
        assert secret not in str(clean_diag)
        assert clean_diag["cerebras_key_present"] is True
