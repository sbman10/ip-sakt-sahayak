"""
backend/app/templates/form_1_template.py
-----------------------------------------
Renderer for the Indian Patent Application "Form 1" — the Application for
Grant of a Patent under Section 7, 54 & 135 and Rule 20(1) of the Patents
Rules, 2003.

This produces a realistic, section-structured scaffold with statutory
placeholder language. It is NOT a filing-ready form; a registered patent
agent must review and complete every field.
"""

from __future__ import annotations

from typing import List, Tuple

from app.schemas.drafts import DraftRequest, DraftSection

DOCUMENT_TITLE = "APPLICATION FOR GRANT OF PATENT (FORM 1)"
FORM_REFERENCE = "Patents Rules, 2003 — Form 1 (Section 7, 54 & 135; Rule 20(1))"

# A placeholder shown wherever the applicant has not supplied a value.
_TBD = "[TO BE COMPLETED BY APPLICANT / PATENT AGENT]"


def render(req: DraftRequest) -> Tuple[List[DraftSection], str, str]:
    """
    Build the Form-1 sections from the request.

    Returns
    -------
    (sections, document_title, form_reference)
    """
    applicant = req.applicant_name.strip()
    address = (req.applicant_address or _TBD).strip()
    title = req.invention_title.strip()
    filing_date = req.filing_date.strip()

    claims = req.claims or [
        "A composition/process as herein described and illustrated by the "
        "accompanying description. " + _TBD
    ]

    sections: List[DraftSection] = []

    sections.append(DraftSection(
        heading="1. APPLICANT'S REFERENCE / IDENTIFICATION OF APPLICATION",
        body=(
            f"Type of Application: ORDINARY APPLICATION.\n"
            f"Applicant's Reference No.: {_TBD}\n"
            f"Intended Date of Filing: {filing_date}"
        ),
    ))

    sections.append(DraftSection(
        heading="2. TYPE OF APPLICATION",
        body=(
            "[X] Ordinary    [ ] Convention    [ ] PCT-NP (National Phase)\n"
            "[ ] Divisional (of Application No.: ____)    "
            "[ ] Patent of Addition (to Application No.: ____)"
        ),
    ))

    sections.append(DraftSection(
        heading="3. APPLICANT(S)",
        body=(
            f"Name in full: {applicant}\n"
            f"Nationality: [Indian / Other — {_TBD}]\n"
            f"Country of Residence: India\n"
            f"Address of the Applicant: {address}\n"
            f"Category of Applicant: [ ] Natural Person   "
            f"[ ] Startup   [ ] Small Entity   [ ] Others (Large Entity)"
        ),
    ))

    sections.append(DraftSection(
        heading="4. INVENTOR(S)",
        body=(
            "Are all the inventor(s) same as the applicant(s)?  [ ] Yes  [ ] No\n"
            f"If No, furnish the following particulars —\n"
            f"Name in full: {applicant if not req.respondent_name else _TBD}\n"
            f"Nationality: [Indian / Other — {_TBD}]\n"
            f"Country of Residence: India\n"
            f"Address: {address}"
        ),
    ))

    sections.append(DraftSection(
        heading="5. TITLE OF THE INVENTION",
        body=title,
    ))

    sections.append(DraftSection(
        heading="6. ADDRESS FOR SERVICE OF APPLICANT / AGENT IN INDIA",
        body=(
            f"Name of the Patent Agent: {_TBD}\n"
            f"IN/PA Registration No.: {_TBD}\n"
            f"Postal Address: {_TBD}\n"
            f"Telephone / Mobile No.: {_TBD}\n"
            f"E-mail ID: {_TBD}"
        ),
    ))

    sections.append(DraftSection(
        heading="7. FIELD OF THE INVENTION",
        body=(
            "The present invention relates generally to the technical field of "
            "the subject matter described below and, more particularly, to the "
            "following:\n\n"
            f"{req.description.strip()}"
        ),
    ))

    sections.append(DraftSection(
        heading="8. BACKGROUND AND SUMMARY OF THE INVENTION",
        body=(
            "Prior-art formulations and processes in this field suffer from one "
            "or more limitations which the present invention seeks to overcome. "
            "The applicant asserts that the invention satisfies the requirements "
            "of novelty and inventive step under Sections 2(1)(j) and 2(1)(ja) "
            "of the Patents Act, 1970.\n\n"
            "Where the subject matter is derived from or related to traditional "
            "Ayurvedic knowledge, the applicant confirms that the claimed "
            "invention demonstrates a technical advancement and/or enhanced "
            "therapeutic efficacy over the known prior art, so as not to be "
            "barred under Section 3(d) or Section 3(p) of the Act. A Freedom-to-"
            "Operate search against the Traditional Knowledge Digital Library "
            "(TKDL) is recommended prior to filing.\n\n"
            f"Summary of the invention: {req.description.strip()[:600]}"
        ),
    ))

    numbered_claims = "\n".join(
        f"  {idx}. {claim}" for idx, claim in enumerate(claims, start=1)
    )
    sections.append(DraftSection(
        heading="9. CLAIMS",
        body=(
            "The following claims define the scope of protection sought "
            "(to be finalised in the complete specification):\n\n"
            f"{numbered_claims}"
        ),
    ))

    sections.append(DraftSection(
        heading="10. DECLARATION BY THE APPLICANT",
        body=(
            f"I/We, {applicant}, the applicant(s) hereof, declare that I/We am/are "
            "in possession of the above-mentioned invention; that the provisional/"
            "complete specification relating to the invention is filed with this "
            "application; and that there is no lawful ground of objection to the "
            "grant of a patent to me/us in respect of the said invention.\n\n"
            f"Dated this ____ day of ______________, at ____________.\n\n"
            f"Signature: __________________________\n"
            f"Name: {applicant}"
        ),
    ))

    sections.append(DraftSection(
        heading="11. ATTACHMENTS / FEE",
        body=(
            "[ ] Complete/Provisional Specification (Form 2)\n"
            "[ ] Drawings\n"
            "[ ] Statement & Undertaking (Form 3)\n"
            "[ ] Declaration as to Inventorship (Form 5, for complete spec.)\n"
            "[ ] Power of Authority (Form 26), if filed through an agent\n"
            "[ ] Prescribed fee as per the First Schedule of the Patents Rules, 2003"
        ),
    ))

    return sections, DOCUMENT_TITLE, FORM_REFERENCE
