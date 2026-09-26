"""
backend/app/services/patentability/comparison_engine.py
-------------------------------------------------------
Phase 6: Feature-by-Feature Prior-Art Comparison Engine.
Performs granular technical comparison between each user invention feature (F001, F002...)
and retrieved prior-art documents.
Strict Rule: Never marks a feature as 'present' without a verified supporting excerpt.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from app.schemas.patentability import (
    DateCategory,
    FeatureComparisonItem,
    InventionFeature,
    InventionFingerprint,
)

log = logging.getLogger("app.services.patentability.comparison_engine")


class ComparisonEngine:
    """
    Generates an evidence-grounded feature comparison matrix across retrieved prior-art documents.
    """

    def build_comparison_matrix(
        self,
        fingerprint: InventionFingerprint,
        retrieved_documents: List[Dict[str, Any]],
    ) -> List[FeatureComparisonItem]:
        comparison_items: List[FeatureComparisonItem] = []

        if not retrieved_documents or not fingerprint.features:
            return comparison_items

        # Limit to top 3-4 most relevant documents to keep matrix actionable
        top_docs = retrieved_documents[:4]

        for feat in fingerprint.features:
            feat_val_clean = feat.feature_value.strip()
            keywords = [
                kw.lower()
                for kw in re.split(r"[,;+&]| ", feat_val_clean)
                if len(kw.strip()) > 3 and kw.lower() not in {"with", "from", "extract", "formulation", "based"}
            ]

            # Compare this feature across each top document
            for doc in top_docs:
                doc_text = doc.get("text", "")
                doc_text_lower = doc_text.lower()
                doc_id = doc.get("document_id", "DOC-UNKNOWN")
                src_id = doc.get("source_id", "SRC-001")
                date_cat = doc.get("date_category", DateCategory.EARLIER_PRIOR_ART)
                section_page = doc.get("section") or f"Page {doc.get('page', '1')}"

                # Match analysis
                matched_keywords = [kw for kw in keywords if kw in doc_text_lower]
                match_ratio = (len(matched_keywords) / len(keywords)) if keywords else 0.0

                feature_present = False
                feature_absent = False
                feature_uncertain = False
                supporting_excerpt: Optional[str] = None
                explanation = ""
                assessment_label = ""
                reviewer_required = False

                if match_ratio >= 0.7:
                    # Find exact excerpt snippet
                    snippet = self._extract_snippet(doc_text, matched_keywords[0])
                    if snippet:
                        feature_present = True
                        supporting_excerpt = snippet
                        assessment_label = "Known individually"
                        explanation = f"Disclosed in {doc.get('title')} ({section_page}): '{snippet}'."
                    else:
                        feature_uncertain = True
                        assessment_label = "Requires closer comparison"
                        explanation = "Keywords present in document text but contextual disclosure is ambiguous."
                        reviewer_required = True
                elif match_ratio > 0.0:
                    snippet = self._extract_snippet(doc_text, matched_keywords[0])
                    feature_uncertain = True
                    supporting_excerpt = snippet
                    assessment_label = "Requires closer comparison"
                    explanation = f"Partial keyword overlap ({', '.join(matched_keywords)}) identified; full combination not clearly disclosed."
                    reviewer_required = True
                else:
                    # Feature not identified in this document
                    feature_absent = True
                    supporting_excerpt = None
                    assessment_label = "Potentially distinguishing"
                    explanation = f"Not identified in {src_id}. Requires experimental confirmation that this feature confers a non-obvious technical effect."

                # Special checks for ratio, sustained release, and bioavailability
                if "ratio" in feat.feature_name.lower() or "range" in feat.feature_name.lower():
                    if feature_present:
                        assessment_label = "Known range"
                    else:
                        assessment_label = "Potentially distinguishing"
                        explanation = "Specific user-defined concentration or ratio range was not found in retrieved document."

                elif "release" in feat.feature_name.lower() or "matrix" in feat.feature_name.lower():
                    if feature_present:
                        assessment_label = "Similar release disclosed"
                        reviewer_required = True
                    else:
                        assessment_label = "Technical evidence required"

                elif "bioavailability" in feat.feature_name.lower() or "effect" in feat.feature_name.lower():
                    assessment_label = "Experimental proof required"
                    explanation = "Performance/efficacy claim requires comparative clinical or in-vitro assay data to establish non-obvious technical advance."
                    reviewer_required = True

                comparison_items.append(
                    FeatureComparisonItem(
                        document_id=doc_id,
                        source_id=src_id,
                        feature_id=feat.feature_id,
                        feature_name=feat.feature_name,
                        user_formulation_value=feat.feature_value,
                        feature_present=feature_present,
                        feature_absent=feature_absent,
                        feature_uncertain=feature_uncertain,
                        supporting_excerpt=supporting_excerpt,
                        page_or_section=section_page,
                        similarity_score=round(match_ratio, 2),
                        exact_match_score=1.0 if match_ratio == 1.0 else 0.0,
                        authority_score=1.0,
                        date_category=date_cat,
                        assessment_label=assessment_label,
                        explanation=explanation,
                        reviewer_required=reviewer_required,
                    )
                )

        return comparison_items

    def _extract_snippet(self, text: str, keyword: str, window: int = 150) -> Optional[str]:
        idx = text.lower().find(keyword.lower())
        if idx == -1:
            return None
        start = max(0, idx - 40)
        end = min(len(text), idx + window)
        snippet = text[start:end].strip()
        if start > 0:
            snippet = "..." + snippet
        if end < len(text):
            snippet = snippet + "..."
        return snippet


comparison_engine = ComparisonEngine()
