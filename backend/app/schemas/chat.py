"""
backend/app/schemas/chat.py
---------------------------
Pydantic v2 data-transfer objects for all API endpoints of IP-SAKTI Sahayak.

Schemas
-------
  CitationScore    - Per-source claim entailment & support metric
  ConfidenceScore  - Composite confidence assessment (score, label, reason, citation_scores)
  ChatRequest      - POST /api/chat request payload
  CitationItem     - Individual retrieved source passage
  AnswerSection    - Structured answer section
  ChatResponse     - POST /api/chat response payload
  WizardRequest    - POST /api/classify request payload
  WizardResponse   - POST /api/classify response payload
"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Fixed legal disclaimer — injected server-side, never overridable by client
# ---------------------------------------------------------------------------

_DISCLAIMER_TEXT: str = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional or registered patent agent."
)


# ===========================================================================
# Citation & Confidence Models
# ===========================================================================


class CitationScore(BaseModel):
    """Claim-level support metrics for a cited source."""

    source: str = Field(
        ...,
        description="Source identifier or statutory name (e.g. 'Patents Act, 1970 - Section 3(p)').",
    )
    support_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="NLI / entailment support score between 0.0 and 1.0.",
    )
    supported_claims: int = Field(
        default=0,
        ge=0,
        description="Number of discrete claims verified against this source.",
    )
    total_claims: int = Field(
        default=0,
        ge=0,
        description="Total number of claims attributed to this source.",
    )


class ConfidenceScore(BaseModel):
    """Structured confidence score with composite metrics and breakdown."""

    score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall numeric confidence score from 0 to 100.",
    )
    label: str = Field(
        ...,
        description="Confidence category label ('High', 'Moderate', 'Low').",
    )
    reason: str = Field(
        ...,
        description="Human-readable explanation of why this confidence level was assigned.",
    )
    citation_scores: list[CitationScore] = Field(
        default_factory=list,
        description="Individual citation entailment and support scores.",
    )


class CitationItem(BaseModel):
    """A single retrieved source passage that grounded the LLM answer."""

    source_id: Optional[str] = Field(
        default=None,
        description="Unique source identifier (e.g. 'SRC-001') matching inline prompt citations.",
    )
    source: str = Field(
        ...,
        description="Name of the source document or statute (e.g. 'Patents_Act_1970').",
    )
    section: str = Field(
        ...,
        description="Page number or section identifier from the source document.",
    )
    text: str = Field(
        ...,
        description="Verbatim chunk snippet that was retrieved and passed to the LLM.",
    )
    relevance: str = Field(
        default="",
        description="Short explanation of why this source supports the answer.",
    )
    is_user_document: bool = Field(
        default=False,
        description="True if this citation is from a user-uploaded document, False for official sources.",
    )
    original_filename: Optional[str] = Field(
        default=None,
        description="Original filename for user-uploaded documents.",
    )


class ExtractedEntities(BaseModel):
    """Structured legal and statutory entities identified during intent classification."""

    jurisdiction: str = Field(default="", description="Identified jurisdiction (India, International, US, etc.)")
    legal_topic: str = Field(default="", description="Domain/topic (e.g. patent, trademark, GI, ABS)")
    act_or_law: str = Field(default="", description="Specific Act or treaty referenced")
    section: str = Field(default="", description="Specific section, article, or rule referenced")


class IntentClassification(BaseModel):
    """Structured machine-readable intent classification output."""

    intent: Literal[
        "KNOWLEDGE_SEEK",
        "CHITCHAT",
        "CLARIFICATION_NEEDED",
        "OUT_OF_SCOPE",
        "UNSAFE_OR_DISALLOWED",
    ] = Field(
        default="KNOWLEDGE_SEEK",
        description="Identified user query intent category.",
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Classifier confidence score between 0.0 and 1.0.",
    )
    reason: str = Field(
        default="",
        description="Short explanation for the classification decision.",
    )
    rewritten_query: str = Field(
        default="",
        description="Context-resolved standalone query suitable for retrieval, or empty string.",
    )
    clarification_question: str = Field(
        default="",
        description="Follow-up question to clarify ambiguous intent, or empty string.",
    )
    entities: ExtractedEntities = Field(
        default_factory=ExtractedEntities,
        description="Structured entities parsed from the query.",
    )


class AnswerSection(BaseModel):
    """Structured section within the generated answer."""

    title: str = Field(
        ...,
        description="Section heading.",
    )
    content: str = Field(
        ...,
        description="Section content text.",
    )


# ===========================================================================
# Chat Request & Response Schemas (POST /api/chat)
# ===========================================================================


class ChatRequest(BaseModel):
    """Payload that the client sends to POST /api/chat."""

    question: str = Field(
        ...,
        min_length=2,
        max_length=2000,
        description="The natural-language legal question from the user.",
        examples=["Can a formulation based on Ashwagandha be patented in India?"],
    )
    jurisdiction: str = Field(
        default="India",
        description='Jurisdiction context ("India", "International", or "Both").',
    )
    language: str = Field(
        default="en",
        description='ISO 639-1 language code for response ("en", "hi", "mr"). Default "en".',
        examples=["en", "hi", "mr"],
    )
    answer_mode: Literal["brief", "standard", "detailed"] = Field(
        default="standard",
        description="Desired answer length and depth.",
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Optional existing conversation ID to append this turn to.",
    )
    
    # ── Document Scoping for RAG Retrieval ──
    document_ids: Optional[list[str]] = Field(
        default=None,
        description="Optional list of document IDs to scope retrieval to (e.g. user-uploaded PDFs).",
    )

    # ── Optional Context Profile & Formulation Data ──
    user_type: Optional[str] = Field(default=None, description="User category (e.g. 'MSME', 'Ayurvedic Practitioner', 'Researcher').")
    user_expertise: Optional[str] = Field(default=None, description="Expertise level (e.g. 'Beginner', 'Intermediate', 'IP Specialist').")
    organization_type: Optional[str] = Field(default=None, description="Entity type (e.g. 'Startup', 'Individual', 'University').")
    user_country: Optional[str] = Field(default="India", description="Country of origin / operation.")
    user_region: Optional[str] = Field(default=None, description="State or geographical region.")
    nationality_or_residency: Optional[str] = Field(default=None, description="Nationality / residency status.")
    user_role: Optional[str] = Field(default=None, description="Professional role.")

    product_name: Optional[str] = Field(default=None, description="Invention or product name.")
    product_description: Optional[str] = Field(default=None, description="Brief description of product or process.")
    formulation_type: Optional[str] = Field(default=None, description="Formulation type (e.g. 'Ayurvedic herbal formulation', 'Nutraceutical').")
    ingredients: Optional[Union[list[str], str]] = Field(default=None, description="Ingredients or biological resources.")
    species: Optional[str] = Field(default=None, description="Botanical or biological species.")
    scientific_names: Optional[str] = Field(default=None, description="Scientific or Latin binomial names.")
    traditional_use: Optional[str] = Field(default=None, description="Documented traditional usage.")
    resource_origin: Optional[str] = Field(default=None, description="Geographical origin of biological material.")
    knowledge_holder: Optional[str] = Field(default=None, description="Traditional knowledge holder / community.")
    knowledge_source: Optional[str] = Field(default=None, description="Classical text or source of traditional knowledge.")
    existing_formulation: Optional[str] = Field(default=None, description="Classical Shastriya formulation or prior art reference.")
    novel_modification: Optional[str] = Field(default=None, description="Novel technical modification or synergy claimed.")
    intended_use: Optional[str] = Field(default=None, description="Intended therapeutic or commercial use.")
    commercial_status: Optional[str] = Field(default=None, description="Commercial utilization vs non-commercial research.")
    development_stage: Optional[str] = Field(default=None, description="Development stage (e.g. 'Concept', 'Prototype', 'Marketed').")

    user_intent: Optional[str] = Field(default=None, description="Stated intent (e.g. 'Patentability and TKDL prior-art analysis').")
    requested_information: Optional[Union[list[str], str]] = Field(default=None, description="Categories of information requested.")
    context: Optional[dict] = Field(default=None, description="Arbitrary pre-structured context dictionary.")

    @field_validator("jurisdiction", mode="before")
    @classmethod
    def normalise_jurisdiction(cls, v: str) -> str:
        """Allow case-insensitive jurisdiction: 'india'->'India', 'international'->'International', 'both'->'Both'."""
        if not v:
            return "India"
        raw = str(v).strip().lower()
        if raw == "both":
            return "Both"
        if "intl" in raw or "international" in raw:
            return "International"
        if raw in ("india", "in"):
            return "India"
        val = str(v).strip().capitalize()
        if val in ("India", "International", "Both"):
            return val
        return "India"

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, v: str) -> str:
        """Reject whitespace-only questions."""
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("question must have at least 2 non-whitespace characters.")
        return cleaned

    @field_validator("language", mode="before")
    @classmethod
    def validate_language(cls, v: Any) -> str:
        """Validate and normalise language codes to supported values ('en', 'hi', 'mr'). Fall back safely to 'en'."""
        if not v:
            return "en"
        raw = str(v).strip().lower()
        if raw in ("en", "hi", "mr"):
            return raw
        # Map common aliases
        if raw in ("english", "eng"):
            return "en"
        if raw in ("hindi", "hin"):
            return "hi"
        if raw in ("marathi", "mar"):
            return "mr"
        return "en"

    model_config = {
        "json_schema_extra": {
            "example": {
                "question": "Is Ashwagandha extract patentable under Indian law?",
                "jurisdiction": "India",
                "language": "EN",
                "answer_mode": "standard",
            }
        }
    }


class ChatResponse(BaseModel):
    """Structured response returned by POST /api/chat."""

    answer: str = Field(
        ...,
        description="The LLM-generated (or guardrail) answer to the user's question.",
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description="Ordered list of source passages that grounded the answer.",
    )
    confidence: ConfidenceScore = Field(
        ...,
        description="Structured confidence assessment with score, label, reason, and citation scores.",
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed legal disclaimer injected server-side.",
    )
    latency_ms: float = Field(
        default=0.0,
        description="End-to-end request processing latency in milliseconds.",
    )
    sections: list[AnswerSection] = Field(
        default_factory=list,
        description="Optional structured sections within the answer.",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Relevant follow-up questions the user might want to ask.",
    )
    # 'degraded' allows graceful fallback when LLM is unavailable without Pydantic validation error
    status: Literal[
        "answered",
        "out_of_scope",
        "no_data",
        "error",
        "degraded",
        "chitchat",
        "clarification_needed",
    ] = Field(
        default="answered",
        description=(
            "Response status. 'degraded' means retrieval succeeded but all configured "
            "generation providers were unavailable; no unsupported answer is fabricated."
        ),
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="The conversation ID this turn was persisted to.",
    )
    jurisdiction: str = Field(
        default="India",
        description='The jurisdiction applied to this turn ("India", "International", or "Both").',
    )
    source_filters: list[str] = Field(
        default_factory=list,
        description="Qdrant collections/source filters applied during retrieval (observability).",
    )
    intent: Optional[str] = Field(
        default=None,
        description="Identified user query intent category.",
    )
    intent_confidence: Optional[float] = Field(
        default=None,
        description="Confidence score of the intent classifier between 0.0 and 1.0.",
    )
    rewritten_query_used: Optional[str] = Field(
        default=None,
        description="Context-resolved standalone query passed to retrieval, if applicable.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "answer": "Under Section 3(p) of the Patents Act, 1970, ...",
                "citations": [
                    {
                        "source": "Patents_Act_1970",
                        "section": "Section 3(p)",
                        "text": "An invention which is, in effect, traditional knowledge ...",
                        "relevance": "Direct statutory bar for traditional knowledge.",
                    }
                ],
                "confidence": {
                    "score": 92,
                    "label": "High",
                    "reason": "Direct statutory match in Section 3(p) with strong entailment.",
                    "citation_scores": [
                        {
                            "source": "Patents_Act_1970",
                            "support_score": 0.95,
                            "supported_claims": 2,
                            "total_claims": 2,
                        }
                    ],
                },
                "disclaimer": _DISCLAIMER_TEXT,
                "latency_ms": 345.2,
            }
        }
    }


# ===========================================================================
# Formulation Wizard Schemas  (POST /api/classify)
# ===========================================================================


class WizardRequest(BaseModel):
    """Input payload for the deterministic Formulation Classification Wizard."""

    is_classical: bool = Field(
        ...,
        description="True -> classical Shastriya formulation. False -> modified/proprietary.",
    )
    has_preservatives: bool = Field(
        ...,
        description="True -> formulation contains synthetic preservatives or novel excipients.",
    )
    target: Literal["ASU", "Food"] = Field(
        ...,
        description='"ASU" -> Drugs & Cosmetics Act. "Food" -> FSSAI / Ayurveda-Aahar.',
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "is_classical": True,
                "has_preservatives": False,
                "target": "ASU",
            }
        }
    }


class WizardResponse(BaseModel):
    """Output payload from the deterministic Formulation Classification Wizard."""

    classification: str = Field(
        ...,
        description="Human-readable classification of the formulation type.",
    )
    pathway: str = Field(
        ...,
        description="Regulatory and legal pathway applicable to this formulation.",
    )
    patentability: str = Field(
        ...,
        description="Summary of patentability position under Indian and international IP law.",
    )
    required_license: str = Field(
        ...,
        description="The specific license or registration required before commercialisation.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "classification": "Classical (Shastriya)",
                "pathway": "Formulas extracted directly from First-Schedule texts of DCA.",
                "patentability": "Barred from patenting under Patents Act Section 3(p). Protected by TKDL.",
                "required_license": "AYUSH Manufacturing License under Rule 158-B(1).",
            }
        }
    }
