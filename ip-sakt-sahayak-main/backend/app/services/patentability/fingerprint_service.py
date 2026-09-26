"""
backend/app/services/patentability/fingerprint_service.py
---------------------------------------------------------
Phase 2 & 3: Formulation Extraction & Invention Feature Modeling.
Extracts discrete technical features into an immutable feature set (F001, F002...),
detects ambiguities without silent merging, tracks field completeness, and preserves
the user's verbatim input.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.patentability import (
    FeatureCategory,
    FieldStatus,
    InventionFeature,
    InventionFingerprint,
    PatentabilityAssessmentRequest,
)

log = logging.getLogger("app.services.patentability.fingerprint_service")

# Common Ayurvedic / Botanical synonym pairs to check for ambiguity without silent merging
SYNONYM_PAIRS = [
    ({"ashwagandha", "asgandh", "withania somnifera", "indian ginseng"}, "Ashwagandha (Withania somnifera)"),
    ({"turmeric", "haldi", "haridra", "curcuma longa", "curcumin"}, "Turmeric (Curcuma longa)"),
    ({"neem", "nimba", "azadirachta indica"}, "Neem (Azadirachta indica)"),
    ({"tulsi", "holy basil", "ocimum sanctum", "ocimum tenuiflorum"}, "Tulsi (Ocimum sanctum)"),
    ({"ginger", "adrak", "sunthi", "zingiber officinale"}, "Ginger (Zingiber officinale)"),
    ({"black pepper", "kali mirch", "maricha", "piper nigrum", "piperine"}, "Black pepper (Piper nigrum / Piperine)"),
    ({"shatavari", "asparagus racemosus"}, "Shatavari (Asparagus racemosus)"),
    ({"guggulu", "guggul", "commiphora mukul", "commiphora wightii"}, "Guggul (Commiphora mukul)"),
    ({"brahmi", "bacopa monnieri"}, "Brahmi (Bacopa monnieri)"),
    ({"triphala", "amla", "haritaki", "bibhitaki", "emblica officinalis", "terminalia chebula", "terminalia bellirica"}, "Triphala constituent"),
]


class FingerprintService:
    """
    Extracts and normalizes invention technical features while preserving verbatim wording.
    Never replaces user wording with interpretations.
    """

    def extract_fingerprint(self, req: PatentabilityAssessmentRequest) -> InventionFingerprint:
        features: List[InventionFeature] = []
        user_wording: Dict[str, str] = {}
        field_statuses: Dict[str, FieldStatus] = {}
        ambiguities: List[str] = []

        counter = 1

        def next_id() -> str:
            nonlocal counter
            fid = f"F{counter:03d}"
            counter += 1
            return fid

        # Helper to register a feature
        def add_feature(
            cat: FeatureCategory,
            name: str,
            val: Optional[str],
            source_field: str,
            is_req: bool = True,
            is_important: bool = True,
        ) -> Optional[str]:
            if not val or not val.strip():
                field_statuses[source_field] = FieldStatus.MISSING
                return None

            raw_val = val.strip()
            user_wording[source_field] = raw_val
            field_statuses[source_field] = FieldStatus.SUPPLIED

            fid = next_id()
            features.append(
                InventionFeature(
                    feature_id=fid,
                    category=cat,
                    feature_name=name,
                    feature_value=raw_val,
                    source_text=raw_val,
                    confidence=1.0,
                    whether_user_confirmed=True,
                    whether_technically_important=is_important,
                    whether_required_for_assessment=is_req,
                )
            )
            return fid

        # 1. Composition / Active Ingredients
        active_list: List[str] = []
        if req.ingredients:
            add_feature(FeatureCategory.COMPOSITION, "Active Ingredients", req.ingredients, "ingredients")
            active_list = [p.strip() for p in re.split(r"[,;+&]|\band\b", req.ingredients) if p.strip()]
        else:
            field_statuses["ingredients"] = FieldStatus.MISSING

        # 2. Botanical Identity
        botanical_list: List[str] = []
        if req.botanical_names:
            add_feature(FeatureCategory.INGREDIENT_IDENTITY, "Botanical Identity", req.botanical_names, "botanical_names")
            botanical_list = [p.strip() for p in re.split(r"[,;+&]|\band\b", req.botanical_names) if p.strip()]
        else:
            field_statuses["botanical_names"] = FieldStatus.MISSING

        # Check for ambiguity between ingredients and botanical names (do NOT silently merge)
        all_terms = [t.lower() for t in (active_list + botanical_list)]
        for synonyms, canonical in SYNONYM_PAIRS:
            matched = [t for t in all_terms if any(s in t for s in synonyms)]
            if len(matched) > 1:
                ambiguities.append(
                    f"Ambiguity detected: Multiple terms ({', '.join(matched)}) may refer to the same botanical entity '{canonical}'. Please verify whether these are distinct components or synonymously used."
                )

        # 3. Ingredient Amounts & Ratios
        ratios_list: List[str] = []
        if req.ingredient_amounts:
            add_feature(FeatureCategory.CONCENTRATION, "Ingredient Amounts", req.ingredient_amounts, "ingredient_amounts")
            ratios_list.append(req.ingredient_amounts.strip())
        else:
            field_statuses["ingredient_amounts"] = FieldStatus.MISSING

        if req.ingredient_ranges:
            add_feature(FeatureCategory.INGREDIENT_RATIO, "Ingredient Ranges / Ratios", req.ingredient_ranges, "ingredient_ranges")
            ratios_list.append(req.ingredient_ranges.strip())
        else:
            field_statuses["ingredient_ranges"] = FieldStatus.MISSING

        # 4. Extract Type & Standardisation
        if req.extract_type:
            add_feature(FeatureCategory.EXTRACT_STANDARDISATION, "Extract Type", req.extract_type, "extract_type")
        else:
            field_statuses["extract_type"] = FieldStatus.MISSING

        if req.standardisation_details:
            add_feature(FeatureCategory.EXTRACT_STANDARDISATION, "Biomarker Standardisation", req.standardisation_details, "standardisation_details")
        else:
            field_statuses["standardisation_details"] = FieldStatus.MISSING

        # 5. Excipients & Delivery Matrix
        if req.excipients:
            add_feature(FeatureCategory.EXCIPIENT, "Excipients", req.excipients, "excipients")
        else:
            field_statuses["excipients"] = FieldStatus.MISSING

        if req.carrier_or_polymer_matrix:
            add_feature(FeatureCategory.POLYMER_MATRIX, "Carrier / Polymer Matrix", req.carrier_or_polymer_matrix, "carrier_or_polymer_matrix")
        else:
            field_statuses["carrier_or_polymer_matrix"] = FieldStatus.MISSING

        if req.dosage_form:
            add_feature(FeatureCategory.DOSAGE_FORM, "Dosage Form", req.dosage_form, "dosage_form")
        else:
            field_statuses["dosage_form"] = FieldStatus.MISSING

        # 6. Preparation Process & Parameters
        process_steps: List[str] = []
        process_params: Dict[str, str] = {}

        if req.preparation_process:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Preparation Process", req.preparation_process, "preparation_process")
            process_steps = [s.strip() for s in req.preparation_process.split("\n") if s.strip()]
        else:
            field_statuses["preparation_process"] = FieldStatus.MISSING

        if req.extraction_solvent:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Extraction Solvent", req.extraction_solvent, "extraction_solvent")
            process_params["solvent"] = req.extraction_solvent.strip()
        else:
            field_statuses["extraction_solvent"] = FieldStatus.MISSING

        if req.extraction_temperature:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Extraction Temperature", req.extraction_temperature, "extraction_temperature")
            process_params["temperature"] = req.extraction_temperature.strip()
        else:
            field_statuses["extraction_temperature"] = FieldStatus.MISSING

        if req.extraction_duration:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Extraction Duration", req.extraction_duration, "extraction_duration")
            process_params["duration"] = req.extraction_duration.strip()
        else:
            field_statuses["extraction_duration"] = FieldStatus.MISSING

        if req.mixing_order:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Mixing Order", req.mixing_order, "mixing_order")
            process_params["mixing_order"] = req.mixing_order.strip()

        if req.pH:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Formulation pH", req.pH, "pH")
            process_params["pH"] = req.pH.strip()

        if req.curing_or_gelation_conditions:
            add_feature(FeatureCategory.PREPARATION_PROCESS, "Curing / Gelation Conditions", req.curing_or_gelation_conditions, "curing_or_gelation_conditions")
            process_params["curing"] = req.curing_or_gelation_conditions.strip()

        # 7. Release & Retention Properties
        if req.release_profile:
            add_feature(FeatureCategory.RELEASE_PROFILE, "Release Profile", req.release_profile, "release_profile")
        else:
            field_statuses["release_profile"] = FieldStatus.MISSING

        if req.retention_or_adhesion_data:
            add_feature(FeatureCategory.RETENTION_PROPERTY, "Retention / Adhesion Data", req.retention_or_adhesion_data, "retention_or_adhesion_data")

        # 8. Technical Effects & Bioavailability
        technical_effects: List[str] = []
        if req.pharmacological_or_technical_effect:
            add_feature(FeatureCategory.THERAPEUTIC_EFFECT, "Technical / Pharmacological Effect", req.pharmacological_or_technical_effect, "pharmacological_or_technical_effect")
            technical_effects.append(req.pharmacological_or_technical_effect.strip())
        else:
            field_statuses["pharmacological_or_technical_effect"] = FieldStatus.MISSING

        if req.bioavailability_data:
            add_feature(FeatureCategory.THERAPEUTIC_EFFECT, "Bioavailability Data", req.bioavailability_data, "bioavailability_data")
            technical_effects.append(f"Bioavailability: {req.bioavailability_data.strip()}")

        # 9. Intended Use & Indication
        if req.intended_use:
            add_feature(FeatureCategory.INTENDED_USE, "Intended Medical or Industrial Use", req.intended_use, "intended_use")
        else:
            field_statuses["intended_use"] = FieldStatus.MISSING

        # 10. Biological Resource Information (NBA Section 6)
        if req.biological_resource_source:
            add_feature(FeatureCategory.BIOLOGICAL_RESOURCE, "Biological Resource Source", req.biological_resource_source, "biological_resource_source")
        else:
            field_statuses["biological_resource_source"] = FieldStatus.MISSING

        if req.geographic_source:
            add_feature(FeatureCategory.BIOLOGICAL_RESOURCE, "Geographic Origin", req.geographic_source, "geographic_source")
        else:
            field_statuses["geographic_source"] = FieldStatus.MISSING

        if req.cultivation_or_wild_source:
            add_feature(FeatureCategory.BIOLOGICAL_RESOURCE, "Wild vs Cultivated Status", req.cultivation_or_wild_source, "cultivation_or_wild_source")

        # 11. Date Verification
        relevant_date = req.priority_date or req.earliest_invention_date
        is_date_missing = False
        if not relevant_date:
            is_date_missing = True
            field_statuses["priority_date"] = FieldStatus.MISSING
            field_statuses["earliest_invention_date"] = FieldStatus.MISSING
            ambiguities.append(
                "Critical Missing Date: Neither priority date nor earliest invention date is supplied. "
                "Time-based prior-art filtering cannot definitively establish earlier vs. later publications. "
                "The assessment is marked as incomplete on temporal prior-art classification."
            )
        else:
            field_statuses["priority_date"] = FieldStatus.SUPPLIED

        return InventionFingerprint(
            title=req.title.strip(),
            features=features,
            active_ingredients=active_list,
            botanical_names=botanical_list,
            ingredient_ratios=ratios_list,
            dosage_form=req.dosage_form.strip() if req.dosage_form else None,
            delivery_system=req.carrier_or_polymer_matrix.strip() if req.carrier_or_polymer_matrix else None,
            process_steps=process_steps,
            process_parameters=process_params,
            technical_effects=technical_effects,
            intended_use=req.intended_use.strip() if req.intended_use else None,
            jurisdiction=req.jurisdiction or "India",
            relevant_date=relevant_date,
            is_date_missing=is_date_missing,
            field_statuses=field_statuses,
            ambiguities=ambiguities,
            user_original_wording=user_wording,
        )


fingerprint_service = FingerprintService()
