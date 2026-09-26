"""
backend/app/schemas/guardian.py
-------------------------------
Pydantic v2 schemas for the Dual-Use Guardian.

Ayurvedic products often need MORE than a patent — the innovator must also
clear regulatory gates depending on whether the product is a drug (ASU) or a
food, whether it uses biological resources (NBA/ABS), and licensing (Rule 158-B).
The Guardian returns a holistic compliance matrix covering all applicable
dimensions at once.

NOTHING is hard-coded: each dimension's applicability, obligation, law basis
and next step is decided by the LLM grounded strictly in the retrieved corpus.
This module only defines shape + validation.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.chat import CitationItem


_DISCLAIMER_TEXT: str = (
    "This is an informational compliance screening across IP and regulatory dimensions, "
    "not legal advice. Requirements depend on your exact product, ingredients, and claims. "
    "Confirm each obligation with the relevant authority (Patent Office, State AYUSH "
    "Licensing Authority, NBA/SBB, FSSAI) or a qualified professional."
)


class GuardianRequest(BaseModel):
    """Payload the client sends to POST /api/guardian."""

    product: str = Field(
        ...,
        min_length=2,
        max_length=2000,
        description=(
            "The product / formulation the user wants a holistic compliance check for "
            "(e.g. 'a Tulsi-Ashwagandha herbal drink for immunity')."
        ),
        examples=["A Tulsi-Ashwagandha herbal immunity drink sold as a food product"],
    )
    positioning: str = Field(
        default="",
        max_length=500,
        description=(
            "Optional: how the product is positioned/sold (e.g. 'as a food/nutraceutical', "
            "'as an ASU medicine', 'exported abroad')."
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

    @field_validator("product")
    @classmethod
    def product_not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("product must have at least 2 non-whitespace characters.")
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
                "product": "A Tulsi-Ashwagandha herbal immunity drink",
                "positioning": "sold as a food / nutraceutical",
                "jurisdiction": "India",
                "language": "EN",
            }
        }
    }


class ComplianceDimension(BaseModel):
    """One regulatory / IP dimension of the compliance matrix."""

    dimension: str = Field(
        ...,
        description="The area of compliance (e.g. 'Patent / IP', 'AYUSH Manufacturing License', "
        "'Biodiversity / ABS', 'FSSAI / Food').",
    )
    applicability: Literal["required", "likely", "conditional", "not_applicable", "unknown"] = Field(
        default="unknown",
        description="Whether this dimension applies to the described product.",
    )
    obligation: str = Field(
        ...,
        description="What the innovator must do for this dimension, in plain language.",
    )
    law_basis: list[str] = Field(
        default_factory=list,
        description="Statutory grounds for this dimension, from retrieved sources only.",
    )
    authority: str = Field(
        default="",
        description="Which authority governs this (e.g. 'State AYUSH Licensing Authority', 'NBA').",
    )
    next_step: str = Field(
        default="",
        description="The concrete next action for this dimension.",
    )


class GuardianResponse(BaseModel):
    """Structured holistic compliance matrix returned by POST /api/guardian."""

    summary: str = Field(
        ...,
        description="One-paragraph plain-language summary of the overall compliance picture.",
    )
    dimensions: list[ComplianceDimension] = Field(
        default_factory=list,
        description="The compliance matrix — one entry per applicable regulatory/IP dimension.",
    )
    priority_actions: list[str] = Field(
        default_factory=list,
        description="The most urgent cross-cutting actions the innovator should take first.",
    )
    citations: list[CitationItem] = Field(
        default_factory=list,
        description="Retrieved source passages that grounded the matrix.",
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
