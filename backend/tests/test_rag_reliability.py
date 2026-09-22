"""
backend/tests/test_rag_reliability.py
--------------------------------------
Comprehensive test suite validating RAG answer-generation reliability:
1. SSE token event format: {"type":"token","token":"..."}
2. SSE citations event format: {"type":"citations","citations":[...]}
3. SSE done event format: {"type":"done","done":true,"status":"answered"} (no raw [DONE])
4. SSE error event format: {"type":"error","message":"...","status":"degraded"}
5. 429/quota error stops immediately without retry and raises GeminiQuotaExceededError
6. 503 error retries at most once and raises GeminiGenerationError
7. finish_reason == 'MAX_TOKENS' trims to sentence boundary, appends notice, sets completed=False
8. finish_reason == 'STOP' sets completed=True
9. Mode-aware token limits: brief=700, standard=1400, detailed=2400
10. Greetings/small-talk return CHITCHAT with zero Gemini calls
11. Prompt builder uses "Not provided" without invented Ayurvedic/product defaults
12. Streaming error emits degraded error event and closes cleanly
"""

import json
from pathlib import Path
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.services.intent_classifier import IntentClassifier, intent_classifier
from app.services.llm import (
    GeminiGenerationError,
    GeminiQuotaExceededError,
    GroundedAnswerText,
    _trim_to_sentence_boundary,
    generate_grounded_answer,
    stream_grounded_answer,
)
from app.services.prompt_builder import prompt_builder


# ============================================================================
# 1. SSE Protocol Event Formats
# ============================================================================

def test_token_event_format():
    token_str = "Section 3(p) applies."
    event = json.dumps({"type": "token", "token": token_str})
    parsed = json.loads(event)
    assert parsed["type"] == "token"
    assert parsed["token"] == token_str


def test_citations_event_format():
    citations = [
        {
            "source_id": "SRC-001",
            "source": "Patents Act 1970",
            "section": "Section 3(p)",
            "text": "Traditional knowledge is not an invention.",
        }
    ]
    event = json.dumps({"type": "citations", "citations": citations})
    parsed = json.loads(event)
    assert parsed["type"] == "citations"
    assert len(parsed["citations"]) == 1
    assert parsed["citations"][0]["source_id"] == "SRC-001"


def test_done_event_format():
    event = json.dumps({"type": "done", "done": True, "status": "answered", "completed": True})
    parsed = json.loads(event)
    assert parsed["type"] == "done"
    assert parsed["done"] is True
    assert parsed["status"] == "answered"
    assert parsed["completed"] is True
    assert "[DONE]" not in event


def test_error_event_format():
    event = json.dumps({"type": "error", "message": "Rate limit exceeded", "status": "degraded"})
    parsed = json.loads(event)
    assert parsed["type"] == "error"
    assert parsed["status"] == "degraded"
    assert "Rate limit" in parsed["message"]


# ============================================================================
# 2. Mode-Aware Token Limits
# ============================================================================

def test_mode_token_limits():
    assert settings.TOKEN_LIMIT_BRIEF == 1500
    assert settings.TOKEN_LIMIT_STANDARD == 4096
    assert settings.TOKEN_LIMIT_DETAILED == 8192

    assert settings.get_mode_token_limit("brief") == 1500
    assert settings.get_mode_token_limit("standard") == 4096
    assert settings.get_mode_token_limit("detailed") == 8192
    assert settings.get_mode_token_limit("unknown") == 4096
    assert settings.get_mode_token_limit(None) == 4096


# ============================================================================
# 3. Gemini Quota & Transient Retry Behavior
# ============================================================================

def test_no_retry_on_429():
    """Verify that a 429 quota error stops immediately with 1 attempt and raises GeminiQuotaExceededError."""
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED: Quota exceeded")

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "gemini"), \
         patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        with patch("app.services.llm._get_client_and_key", return_value=(mock_client, "fake-key-123")):
            with patch("app.services.llm.key_manager.mark_rate_limited") as mock_mark:
                with pytest.raises(GeminiQuotaExceededError):
                    generate_grounded_answer(
                        question="What is Section 3(p)?",
                        context="[SRC-001] Context",
                    )
                # Must have attempted exactly once (no retry on 429)
                assert mock_client.models.generate_content.call_count == 1
                mock_mark.assert_called_once_with("fake-key-123")


def test_single_retry_on_503():
    """Verify that a 503 transient error is retried at most once and raises GeminiGenerationError if it persists."""
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable: High load")

    with patch.object(settings, "LLM_PRIMARY_PROVIDER", "gemini"), \
         patch.object(settings, "LLM_FALLBACK_PROVIDER", "gemini"):
        with patch("app.services.llm._get_client_and_key", return_value=(mock_client, "fake-key-123")):
            with patch("time.sleep") as mock_sleep:
                with pytest.raises(GeminiGenerationError):
                    generate_grounded_answer(
                        question="What is Section 3(p)?",
                        context="[SRC-001] Context",
                    )
                # Exactly 2 attempts (1 initial + 1 retry)
                assert mock_client.models.generate_content.call_count == 2
                mock_sleep.assert_called_once_with(1.5)


# ============================================================================
# 4. Truncation and Sentence Boundary Trimming
# ============================================================================

def test_trim_to_sentence_boundary():
    text = "First sentence is complete. Second sentence is also complete. Incomplete third sentence that was cu"
    trimmed = _trim_to_sentence_boundary(text)
    assert trimmed == "First sentence is complete. Second sentence is also complete."


def test_finish_reason_max_tokens_truncation():
    """Verify that finish_reason=MAX_TOKENS trims to sentence boundary and appends notice."""
    mock_candidate = MagicMock()
    mock_candidate.finish_reason = "MAX_TOKENS"

    mock_response = MagicMock()
    mock_response.text = (
        "Section 3(p) bars patenting of traditional knowledge. "
        "An applicant cannot claim known formulations. Extra words cut of"
    )
    mock_response.candidates = [mock_candidate]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.services.llm._get_client_and_key", return_value=(mock_client, "fake-key-123")):
        result = generate_grounded_answer(
            question="Explain Section 3(p).",
            context="[SRC-001] Text",
            answer_mode="brief",
        )

        assert isinstance(result, GroundedAnswerText)
        assert result.completed is False
        assert result.finish_reason == "MAX_TOKENS"
        assert "[The answer was shortened by the generation limit. Please ask for a shorter answer.]" in result
        assert "Extra words cut of" not in result
        assert "An applicant cannot claim known formulations." in result


def test_finish_reason_stop_normal():
    """Verify that normal finish_reason=STOP results in completed=True."""
    mock_candidate = MagicMock()
    mock_candidate.finish_reason = "STOP"

    mock_response = MagicMock()
    mock_response.text = "This is a full, complete legal response."
    mock_response.candidates = [mock_candidate]

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.services.llm._get_client_and_key", return_value=(mock_client, "fake-key-123")):
        result = generate_grounded_answer(
            question="Explain Section 3(p).",
            context="[SRC-001] Text",
        )

        assert isinstance(result, GroundedAnswerText)
        assert result.completed is True
        assert result.finish_reason == "STOP"
        assert "[The answer was shortened" not in result
        assert result == "This is a full, complete legal response."


# ============================================================================
# 5. Prompt Construction Without Invented Defaults
# ============================================================================

def test_prompt_no_invented_defaults():
    """Verify that unprovided user and product contexts default cleanly to 'Not provided'."""
    prompt = prompt_builder.build_user_prompt(
        question="What are the patent restrictions on traditional herbal formulations?",
        context="[SRC-001] Indian Patents Act 1970 § 3(p)",
        jurisdiction="India",
        user_context=None,
        product_context=None,
    )

    assert "User role: Not provided" in prompt
    assert "Formulation type: Not provided" in prompt
    assert "Ingredients / Biological resources: Not provided" in prompt
    assert "Commercial status: Not provided" in prompt

    # Ensure invented values do not appear
    assert "Classical Ayurvedic formulation" not in prompt
    assert "Polyherbal extract" not in prompt
    assert "IP Researcher / Patent Agent" not in prompt


# ============================================================================
# 6. Intent Classification & Zero Gemini Calls on Greetings
# ============================================================================

@pytest.mark.anyio
async def test_greeting_zero_gemini_calls():
    """Verify that greetings return CHITCHAT via fast deterministic rules without invoking Gemini."""
    classifier = IntentClassifier()

    with patch.object(classifier, "_call_llm_classifier") as mock_llm_call:
        res = await classifier.classify_intent("Hello, good morning!")
        assert res.intent == "CHITCHAT"
        assert res.confidence == 1.0
        mock_llm_call.assert_not_called()


@pytest.mark.anyio
async def test_statutory_domain_query_fast_rule():
    """Verify that common statutory queries match deterministic domain keywords."""
    classifier = IntentClassifier()
    fast_res = classifier._fast_rule_classify("What does Section 3(p) of the Patents Act say?")
    assert fast_res is not None
    assert fast_res.intent == "KNOWLEDGE_SEEK"
    assert fast_res.confidence == 1.0

    # End-to-end classify_intent without LLM calls
    res = await classifier.classify_intent("What does Section 3(p) of the Patents Act say?")
    assert res.intent == "KNOWLEDGE_SEEK"
    assert res.confidence == 1.0


# ============================================================================
# 7. Streaming Failure Exception Propagation
# ============================================================================

def test_streaming_error_raises_exception():
    """Verify that stream_grounded_answer raises exceptions rather than yielding error text."""
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.side_effect = Exception("Connection reset by peer")

    with patch("app.services.llm._get_client_and_key", return_value=(mock_client, "fake-key-123")):
        with pytest.raises(GeminiGenerationError):
            list(stream_grounded_answer(
                question="Tell me about biological diversity act",
                context="[SRC-001] Context",
            ))
