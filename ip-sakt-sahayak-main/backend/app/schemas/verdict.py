"""
backend/app/schemas/verdict.py
------------------------------
Pydantic v2 schemas for the Patentability Verdict Engine ("Biopiracy Shield").

The Verdict Engine takes a user's formulation / herb combination and returns a
grounded, traffic-light patentability verdict (RED / YELLOW / GREEN) with the
statutory basis, evidence citations, and concrete next steps.

IMPORTANT: Nothing here is hard-coded. The verdict, reasoning, law basis and
next steps are all produced by the LLM grounded strictly in the retrieved
corpus (TKDL, Patents Act Section 3(p)/3(d)/3(e), Biodiversity Act, etc.).
This module only defines the data shape and validation.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Re-use the CitationItem shape from the chat schema so the frontend can render
# verdict citations with the exact same component it uses for chat citations.
from app.schemas.chat import CitationItem


_DISCLAIMER_TEXT: str = (
    "This is an informational patentability screening, not a legal opinion or a "
    "guarantee of grant/rejection. A registered patent agent must perform a formal "
    "prior-art search and novelty assessment before filing."
)


class VerdictRequest(BaseModel):
    """Payload the client sends to POST /api/verdict."""

    formulation: str = Field(
        ...,
        min_length=2,
        max_length=2000,
        description=(
            "The formulation, herb, or herb-combination the user wants screened "
            "for patentability (e.g. 'Ashwagandha + Shatavari churna for immunity')."
        ),
        examples=["Ashwagandha and Shatavari combination for boosting immunity"],
    )
    intended_use: str = Field(
        default="",
        max_length=1000,
        description=(
            "Optional: what the product is for / how it is novel (e.g. 'a new "
            "nano-emulsion delivery method', 'classical churna as per texts')."
        ),
    )
    jurisdiction: str = Field(
        default="India",
        description='Jurisdiction context ("India", "International", or "Both").',
    )
    language: str = Field(
        default="EN",
        description='ISO 639-1 language code for the response (default "EN").',
    )

    @field_validator("formulation")
    @classmethod
    def formulation_not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("formulation must have at least 2 non-whitespace characters.")
        return cleaned

    @field_validator("jurisdiction", mode="before")
    @classmethod
    def normalise_jurisdiction(cls, v: str) -> str:
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

    @field_validator("language")
    @classmethod
    def language_to_upper(cls, v: str) -> str:
        if not v:
            return "EN"
        return v.strip().upper()

    model_config = {
        "json_schema_extra": {
            "example": {
                "formulation": "Ashwagandha + Shatavari combination for immunity",
                "intended_use": "Classical churna as described in traditional texts",
                "jurisdiction": "India",
                "language": "EN",
            }
        }
    }


class VerdictResponse(BaseModel):
    """Structured traffic-light verdict returned by POST /api/verdict."""

    verdict: Literal["RED", "YELLOW", "GREEN", "UNKNOWN"] = Field(
        ...,
        description=(
            "Traffic-light patentability signal. "
            "RED = likely NOT patentable (traditional knowledge / prior art). "
            "YELLOW = uncertain / conditional (needs modification or more info). "
            "GREEN = potentially patentable (appears novel). "
            "UNKNOWN = insufficient grounded evidence to decide."
        ),
    )
    verdict_label: str = Field(
        ...,
        description="Short human-readable label (e.g. 'Likely Not Patentable').",
    )
    summary: str = Field(
        ...,
        description="One-paragraph plain-language explanation of the verdict.",
    )
    law_basis: list[str] = Field(
        default_factory=list,
        description=(
            "The statutory grounds the verdict rests on, drawn ONLY from retrieved "
            "sources (e.g. 'Section 3(p), Patents Act 1970')."
        ),
    )
    next_steps: list[str] = Field(
        default_factory=list,
        description="Concrete, actionable next steps for the innovator.",
    )
    compliance_flags: list[str] = Field(
        default_factory=list,
        description=(
            "Additional regulatory obligations flagged from the sources "
            "(e.g. 'NBA / ABS approval required under Biological Diversity Act 2002')."
        ),
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description="Retrieved source passages that grounded the verdict.",
    )
    confidence: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Overall confidence (0-100) in the verdict, from retrieval + entailment signals.",
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed screening disclaimer injected server-side.",
    )
    latency_ms: float = Field(
        default=0.0,
        description="End-to-end processing latency in milliseconds.",
    )
    status: Literal["ok", "no_data", "error"] = Field(
        default="ok",
        description="Processing status.",
    )
    jurisdiction: str = Field(
        default="India",
        description='Jurisdiction applied to this screening.',
    )
    source_filters: list[str] = Field(
        default_factory=list,
        description="ChromaDB collections queried (observability).",
    )
