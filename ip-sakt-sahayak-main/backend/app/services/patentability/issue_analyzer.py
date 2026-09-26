"""
backend/app/services/patentability/issue_analyzer.py
----------------------------------------------------
Phase 7 & 8: Patentability Statutory Issue Analysis & Experimental Evidence Checklist.
Evaluates the invention against official Indian legal standards:
- Patents Act 1970: Section 3(p) (Traditional Knowledge), 3(e) (Mere Admixture), 3(d) (Efficacy)
- Biological Diversity Act 2002: Section 6 (Mandatory NBA Form III Approval)
- Novelty (Section 2(1)(j)) and Inventive Step (Section 2(1)(ja))
- Generates required experimental proof checklists and flags unverified numerical claims.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.patentability import (
    DateCategory,
    ExperimentalChecklistItem,
    FeatureComparisonItem,
    InventionFingerprint,
    PatentabilityAssessmentRequest,
    StatutoryIssueItem,
)

log = logging.getLogger("app.services.patentability.issue_analyzer")


class PatentabilityIssueAnalyzer:
    """
    Statutory legal analyzer ensuring strict non-definitive analysis under Indian patent jurisprudence.
    """

    def analyze_issues(
        self,
        req: PatentabilityAssessmentRequest,
        fingerprint: InventionFingerprint,
        comparison_table: List[FeatureComparisonItem],
        retrieved_documents: List[Dict[str, Any]],
    ) -> Tuple[List[StatutoryIssueItem], List[ExperimentalChecklistItem], List[str], List[Dict[str, str]]]:
        statutory_issues: List[StatutoryIssueItem] = []
        checklist: List[ExperimentalChecklistItem] = []
        evidence_gaps: List[str] = []
        possible_distinguishing: List[Dict[str, str]] = []

        # -----------------------------------------------------------------------
        # 1. Section 3(p) — Traditional Knowledge Exclusion
        # -----------------------------------------------------------------------
        has_tk_reference = any(
            doc.get("document_type") == "traditional_knowledge" or "tkdl" in doc.get("chunk_id", "").lower()
            for doc in retrieved_documents
        )
        tk_overlap_features = [
            item for item in comparison_table
            if item.feature_present and ("Active" in item.feature_name or "Botanical" in item.feature_name)
        ]

        if has_tk_reference or tk_overlap_features:
            overlap_names = ", ".join(list(set(item.user_formulation_value for item in tk_overlap_features)))
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="Traditional Knowledge Bar",
                    statutory_basis="Section 3(p), Patents Act, 1970",
                    evidence_found=(
                        f"Active constituents ({overlap_names or 'botanicals'}) found documented in traditional medicine records / classical Samhitas. "
                        "Section 3(p) expressly excludes inventions which in effect are traditional knowledge or aggregations of known properties."
                    ),
                    interpretation=(
                        "Using known Ayurvedic herbs for their established classical therapeutic indications is barred under Section 3(p). "
                        "To be considered potentially patentable, the invention must rely on non-obvious modifications such as a synergistic interaction, "
                        "purified standardized fractions, or an advanced non-classical drug delivery system (e.g. nano-particles or targeted liposomes)."
                    ),
                    missing_information="Documented proof that the therapeutic action is not merely the known classical effect of the individual herbs.",
                    professional_review_required=True,
                    risk_level="HIGH",
                )
            )
        else:
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="Traditional Knowledge Bar",
                    statutory_basis="Section 3(p), Patents Act, 1970",
                    evidence_found="No direct classical Ayurvedic match identified in current indexed knowledge corpus.",
                    interpretation=(
                        "While no direct match was retrieved in the local database, an exhaustive search against official TKDL "
                        "databases (which contain over 2.5 lakh classical formulations) is mandatory prior to filing."
                    ),
                    missing_information="Formal comprehensive CSIR-TKDL prior-art clearance search report.",
                    professional_review_required=True,
                    risk_level="MODERATE",
                )
            )

        # -----------------------------------------------------------------------
        # 2. Section 3(e) — Mere Admixture vs. Synergistic Combination
        # -----------------------------------------------------------------------
        num_actives = len(fingerprint.active_ingredients)
        if num_actives > 1 or req.ingredients and ("," in req.ingredients or "+" in req.ingredients):
            has_synergy_claim = bool(req.pharmacological_or_technical_effect and "synerg" in req.pharmacological_or_technical_effect.lower())
            has_experimental_data = bool(req.bioavailability_data or req.uploaded_supporting_documents)

            if has_synergy_claim and not has_experimental_data:
                statutory_issues.append(
                    StatutoryIssueItem(
                        topic="Mere Admixture vs. Synergism Concern",
                        statutory_basis="Section 3(e), Patents Act, 1970",
                        evidence_found="Multi-herb formulation claimed, with assertion of synergistic or enhanced effect.",
                        interpretation=(
                            "Under Section 3(e), a substance obtained by mere admixture resulting only in aggregation of properties "
                            "is not an invention. Indian Patent Office guidelines require comparative experimental data proving that "
                            "the combination produces a synergistic therapeutic index exceeding the sum of the individual components."
                        ),
                        missing_information=(
                            "Combination-index (Chou-Talalay or isobologram) or comparative assay comparing Formulation vs. "
                            "Component A alone vs. Component B alone."
                        ),
                        professional_review_required=True,
                        risk_level="HIGH",
                    )
                )
                evidence_gaps.append(
                    "Section 3(e) Synergy Proof: Provide comparative assay data showing Formulation vs Component A alone vs Component B alone."
                )
            else:
                statutory_issues.append(
                    StatutoryIssueItem(
                        topic="Mere Admixture vs. Synergism Concern",
                        statutory_basis="Section 3(e), Patents Act, 1970",
                        evidence_found="Multiple ingredients blended into a composite formulation.",
                        interpretation=(
                            "Without clear comparative data against individual components, examiners frequently issue Section 3(e) objections during First Examination Reports (FER)."
                        ),
                        missing_information="Comparative study testing individual components against the final composite mixture.",
                        professional_review_required=True,
                        risk_level="MODERATE",
                    )
                )

        # -----------------------------------------------------------------------
        # 3. Section 3(d) — Known Substance and Enhanced Efficacy
        # -----------------------------------------------------------------------
        if fingerprint.delivery_system or fingerprint.dosage_form:
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="New Form / Enhanced Efficacy Standard",
                    statutory_basis="Section 3(d), Patents Act, 1970",
                    evidence_found=f"New formulation / delivery matrix reported: '{fingerprint.dosage_form or fingerprint.delivery_system}'.",
                    interpretation=(
                        "Per landmark Supreme Court jurisprudence (Novartis AG v. Union of India), a new formulation or derivative "
                        "of a known substance must demonstrate a significant enhancement of therapeutic efficacy. "
                        "Mere pharmacokinetic improvement (such as higher solubility or sustained release) without a direct "
                        "demonstration of therapeutic efficacy is closely scrutinized under Section 3(d)."
                    ),
                    missing_information="Clinical or in-vivo proof showing that the enhanced delivery directly translates to improved therapeutic outcome.",
                    professional_review_required=True,
                    risk_level="HIGH" if not req.bioavailability_data else "MODERATE",
                )
            )

        # -----------------------------------------------------------------------
        # 4. Biological Diversity Act 2002 — Section 6 Mandatory NBA Approval
        # -----------------------------------------------------------------------
        is_bio_sourced = bool(req.biological_resource_source or req.botanical_names or req.ingredients)
        if is_bio_sourced:
            geo_origin = req.geographic_source or "Unspecified Indian origin"
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="Biological Resource & National Biodiversity Authority Clearance",
                    statutory_basis="Section 6, Biological Diversity Act, 2002 & Section 10(4)(ii)(D) Patents Act",
                    evidence_found=f"Invention utilizes biological materials (herbal/plant origin). Source: {geo_origin}.",
                    interpretation=(
                        "Under Section 6(1) of the Biological Diversity Act, 2002, prior approval of the National Biodiversity Authority (NBA) "
                        "via Form III is legally mandatory before the grant of a patent in India. Failure to obtain NBA approval or conceal origin "
                        "is a non-bailable offense and grounds for patent revocation under Section 64(1)(p) of the Patents Act."
                    ),
                    missing_information=(
                        "Form III NBA application filing details, exact State/District geographical coordinates of accession, "
                        "and Benefit Sharing Agreement where applicable."
                    ),
                    professional_review_required=True,
                    risk_level="CRITICAL" if not req.geographic_source else "MODERATE",
                )
            )
            if not req.geographic_source:
                evidence_gaps.append(
                    "Mandatory NBA Origin Disclosure: Supply exact geographic source (State, District) and whether biological resource is wild or cultivated."
                )

        # -----------------------------------------------------------------------
        # 5. Novelty (Section 2(1)(j)) & Inventive Step (Section 2(1)(ja))
        # -----------------------------------------------------------------------
        earlier_docs = [
            doc for doc in retrieved_documents
            if doc.get("date_category") == DateCategory.EARLIER_PRIOR_ART
        ]

        single_doc_anticipation = False
        for doc in earlier_docs:
            doc_feats_present = [
                it for it in comparison_table
                if it.document_id == doc.get("document_id") and it.feature_present
            ]
            if len(doc_feats_present) >= max(3, len(fingerprint.features) - 1):
                single_doc_anticipation = True
                break

        if single_doc_anticipation:
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="Novelty Assessment",
                    statutory_basis="Section 2(1)(j), Patents Act, 1970",
                    evidence_found="A single earlier prior art document discloses substantial overlapping features of the claimed formulation.",
                    interpretation=(
                        "High prior-art overlap detected. To maintain novelty under Section 2(1)(j), the claims must be narrowed "
                        "to specific differentiating features (such as non-obvious extract ratios, specific excipient matrices, or unique release profiles)."
                    ),
                    missing_information="Identification of distinguishing structural or technical parameters not disclosed in the cited document.",
                    professional_review_required=True,
                    risk_level="HIGH",
                )
            )
        else:
            statutory_issues.append(
                StatutoryIssueItem(
                    topic="Novelty Assessment",
                    statutory_basis="Section 2(1)(j), Patents Act, 1970",
                    evidence_found=(
                        "No single document in the indexed corpus discloses all elements of the user's claimed combination. "
                        "Note: This is an automated preliminary observation, not a legal novelty opinion."
                    ),
                    interpretation=(
                        "Under Indian law, anticipation requires that every essential feature of the claim be disclosed in a single prior publication. "
                        "No single anticipating reference was identified in the current index."
                    ),
                    missing_information="Full-scale multi-jurisdiction patent search across IPO, WIPO, USPTO, and EPO databases.",
                    professional_review_required=True,
                    risk_level="LOW",
                )
            )

        # Inventive Step
        statutory_issues.append(
            StatutoryIssueItem(
                topic="Inventive Step (Non-Obviousness)",
                statutory_basis="Section 2(1)(ja), Patents Act, 1970",
                evidence_found=(
                    "Individual components and formulation principles are known in the art across multiple references."
                ),
                interpretation=(
                    "Under Section 2(1)(ja), the invention must feature a technical advance as compared to existing knowledge "
                    "that is not obvious to a person skilled in the art. Combining known herbs into a known dosage form (e.g. tablet or syrup) "
                    "is typically held to be obvious unless an unexpected technical hurdle was overcome."
                ),
                missing_information="Evidence showing that formulating these specific components presented unexpected technical difficulties or produced unexpected outcomes.",
                professional_review_required=True,
                risk_level="HIGH",
            )
        )

        # -----------------------------------------------------------------------
        # Experimental Evidence Checklist (Phase 8)
        # -----------------------------------------------------------------------
        # Check numerical claims
        claim_text = (req.pharmacological_or_technical_effect or "") + " " + (req.bioavailability_data or "")
        match_num = re.search(r"(\d+(\.\d+)?\s*(x|fold|%|times))", claim_text, re.IGNORECASE)
        has_verified_report = len(req.uploaded_supporting_documents) > 0

        if match_num:
            claimed_val = match_num.group(1)
            checklist.append(
                ExperimentalChecklistItem(
                    category="Numerical Performance Claim",
                    requirement=f"Validation of claimed '{claimed_val}' technical improvement",
                    status="verified" if has_verified_report else "user_reported_unverified",
                    comparator_needed="Standard control / benchmark formulation (pure active or commercial baseline)",
                    recommended_test_method="In-vitro dissolution testing or in-vivo pharmacokinetic bioavailability profile (AUC, Cmax, Tmax)",
                    importance="CRITICAL",
                )
            )
            if not has_verified_report:
                evidence_gaps.append(
                    f"Unsupported Numerical Claim: Claim of '{claimed_val}' improvement is user-reported and not independently verified. Supporting lab assay required."
                )

        checklist.extend([
            ExperimentalChecklistItem(
                category="Synergy & Admixture Controls",
                requirement="Comparative testing of composite formulation against individual components",
                status="missing",
                comparator_needed="Formulation vs Component A alone vs Component B alone",
                recommended_test_method="Isobologram analysis, Combination Index (CI < 1.0), or standard dose-response curve",
                importance="HIGH",
            ),
            ExperimentalChecklistItem(
                category="Stability & Reproducibility",
                requirement="Accelerated stability data and batch reproducibility (replicate testing)",
                status="missing",
                comparator_needed="Minimum 3 independent production batches",
                recommended_test_method="ICH guidelines (Q1A) testing at 40°C/75% RH over 3-6 months",
                importance="HIGH",
            ),
            ExperimentalChecklistItem(
                category="Release Profile Validation",
                requirement="In-vitro dissolution kinetics validation",
                status="verified" if req.release_profile and has_verified_report else "user_reported_unverified" if req.release_profile else "missing",
                comparator_needed="Immediate release control formulation",
                recommended_test_method="USP Apparatus II (Paddle) dissolution profiling in simulated gastric / intestinal fluids",
                importance="HIGH",
            ),
            ExperimentalChecklistItem(
                category="Biological Resource Authentication",
                requirement="Botanical identity voucher specimen and authentication certificate",
                status="verified" if req.standardisation_details else "missing",
                comparator_needed="Official pharmacopoeial standard (API / IP monograph)",
                recommended_test_method="HPTLC / HPLC fingerprinting against certified reference standards",
                importance="HIGH",
            ),
        ])

        # -----------------------------------------------------------------------
        # Possible Distinguishing Features (Conservative)
        # -----------------------------------------------------------------------
        if req.ingredient_ranges:
            possible_distinguishing.append({
                "feature": "Specific Ingredient Ratio / Range",
                "observation": "User-specified concentration ratio was not identified in retrieved documents.",
                "wording": "may require closer comparison and experimental confirmation that the ratio produces a critical non-obvious effect.",
            })

        if req.carrier_or_polymer_matrix:
            possible_distinguishing.append({
                "feature": "Carrier / Polymer Delivery Architecture",
                "observation": "Specific delivery matrix reported.",
                "wording": "could be technically relevant if it overcomes documented instability or poor solubility of the herbal actives.",
            })

        if req.release_profile:
            possible_distinguishing.append({
                "feature": "Sustained / Modified Release Profile",
                "observation": "Reported dissolution kinetics.",
                "wording": "requires experimental confirmation using comparative standard dissolution testing.",
            })

        return statutory_issues, checklist, evidence_gaps, possible_distinguishing


patentability_issue_analyzer = PatentabilityIssueAnalyzer()
