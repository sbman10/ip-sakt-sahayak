"""
backend/app/services/patentability/orchestrator.py
--------------------------------------------------
End-to-end Orchestrator for the Patentability and Prior-Art Assessment Workflow.
Coordinates:
  PII Scrubbing ->
  Invention Fingerprint Extraction ->
  Controlled 9-Angle Hybrid Search ->
  Temporal Prior-Art Categorization ->
  Feature-by-Feature Comparison Matrix ->
  Statutory Patentability Issue Analysis (Sec 3(p), 3(d), 3(e), NBA) ->
  Experimental Evidence Checklist ->
  Grounded Report Generation & Citation Validation.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.schemas.patentability import (
    AssessmentStatus,
    PatentabilityAssessmentRequest,
    PatentabilityReport,
)
from app.services.patentability.comparison_engine import comparison_engine
from app.services.patentability.fingerprint_service import fingerprint_service
from app.services.patentability.issue_analyzer import patentability_issue_analyzer
from app.services.patentability.report_generator import report_generator
from app.services.patentability.search_strategy import prior_art_search_strategy
from app.services.pii_scrubber import scrub_pii

log = logging.getLogger("app.services.patentability.orchestrator")


class PatentabilityOrchestrator:
    """
    Main execution pipeline for preliminary evidence-based patentability assessments.
    """

    async def execute_assessment(
        self,
        req: PatentabilityAssessmentRequest,
    ) -> PatentabilityReport:
        start_time = time.perf_counter()

        # 1. PII Scrubbing for DPDP compliance on natural language text fields
        scrubbed_title = scrub_pii(req.title)
        scrubbed_problem = scrub_pii(req.problem_statement) if req.problem_statement else None
        scrubbed_process = scrub_pii(req.preparation_process) if req.preparation_process else None
        scrubbed_disclosure = scrub_pii(req.public_disclosure_details) if req.public_disclosure_details else None

        req_scrubbed = req.model_copy(
            update={
                "title": scrubbed_title,
                "problem_statement": scrubbed_problem,
                "preparation_process": scrubbed_process,
                "public_disclosure_details": scrubbed_disclosure,
            }
        )

        # 2. Phase 2 & 3: Extraction of Invention Fingerprint & Feature Model
        fingerprint = fingerprint_service.extract_fingerprint(req_scrubbed)

        # 3. Phase 4 & 5: Controlled Multi-Query Hybrid Search & Prior-Art Categorization
        reranked_docs, categorized_pointers = prior_art_search_strategy.execute_search(
            req=req_scrubbed,
            fingerprint=fingerprint,
        )

        # 4. Phase 6: Feature-by-Feature Comparison Matrix
        comparison_table = comparison_engine.build_comparison_matrix(
            fingerprint=fingerprint,
            retrieved_documents=reranked_docs,
        )

        # 5. Phase 7 & 8: Statutory Issue Analysis & Experimental Proof Checklist
        statutory_issues, checklist, evidence_gaps, possible_distinguishing = (
            patentability_issue_analyzer.analyze_issues(
                req=req_scrubbed,
                fingerprint=fingerprint,
                comparison_table=comparison_table,
                retrieved_documents=reranked_docs,
            )
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # 6. Phase 9 & 10: Grounded Report Generation & Citation Validation
        report = report_generator.generate_report(
            req=req_scrubbed,
            fingerprint=fingerprint,
            retrieved_documents=reranked_docs,
            categorized_pointers=categorized_pointers,
            comparison_table=comparison_table,
            statutory_issues=statutory_issues,
            experimental_checklist=checklist,
            evidence_gaps=evidence_gaps,
            possible_distinguishing=possible_distinguishing,
            latency_ms=round(elapsed_ms, 2),
        )

        return report


patentability_orchestrator = PatentabilityOrchestrator()
