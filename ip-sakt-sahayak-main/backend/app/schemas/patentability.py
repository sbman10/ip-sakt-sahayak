"""
backend/app/schemas/patentability.py
------------------------------------
Pydantic v2 schemas for the Patentability and Prior-Art Assessment workflow.
Covers:
- Phase 1: Invention Intake fields and field statuses
- Phase 2 & 3: Invention Fingerprint and Feature sets
- Phase 4 & 5: Prior-Art metadata, pointers, and date categorisation
- Phase 6: Feature-by-feature comparison matrix
- Phase 7 & 8: Patentability issue analysis (Sec 3(p), 3(d), 3(e), NBA) and experimental checklist
- Phase 9 & 10: Final 9-section report and citation mappings
"""

from __future__ import annotations

import re
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums and Result Categories
# ---------------------------------------------------------------------------

class AssessmentStatus(str, Enum):
    RECEIVED = "received"
    EXTRACTING = "extracting"
    SEARCHING = "searching"
    COMPARING = "comparing"
    GENERATING = "generating"
    VALIDATING = "validating"
    COMPLETED = "completed"
    INSUFFICIENT_INFORMATION = "insufficient_information"
    FAILED = "failed"


class FieldStatus(str, Enum):
    SUPPLIED = "supplied"
    MISSING = "missing"
    UNCERTAIN = "uncertain"
    CONTRADICTORY = "contradictory"


class ResultCategory(str, Enum):
    POTENTIALLY_DISTINGUISHABLE = "Potentially distinguishable based on supplied information"
    SIGNIFICANT_OVERLAP = "Significant prior-art overlap identified"
    EVIDENCE_INSUFFICIENT = "Evidence insufficient for reliable assessment"
    PROFESSIONAL_REVIEW_REQUIRED = "Professional patent review required"


class DateCategory(str, Enum):
    EARLIER_PRIOR_ART = "Earlier relevant prior art"
    TRADITIONAL_KNOWLEDGE = "Traditional knowledge or classical formulation"
    LATER_PUBLICATION = "Later related publication (not earlier prior art)"
    NON_PATENT_LITERATURE = "Non-patent technical literature"


class FeatureCategory(str, Enum):
    COMPOSITION = "composition"
    INGREDIENT_IDENTITY = "ingredient_identity"
    INGREDIENT_RATIO = "ingredient_ratio"
    CONCENTRATION = "concentration"
    EXTRACT_STANDARDISATION = "extract_standardisation"
    EXCIPIENT = "excipient"
    POLYMER_MATRIX = "polymer_matrix"
    DOSAGE_FORM = "dosage_form"
    PREPARATION_PROCESS = "preparation_process"
    RELEASE_PROFILE = "release_profile"
    RETENTION_PROPERTY = "retention_property"
    THERAPEUTIC_EFFECT = "therapeutic_or_technical_effect"
    INTENDED_USE = "intended_use"
    BIOLOGICAL_RESOURCE = "biological_resource_information"


# ---------------------------------------------------------------------------
# Phase 1: Invention Intake Models
# ---------------------------------------------------------------------------

class UploadedDocReference(BaseModel):
    """Reference to an uploaded supporting document or lab report."""
    document_id: str
    filename: str
    file_type: str = "pdf"  # pdf, docx, txt
    doc_category: str = "experimental_report"  # formulation_notes, experimental_report, patent_doc, lab_results, prior_art
    description: Optional[str] = None
    checksum: Optional[str] = None


class PatentabilityAssessmentRequest(BaseModel):
    """
    Structured patentability intake request supporting all 30 user input fields.
    Does not require every field initially, but marks incomplete fields.
    """
    # Identification
    title: str = Field(..., description="Title of the invention or formulation")
    problem_statement: Optional[str] = Field(None, description="Technical problem or unmet clinical need being addressed")

    # Composition & Botanical Identity
    ingredients: Optional[str] = Field(None, description="Common or trade names of active ingredients")
    botanical_names: Optional[str] = Field(None, description="Exact Latin binominals / botanical names (e.g. Withania somnifera)")
    ingredient_amounts: Optional[str] = Field(None, description="Amounts (e.g., 500mg, 10g)")
    ingredient_ranges: Optional[str] = Field(None, description="Percentage or ratio ranges (e.g. 15-25% w/w)")
    extract_type: Optional[str] = Field(None, description="Aqueous, hydroalcoholic, ethanolic, CO2 supercritical extract")
    standardisation_details: Optional[str] = Field(None, description="Biomarker standardisation (e.g. Withanolides >= 5%, Curcuminoids >= 95%)")

    # Formulation Matrix & Excipients
    excipients: Optional[str] = Field(None, description="Carriers, surfactants, binders, preservatives")
    carrier_or_polymer_matrix: Optional[str] = Field(None, description="Specific delivery matrix (e.g. MCC, sodium alginate, PLGA)")
    dosage_form: Optional[str] = Field(None, description="Nanoparticles, tablet, liposome, topical gel, syrup")

    # Process & Parameters
    preparation_process: Optional[str] = Field(None, description="Step-by-step manufacturing or synthesis process")
    extraction_solvent: Optional[str] = Field(None, description="Solvent used in extraction")
    extraction_temperature: Optional[str] = Field(None, description="Extraction temperature range (°C)")
    extraction_duration: Optional[str] = Field(None, description="Time duration for extraction")
    mixing_order: Optional[str] = Field(None, description="Sequential addition order of components")
    pH: Optional[str] = Field(None, description="Formulation or reaction pH")
    curing_or_gelation_conditions: Optional[str] = Field(None, description="Crosslinking or curing conditions (temp, duration, crosslinker)")

    # Properties, Data & Claims
    release_profile: Optional[str] = Field(None, description="In-vitro dissolution or release kinetics (e.g. 8-hour sustained release)")
    retention_or_adhesion_data: Optional[str] = Field(None, description="Mucoadhesive strength, skin retention, residence time")
    bioavailability_data: Optional[str] = Field(None, description="Pharmacokinetic data, AUC, Cmax, fold increase claims")
    pharmacological_or_technical_effect: Optional[str] = Field(None, description="Claimed technical effect or synergistic action")
    intended_use: Optional[str] = Field(None, description="Therapeutic indication, cosmetic or industrial application")

    # Jurisdiction & Relevant Dates
    jurisdiction: str = Field(default="India", description="Target jurisdiction (India, International, Both)")
    earliest_invention_date: Optional[str] = Field(None, description="Earliest lab notebook or invention date (YYYY-MM-DD)")
    priority_date: Optional[str] = Field(None, description="Earliest provisional or priority application date (YYYY-MM-DD)")
    first_public_disclosure_date: Optional[str] = Field(None, description="Any prior publication, conference presentation, or clinical trial registry (YYYY-MM-DD)")
    public_disclosure_details: Optional[str] = Field(None, description="Details of any prior public disclosure")

    # Biological Resources & Origin (NBA / Biodiversity Act Compliance)
    biological_resource_source: Optional[str] = Field(None, description="Biological resource utilized (plant, microbe, animal)")
    geographic_source: Optional[str] = Field(None, description="Geographical location where biological resource was obtained (State/District, India or foreign)")
    cultivation_or_wild_source: Optional[str] = Field(None, description="Whether sourced from wild harvest or cultivated plantation")

    # Uploaded Supporting Documents
    uploaded_supporting_documents: List[UploadedDocReference] = Field(default_factory=list, description="Supporting notes, lab results, or patent PDFs")

    # Matter linkage
    matter_id: Optional[str] = Field(None, description="Optional IP matter workspace UUID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 3:
            raise ValueError("Invention title must be at least 3 characters long.")
        return s


# ---------------------------------------------------------------------------
# Phase 2 & 3: Feature Model & Fingerprint
# ---------------------------------------------------------------------------

class InventionFeature(BaseModel):
    """Discrete technical feature extracted from the user formulation."""
    feature_id: str = Field(..., description="Stable feature ID, e.g. F001")
    category: FeatureCategory
    feature_name: str
    feature_value: str
    source_text: str = Field(..., description="Exact user wording from which this feature was extracted")
    confidence: float = 1.0
    whether_user_confirmed: bool = True
    whether_technically_important: bool = True
    whether_required_for_assessment: bool = True


class InventionFingerprint(BaseModel):
    """Structured architectural fingerprint of the user invention."""
    title: str
    features: List[InventionFeature] = Field(default_factory=list)
    active_ingredients: List[str] = Field(default_factory=list)
    botanical_names: List[str] = Field(default_factory=list)
    ingredient_ratios: List[str] = Field(default_factory=list)
    dosage_form: Optional[str] = None
    delivery_system: Optional[str] = None
    process_steps: List[str] = Field(default_factory=list)
    process_parameters: Dict[str, str] = Field(default_factory=dict)
    technical_effects: List[str] = Field(default_factory=list)
    intended_use: Optional[str] = None
    jurisdiction: str = "India"
    relevant_date: Optional[str] = None
    is_date_missing: bool = False
    
    # Track data quality
    field_statuses: Dict[str, FieldStatus] = Field(default_factory=dict)
    ambiguities: List[str] = Field(default_factory=list)
    user_original_wording: Dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Phase 4 & 5: Prior-Art Metadata & Pointers
# ---------------------------------------------------------------------------

class PriorArtMetadata(BaseModel):
    """Comprehensive chunk/document metadata conforming to Phase 4 requirements."""
    chunk_id: str
    document_id: str
    title: str
    document_type: str  # statute, rule, patent, traditional_knowledge, scientific_article, user_upload
    publication_date: Optional[str] = None
    priority_date: Optional[str] = None
    filing_date: Optional[str] = None
    authority: str = "Indian Patent Office"
    jurisdiction: str = "India"
    source_url: Optional[str] = None
    page: Optional[Union[int, str]] = None
    section: Optional[str] = None
    paragraph: Optional[str] = None
    language: str = "en"
    document_version: str = "1.0"
    source_access_type: str = "public_statute"  # public_statute, open_access, tkdl_reference, user_upload
    full_text_available: bool = True
    indexed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    checksum: Optional[str] = None


class PriorArtPointer(BaseModel):
    """Identified prior-art document pointer."""
    source_id: str = Field(..., description="Unique reference ID, e.g. SRC-001 or P1")
    document_id: str
    title: str
    publication_date: Optional[str] = None
    priority_date: Optional[str] = None
    authority: str
    document_type: str
    jurisdiction: str
    relevant_section_or_page: str
    matching_features: List[str] = Field(default_factory=list)
    missing_features: List[str] = Field(default_factory=list)
    why_relevant: str
    source_link: Optional[str] = None
    date_category: DateCategory = DateCategory.EARLIER_PRIOR_ART


# ---------------------------------------------------------------------------
# Phase 6: Feature-by-Feature Comparison Matrix
# ---------------------------------------------------------------------------

class FeatureComparisonItem(BaseModel):
    """Detailed comparison between a single invention feature and a prior-art source."""
    document_id: str
    source_id: str
    feature_id: str
    feature_name: str
    user_formulation_value: str
    feature_present: bool = False
    feature_absent: bool = False
    feature_uncertain: bool = False
    supporting_excerpt: Optional[str] = None
    page_or_section: Optional[str] = None
    similarity_score: float = 0.0
    exact_match_score: float = 0.0
    authority_score: float = 1.0
    date_category: DateCategory = DateCategory.EARLIER_PRIOR_ART
    assessment_label: str = "Requires closer comparison"  # Known individually, Potentially distinguishing, Technical evidence required
    explanation: str
    reviewer_required: bool = False


# ---------------------------------------------------------------------------
# Phase 7 & 8: Statutory Issue Analysis & Experimental Evidence Checklist
# ---------------------------------------------------------------------------

class StatutoryIssueItem(BaseModel):
    """Analysis for an individual patentability statutory criteria."""
    topic: str  # Novelty, Inventive Step, Mere Admixture Sec 3(e), Traditional Knowledge Sec 3(p), etc.
    statutory_basis: str  # Section 3(p), Section 3(e), Section 3(d), Section 6 BD Act
    evidence_found: str
    interpretation: str
    missing_information: str
    professional_review_required: bool = True
    risk_level: str = "MODERATE"  # LOW, MODERATE, HIGH, CRITICAL


class ExperimentalChecklistItem(BaseModel):
    """Experimental proof requirement for technical effects."""
    category: str
    requirement: str
    status: str  # verified, missing, user_reported_unverified
    comparator_needed: Optional[str] = None
    recommended_test_method: Optional[str] = None
    importance: str = "HIGH"  # CRITICAL, HIGH, RECOMMENDED


# ---------------------------------------------------------------------------
# Phase 9: Final Report & API Responses
# ---------------------------------------------------------------------------

class BibliographyEntry(BaseModel):
    source_id: str
    title: str
    authority: str
    jurisdiction: str
    document_type: str
    publication_date: Optional[str] = None
    source_link: Optional[str] = None


class PatentabilityReport(BaseModel):
    """
    Standardized Phase 9 preliminary patentability report.
    Never produces a legally final 'patentable' or 'not patentable' decision.
    """
    assessment_id: str
    status: AssessmentStatus
    result_category: ResultCategory
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    jurisdiction: str
    relevant_date: Optional[str] = None
    is_time_assessment_incomplete: bool = False

    # Mandatory Legal Limitation
    limitation_notice: str = (
        "This is an automated preliminary assessment based only on the indexed sources "
        "and information supplied by the user. It is not a legal opinion, patentability "
        "certificate or substitute for review by a registered patent agent or qualified professional."
    )

    # 1. Invention Understood Summary
    invention_summary: Dict[str, Any]

    # 2. Feature Map
    feature_map: List[InventionFeature]

    # 3. Prior-Art Pointers
    prior_art_pointers: List[PriorArtPointer]

    # 4. Feature-by-Feature Comparison Table
    feature_comparison_table: List[FeatureComparisonItem]

    # 5. Preliminary Observations (Statutory Issues)
    preliminary_observations: List[StatutoryIssueItem]

    # 6. Evidence Gaps
    evidence_gaps: List[str]

    # 7. Possible Distinguishing Features
    possible_distinguishing_features: List[Dict[str, str]]

    # 8. Recommended Next Steps
    recommended_next_steps: List[str]

    # 9. Bibliography
    bibliography: List[BibliographyEntry]

    # Raw Markdown report formatted per Phase 9
    markdown_report: str

    # Observability & Confidence
    confidence_score: int = 60
    latency_ms: float = 0.0
    field_warnings: List[str] = Field(default_factory=list)


class AssessmentSummaryItem(BaseModel):
    """Brief summary item for listing past assessments."""
    id: str
    title: str
    created_at: str
    status: str
    result_category: str
    jurisdiction: str
