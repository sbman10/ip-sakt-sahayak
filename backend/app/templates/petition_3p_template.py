"""
backend/app/templates/petition_3p_template.py
----------------------------------------------
Renderer for a Pre-Grant Opposition (Representation) Petition under
Section 25(1) of the Patents Act, 1970, read with Rule 55 of the Patents
Rules, 2003 — commonly relying on Section 3(p) (invention which, in effect,
is traditional knowledge or an aggregation/duplication of known properties of
traditionally known component(s)) as a ground of opposition.

Realistic placeholder legal language only — NOT a filing-ready pleading.
"""

from __future__ import annotations

from typing import List, Tuple

from app.schemas.drafts import DraftRequest, DraftSection

DOCUMENT_TITLE = (
    "REPRESENTATION FOR PRE-GRANT OPPOSITION UNDER SECTION 25(1) OF THE "
    "PATENTS ACT, 1970"
)
FORM_REFERENCE = (
    "Patents Act, 1970 — Section 25(1) & Section 3(p); Patents Rules, 2003 — "
    "Rule 55"
)

_TBD = "[TO BE COMPLETED BY OPPONENT / AGENT]"


def render(req: DraftRequest) -> Tuple[List[DraftSection], str, str]:
    """Build the opposition-petition sections from the request."""
    opponent = req.applicant_name.strip()
    respondent = (req.respondent_name or "[NAME OF THE PATENT APPLICANT]").strip()
    app_no = (req.application_number or "[APPLICATION NUMBER]").strip()
    title = req.invention_title.strip()
    filing_date = req.filing_date.strip()

    sections: List[DraftSection] = []

    sections.append(DraftSection(
        heading="IN THE MATTER OF",
        body=(
            "BEFORE THE CONTROLLER OF PATENTS, THE PATENT OFFICE, "
            f"[BRANCH — {_TBD}]\n\n"
            f"In the matter of Indian Patent Application No. {app_no} "
            f'titled "{title}";\n\n'
            "AND\n\n"
            "In the matter of a Representation by way of Pre-Grant Opposition "
            "under Section 25(1) of the Patents Act, 1970 read with Rule 55 of "
            "the Patents Rules, 2003.\n\n"
            f"{opponent}\n"
            "\t\t\t\t\t\t...OPPONENT\n"
            "versus\n"
            f"{respondent}\n"
            "\t\t\t\t\t\t...APPLICANT / RESPONDENT"
        ),
    ))

    sections.append(DraftSection(
        heading="1. PARTICULARS OF THE OPPONENT",
        body=(
            f"Name of the Opponent: {opponent}\n"
            f"Address for service in India: {req.applicant_address or _TBD}\n"
            f"Interest of the Opponent in the matter: {_TBD}\n"
            f"Date of this representation: {filing_date}"
        ),
    ))

    sections.append(DraftSection(
        heading="2. THE IMPUGNED APPLICATION",
        body=(
            f"The Opponent has come to learn of Patent Application No. {app_no} "
            f'titled "{title}", filed by the Applicant and published under '
            "Section 11A of the Patents Act, 1970. The Opponent submits that the "
            "said application ought not to proceed to grant for the grounds set "
            "out hereinbelow."
        ),
    ))

    sections.append(DraftSection(
        heading="3. GROUNDS OF OPPOSITION",
        body=(
            "The Opponent opposes the grant of the patent on, inter alia, the "
            "following grounds under Section 25(1) of the Patents Act, 1970:\n\n"
            "(a) Section 25(1)(d) — Public knowledge / public use in India before "
            "the priority date;\n"
            "(b) Section 25(1)(e) — Obviousness and lack of inventive step;\n"
            "(c) Section 25(1)(f) read with Section 3(p) — The subject matter is, "
            "in effect, traditional knowledge, or is an aggregation or duplication "
            "of the known properties of traditionally known component(s), and is "
            "therefore not an invention within the meaning of the Act;\n"
            "(d) Section 25(1)(f) read with Section 3(d) — Mere discovery of a new "
            "form / new use of a known substance without enhancement of known "
            "efficacy;\n"
            "(e) Section 25(1)(j) — The complete specification does not sufficiently "
            "and clearly describe the invention."
        ),
    ))

    sections.append(DraftSection(
        heading="4. STATEMENT OF THE CASE (SUBSTANTIVE)",
        body=(
            "In support of the above grounds, the Opponent states as follows:\n\n"
            f"{req.description.strip()}\n\n"
            "The Opponent relies on the Traditional Knowledge Digital Library "
            "(TKDL), classical Ayurvedic texts, and other prior-art publications "
            "particularised in the accompanying evidence to demonstrate that the "
            "claimed subject matter was already known and/or is obvious, and falls "
            "squarely within the bar of Section 3(p) of the Patents Act, 1970."
        ),
    ))

    sections.append(DraftSection(
        heading="5. PRAYER",
        body=(
            "In view of the foregoing, the Opponent respectfully prays that this "
            "Hon'ble Controller may be pleased to:\n\n"
            f"(i) Refuse the grant of a patent on Application No. {app_no};\n"
            "(ii) Afford the Opponent an opportunity of a hearing under Rule 55(4) "
            "of the Patents Rules, 2003, before any decision is taken;\n"
            "(iii) Pass such further or other orders as this Hon'ble Controller may "
            "deem fit in the facts and circumstances of the case."
        ),
    ))

    sections.append(DraftSection(
        heading="6. VERIFICATION",
        body=(
            f"I, {opponent}, do hereby verify that the contents of the above "
            "representation are true and correct to the best of my knowledge, "
            "information and belief, and that nothing material has been concealed "
            "therefrom.\n\n"
            f"Verified at ____________ on this ____ day of ______________.\n\n"
            f"Signature of the Opponent / Authorised Agent: ______________________\n"
            f"Name: {opponent}"
        ),
    ))

    sections.append(DraftSection(
        heading="7. LIST OF DOCUMENTS RELIED UPON",
        body=(
            "[ ] Extracts from the Traditional Knowledge Digital Library (TKDL)\n"
            "[ ] Relevant classical Ayurvedic text references\n"
            "[ ] Prior-art publications / patents\n"
            "[ ] Power of Attorney (Form 26), if filed through an agent\n"
            "[ ] Any expert affidavit(s)"
        ),
    ))

    return sections, DOCUMENT_TITLE, FORM_REFERENCE
