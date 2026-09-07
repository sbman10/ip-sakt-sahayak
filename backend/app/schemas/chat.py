"""
backend/app/schemas/chat.py
---------------------------
Pydantic data-transfer objects for the /api/chat endpoint.

All field validations are enforced at the FastAPI boundary so
downstream business logic receives clean, typed data.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request Schema
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Payload that the React frontend sends to POST /api/chat."""

    question: str = Field(
        ...,
        min_length=3,
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
            'ISO 639-1 language code for the response language. '
            'Defaults to "EN" (English). Future values: "HI", "SA", etc.'
        ),
        examples=["EN", "HI"],
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
        """Normalise language codes to uppercase (e.g. 'en' → 'EN')."""
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


# ---------------------------------------------------------------------------
# Sub-model: Citation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Response Schema
# ---------------------------------------------------------------------------

_DISCLAIMER_TEXT = (
    "This is an informational prototype, not formal legal advice. "
    "Please consult a qualified IP professional."
)


class ChatResponse(BaseModel):
    """Structured response returned by POST /api/chat."""

    answer: str = Field(
        ...,
        description="The LLM-generated (or guardrail) answer to the user's question.",
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description=(
            "Ordered list of source passages that grounded the answer. "
            "Empty when the guardrail abstains."
        ),
    )
    confidence: Literal["high", "moderate", "low"] = Field(
        ...,
        description=(
            '"high" (re-ranker score >= 0.80), '
            '"moderate" (>= 0.65), '
            '"low" (below threshold -- guardrail fires).'
        ),
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed legal disclaimer injected by the server.",
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
