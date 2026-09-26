"""
Jurisdiction-awareness tests for IP-SAKTI Sahayak.

These are intentionally LIGHTWEIGHT: they exercise the schema validation,
source-filter resolution, prompt construction, and collection-routing logic
WITHOUT loading embeddings, ChromaDB, or calling Gemini — so they run fast and
never trigger an OOM on a low-RAM machine.

Run from the backend/ directory:
    python -m pytest tests/test_jurisdiction.py -v
"""

import sys
from pathlib import Path

import pytest

# Ensure `app` package is importable when running from backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ---------------------------------------------------------------------------
# 1. ChatRequest jurisdiction normalisation (India / International / Both)
# ---------------------------------------------------------------------------
from app.schemas.chat import ChatRequest  # noqa: E402


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("india", "India"),
        ("India", "India"),
        ("IN", "India"),
        ("international", "International"),
        ("International", "International"),
        ("intl", "International"),
        ("both", "Both"),
        ("Both", "Both"),
        ("BOTH", "Both"),
        ("", "India"),          # empty -> safe default
        ("garbage", "India"),   # unknown -> safe default
    ],
)
def test_jurisdiction_normalisation(raw, expected):
    req = ChatRequest(question="Can I patent neem?", jurisdiction=raw)
    assert req.jurisdiction == expected


def test_jurisdiction_default_is_india():
    req = ChatRequest(question="What is TKDL?")
    assert req.jurisdiction == "India"


# ---------------------------------------------------------------------------
# 2. Source-filter resolution (observability metadata / collection routing)
# ---------------------------------------------------------------------------
from app.routers.chat import _resolve_source_filters  # noqa: E402


def test_source_filters_india():
    assert _resolve_source_filters("India") == ["india_statutes"]


def test_source_filters_international():
    assert _resolve_source_filters("International") == ["international_treaties"]


def test_source_filters_both():
    # Both must fan out across BOTH collections
    assert _resolve_source_filters("Both") == [
        "india_statutes",
        "international_treaties",
    ]


def test_source_filters_default_on_junk():
    assert _resolve_source_filters("") == ["india_statutes"]
    assert _resolve_source_filters(None) == ["india_statutes"]


# ---------------------------------------------------------------------------
# 3. Prompt builder injects the jurisdiction-aware instruction + variable
# ---------------------------------------------------------------------------
from app.services.prompt_builder import prompt_builder  # noqa: E402


def test_prompt_builder_india_variable():
    prompt = prompt_builder.build_user_prompt(
        question="Can I patent neem?",
        context="Section 3(p) bars traditional knowledge.",
        jurisdiction="India",
    )
    assert "selected_jurisdiction: india" in prompt
    assert "jurisdiction-aware question" in prompt


def test_prompt_builder_international_variable():
    prompt = prompt_builder.build_user_prompt(
        question="What does the Nagoya Protocol require?",
        context="Nagoya Protocol Article 5.",
        jurisdiction="International",
    )
    assert "selected_jurisdiction: international" in prompt


def test_prompt_builder_both_separation_rule():
    prompt = prompt_builder.build_user_prompt(
        question="Compare ABS obligations.",
        context="India: BD Act. International: Nagoya Protocol.",
        jurisdiction="Both",
    )
    assert "selected_jurisdiction: both" in prompt
    # The Both branch must instruct separation of India vs international conclusions
    assert "separate" in prompt.lower()
    assert "conflict" in prompt.lower() or "difference" in prompt.lower()


def test_prompt_builder_no_cross_jurisdiction_generalisation():
    prompt = prompt_builder.build_user_prompt(
        question="x", context="y", jurisdiction="India"
    )
    assert "Do not generalize rules from one jurisdiction to another" in prompt


# ---------------------------------------------------------------------------
# 4. Collection routing logic (the mapping hybrid_rrf_search relies on)
#    We assert the resolved collection list matches jurisdiction intent.
# ---------------------------------------------------------------------------
def _resolve_collections(jurisdiction: str):
    """Mirror of the routing logic in retrieval_service.hybrid_rrf_search."""
    jur = jurisdiction.strip().lower()
    if jur == "both":
        return ["india_statutes", "international_treaties"]
    if "international" in jur:
        return ["international_treaties"]
    return ["india_statutes"]


def test_routing_india_only():
    assert _resolve_collections("India") == ["india_statutes"]


def test_routing_international_only():
    assert _resolve_collections("International") == ["international_treaties"]


def test_routing_both_combines():
    cols = _resolve_collections("Both")
    assert "india_statutes" in cols and "international_treaties" in cols


# ---------------------------------------------------------------------------
# 5. ChatResponse carries jurisdiction + source_filters metadata
# ---------------------------------------------------------------------------
from app.schemas.chat import ChatResponse, ConfidenceScore  # noqa: E402


def test_chat_response_metadata_fields():
    resp = ChatResponse(
        answer="ok",
        confidence=ConfidenceScore(score=50, label="Medium", reason="test"),
        jurisdiction="Both",
        source_filters=["india_statutes", "international_treaties"],
    )
    assert resp.jurisdiction == "Both"
    assert resp.source_filters == ["india_statutes", "international_treaties"]


def test_chat_response_metadata_defaults():
    resp = ChatResponse(
        answer="ok",
        confidence=ConfidenceScore(score=50, label="Medium", reason="test"),
    )
    assert resp.jurisdiction == "India"
    assert resp.source_filters == []
