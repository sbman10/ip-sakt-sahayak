"""Regression tests for provider failures reaching the public chat contract."""

from pathlib import Path
import sys
from unittest.mock import MagicMock

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas.chat import ChatResponse, ConfidenceScore
from app.services.llm_providers.base import ProviderConfigError
from app.services.llm_providers.cerebras_provider import CerebrasProvider


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


def test_cerebras_billing_error_is_configuration_error_and_not_transient():
    provider = CerebrasProvider(api_key="test-key")
    response = MagicMock()
    response.status_code = 402
    response.text = "payment required"
    response.json.return_value = {"error": "payment required"}

    with pytest.raises(ProviderConfigError) as exc_info:
        provider._handle_http_error(response)

    assert exc_info.value.status_code == 402
    assert exc_info.value.provider == "cerebras"

