"""Regression tests for provider failures reaching the public chat contract."""

from pathlib import Path
import sys
from unittest.mock import MagicMock

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas.chat import ChatResponse, ConfidenceScore
from app.services.llm_providers.base import ProviderAuthError, ProviderConfigError, ProviderQuotaError


def test_degraded_chat_response_is_valid_api_schema():
    response = ChatResponse(
        answer="The generation service is temporarily unavailable. No answer was generated without verification.",
        confidence=ConfidenceScore(
            score=0,
            label="Low",
            reason="Retrieval completed, but no configured generation provider was available.",
        ),
        status="degraded",
    )

    assert response.status == "degraded"


def test_groq_billing_or_quota_error_is_quota_error():
    from app.services.llm_providers.groq_provider import GroqProvider
    provider = GroqProvider(api_key="test-key")
    response = MagicMock()
    response.status_code = 429
    response.text = "rate limit reached"
    response.json.return_value = {"error": {"message": "Rate limit reached"}}

    with pytest.raises(ProviderQuotaError) as exc_info:
        provider._handle_http_error(response)

    assert exc_info.value.status_code == 429
    assert exc_info.value.provider == "groq"


def test_groq_auth_and_quota_errors():
    from app.services.llm_providers.groq_provider import GroqProvider
    from app.services.llm_providers.base import ProviderAuthError, ProviderQuotaError
    provider = GroqProvider(api_key="test-key")

    resp_401 = MagicMock()
    resp_401.status_code = 401
    resp_401.text = "invalid api key"
    resp_401.json.return_value = {"error": {"message": "Invalid API Key"}}
    with pytest.raises(ProviderAuthError):
        provider._handle_http_error(resp_401)

    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.text = "rate limit exceeded"
    resp_429.json.return_value = {"error": {"message": "Rate limit reached"}}
    with pytest.raises(ProviderQuotaError):
        provider._handle_http_error(resp_429)

