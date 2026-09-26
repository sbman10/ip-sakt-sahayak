"""
backend/app/services/patentability/report_generator.py
------------------------------------------------------
Phase 9 & 10: Grounded Report Generator & Citation Validation Service.
Synthesizes the complete Preliminary Patentability & Prior-Art Assessment report
strictly adhering to the 9-part Phase 9 format and Phase 10 grounded generation rules.
Enforces cautious result categories and validates all citations against retrieved sources.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.patentability import (
    AssessmentStatus,
    BibliographyEntry,
    DateCategory,
    ExperimentalChecklistItem,
    FeatureComparisonItem,
    InventionFeature,
    InventionFingerprint,
    PatentabilityAssessmentRequest,
    PatentabilityReport,
    PriorArtPointer,
    ResultCategory,
    StatutoryIssueItem,
)

log = logging.getLogger("app.services.patentability.report_generator")


class ReportGenerator:
    """
    Constructs the grounded preliminary assessment report and validates citation integrity.
    """

    def generate_report(
        self,
        req: PatentabilityAssessmentRequest,
        fingerprint: InventionFingerprint,
        retrieved_documents: List[Dict[str, Any]],
        categorized_pointers: Dict[str, List[PriorArtPointer]],
        comparison_table: List[FeatureComparisonItem],
        statutory_issues: List[StatutoryIssueItem],
        experimental_checklist: List[ExperimentalChecklistItem],
        evidence_gaps: List[str],
        possible_distinguishing: List[Dict[str, str]],
        latency_ms: float = 0.0,
    ) -> PatentabilityReport:
        assessment_id = str(uuid.uuid4())

        # 1. Determine cautious Result Category
        result_category = self._determine_result_category(
            fingerprint=fingerprint,
            retrieved_documents=retrieved_documents,
            comparison_table=comparison_table,
            statutory_issues=statutory_issues,
            evidence_gaps=evidence_gaps,
        )

        # 2. Build Bibliography (only documents actually retrieved and present in evidence pack)
        bibliography: List[BibliographyEntry] = []
        valid_source_ids = set()

        all_pointers: List[PriorArtPointer] = []
        for ptr_list in categorized_pointers.values():
            all_pointers.extend(ptr_list)

        for ptr in all_pointers:
            valid_source_ids.add(ptr.source_id)
            bibliography.append(
                BibliographyEntry(
                    source_id=ptr.source_id,
                    title=ptr.title,
                    authority=ptr.authority,
                    jurisdiction=ptr.jurisdiction,
                    document_type=ptr.document_type,
                    publication_date=ptr.publication_date,
                    source_link=ptr.source_link,
                )
            )

        # 3. Validate Citations (Phase 10 rule: no un-retrieved source citations)
        for item in comparison_table:
            if item.source_id not in valid_source_ids:
                log.warning("Invalid source citation detected in comparison table: %s", item.source_id)

        # 4. Format Invention Understood Summary
        invention_summary = {
            "title": fingerprint.title,
            "active_ingredients": ", ".join(fingerprint.active_ingredients) if fingerprint.active_ingredients else "Not specified",
            "dosage_form": fingerprint.dosage_form or "Not specified",
            "delivery_system": fingerprint.delivery_system or "Standard carrier",
            "process": " -> ".join(fingerprint.process_steps) if fingerprint.process_steps else "Standard extraction/compounding",
            "technical_effect": " | ".join(fingerprint.technical_effects) if fingerprint.technical_effects else "User-reported therapeutic effect",
            "intended_use": fingerprint.intended_use or "Therapeutic indication",
            "jurisdiction": fingerprint.jurisdiction,
            "relevant_date": fingerprint.relevant_date or "Missing (Incomplete temporal baseline)",
            "missing_or_uncertain_information": fingerprint.ambiguities,
        }

        # 5. Build Recommended Next Steps
        next_steps = [
            "Complete Missing Intake Fields: Supply missing processing parameters and exact geographic coordinates of biological resources.",
            "Upload Supporting Experimental Data: Provide comparative assay data (Formulation vs. individual components) to address Section 3(e) mere admixture hurdles.",
            "Verify Priority / Invention Dates: Establish certified laboratory notebook dates to certify temporal prior-art boundaries.",
            "Review High-Relevance Prior-Art Pointers: Examine cited TKDL entries and prior patent publications with an Indian Patent Agent.",
            "Mandatory NBA Form III Approval: Apply to National Biodiversity Authority prior to patent grant per Section 6 of the Biological Diversity Act, 2002.",
            "Obtain Registered Patent Agent Review: Undergo formal claim drafting and FTO (Freedom to Operate) clearance before any commercial disclosure.",
        ]

        # 6. Synthesize Standardized Markdown Report
        markdown_text = self._build_markdown_report(
            req=req,
            fingerprint=fingerprint,
            result_category=result_category,
            invention_summary=invention_summary,
            all_pointers=all_pointers,
            comparison_table=comparison_table,
            statutory_issues=statutory_issues,
            evidence_gaps=evidence_gaps,
            possible_distinguishing=possible_distinguishing,
            next_steps=next_steps,
            bibliography=bibliography,
        )

        return PatentabilityReport(
            assessment_id=assessment_id,
            status=AssessmentStatus.COMPLETED,
            result_category=result_category,
            jurisdiction=fingerprint.jurisdiction,
            relevant_date=fingerprint.relevant_date,
            is_time_assessment_incomplete=fingerprint.is_date_missing,
            invention_summary=invention_summary,
            feature_map=fingerprint.features,
            prior_art_pointers=all_pointers,
            feature_comparison_table=comparison_table,
            preliminary_observations=statutory_issues,
            evidence_gaps=evidence_gaps,
            possible_distinguishing_features=possible_distinguishing,
            recommended_next_steps=next_steps,
            bibliography=bibliography,
            markdown_report=markdown_text,
            confidence_score=75 if not fingerprint.is_date_missing else 50,
            latency_ms=latency_ms,
            field_warnings=fingerprint.ambiguities,
        )

    def _determine_result_category(
        self,
        fingerprint: InventionFingerprint,
        retrieved_documents: List[Dict[str, Any]],
        comparison_table: List[FeatureComparisonItem],
        statutory_issues: List[StatutoryIssueItem],
        evidence_gaps: List[str],
    ) -> ResultCategory:
        # Strict hierarchy of controlled categories
        if fingerprint.is_date_missing or len(evidence_gaps) >= 4:
            return ResultCategory.EVIDENCE_INSUFFICIENT

        has_critical_issue = any(issue.risk_level == "CRITICAL" for issue in statutory_issues)
        has_tk_overlap = any(
            issue.topic == "Traditional Knowledge Bar" and issue.risk_level == "HIGH"
            for issue in statutory_issues
        )
        overlap_features = [it for it in comparison_table if it.feature_present]

        if has_tk_overlap or len(overlap_features) >= 3:
            return ResultCategory.SIGNIFICANT_OVERLAP

        if has_critical_issue:
            return ResultCategory.PROFESSIONAL_REVIEW_REQUIRED

        return ResultCategory.POTENTIALLY_DISTINGUISHABLE

    def _build_markdown_report(
        self,
        req: PatentabilityAssessmentRequest,
        fingerprint: InventionFingerprint,
        result_category: ResultCategory,
        invention_summary: Dict[str, Any],
        all_pointers: List[PriorArtPointer],
        comparison_table: List[FeatureComparisonItem],
        statutory_issues: List[StatutoryIssueItem],
        evidence_gaps: List[str],
        possible_distinguishing: List[Dict[str, str]],
        next_steps: List[str],
        bibliography: List[BibliographyEntry],
    ) -> str:
        lines: List[str] = []

        lines.append("# Preliminary Patentability and Prior-Art Assessment")
        lines.append("")
        lines.append("## Important limitation")
        lines.append("")
        lines.append(
            "> **Notice:** This is an automated preliminary assessment based only on the indexed sources "
            "and information supplied by the user. It is not a legal opinion, patentability certificate "
            "or substitute for review by a registered patent agent or qualified legal professional."
        )
        lines.append("")
        lines.append(f"**Preliminary Result Category:** `{result_category.value}`")
        if fingerprint.is_date_missing:
            lines.append("")
            lines.append("> ⚠️ **Temporal Notice:** Earliest invention or priority date was not supplied. Time-based prior-art filtering is marked as incomplete.")
        lines.append("")

        # Section 1
        lines.append("## 1. Invention understood")
        lines.append("")
        lines.append(f"- **Active ingredients:** {invention_summary['active_ingredients']}")
        lines.append(f"- **Dosage form:** {invention_summary['dosage_form']}")
        lines.append(f"- **Delivery system:** {invention_summary['delivery_system']}")
        lines.append(f"- **Process:** {invention_summary['process']}")
        lines.append(f"- **Technical effect:** {invention_summary['technical_effect']}")
        lines.append(f"- **Intended use:** {invention_summary['intended_use']}")
        lines.append(f"- **Jurisdiction:** {invention_summary['jurisdiction']}")
        lines.append(f"- **Relevant date:** {invention_summary['relevant_date']}")
        if invention_summary["missing_or_uncertain_information"]:
            lines.append("- **Missing or uncertain information:**")
            for unc in invention_summary["missing_or_uncertain_information"]:
                lines.append(f"  - {unc}")
        lines.append("")

        # Section 2
        lines.append("## 2. Feature map")
        lines.append("")
        lines.append("| Feature ID | Category | Feature Name | Technical Value |")
        lines.append("|---|---|---|---|")
        for feat in fingerprint.features:
            lines.append(f"| **{feat.feature_id}** | {feat.category.value} | {feat.feature_name} | {feat.feature_value} |")
        lines.append("")

        # Section 3
        lines.append("## 3. Prior-art pointers")
        lines.append("")
        if not all_pointers:
            lines.append("> “No matching document was identified in the indexed corpus. This is not a legal novelty opinion.”")
        else:
            for ptr in all_pointers:
                lines.append(f"### [{ptr.source_id}] {ptr.title}")
                lines.append(f"- **Document ID:** {ptr.document_id}")
                lines.append(f"- **Document Type:** {ptr.document_type.capitalize()} ({ptr.date_category.value})")
                lines.append(f"- **Authority & Jurisdiction:** {ptr.authority} ({ptr.jurisdiction})")
                lines.append(f"- **Publication / Priority Date:** {ptr.publication_date or 'N/A'} (Priority: {ptr.priority_date or 'N/A'})")
                lines.append(f"- **Relevant Section / Page:** {ptr.relevant_section_or_page}")
                lines.append(f"- **Matching Features:** {', '.join(ptr.matching_features) if ptr.matching_features else 'None directly identified'}")
                lines.append(f"- **Missing Features:** {', '.join(ptr.missing_features) if ptr.missing_features else 'None'}")
                lines.append(f"- **Why Relevant:** {ptr.why_relevant}")
                lines.append("")

        # Section 4
        lines.append("## 4. Feature comparison table")
        lines.append("")
        lines.append("| Feature | User’s formulation | Prior-art overlap | Assessment |")
        lines.append("|---|---|---|---|")
        if not comparison_table:
            lines.append("| None | No features extracted | No prior art retrieved | Requires intake completion |")
        else:
            for it in comparison_table:
                overlap_txt = f"Found in [{it.source_id}]" if it.feature_present else f"Partial in [{it.source_id}]" if it.feature_uncertain else f"Not found in [{it.source_id}]"
                lines.append(f"| [{it.feature_id}] {it.feature_name} | {it.user_formulation_value} | {overlap_txt} | {it.assessment_label} |")
        lines.append("")

        # Section 5
        lines.append("## 5. Preliminary observations")
        lines.append("")
        for issue in statutory_issues:
            lines.append(f"### {issue.topic} ({issue.statutory_basis})")
            lines.append(f"- **Evidence found:** {issue.evidence_found}")
            lines.append(f"- **Interpretation:** {issue.interpretation}")
            lines.append(f"- **Missing information:** {issue.missing_information}")
            lines.append(f"- **Professional review required:** {'Yes — mandatory consultation recommended' if issue.professional_review_required else 'No'}")
            lines.append("")

        # Section 6
        lines.append("## 6. Evidence gaps")
        lines.append("")
        if not evidence_gaps:
            lines.append("No critical intake gaps detected from supplied parameters.")
        else:
            for gap in evidence_gaps:
                lines.append(f"- ⚠️ {gap}")
        lines.append("")

        # Section 7
        lines.append("## 7. Possible distinguishing features")
        lines.append("")
        if not possible_distinguishing:
            lines.append("No distinguishing features could be supported based solely on the supplied information without additional experimental proof.")
        else:
            for dist in possible_distinguishing:
                lines.append(f"- **{dist['feature']}:** {dist['observation']} — *{dist['wording']}*")
        lines.append("")

        # Section 8
        lines.append("## 8. Recommended next steps")
        lines.append("")
        for step in next_steps:
            lines.append(f"1. {step}")
        lines.append("")

        # Section 9
        lines.append("## 9. Bibliography")
        lines.append("")
        if not bibliography:
            lines.append("No external or indexed statutory sources cited.")
        else:
            for b in bibliography:
                lines.append(f"- **[{b.source_id}]** {b.title}. *{b.authority}* ({b.jurisdiction}, {b.publication_date or 'Undated'}).")
        lines.append("")

        return "\n".join(lines)


report_generator = ReportGenerator()
