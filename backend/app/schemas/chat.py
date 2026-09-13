"""
backend/app/schemas/chat.py
---------------------------
Pydantic v2 data-transfer objects for all API endpoints of IP-SAKTI Sahayak.

Schemas
-------
  ChatRequest      - POST /api/chat request payload
  CitationItem     - Individual retrieved source passage (sub-model)
  ChatResponse     - POST /api/chat response payload
  WizardRequest    - POST /api/classify request payload
  WizardResponse   - POST /api/classify response payload

All field validations are enforced at the FastAPI boundary so downstream
business logic receives clean, typed data with no further input-sanitisation
needed in the service layer.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Fixed legal disclaimer — injected server-side, never overrideable by client
# ---------------------------------------------------------------------------

_DISCLAIMER_TEXT: str = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional or registered patent agent."
)


# ===========================================================================
# Chat Schemas  (POST /api/chat)
# ===========================================================================


class ChatRequest(BaseModel):
    """Payload that the React frontend sends to POST /api/chat."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The natural-language legal question from the user.",
        examples=["Can a formulation based on Ashwagandha be patented in India?"],
    )
    jurisdiction: Literal["India", "International"] = Field(
        ...,
        description=(
            'Jurisdiction toggle. Must be exactly "India" or "International". '
            "Controls which ChromaDB collection is queried."
        ),
    )
    language: str = Field(
        default="EN",
        description=(
            "ISO 639-1 language code for the response language. "
            'Defaults to "EN" (English). Future values: "HI", "SA", etc.'
        ),
        examples=["EN", "HI"],
    )
    conversation_id: str | None = Field(
        default=None,
        description=(
            "Optional existing conversation id to append this turn to. "
            "When omitted, the backend creates a new conversation and returns "
            "its id in the response so the client can persist follow-up turns."
        ),
    )

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, v: str) -> str:
        """Reject whitespace-only questions."""
        if not v.strip():
            raise ValueError("question must not be blank or whitespace-only.")
        return v.strip()

    @field_validator("language")
    @classmethod
    def language_to_upper(cls, v: str) -> str:
        """Normalise language codes to uppercase (e.g. 'en' -> 'EN')."""
        return v.strip().upper()

    model_config = {
        "json_schema_extra": {
            "example": {
                "question": "Is Ashwagandha extract patentable under Indian law?",
                "jurisdiction": "India",
                "language": "EN",
            }
        }
    }


class CitationItem(BaseModel):
    """A single retrieved source passage that grounded the LLM answer."""

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


class AnswerSection(BaseModel):
    """Optional structured section within the answer."""
    
    title: str = Field(
        ...,
        description="Section heading.",
    )
    content: str = Field(
        ...,
        description="Section content text.",
    )


class ConfidenceScore(BaseModel):
    """Structured confidence assessment."""
    
    score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Numeric confidence score from 0 to 100.",
    )
    label: Literal["High", "Medium", "Low"] = Field(
        ...,
        description="Human-readable confidence label.",
    )
    reason: str = Field(
        ...,
        description="Short explanation of the confidence level.",
    )


class ChatResponse(BaseModel):
    """Structured response returned by POST /api/chat."""

    answer: str = Field(
        ...,
        description="The LLM-generated (or guardrail) answer to the user's question.",
    )
    sections: list[AnswerSection] = Field(
        default_factory=list,
        description="Optional structured sections within the answer.",
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description=(
            "Ordered list of source passages that grounded the answer. "
            "Empty when the guardrail abstains."
        ),
    )
    confidence: ConfidenceScore = Field(
        ...,
        description="Structured confidence assessment with score, label, and reason.",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Relevant follow-up questions the user might want to ask.",
    )
    status: Literal["answered", "out_of_scope", "no_data", "error"] = Field(
        default="answered",
        description="Response status indicating the type of response.",
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed legal disclaimer injected server-side.",
    )
    conversation_id: str | None = Field(
        default=None,
        description=(
            "The conversation this turn was persisted to. Echoes the request "
            "conversation_id, or a freshly created id when the request omitted one."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "answer": "Under Section 3(p) of the Patents Act, 1970, ...",
                "citations": [
                    {
                        "source": "Patents_Act_1970",
                        "section": "Page 12",
                        "text": "An invention which is, in effect, traditional knowledge ...",
                    }
                ],
                "confidence": "high",
                "disclaimer": _DISCLAIMER_TEXT,
            }
        }
    }


# ===========================================================================
# Formulation Wizard Schemas  (POST /api/classify)
# ===========================================================================


class WizardRequest(BaseModel):
    """
    Input payload for the deterministic Formulation Classification Wizard.

    Fields
    ------
    is_classical:
        True if the formulation is drawn verbatim from a classical Ayurvedic
        text (Shastriya Yoga).  False for modified / proprietary preparations.
    has_preservatives:
        True if the formulation contains any added synthetic preservative,
        excipient, or modified-release technology not present in the original
        classical text.
    target:
        End-use category. "ASU" for Ayurvedic / Siddha / Unani medicine;
        "Food" for nutraceuticals or Ayurveda-Aahar functional food supplements.
    """

    is_classical: bool = Field(
        ...,
        description=(
            "True -> classical Shastriya formulation drawn verbatim from first-schedule texts. "
            "False -> modified, patent-and-proprietary, or novel formulation."
        ),
    )
    has_preservatives: bool = Field(
        ...,
        description=(
            "True -> formulation contains synthetic preservatives, novel excipients, "
            "or delivery-system modifications not found in classical texts."
        ),
    )
    target: Literal["ASU", "Food"] = Field(
        ...,
        description=(
            '"ASU" -> Ayurvedic/Siddha/Unani medicinal product regulated under '
            'Drugs & Cosmetics Act. "Food" -> nutraceutical or Ayurveda-Aahar '
            "regulated under FSSAI."
        ),
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
    """
    Output payload from the deterministic Formulation Classification Wizard.

    All fields are fully populated strings -- no nullable fields -- so the
    frontend can render results without null-guards.
    """

    classification: str = Field(
        ...,
        description="Human-readable classification of the formulation type.",
        examples=["Classical (Shastriya)", "Patent & Proprietary (Anubhavasiddha / Modified)"],
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
        description=(
            "The specific license or registration the manufacturer must obtain "
            "before commercialising this formulation."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "classification": "Classical (Shastriya)",
                "pathway": (
                    "Formulas extracted directly from First-Schedule texts of the "
                    "Drugs and Cosmetics Act."
                ),
                "patentability": (
                    "Barred from patenting under Patents Act Section 3(p) as traditional "
                    "knowledge. Protected by TKDL."
                ),
                "required_license": "AYUSH Manufacturing License under Rule 158-B(1).",
            }
        }
    }
