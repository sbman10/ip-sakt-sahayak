"""
backend/app/schemas/drafts.py
-----------------------------
Pydantic v2 data-transfer objects for the Draft Generation endpoint.

Schemas
-------
  DraftRequest    - POST /api/drafts/generate request payload
  DraftSection    - A single titled block of the generated document (sub-model)
  DraftResponse   - POST /api/drafts/generate response payload

The three supported template types map to real Indian IP / biodiversity
filings:

  form_1        -> Patent Application "Form 1" (Patents Rules, 2003)
  nba           -> National Biodiversity Authority access/benefit-sharing form
  3p_petition   -> Pre-grant Opposition Petition under Section 25(1) read with
                   Section 3(p) of the Patents Act, 1970

All input validation is enforced at the FastAPI boundary so the template
layer receives clean, typed data.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Fixed legal disclaimer — injected server-side, never overrideable by client.
# Mirrors the pattern used in schemas/chat.py.
# ---------------------------------------------------------------------------

_DISCLAIMER_TEXT: str = (
    "This document is an auto-generated informational draft, not a filed legal "
    "instrument or formal legal advice. It must be reviewed, corrected, and "
    "signed by a registered patent agent or qualified IP professional before "
    "submission to any authority."
)


# Supported template identifiers — kept as a Literal so FastAPI rejects any
# unknown value with a clean 422 before business logic runs.
TemplateType = Literal["form_1", "nba", "3p_petition"]


# ===========================================================================
# Request
# ===========================================================================


class DraftRequest(BaseModel):
    """Payload the React frontend sends to POST /api/drafts/generate."""

    template_type: TemplateType = Field(
        ...,
        description=(
            "Which legal document to generate. One of: "
            "'form_1' (Patent Form-1), 'nba' (National Biodiversity Authority "
            "application), '3p_petition' (Section 3(p) opposition petition)."
        ),
        examples=["form_1"],
    )
    applicant_name: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Full legal name of the applicant / inventor / petitioner.",
        examples=["Dr. Anjali Sharma"],
    )
    invention_title: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description=(
            "Title of the invention / formulation / subject matter of the filing."
        ),
        examples=[
            "A synergistic Ashwagandha nano-formulation with enhanced bioavailability"
        ],
    )
    filing_date: str = Field(
        ...,
        min_length=4,
        max_length=40,
        description="Intended filing / application date (ISO 'YYYY-MM-DD' preferred).",
        examples=["2026-09-15"],
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=8000,
        description=(
            "Free-text description of the invention, formulation, or grounds "
            "of the petition. Rendered into the body of the document."
        ),
    )
    claims: Optional[List[str]] = Field(
        default=None,
        description=(
            "Ordered list of patent claim statements. Used only for the "
            "'form_1' patent template; ignored for other template types."
        ),
        examples=[[
            "A herbal composition comprising a standardised Withania somnifera "
            "extract encapsulated in a lipid nanocarrier.",
            "The composition of claim 1, wherein the mean particle size is "
            "below 200 nanometres.",
        ]],
    )

    # -- optional metadata used by specific templates --
    applicant_address: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Postal address / nationality block for the applicant.",
    )
    respondent_name: Optional[str] = Field(
        default=None,
        max_length=300,
        description=(
            "For '3p_petition': the applicant of the patent being opposed "
            "(the respondent). Optional; a placeholder is used if omitted."
        ),
    )
    application_number: Optional[str] = Field(
        default=None,
        max_length=120,
        description=(
            "For '3p_petition': the patent application number being opposed. "
            "Optional; a placeholder is used if omitted."
        ),
    )

    @field_validator("applicant_name", "invention_title", "filing_date", "description")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        """Reject strings that are only whitespace."""
        if not v or not v.strip():
            raise ValueError("Field must not be blank or whitespace-only.")
        return v.strip()

    @field_validator("claims")
    @classmethod
    def _clean_claims(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Drop blank claim lines and trim surviving ones."""
        if v is None:
            return None
        cleaned = [c.strip() for c in v if c and c.strip()]
        return cleaned or None


# ===========================================================================
# Response
# ===========================================================================


class DraftSection(BaseModel):
    """One titled section of the generated document."""

    heading: str = Field(..., description="Section heading, e.g. 'FIELD OF THE INVENTION'.")
    body: str = Field(..., description="Rendered body text for this section.")


class DraftResponse(BaseModel):
    """Response returned by POST /api/drafts/generate."""

    template_type: TemplateType = Field(..., description="Echo of the requested template.")
    document_title: str = Field(..., description="Human-readable title of the document.")
    form_reference: str = Field(
        ...,
        description=(
            "The statutory form / provision reference this document maps to "
            "(e.g. 'Patents Rules, 2003 — Form 1')."
        ),
    )
    generated_at: str = Field(..., description="ISO-8601 UTC timestamp of generation.")
    sections: List[DraftSection] = Field(
        ...,
        description="Ordered list of the document's sections.",
    )
    plain_text: str = Field(
        ...,
        description=(
            "The full document rendered as a single plain-text string, suitable "
            "for copy-to-clipboard and .txt download on the frontend."
        ),
    )
    disclaimer: str = Field(
        default=_DISCLAIMER_TEXT,
        description="Fixed legal disclaimer, injected server-side.",
    )
