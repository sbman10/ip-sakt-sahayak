"""
backend/tests/test_multilingual_chat.py
---------------------------------------
Focused unit and integration test suite for Phase 3 and Phase 4:
- Language code validation ('en', 'hi', 'mr') and unsupported fallback to 'en'
- PromptBuilder Hindi & Marathi instructions preserving citations and statutory references
- Untranslated citation source metadata preservation
- Conversation language persistence across turns
- ChatResponse contract validation with Hindi and Marathi answers
"""

import uuid
import pytest
from pydantic import ValidationError

from app.schemas.chat import ChatRequest, ChatResponse, CitationItem, ConfidenceScore
from app.services.prompt_builder import prompt_builder, PromptBuilder
from app.models.database import Conversation, SessionLocal


# ===========================================================================
# 1. ChatRequest Language Validation Tests
# ===========================================================================

def test_language_validation_valid_supported_codes():
    """Verify supported codes 'en', 'hi', 'mr' in lowercase, uppercase, and mixed case."""
    for raw, expected in [
        ("en", "en"),
        ("hi", "hi"),
        ("mr", "mr"),
        ("EN", "en"),
        ("HI", "hi"),
        ("MR", "mr"),
        ("En", "en"),
        ("Hi", "hi"),
        ("Mr", "mr"),
    ]:
        req = ChatRequest(question="Is formulation patentable?", language=raw)
        assert req.language == expected, f"Failed for raw input: {raw}"


def test_language_validation_aliases():
    """Verify common aliases 'english', 'hindi', 'marathi' map to respective codes."""
    assert ChatRequest(question="Question?", language="english").language == "en"
    assert ChatRequest(question="Question?", language="Hindi").language == "hi"
    assert ChatRequest(question="Question?", language="MARATHI").language == "mr"


def test_language_validation_unsupported_fallback():
    """Verify unsupported language values fall back safely to 'en'."""
    unsupported_inputs = ["fr", "de", "es", "zh", "ja", "klingon", "unknown_123", "", None]
    for val in unsupported_inputs:
        req = ChatRequest(question="Can I patent Ashwagandha?", language=val)
        assert req.language == "en", f"Expected fallback to 'en' for input: {val}"


# ===========================================================================
# 2. PromptBuilder Multilingual Generation Instruction Tests
# ===========================================================================

def test_prompt_builder_english_directive():
    """Verify English directive in prompt generation."""
    prompt = prompt_builder.build_user_prompt(
        question="Can I patent Ashwagandha?",
        context="[SRC-001] Section 3(p) of Patents Act 1970 bars traditional knowledge.",
        language="en",
    )
    assert "RESPONSE LANGUAGE DIRECTIVE: ENGLISH" in prompt
    assert "[SRC-XXX]" in prompt
    assert "not legal advice" in prompt


def test_prompt_builder_hindi_directive_and_statutory_preservation():
    """Verify Hindi directive requires Devanagari script and strictly forbids translating statute names and citations."""
    prompt = prompt_builder.build_user_prompt(
        question="क्या मैं अश्वगंधा फॉर्मूलेशन को पेटेंट करा सकता हूँ?",
        context="[SRC-001] Section 3(p) of Patents Act 1970 bars traditional knowledge prior art.",
        language="hi",
    )
    # Check language directive
    assert "RESPONSE LANGUAGE DIRECTIVE: HINDI (हिन्दी)" in prompt
    assert "देवनागरी लिपि" in prompt

    # Check statutory preservation instructions
    assert "DO NOT translate official statute titles" in prompt
    assert "Patents Act 1970" in prompt
    assert "Biological Diversity Act 2002" in prompt
    assert "TKDL" in prompt
    assert "Section 3(p)" in prompt
    assert "Section 2(1)(j)" in prompt
    assert "NEVER translate or alter citation IDs" in prompt
    assert "[SRC-001]" in prompt

    # Check Hindi disclaimer
    assert "यह जानकारी केवल अनुसंधान और सूचनात्मक उद्देश्यों के लिए है" in prompt


def test_prompt_builder_marathi_directive_and_statutory_preservation():
    """Verify Marathi directive requires Devanagari script and strictly forbids translating statute names and citations."""
    prompt = prompt_builder.build_user_prompt(
        question="मी आयुर्वेदिक फॉर्म्युलेशन पेटंट करू शकतो का?",
        context="[SRC-001] Section 3(p) of Patents Act 1970 bars traditional knowledge prior art.",
        language="mr",
    )
    # Check language directive
    assert "RESPONSE LANGUAGE DIRECTIVE: MARATHI (मराठी)" in prompt
    assert "देवनागरी लिपी" in prompt

    # Check statutory preservation instructions
    assert "DO NOT translate official statute titles" in prompt
    assert "Patents Act 1970" in prompt
    assert "Biological Diversity Act 2002" in prompt
    assert "TKDL" in prompt
    assert "Section 3(p)" in prompt
    assert "Section 2(1)(j)" in prompt
    assert "NEVER translate or alter citation IDs" in prompt
    assert "[SRC-001]" in prompt

    # Check Marathi disclaimer
    assert "ही माहिती केवळ संशोधन आणि माहितीच्या उद्देशाने आहे" in prompt


def test_prompt_builder_unsupported_language_fallback():
    """Verify unsupported language in PromptBuilder defaults safely to English directive."""
    prompt = prompt_builder.build_user_prompt(
        question="Can I patent this formulation?",
        context="[SRC-001] Section 3(p)",
        language="unsupported_lang",
    )
    assert "RESPONSE LANGUAGE DIRECTIVE: ENGLISH" in prompt


# ===========================================================================
# 3. Citation and Metadata Preservation Tests
# ===========================================================================

def test_citation_metadata_untranslated():
    """
    Ensure citation items retain exact authoritative statutory source names,
    section numbers, and verbatim text without machine translation.
    """
    citation = CitationItem(
        source_id="SRC-001",
        source="Patents_Act_1970",
        section="Section 3(p)",
        text="an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components",
        relevance="[SRC-001] Grounded in Patents_Act_1970 (Section 3(p)).",
    )

    # Verify attributes are verbatim English statutory text
    assert citation.source_id == "SRC-001"
    assert citation.source == "Patents_Act_1970"
    assert citation.section == "Section 3(p)"
    assert "traditional knowledge" in citation.text
    assert "[SRC-001]" in citation.relevance


def test_chat_response_with_hindi_answer_preserves_citations():
    """Test ChatResponse serialization with a Hindi answer and untranslated English citations."""
    hindi_answer = (
        "पेटेंट्स अधिनियम 1970 की धारा 3(p) [Section 3(p)] के अंतर्गत, पारंपरिक ज्ञान "
        "पर आधारित फॉर्मूलेशन पेटेंट योग्य नहीं हैं [SRC-001]। यदि आपका फॉर्मूलेशन किसी नवीन "
        "डिलीवरी सिस्टम पर आधारित है, तो धारा 2(1)(j) [Section 2(1)(j)] के तहत विचार किया जा सकता है।"
    )
    citations = [
        CitationItem(
            source_id="SRC-001",
            source="Patents_Act_1970",
            section="Section 3(p)",
            text="An invention which in effect is traditional knowledge...",
            relevance="[SRC-001] Grounded in Patents_Act_1970 (Section 3(p)).",
        )
    ]
    confidence = ConfidenceScore(
        score=92,
        label="High",
        reason="Direct statutory match under Section 3(p).",
        citation_scores=[],
    )

    resp = ChatResponse(
        answer=hindi_answer,
        citations=citations,
        confidence=confidence,
        status="answered",
        jurisdiction="India",
    )

    assert resp.status == "answered"
    assert len(resp.citations) == 1
    assert resp.citations[0].source == "Patents_Act_1970"
    assert resp.citations[0].section == "Section 3(p)"
    assert "[SRC-001]" in resp.answer


def test_chat_response_with_marathi_answer_preserves_citations():
    """Test ChatResponse serialization with a Marathi answer and untranslated English citations."""
    marathi_answer = (
        "पेटंट कायदा 1970 च्या कलम 3(p) [Section 3(p)] नुसार, पारंपारिक ज्ञान "
        "किंवा ज्ञात घटकांचे एकत्रीकरण पेटंटसाठी पात्र नाही [SRC-001]। "
        "परंतु जर नवीन वितरण पद्धत (novel delivery mechanism) असेल, तर कलम 2(1)(j) चा विचार केला जाऊ शकतो।"
    )
    citations = [
        CitationItem(
            source_id="SRC-001",
            source="Patents_Act_1970",
            section="Section 3(p)",
            text="An invention which in effect is traditional knowledge...",
            relevance="[SRC-001] Grounded in Patents_Act_1970 (Section 3(p)).",
        )
    ]
    confidence = ConfidenceScore(
        score=90,
        label="High",
        reason="Direct statutory match under Section 3(p).",
        citation_scores=[],
    )

    resp = ChatResponse(
        answer=marathi_answer,
        citations=citations,
        confidence=confidence,
        status="answered",
        jurisdiction="India",
    )

    assert resp.status == "answered"
    assert len(resp.citations) == 1
    assert resp.citations[0].source == "Patents_Act_1970"
    assert resp.citations[0].section == "Section 3(p)"
    assert "[SRC-001]" in resp.answer


# ===========================================================================
# 4. Database Conversation Language Persistence Tests
# ===========================================================================

def test_conversation_language_persistence():
    """Verify that Conversation model stores language code and supports updating it."""
    db = SessionLocal()
    try:
        conv_id = str(uuid.uuid4())
        conv = Conversation(
            id=conv_id,
            title="Multilingual Test Conversation",
            jurisdiction="India",
            language="hi",
        )
        db.add(conv)
        db.commit()

        # Query back and verify
        fetched = db.query(Conversation).filter(Conversation.id == conv_id).first()
        assert fetched is not None
        assert fetched.language == "hi"

        # Update language to Marathi on language switch
        fetched.language = "mr"
        db.commit()

        updated = db.query(Conversation).filter(Conversation.id == conv_id).first()
        assert updated.language == "mr"
    finally:
        db.close()
