"""
backend/app/schemas/roadmap.py
------------------------------
Pydantic v2 schemas for the IP Journey Roadmap.

Given a user's innovation / situation, the Roadmap produces a personalized,
grounded visual timeline of their IP journey (file -> publish -> RFE -> FER ->
grant -> renewals) plus any pre-filing regulatory gates (NBA/ABS, licensing).

NOTHING is hard-coded: the stages, their timelines, statutory basis and
action items are all produced by the LLM grounded strictly in the retrieved
corpus. This module only defines shape + validation.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.chat import CitationItem


_DISCLAIMER_TEXT: str = (
    "This is an informational roadmap based on general statutory timelines, not a "
    "guaranteed schedule or legal advice. Exact dates depend on your filing, the "
    "patent office workload, and objections. Confirm each step with a registered patent agent."
)


class RoadmapRequest(BaseModel):
    """Payload the client sends to POST /api/roadmap."""

    innovation: str = Field(
        ...,
        min_length=2,
        max_length=2000,
        description=(
            "The innovation / formulation / product the user wants an IP journey for "
            "(e.g. 'a novel Ashwagandha nano-emulsion for immunity')."
        ),
        examples=["A novel modified Ashwagandha formulation with a new delivery method"],
    )
    stage: str = Field(
        default="",
        max_length=200,
        description=(
            "Optional: where the user currently is (e.g. 'just an idea', 'ready to file', "
            "'already filed, waiting for examination')."
        ),
    )
    jurisdiction: str = Field(
        default="India",
        description='Jurisdiction context ("India", "International", or "Both").',
    )
    language: str = Field(
        default="EN",
        description='ISO 639-1 language code (default "EN").',
    )

    @field_validator("innovation")
    @classmethod
    def innovation_not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("innovation must have at least 2 non-whitespace characters.")
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
                "innovation": "A novel modified Ashwagandha formulation with a new delivery method",
                "stage": "just an idea",
                "jurisdiction": "India",
                "language": "EN",
            }
        }
    }


class RoadmapStage(BaseModel):
    """A single stage in the IP journey timeline."""

    key: str = Field(
        default="",
        description="Short machine key for the stage (e.g. 'filing', 'publication', 'rfe').",
    )
    title: str = Field(
        ...,
        description="Human-readable stage name (e.g. 'File the Patent Application').",
    )
    timeline: str = Field(
        default="",
        description="When this happens, drawn from sources (e.g. 'Month 0', 'Within 48 months of filing').",
    )
    description: str = Field(
        ...,
        description="What happens at this stage, in plain language.",
    )
    law_basis: list[str] = Field(
        default_factory=list,
        description="Statutory grounds for this stage, from retrieved sources only.",
    )
    action_items: list[str] = Field(
        default_factory=list,
        description="Concrete things the innovator must do at this stage.",
    )
    status: Literal["required", "conditional", "optional", "info"] = Field(
        default="info",
        description="Whether this stage is mandatory, conditional, optional, or informational.",
    )


class RoadmapResponse(BaseModel):
    """Structured IP journey roadmap returned by POST /api/roadmap."""

    overview: str = Field(
        ...,
        description="One-paragraph plain-language overview of the journey for this innovation.",
    )
    stages: list[RoadmapStage] = Field(
        default_factory=list,
        description="Ordered timeline stages of the IP journey.",
    )
    prerequisites: list[str] = Field(
        default_factory=list,
        description="Things that must be done BEFORE filing (e.g. NBA/ABS approval, novelty check).",
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description="Retrieved source passages that grounded the roadmap.",
    )
    confidence: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Overall confidence (0-100) from retrieval signals.",
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed disclaimer injected server-side.",
    )
    latency_ms: float = Field(default=0.0, description="Processing latency in ms.")
    status: Literal["ok", "no_data", "error"] = Field(default="ok", description="Processing status.")
    jurisdiction: str = Field(default="India", description="Jurisdiction applied.")
    source_filters: list[str] = Field(default_factory=list, description="Collections queried.")
