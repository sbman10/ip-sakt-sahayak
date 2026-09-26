"""
backend/app/services/patentability/search_strategy.py
-----------------------------------------------------
Phase 5: Prior-Art Search Strategy.
Generates 9 controlled search representations without unrestricted LLM hallucinations.
Executes filtered hybrid retrieval and categorizes candidate references into:
A. Earlier relevant prior art (strictly before priority date)
B. Traditional knowledge / classical formulations
C. Later related publications (published after priority date — never treated as anticipation)
D. Non-patent technical literature
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.patentability import (
    DateCategory,
    InventionFingerprint,
    PatentabilityAssessmentRequest,
    PriorArtPointer,
)
from app.services.patentability.vector_store import unified_vector_store

log = logging.getLogger("app.services.patentability.search_strategy")

# Controlled Botanical Synonym Map (no unrestricted LLM drift)
BOTANICAL_SYNONYM_DICT = {
    "ashwagandha": ["Withania somnifera", "Indian Ginseng", "Asgandh"],
    "turmeric": ["Curcuma longa", "Haridra", "Curcumin"],
    "neem": ["Azadirachta indica", "Nimba"],
    "tulsi": ["Ocimum sanctum", "Ocimum tenuiflorum", "Holy Basil"],
    "ginger": ["Zingiber officinale", "Sunthi", "Adrak"],
    "black pepper": ["Piper nigrum", "Maricha", "Piperine"],
    "shatavari": ["Asparagus racemosus"],
    "guggulu": ["Commiphora mukul", "Commiphora wightii"],
    "brahmi": ["Bacopa monnieri"],
    "amla": ["Emblica officinalis", "Phyllanthus emblica"],
}


class PriorArtSearchStrategy:
    """
    Executes multi-angle controlled retrieval across 9 defined query angles,
    fuses candidate pools, and sorts results into strict temporal and authority categories.
    """

    def generate_controlled_queries(
        self,
        req: PatentabilityAssessmentRequest,
        fingerprint: InventionFingerprint,
    ) -> Dict[str, str]:
        """Builds the 9 controlled query representations without HyDE or unrestricted expansion."""
        queries: Dict[str, str] = {}

        # 1. Original formulation query
        queries["original_formulation"] = f"{req.title}. {req.ingredients or ''} {req.dosage_form or ''}".strip()

        # 2. Ingredient-only query
        queries["ingredient_only"] = ", ".join(fingerprint.active_ingredients) if fingerprint.active_ingredients else req.title

        # 3. Botanical-name query
        queries["botanical_name"] = ", ".join(fingerprint.botanical_names) if fingerprint.botanical_names else (req.botanical_names or req.title)

        # 4. Technical-effect query
        queries["technical_effect"] = req.pharmacological_or_technical_effect or (req.problem_statement or "therapeutic technical effect")

        # 5. Dosage-form query
        dosage_matrix = f"{req.dosage_form or ''} {req.carrier_or_polymer_matrix or ''}".strip()
        queries["dosage_form"] = dosage_matrix if dosage_matrix else "formulation delivery system"

        # 6. Process query
        proc_str = f"{req.preparation_process or ''} {req.extraction_solvent or ''} {req.extraction_temperature or ''}".strip()
        queries["process"] = proc_str if proc_str else "extraction and formulation method"

        # 7. Traditional-knowledge query
        tk_names = fingerprint.botanical_names + fingerprint.active_ingredients
        queries["traditional_knowledge"] = f"traditional knowledge classical formulation Samhita {' '.join(tk_names)}".strip()

        # 8. Patent-claim-style query
        actives = " and ".join(fingerprint.active_ingredients[:3]) if fingerprint.active_ingredients else req.title
        queries["patent_claim_style"] = f"A formulation comprising {actives} in a {req.dosage_form or 'carrier'} for {req.intended_use or 'treatment'}"

        # 9. Synonym-expanded query (using strictly controlled dictionary)
        expanded: List[str] = []
        for term in (fingerprint.active_ingredients + fingerprint.botanical_names):
            t_low = term.lower()
            for k, syns in BOTANICAL_SYNONYM_DICT.items():
                if k in t_low or any(s.lower() in t_low for s in syns):
                    expanded.extend(syns)
                    break
        queries["synonym_expanded"] = " ".join(list(set(expanded))) if expanded else queries["original_formulation"]

        return queries

    def categorize_date(
        self,
        doc_pub_date_str: Optional[str],
        relevant_date_str: Optional[str],
        doc_type: str,
    ) -> DateCategory:
        """
        Classifies document temporally relative to priority/invention date.
        If publication date is after priority date -> LATER_PUBLICATION.
        """
        if doc_type in ["traditional_knowledge", "classical_text"]:
            return DateCategory.TRADITIONAL_KNOWLEDGE

        if not doc_pub_date_str or not relevant_date_str:
            # If dates are missing, classify conservatively
            if doc_type == "scientific_article":
                return DateCategory.NON_PATENT_LITERATURE
            return DateCategory.EARLIER_PRIOR_ART

        try:
            # Parse YYYY-MM-DD or YYYY
            p_date = self._parse_date(doc_pub_date_str)
            r_date = self._parse_date(relevant_date_str)

            if p_date and r_date:
                if p_date > r_date:
                    return DateCategory.LATER_PUBLICATION
                if doc_type == "scientific_article":
                    return DateCategory.NON_PATENT_LITERATURE
                return DateCategory.EARLIER_PRIOR_ART
        except Exception as e:
            log.debug("Date parsing fallback: %s", e)

        return DateCategory.EARLIER_PRIOR_ART

    def _parse_date(self, d_str: str) -> Optional[datetime]:
        clean = d_str.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y"):
            try:
                return datetime.strptime(clean[:10], fmt)
            except ValueError:
                continue
        return None

    def execute_search(
        self,
        req: PatentabilityAssessmentRequest,
        fingerprint: InventionFingerprint,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, List[PriorArtPointer]]]:
        """
        Runs the multi-query hybrid retrieval strategy, fuses documents, and categorizes them.
        """
        queries = self.generate_controlled_queries(req, fingerprint)
        fused_pool: Dict[str, Dict[str, Any]] = {}

        # Search across key angles
        search_angles = [
            ("original_formulation", 8),
            ("botanical_name", 6),
            ("dosage_form", 5),
            ("traditional_knowledge", 6),
            ("patent_claim_style", 5),
        ]

        for angle_name, k in search_angles:
            q_text = queries.get(angle_name, "")
            if not q_text:
                continue
            candidates = unified_vector_store.hybrid_rrf_search(
                query=q_text,
                jurisdiction=req.jurisdiction,
                top_k=k,
            )
            for c in candidates:
                cid = c["chunk_id"]
                if cid not in fused_pool:
                    fused_pool[cid] = c
                else:
                    # Accumulate score
                    fused_pool[cid]["rrf_score"] = fused_pool[cid].get("rrf_score", 0.0) + c.get("rrf_score", 0.0)

        raw_candidates = list(fused_pool.values())
        raw_candidates.sort(key=lambda x: x.get("rrf_score", 0.0), reverse=True)

        # CrossEncoder rerank top 10 against original formulation query
        reranked = unified_vector_store.rerank_candidates(
            query=queries["original_formulation"],
            candidates=raw_candidates[:10],
            final_k=6,
        )

        categorized_pointers: Dict[str, List[PriorArtPointer]] = {
            "earlier_prior_art": [],
            "traditional_knowledge": [],
            "later_publications": [],
            "non_patent_literature": [],
        }

        # Build PriorArtPointer records
        doc_count = 1
        for doc in reranked:
            source_id = f"SRC-{doc_count:03d}"
            doc_count += 1
            doc["source_id"] = source_id

            date_cat = self.categorize_date(
                doc_pub_date_str=doc.get("publication_date"),
                relevant_date_str=fingerprint.relevant_date,
                doc_type=doc.get("document_type", "patent"),
            )
            doc["date_category"] = date_cat

            # Matching & missing feature analysis
            doc_text_low = doc.get("text", "").lower()
            matching: List[str] = []
            missing: List[str] = []

            for feat in fingerprint.features:
                val_terms = [v.strip().lower() for v in re.split(r"[,;+&]| ", feat.feature_value) if len(v.strip()) > 3]
                if any(vt in doc_text_low for vt in val_terms):
                    matching.append(f"[{feat.feature_id}] {feat.feature_name}")
                else:
                    missing.append(f"[{feat.feature_id}] {feat.feature_name}")

            pointer = PriorArtPointer(
                source_id=source_id,
                document_id=doc.get("document_id", source_id),
                title=doc.get("title", "Prior Art Document"),
                publication_date=doc.get("publication_date"),
                priority_date=doc.get("priority_date"),
                authority=doc.get("authority", "Patent Office"),
                document_type=doc.get("document_type", "patent"),
                jurisdiction=doc.get("jurisdiction", "India"),
                relevant_section_or_page=doc.get("section") or f"Page {doc.get('page', '1')}",
                matching_features=matching[:4],
                missing_features=missing[:4],
                why_relevant=f"Discloses related {doc.get('section', 'subject matter')} under {doc.get('authority', 'authority')} jurisdiction.",
                source_link=doc.get("source_url"),
                date_category=date_cat,
            )

            if date_cat == DateCategory.EARLIER_PRIOR_ART:
                categorized_pointers["earlier_prior_art"].append(pointer)
            elif date_cat == DateCategory.TRADITIONAL_KNOWLEDGE:
                categorized_pointers["traditional_knowledge"].append(pointer)
            elif date_cat == DateCategory.LATER_PUBLICATION:
                categorized_pointers["later_publications"].append(pointer)
            else:
                categorized_pointers["non_patent_literature"].append(pointer)

        return reranked, categorized_pointers


prior_art_search_strategy = PriorArtSearchStrategy()
