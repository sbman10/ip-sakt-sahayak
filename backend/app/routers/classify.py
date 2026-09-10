"""
backend/app/routers/classify.py
---------------------------------
FastAPI router for the deterministic Formulation Classification Wizard.

Endpoint
--------
    POST /api/classify

This router applies a purely rules-based, deterministic decision tree to
classify an Ayurvedic formulation and return its regulatory pathway,
patentability position, and required manufacturing license.

No ML models, no external API calls, no randomness — the response is
fully reproducible for any given (is_classical, has_preservatives, target)
combination.  This makes it unit-testable, auditable, and legally defensible.

Decision matrix
---------------
                     target = "Food"   target = "ASU"
  is_classical=T/F   -> Nutraceutical  -> Classical OR P&P (see has_preservatives)
  
  ASU branch:
    is_classical=True  AND has_preservatives=False  -> Classical (Shastriya)
    is_classical=True  AND has_preservatives=True   -> Patent & Proprietary
    is_classical=False (any has_preservatives)      -> Patent & Proprietary
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas.chat import WizardRequest, WizardResponse

log = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Classification constant strings — defined as module-level constants so they
# are easy to audit, update, and localise without hunting through logic blocks.
# ---------------------------------------------------------------------------

# --- Classical / Shastriya path ---
_CLASS_CLASSICAL = "Classical (Shastriya)"
_PATH_CLASSICAL = (
    "Formulas extracted directly from First-Schedule texts of the Drugs and "
    "Cosmetics Act. Manufacturing must strictly reproduce the classical "
    "text without alteration to retain this classification."
)
_PATENT_CLASSICAL = (
    "Barred from patenting under Section 3(p) of the Patents Act, 1970, "
    "as the formulation constitutes traditional knowledge already in the public "
    "domain. The formulation's composition is protected against misappropriation "
    "by the Traditional Knowledge Digital Library (TKDL), which is cited by "
    "patent offices worldwide to invalidate such patent applications."
)
_LICENSE_CLASSICAL = (
    "AYUSH Manufacturing License under Rule 158-B(1) of the Drugs and "
    "Cosmetics Rules, 1945. The Good Manufacturing Practice (GMP) standard "
    "prescribed under Schedule T must also be complied with."
)

# --- Patent & Proprietary / Anubhavasiddha / Modified path ---
_CLASS_PP = "Patent & Proprietary (Anubhavasiddha / Modified)"
_PATH_PP = (
    "Contains traditional Ayurvedic ingredients but has modified dosages, "
    "novel delivery systems (e.g. nano-formulation, sustained-release capsules), "
    "or novel combinations not described verbatim in any classical text. "
    "Governed by Schedule FF and Schedule T of the Drugs and Cosmetics Rules."
)
_PATENT_PP = (
    "Patentable ONLY if the applicant can demonstrate novelty (not disclosed "
    "anywhere before the priority date), an inventive step (non-obvious to a "
    "person skilled in the art), and — critically — enhanced therapeutic "
    "efficacy over the prior-art public baseline as required by Section 3(d) "
    "of the Patents Act, 1970. A Freedom-to-Operate (FTO) search against TKDL "
    "and IPD databases is strongly recommended before filing."
)
_LICENSE_PP = (
    "AYUSH Manufacturing License under Rule 158-B(2) of the Drugs and "
    "Cosmetics Rules, 1945. Clinical validation data and a qualified "
    "Ayurvedic physician on premises are required. GMP certification under "
    "Schedule T is mandatory."
)

# --- Nutraceutical / Ayurveda-Aahar path ---
_CLASS_FOOD = "Ayurveda-Aahar / Nutraceutical"
_PATH_FOOD = (
    "Functional food supplements containing herbal elements, regulated under "
    "the Food Safety and Standards (Health Supplements, Nutraceuticals, Food "
    "for Special Dietary Use, Food for Special Medical Purpose, Functional "
    "Food and Novel Food) Regulations, 2016, and — for Ayurveda-labelled "
    "products — additional guidance issued by FSSAI in coordination with "
    "the Ministry of AYUSH."
)
_PATENT_FOOD = (
    "Cannot claim therapeutic or curative efficacy in product labelling, "
    "marketing, or any patent claim directed at a human disease — such claims "
    "attract action under the Drugs and Cosmetics Act. Protection strategy "
    "should rely primarily on Trademark registration for the brand identity "
    "and Registered Design protection for distinctive packaging under the "
    "Designs Act, 2000. Novel herbal extraction processes may qualify for "
    "a process patent under Section 5 of the Patents Act if they meet novelty "
    "and inventive-step criteria."
)
_LICENSE_FOOD = (
    "FSSAI Registration (turnover < INR 12 lakhs/year) or FSSAI State/Central "
    "License (higher turnover), conforming to Ayurveda-Aahara product "
    "regulations. Obtain a FSSAI Product Approval for any new nutraceutical "
    "ingredient. If the label bears an AYUSH claim, additionally file a "
    "declaration with the relevant State AYUSH Licensing Authority."
)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/classify",
    response_model=WizardResponse,
    summary="Ayurvedic Formulation Classification Wizard",
    description=(
        "Deterministic, rules-based classifier that categorises an Ayurvedic "
        "formulation and returns its regulatory pathway, patentability position, "
        "and required manufacturing license based on Indian IP and AYUSH law."
    ),
)
def classify_formulation(payload: WizardRequest) -> WizardResponse:
    """
    Apply the decision tree and return a fully populated WizardResponse.

    Parameters
    ----------
    payload:
        Validated WizardRequest from the FastAPI request body.

    Returns
    -------
    WizardResponse
        Deterministic classification result with all four fields populated.
    """
    log.info(
        "Classify request | is_classical=%s | has_preservatives=%s | target=%s",
        payload.is_classical,
        payload.has_preservatives,
        payload.target,
    )

    # ------------------------------------------------------------------
    # Branch 1: Food / Nutraceutical — takes precedence over ASU rules
    # because a product targeting the food market follows FSSAI rules
    # regardless of whether its base formula is classical.
    # ------------------------------------------------------------------
    if payload.target == "Food":
        log.info("Classification result: Nutraceutical (Food target)")
        return WizardResponse(
            classification=_CLASS_FOOD,
            pathway=_PATH_FOOD,
            patentability=_PATENT_FOOD,
            required_license=_LICENSE_FOOD,
        )

    # ------------------------------------------------------------------
    # Branch 2: ASU — Classical (Shastriya)
    # Condition: classical text basis AND no synthetic preservatives or
    # novel delivery modifications.
    # ------------------------------------------------------------------
    if payload.is_classical and not payload.has_preservatives:
        log.info("Classification result: Classical (Shastriya)")
        return WizardResponse(
            classification=_CLASS_CLASSICAL,
            pathway=_PATH_CLASSICAL,
            patentability=_PATENT_CLASSICAL,
            required_license=_LICENSE_CLASSICAL,
        )

    # ------------------------------------------------------------------
    # Branch 3: ASU — Patent & Proprietary
    # Catches:
    #   - Classical base WITH preservatives/modifications
    #   - Entirely non-classical (novel / Anubhavasiddha) formulations
    # ------------------------------------------------------------------
    log.info("Classification result: Patent & Proprietary")
    return WizardResponse(
        classification=_CLASS_PP,
        pathway=_PATH_PP,
        patentability=_PATENT_PP,
        required_license=_LICENSE_PP,
    )
