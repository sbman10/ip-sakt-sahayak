"""
backend/app/routers/drafts.py
------------------------------
FastAPI router for the Draft Generation feature.

Endpoint
--------
    POST /api/drafts/generate

Given a template type and applicant-supplied fields, this router
deterministically renders a section-structured IP legal-document draft
(Patent Form-1, NBA application, or a Section 3(p) opposition petition).

No ML, no external API calls, no randomness — every response is fully
reproducible for a given request, which makes the output auditable and
unit-testable. Mirrors the deterministic design of routers/classify.py.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Dict, List, Tuple

from fastapi import APIRouter, HTTPException, status

from app.schemas.drafts import DraftRequest, DraftResponse, DraftSection
from app.templates import (
    form_1_template,
    nba_template,
    petition_3p_template,
)

log = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Template dispatch table — maps template_type -> renderer callable.
# Each renderer returns (sections, document_title, form_reference).
# ---------------------------------------------------------------------------

_RenderFn = Callable[[DraftRequest], Tuple[List[DraftSection], str, str]]

_TEMPLATE_RENDERERS: Dict[str, _RenderFn] = {
    "form_1": form_1_template.render,
    "nba": nba_template.render,
    "3p_petition": petition_3p_template.render,
}


def _render_plain_text(document_title: str, form_reference: str,
                       sections: List[DraftSection], disclaimer: str) -> str:
    """
    Flatten the structured sections into a single plain-text document,
    suitable for copy-to-clipboard and .txt download on the frontend.
    """
    lines: List[str] = []
    lines.append("=" * 72)
    lines.append(document_title.upper())
    lines.append(f"({form_reference})")
    lines.append("=" * 72)
    lines.append("")

    for sec in sections:
        lines.append(sec.heading)
        lines.append("-" * len(sec.heading))
        lines.append(sec.body)
        lines.append("")

    lines.append("-" * 72)
    lines.append("DISCLAIMER: " + disclaimer)
    lines.append("-" * 72)
    return "\n".join(lines)


@router.post(
    "/drafts/generate",
    response_model=DraftResponse,
    summary="Generate an IP legal-document draft",
    description=(
        "Deterministically generates a section-structured legal-document draft "
        "for one of three template types: 'form_1' (Patent Application Form-1), "
        "'nba' (National Biodiversity Authority application), or '3p_petition' "
        "(Section 3(p) pre-grant opposition petition). Realistic statutory "
        "placeholder language is filled from the supplied applicant fields."
    ),
    tags=["Drafts — Document Generation"],
)
def generate_draft(payload: DraftRequest) -> DraftResponse:
    """
    Dispatch to the correct template renderer and assemble the response.

    Parameters
    ----------
    payload:
        Validated DraftRequest from the FastAPI request body.

    Returns
    -------
    DraftResponse
        Structured sections + a flattened plain-text rendering + disclaimer.
    """
    log.info(
        "Draft generate request | template_type=%s | applicant=%s | title=%s",
        payload.template_type,
        payload.applicant_name,
        payload.invention_title[:60],
    )

    renderer = _TEMPLATE_RENDERERS.get(payload.template_type)
    if renderer is None:
        # Should be unreachable because template_type is a Literal validated
        # by Pydantic, but we guard defensively for a clean 400.
        log.warning("Unknown template_type reached router: %s", payload.template_type)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported template_type: {payload.template_type!r}",
        )

    sections, document_title, form_reference = renderer(payload)

    # Build the response object first so we can reuse its default disclaimer
    # in the plain-text flattening.
    response = DraftResponse(
        template_type=payload.template_type,
        document_title=document_title,
        form_reference=form_reference,
        generated_at=datetime.now(timezone.utc).isoformat(),
        sections=sections,
        plain_text="",  # filled below
    )
    response.plain_text = _render_plain_text(
        document_title, form_reference, sections, response.disclaimer
    )

    log.info(
        "Draft generated | template_type=%s | sections=%d | chars=%d",
        payload.template_type,
        len(sections),
        len(response.plain_text),
    )
    return response
