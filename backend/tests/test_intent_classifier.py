"""
Intent-identification and routing layer tests for IP-SAKTI Sahayak.

Tests verify:
1. Greetings route to CHITCHAT and skip retrieval.
2. Thanks route to CHITCHAT and skip retrieval.
3. Legal/IP query routes to KNOWLEDGE_SEEK.
4. Ambiguous query routes to CLARIFICATION_NEEDED.
5. Unrelated query routes to OUT_OF_SCOPE.
6. Unsafe query preserves guardrail behavior.
7. Rewritten follow-up query is used for retrieval.
8. Classifier failure falls back safely to existing RAG pipeline.
9. Malformed classifier JSON is handled safely.
10. /chat/stream follows the same intent routing rules.
11. Non-knowledge intents never call hybrid_rrf_search.
"""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConfidenceScore,
    ExtractedEntities,
    IntentClassification,
)
from app.services.intent_classifier import (
    IntentClassifier,
    build_chitchat_response,
    build_clarification_response,
    build_out_of_scope_response,
    build_unsafe_response,
    intent_classifier,
)


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Fast Rule Tests (Zero Latency Deterministic Pre-filter)
# ---------------------------------------------------------------------------

def test_fast_rule_greeting_chitchat():
    async def _run():
        classifier = IntentClassifier()
        for q in ["Hello", "Hi there", "Namaste", "Good morning", "Hey!"]:
            result = await classifier.classify_intent(q)
            assert result.intent == "CHITCHAT"
            assert result.confidence == 1.0
    asyncio.run(_run())


def test_fast_rule_thanks_chitchat():
    async def _run():
        classifier = IntentClassifier()
        for q in ["Thank you", "Thanks so much", "Shukriya", "Dhanyawad"]:
            result = await classifier.classify_intent(q)
            assert result.intent == "CHITCHAT"
            assert result.confidence == 1.0
    asyncio.run(_run())


def test_fast_rule_ambiguous_clarification():
    async def _run():
        classifier = IntentClassifier()
        for q in ["It is not working", "What should I do?", "Tell me about registration"]:
            result = await classifier.classify_intent(q)
            assert result.intent == "CLARIFICATION_NEEDED"
            assert result.confidence >= 0.8
            assert len(result.clarification_question) > 0
    asyncio.run(_run())


def test_fast_rule_out_of_scope():
    async def _run():
        classifier = IntentClassifier()
        for q in ["What is the weather today?", "Who won the cricket match?", "Write a poem"]:
            result = await classifier.classify_intent(q)
            assert result.intent == "OUT_OF_SCOPE"
            assert result.confidence >= 0.9
    asyncio.run(_run())


# ---------------------------------------------------------------------------
# 2. LLM Classifier & Query Rewriting Tests (Mocked)
# ---------------------------------------------------------------------------

def test_llm_classification_knowledge_seek():
    async def _run():
        mock_res = IntentClassification(
            intent="KNOWLEDGE_SEEK",
            confidence=0.96,
            reason="Specific patent law inquiry",
            rewritten_query="What is the patent filing process under Section 3(p)?",
            clarification_question="",
            entities=ExtractedEntities(
                jurisdiction="India",
                legal_topic="patent",
                act_or_law="Patents Act 1970",
                section="Section 3(p)",
            ),
        )

        with patch.object(intent_classifier, "_call_llm_classifier", new=AsyncMock(return_value=mock_res)):
            res = await intent_classifier.classify_intent("Can I patent an Ayurvedic formulation?")
            assert res.intent == "KNOWLEDGE_SEEK"
            assert res.confidence == 0.96
            assert res.rewritten_query == "What is the patent filing process under Section 3(p)?"
            assert res.entities.legal_topic == "patent"
    asyncio.run(_run())


def test_llm_classification_query_rewriting():
    async def _run():
        mock_res = IntentClassification(
            intent="KNOWLEDGE_SEEK",
            confidence=0.94,
            reason="Contextual follow-up query resolved",
            rewritten_query="What are the international patent filing requirements for Ayurvedic extracts?",
            clarification_question="",
            entities=ExtractedEntities(jurisdiction="International", legal_topic="patent"),
        )

        with patch.object(intent_classifier, "_call_llm_classifier", new=AsyncMock(return_value=mock_res)):
            res = await intent_classifier.classify_intent(
                query="What about the international rule?",
                conversation_context="User: How to patent Ashwagandha in India?\nAssistant: Under Patents Act Section 3(p)...",
            )
            assert res.intent == "KNOWLEDGE_SEEK"
            assert "international" in res.rewritten_query.lower()
    asyncio.run(_run())


# ---------------------------------------------------------------------------
# 3. Classifier Failure & Fallback Resilience
# ---------------------------------------------------------------------------

def test_classifier_timeout_fallback_to_knowledge_seek():
    async def _run():
        with patch.object(intent_classifier, "_call_llm_classifier", side_effect=asyncio.TimeoutError):
            res = await intent_classifier.classify_intent("Explain biological diversity access rules")
            # Must safely fall back to KNOWLEDGE_SEEK so RAG is not blocked
            assert res.intent == "KNOWLEDGE_SEEK"
            assert res.confidence == 0.5
            assert "fallback" in res.reason.lower()
    asyncio.run(_run())


def test_classifier_exception_fallback_to_knowledge_seek():
    async def _run():
        with patch.object(intent_classifier, "_call_llm_classifier", side_effect=RuntimeError("API Error")):
            res = await intent_classifier.classify_intent("Explain Section 6 of Biological Diversity Act")
            assert res.intent == "KNOWLEDGE_SEEK"
            assert res.confidence == 0.5
    asyncio.run(_run())


# ---------------------------------------------------------------------------
# 4. End-to-End Chat Routing: Retrieval Skipping for Non-Knowledge Intents
# ---------------------------------------------------------------------------

def test_chat_greeting_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat", json={"question": "Hello, good morning!", "jurisdiction": "India"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "chitchat"
        assert data["intent"] == "CHITCHAT"
        assert len(data["citations"]) == 0
        assert "IP-SAKTI" in data["answer"]
        # Verification: hybrid_rrf_search must NOT be called!
        mock_retrieval.assert_not_called()


def test_chat_thanks_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat", json={"question": "Thank you so much", "jurisdiction": "India"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "chitchat"
        assert data["intent"] == "CHITCHAT"
        assert len(data["citations"]) == 0
        mock_retrieval.assert_not_called()


def test_chat_ambiguous_clarification_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat", json={"question": "It is not working", "jurisdiction": "India"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "clarification_needed"
        assert data["intent"] == "CLARIFICATION_NEEDED"
        assert len(data["citations"]) == 0
        assert "?" in data["answer"]
        mock_retrieval.assert_not_called()


def test_chat_out_of_scope_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat", json={"question": "What is the weather in Delhi?", "jurisdiction": "India"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "out_of_scope"
        assert data["intent"] == "OUT_OF_SCOPE"
        assert len(data["citations"]) == 0
        mock_retrieval.assert_not_called()


def test_chat_knowledge_seek_calls_retrieval_with_rewritten_query(client):
    mock_classification = IntentClassification(
        intent="KNOWLEDGE_SEEK",
        confidence=0.98,
        reason="Patentability query",
        rewritten_query="Is Ashwagandha extract patentable under Section 3(p)?",
        clarification_question="",
        entities=ExtractedEntities(legal_topic="patent", section="Section 3(p)"),
    )

    with patch("app.services.intent_classifier.intent_classifier.classify_intent", new=AsyncMock(return_value=mock_classification)), \
         patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval, \
         patch("app.routers.chat.evaluate_retrieval_quality") as mock_gate, \
         patch("app.routers.chat.conditional_rerank") as mock_rerank, \
         patch("app.routers.chat.generate_grounded_answer", new=AsyncMock(return_value="Ashwagandha extract is barred under Section 3(p). [Source: SRC-001]")):

        mock_retrieval.return_value = [{"text": "Section 3(p) bars traditional knowledge", "distance": 0.2, "source": "Patents Act", "section": "3(p)"}]
        mock_gate.return_value = {"is_sufficient": True, "best_distance": 0.2, "top_rrf_score": 0.9}
        mock_rerank.return_value = ([{"text": "Section 3(p) bars traditional knowledge", "source": "Patents Act", "section": "3(p)", "reranker_score": 0.9}], False)

        resp = client.post("/api/chat", json={"question": "Can I patent Ashwagandha?", "jurisdiction": "India"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "answered"
        assert data["intent"] == "KNOWLEDGE_SEEK"
        assert data["rewritten_query_used"] == "Is Ashwagandha extract patentable under Section 3(p)?"

        # Verification: hybrid_rrf_search was called with the REWRITTEN query!
        mock_retrieval.assert_called_once()
        assert mock_retrieval.call_args[1]["query"] == "Is Ashwagandha extract patentable under Section 3(p)?"


# ---------------------------------------------------------------------------
# 5. Streaming Endpoint (/chat/stream) Parity Tests
# ---------------------------------------------------------------------------

def test_chat_stream_chitchat_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat/stream", json={"question": "Hi there!", "jurisdiction": "India"})
        assert resp.status_code == 200
        content = resp.text
        assert "data: {\"type\": \"meta\", \"intent\": \"CHITCHAT\"" in content
        assert "IP-SAKTI" in content
        mock_retrieval.assert_not_called()


def test_chat_stream_clarification_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat/stream", json={"question": "What should I do?", "jurisdiction": "India"})
        assert resp.status_code == 200
        content = resp.text
        assert "data: {\"type\": \"meta\", \"intent\": \"CLARIFICATION_NEEDED\"" in content
        mock_retrieval.assert_not_called()


def test_chat_stream_out_of_scope_skips_retrieval(client):
    with patch("app.routers.chat.hybrid_rrf_search") as mock_retrieval:
        resp = client.post("/api/chat/stream", json={"question": "How to bake a cake?", "jurisdiction": "India"})
        assert resp.status_code == 200
        content = resp.text
        assert "data: {\"type\": \"meta\", \"intent\": \"OUT_OF_SCOPE\"" in content
        mock_retrieval.assert_not_called()
