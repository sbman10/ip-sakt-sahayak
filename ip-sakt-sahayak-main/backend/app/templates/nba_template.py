"""
backend/app/templates/nba_template.py
--------------------------------------
Renderer for an application to the National Biodiversity Authority (NBA)
for prior approval before applying for Intellectual Property Rights based on
biological resources / associated traditional knowledge obtained from India.

Statutory basis: Section 6 of the Biological Diversity Act, 2002, read with
the relevant NBA (Access and Benefit Sharing) Regulations, 2014, and Form III
of the Biological Diversity Rules, 2004.

Realistic placeholder language only — NOT a filing-ready form.
"""

from __future__ import annotations

from typing import List, Tuple

from app.schemas.drafts import DraftRequest, DraftSection

DOCUMENT_TITLE = (
    "APPLICATION TO THE NATIONAL BIODIVERSITY AUTHORITY FOR PRIOR APPROVAL "
    "BEFORE APPLYING FOR INTELLECTUAL PROPERTY RIGHTS"
)
FORM_REFERENCE = (
    "Biological Diversity Act, 2002 — Section 6; Biological Diversity Rules, "
    "2004 — Form III; NBA (ABS) Regulations, 2014"
)

_TBD = "[TO BE COMPLETED BY APPLICANT]"


def render(req: DraftRequest) -> Tuple[List[DraftSection], str, str]:
    """Build the NBA application sections from the request."""
    applicant = req.applicant_name.strip()
    address = (req.applicant_address or _TBD).strip()
    title = req.invention_title.strip()
    filing_date = req.filing_date.strip()

    sections: List[DraftSection] = []

    sections.append(DraftSection(
        heading="A. PARTICULARS OF THE APPLICANT",
        body=(
            f"1. Full name of the applicant: {applicant}\n"
            f"2. Address / registered office: {address}\n"
            f"3. Nationality: [Indian / Non-Indian — {_TBD}]\n"
            f"4. Status: [ ] Individual  [ ] Company  [ ] Institution  [ ] Other\n"
            f"5. Contact (phone / e-mail): {_TBD}"
        ),
    ))

    sections.append(DraftSection(
        heading="B. NATURE OF THE INTELLECTUAL PROPERTY RIGHT SOUGHT",
        body=(
            "Type of IPR intended to be applied for:\n"
            "[ ] Patent   [ ] Plant Variety   [ ] Copyright   [ ] Other\n\n"
            f"Title / subject of the proposed IPR application: {title}\n"
            f"Intended date of the IPR application: {filing_date}\n"
            f"Patent / application reference (if already filed): "
            f"{req.application_number or _TBD}"
        ),
    ))

    sections.append(DraftSection(
        heading="C. BIOLOGICAL RESOURCE(S) AND ASSOCIATED TRADITIONAL KNOWLEDGE",
        body=(
            "Details of the biological resource(s) and/or associated traditional "
            "knowledge used in the research or invention:\n\n"
            f"{req.description.strip()}\n\n"
            "Geographical location(s) from where the biological resource was "
            f"obtained: {_TBD}\n"
            "Quantity of biological resource used: " + _TBD + "\n"
            "Whether the resource is normally traded as a commodity: [ ] Yes [ ] No"
        ),
    ))

    sections.append(DraftSection(
        heading="D. PURPOSE AND EXPECTED OUTCOME",
        body=(
            "A concise statement of the research/invention, its purpose, and the "
            "commercial utilisation, if any, expected to arise from the biological "
            "resource and/or associated knowledge:\n\n"
            f"{req.description.strip()[:800]}"
        ),
    ))

    sections.append(DraftSection(
        heading="E. BENEFIT-SHARING PROPOSAL",
        body=(
            "The applicant undertakes to abide by the benefit-sharing terms "
            "determined by the National Biodiversity Authority under Section 21 "
            "of the Biological Diversity Act, 2002, which may include monetary "
            "and/or non-monetary benefits to the benefit claimers, including the "
            "concerned local bodies and holders of traditional knowledge.\n\n"
            f"Proposed mode of benefit sharing: {_TBD}\n"
            f"Identified benefit claimers / local communities: {_TBD}"
        ),
    ))

    sections.append(DraftSection(
        heading="F. DECLARATION AND UNDERTAKING",
        body=(
            f"I, {applicant}, hereby declare that the information furnished above "
            "is true and correct to the best of my knowledge and belief. I "
            "undertake not to transfer the biological resource and/or associated "
            "knowledge, or the results of research thereon, to any third party "
            "without the prior approval of the National Biodiversity Authority, "
            "and to comply with all conditions imposed under the Act and the "
            "Regulations.\n\n"
            f"Place: ____________     Date: ____________\n\n"
            f"Signature of the Applicant: __________________________\n"
            f"Name: {applicant}"
        ),
    ))

    sections.append(DraftSection(
        heading="G. ENCLOSURES / FEE",
        body=(
            "[ ] Prescribed application fee as per NBA (ABS) Regulations, 2014\n"
            "[ ] Passport-size photograph / authorisation letter\n"
            "[ ] Details of prior collaborative research, if any\n"
            "[ ] Copy of the IPR application / provisional specification, if filed"
        ),
    ))

    return sections, DOCUMENT_TITLE, FORM_REFERENCE
