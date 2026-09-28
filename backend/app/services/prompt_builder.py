"""
backend/app/services/prompt_builder.py
--------------------------------------
Production Master Prompt Construction Service for IP-SAKTI Sahayak.
Enforces statutory grounding, citation attribution, anti-hallucination rules,
intent-specific prompt modes, uninvented defaults, and strict jurisdiction awareness.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Union


class PromptBuilder:
    """
    Constructs system and user prompts for Google Gemini grounded legal reasoning
    following the production Master RAG Prompt architecture.
    """

    SYSTEM_PROMPT = """SYSTEM PROMPT — IP-SAKTI CONTEXT-AWARE LEGAL & TRADITIONAL KNOWLEDGE RAG ASSISTANT

You are IP-SAKTI, an authoritative statutory research and intellectual-property guidance system specializing in Indian and international patent law, the Patents Act 1970, the Biological Diversity Act 2002, Traditional Knowledge (TK), TKDL prior art, and Access and Benefit Sharing (ABS).

Your task is to answer the user's query using ONLY the retrieved authoritative evidence supplied below and any explicitly provided user context.

CORE OPERATIONAL PRINCIPLES:

1. EVIDENCE-ONLY GROUNDING (ZERO HALLUCINATION):
- You must generate answers using ONLY the retrieved evidence passages provided in the prompt.
- NEVER invent sections, sub-sections, rules, patent numbers, case citations, court judgments, dates, authorities, or URLs.
- NEVER treat general model training knowledge as a cited statutory fact. If a fact or legal rule is not present in the retrieved sources, say:
  "The available sources do not establish this."
- Clearly distinguish between:
  (a) verbatim or direct statutory text,
  (b) explanation of that text,
  (c) reasonable inference from the text, and
  (d) uncertainty or evidence gaps.

2. CITATION ATTRIBUTION:
- Every material legal or factual claim MUST have an inline citation pointing to its source ID, e.g. [SRC-001] or [SRC-001, Section 3(p)].
- You may cite ONLY existing SOURCE_ID tags provided in the RETRIEVED KNOWLEDGE section.
- Never fabricate citations or cite non-existent source IDs.

3. INTENT-SPECIFIC MODES:
- For factual legal questions:
  * Provide a clear, comprehensive, and complete statutory explanation using structured points or paragraphs.
  * Mention all relevant provisions, requirements, and statutory authorities directly answering the query to full completion.
  * Cite each substantive claim with [SRC-XXX].
  * Never truncate sentences or leave bullet points half-finished.
- For patentability queries:
  * Separate preliminary assessment from legal conclusions.
  * Systematically analyze novelty, inventive step, and statutory subject-matter exclusions.
  * Never state that an invention is definitively "patentable" or "unpatentable" with certainty.
  * Always use cautious phrasing: "may have potential", "appears limited by prior art", or "requires professional assessment".
  * Identify evidence gaps and prior-art search requirements.

4. MANDATORY DISCLAIMER:
- Always include the brief notice that the response provides general statutory information for research purposes and does not constitute formal legal advice or a binding patent office opinion.
"""

    @classmethod
    def build_user_prompt(
        cls,
        question: str,
        context: str,
        jurisdiction: str = "India",
        language: str = "EN",
        answer_mode: str = "standard",
        user_context: Optional[dict] = None,
        product_context: Optional[dict] = None,
        user_intent: Optional[str] = None,
        requested_information: Optional[Union[list[str], str]] = None,
    ) -> str:
        """
        Builds the grounded master user prompt combining:
        1. User profile context (marking unprovided fields as 'Not provided')
        2. Jurisdiction context & routing instructions
        3. Product context (marking unprovided fields as 'Not provided')
        4. Intent-specific instructions (simple legal vs. patentability)
        5. Retrieved evidence passages with [SRC-XXX] formatting
        6. Operational task constraints
        """
        u_ctx = user_context or {}
        p_ctx = product_context or {}

        # ── 1. Depth & Language Directives ──────────────────────────
        depth_instruction = {
            "brief": "Provide a concise, direct statutory summary (3-5 sentences or short bullets) highlighting key provisions.",
            "standard": "Provide a comprehensive, well-structured legal explanation with applicable sections and clear citations.",
            "detailed": "Provide an exhaustive legal analysis including detailed statutory breakdown, relevant exceptions, and procedural requirements.",
        }.get(answer_mode.lower(), "Provide a comprehensive, well-structured legal explanation.")

        lang_code = (language or "en").strip().lower()
        if lang_code not in ("en", "hi", "mr"):
            lang_code = "en"

        if lang_code == "hi":
            language_instruction = (
                "RESPONSE LANGUAGE DIRECTIVE: HINDI (हिन्दी)\n"
                "- Write the entire explanation, headings, bullet points, disclaimers, and uncertainty notices in natural, fluent Hindi using the Devanagari script (देवनागरी लिपि).\n"
                "- CRITICAL CITATION & STATUTORY PRESERVATION RULE:\n"
                "  * DO NOT translate official statute titles (e.g., 'Patents Act 1970', 'Biological Diversity Act 2002', 'TKDL', 'Drugs and Cosmetics Rules').\n"
                "  * DO NOT alter, translate, or invent statutory section numbers, rule numbers, or form names (e.g., 'Section 3(p)', 'Section 2(1)(j)', 'Section 3(d)', 'Rule 158-B', 'Form 1', 'Form 18').\n"
                "  * Keep all source citation IDs EXACTLY intact in square brackets, e.g. [SRC-001] or [SRC-001, Section 3(p)]. NEVER translate or alter citation IDs.\n"
                "  * Explain the legal reasoning and implications clearly in Hindi, but keep all official statutory names and section citations traceable.\n"
                "  * Clearly distinguish between verbatim source text and your explanation.\n"
                "  * Do not claim the underlying statute itself is published in Hindi if quoting English statutory text.\n"
                "- HINDI DISCLAIMER:\n"
                "  * Conclude with the legal disclaimer in Hindi: 'यह जानकारी केवल अनुसंधान और सूचनात्मक उद्देश्यों के लिए है और इसे औपचारिक कानूनी सलाह नहीं माना जाना चाहिए। आधिकारिक कार्यवाही के लिए कृपया किसी पंजीकृत पेटेंट एजेंट या वकील से परामर्श लें।'"
            )
        elif lang_code == "mr":
            language_instruction = (
                "RESPONSE LANGUAGE DIRECTIVE: MARATHI (मराठी)\n"
                "- Write the entire explanation, headings, bullet points, disclaimers, and uncertainty notices in natural, fluent Marathi using the Devanagari script (देवनागरी लिपी).\n"
                "- CRITICAL CITATION & STATUTORY PRESERVATION RULE:\n"
                "  * DO NOT translate official statute titles (e.g., 'Patents Act 1970', 'Biological Diversity Act 2002', 'TKDL', 'Drugs and Cosmetics Rules').\n"
                "  * DO NOT alter, translate, or invent statutory section numbers, rule numbers, or form names (e.g., 'Section 3(p)', 'Section 2(1)(j)', 'Section 3(d)', 'Rule 158-B', 'Form 1', 'Form 18').\n"
                "  * Keep all source citation IDs EXACTLY intact in square brackets, e.g. [SRC-001] or [SRC-001, Section 3(p)]. NEVER translate or alter citation IDs.\n"
                "  * Explain the legal reasoning and implications clearly in Marathi, but keep all official statutory names and section citations traceable.\n"
                "  * Clearly distinguish between verbatim source text and your explanation.\n"
                "  * Do not claim the underlying statute itself is published in Marathi if quoting English statutory text.\n"
                "- MARATHI DISCLAIMER:\n"
                "  * Conclude with the legal disclaimer in Marathi: 'ही माहिती केवळ संशोधन आणि माहितीच्या उद्देशाने आहे आणि याला अधिकृत कायदेशीर सल्ला मानले जाऊ नये. अधिकृत प्रक्रियेसाठी कृपया नोंदणीकृत पेटेंट एजंट किंवा वकिलाचा सल्ला घ्यावा.'"
            )
        else:
            language_instruction = (
                "RESPONSE LANGUAGE DIRECTIVE: ENGLISH\n"
                "- Respond in clear, authoritative, professional legal English.\n"
                "- Cite every material statutory claim with exact source identifiers [SRC-XXX].\n"
                "- Conclude with a brief disclaimer that this is general statutory information and not legal advice."
            )

        # ── 2. Jurisdiction Processing ──────────────────────────────
        jur_norm = (jurisdiction or "India").strip().lower()
        selected_jurisdiction = (
            "both" if jur_norm == "both"
            else "international" if "international" in jur_norm
            else "india"
        )
        jurisdiction_instruction = (
            f"Selected jurisdiction: {selected_jurisdiction.upper()}\n"
            "Ground every claim in the retrieved sources relevant to this jurisdiction. "
            "Do not generalize rules across jurisdictions without statutory support."
        )

        # ── 3. User Profile Context (No Invented Defaults) ──────────
        user_type = u_ctx.get("user_type") or "Not provided"
        user_expertise = u_ctx.get("user_expertise") or "Not provided"
        organization_type = u_ctx.get("organization_type") or "Not provided"
        user_country = u_ctx.get("user_country") or "India"
        user_region = u_ctx.get("user_region") or "Not provided"
        nationality_or_residency = u_ctx.get("nationality_or_residency") or "Not provided"
        user_role = u_ctx.get("user_role") or "Not provided"

        user_context_block = (
            "--- 1. USER CONTEXT ---\n"
            f"User type: {user_type}\n"
            f"Expertise level: {user_expertise}\n"
            f"Organization type: {organization_type}\n"
            f"Country / Region: {user_country} ({user_region})\n"
            f"Nationality / Residency: {nationality_or_residency}\n"
            f"User role: {user_role}\n"
        )

        # ── 4. Product Context (No Invented Defaults) ───────────────
        product_name = p_ctx.get("product_name") or "Not provided"
        product_description = p_ctx.get("product_description") or "Not provided"
        formulation_type = p_ctx.get("formulation_type") or "Not provided"
        ingredients = p_ctx.get("ingredients") or "Not provided"
        species = p_ctx.get("species") or "Not provided"
        scientific_names = p_ctx.get("scientific_names") or "Not provided"
        traditional_use = p_ctx.get("traditional_use") or "Not provided"
        resource_origin = p_ctx.get("resource_origin") or "Not provided"
        knowledge_holder = p_ctx.get("knowledge_holder") or "Not provided"
        knowledge_source = p_ctx.get("knowledge_source") or "Not provided"
        existing_formulation = p_ctx.get("existing_formulation") or "Not provided"
        novel_modification = p_ctx.get("novel_modification") or "Not provided"
        intended_use = p_ctx.get("intended_use") or "Not provided"
        commercial_status = p_ctx.get("commercial_status") or "Not provided"
        development_stage = p_ctx.get("development_stage") or "Not provided"

        product_context_block = (
            "--- 2. OBJECT / PRODUCT CONTEXT ---\n"
            f"Product name: {product_name}\n"
            f"Description: {product_description}\n"
            f"Formulation type: {formulation_type}\n"
            f"Ingredients / Biological resources: {ingredients}\n"
            f"Species / Scientific names: {species} ({scientific_names})\n"
            f"Traditional use: {traditional_use}\n"
            f"Geographical origin: {resource_origin}\n"
            f"Knowledge source / holder: {knowledge_source} ({knowledge_holder})\n"
            f"Existing formulation: {existing_formulation}\n"
            f"Claimed novel modification: {novel_modification}\n"
            f"Intended use: {intended_use}\n"
            f"Commercial status: {commercial_status}\n"
            f"Development stage: {development_stage}\n"
        )

        # ── 5. Intent Determination & Intent-Specific Directives ─────
        q_clean = question.strip()
        q_lower = q_clean.lower()

        is_patentability = any(k in q_lower for k in [
            "patentable", "patentability", "can i patent", "can we patent",
            "patent eligibility", "eligible for patent", "patent application",
            "grant a patent", "patent approval"
        ]) or (user_intent and "patentability" in user_intent.lower())

        if is_patentability:
            intent_directive = (
                "INTENT DIRECTIVE: PATENTABILITY ASSESSMENT\n"
                "- Separate preliminary assessment from formal legal conclusion.\n"
                "- Discuss novelty, inventive step, and statutory exclusions (e.g., Section 3(p), Section 3(e), Section 3(d)) ONLY as relevant.\n"
                "- Highlight evidence gaps and prior art uncertainties.\n"
                "- NEVER assert that an invention is 'patentable' with certainty. Use cautious phrasing such as:\n"
                "  'may have potential subject to prior-art verification', 'appears limited by statutory exclusions', or 'requires professional assessment'."
            )
        else:
            intent_directive = (
                "INTENT DIRECTIVE: FACTUAL STATUTORY QUERY\n"
                "- Provide a comprehensive, fully articulated, and well-structured answer.\n"
                "- Clearly articulate all relevant statutory requirements, provisions, procedures, and authorities to full completion.\n"
                "- Cite each key claim with [SRC-XXX].\n"
                "- Ensure every requirement or bullet point is fully written out and completed without cutting off mid-sentence."
            )

        # ── 6. Requested Information Block ──────────────────────────
        req_info_val = requested_information or ["Direct answer to user inquiry"]
        if isinstance(req_info_val, list):
            req_info_str = ", ".join(str(x) for x in req_info_val)
        else:
            req_info_str = str(req_info_val)

        requested_info_block = (
            "--- 3. USER QUERY & INTENT ---\n"
            f"Question: {q_clean}\n"
            f"Declared / inferred intent: {user_intent or ('Patentability inquiry' if is_patentability else 'Statutory research')}\n"
            f"Information requested: {req_info_str}\n"
            f"{intent_directive}\n"
        )

        # ── 7. Retrieved Evidence Block ─────────────────────────────
        retrieved_knowledge_block = (
            "--- 4. RETRIEVED STATUTORY EVIDENCE ---\n"
            f"{context.strip() if context.strip() else '[No relevant statutory passages retrieved]'}\n"
            "--- END RETRIEVED EVIDENCE ---\n"
        )

        # ── 8. Master Directive ─────────────────────────────────────
        directive_block = (
            f"--- 5. GENERATION CONSTRAINTS ---\n"
            f"Depth: {answer_mode.upper()} ({depth_instruction})\n"
            f"Language: {language_instruction}\n"
            f"{jurisdiction_instruction}\n\n"
            "REMINDERS:\n"
            "1. Use ONLY facts from the retrieved evidence. If facts are missing, say 'The available sources do not establish this.'\n"
            "2. Cite every material claim using [SRC-XXX] citing only existing source IDs.\n"
            "3. Ensure the response is complete from beginning to end; do not truncate, cut off, or leave sentences unfinished.\n"
            "4. Conclude with a brief disclaimer that this is general statutory information and not legal advice."
        )

        prompt = (
            f"{user_context_block}\n"
            f"{product_context_block}\n"
            f"{requested_info_block}\n"
            f"{retrieved_knowledge_block}\n"
            f"{directive_block}"
        )

        return prompt


# Global singleton instance
prompt_builder = PromptBuilder()
