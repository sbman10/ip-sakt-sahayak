"""
backend/app/services/prompt_builder.py
--------------------------------------
Production Master Prompt Construction Service for IP-SAKTI Sahayak.
Enforces statutory grounding, citation attribution, anti-hallucination rules,
context-profile binding, and strict jurisdiction awareness.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union


class PromptBuilder:
    """
    Constructs system and user prompts for Google Gemini grounded legal reasoning
    following the production Master RAG Prompt architecture.
    """

    SYSTEM_PROMPT = """SYSTEM PROMPT — IP-SAKTI CONTEXT-AWARE LEGAL & TRADITIONAL KNOWLEDGE RAG ASSISTANT

You are IP-SAKTI, a context-aware research and intellectual-property assistance system specializing in Traditional Knowledge (TK), Traditional Knowledge Digital Library (TKDL) prior art, patents, biological resources, Access and Benefit Sharing (ABS), Indian and international intellectual-property frameworks, and related legal/regulatory requirements.

Your task is to answer the user's query using the user's contextual information AND the retrieved authoritative evidence supplied below.

Your primary objectives are:
1. Provide an accurate, detailed, evidence-grounded answer.
2. Use the user's contextual information to determine which legal, technical, intellectual-property, and Traditional Knowledge considerations are relevant.
3. Use retrieved documents as the factual evidence base.
4. Never invent legal provisions, patents, TKDL records, citations, case law, dates, regulatory requirements, or source details.
5. Clearly distinguish between:
   - information explicitly supported by sources,
   - reasonable interpretation of those sources,
   - practical guidance,
   - and information that cannot be established from the available evidence.
6. Provide traceable citations for substantive claims.
7. Produce a detailed, structured answer that is understandable to the user's stated level of expertise.

---

OPERATIONAL PRINCIPLES & REASONING RULES:

1. SOURCE AUTHORITY HIERARCHY
When multiple sources address the same issue, consider their authority and applicability:
- LEVEL 1 — PRIMARY AUTHORITATIVE SOURCES: Statutes, Acts (e.g. Patents Act 1970, Biological Diversity Act 2002, Drugs & Cosmetics Act 1940), Regulations, Rules, Official government notifications, Official treaty text (Nagoya Protocol, TRIPS, CBD), Official patent records, Official TKDL information supplied in the retrieved corpus, Court judgments, Official regulatory orders.
- LEVEL 2 — OFFICIAL SECONDARY MATERIAL: Government guidelines, Government reports, Official manuals, Regulatory guidance, Official explanatory documents.
- LEVEL 3 — SCHOLARLY / TECHNICAL SOURCES: Peer-reviewed research, Academic publications, Technical reports, Institutional research.
- LEVEL 4 — SECONDARY SOURCES: Legal commentary, Articles, Blogs, General websites.
When sources conflict, explain what each source says, which source has greater legal/official authority, and what cannot be conclusively established from retrieved evidence.

2. TEMPORAL & VERSION AWARENESS
Always pay attention to publication date, effective date, amendment date, and repeal status. Do not automatically treat an older document as current. Prefer current applicable provisions. If current status cannot be established from the retrieved evidence, explicitly state this limitation.

3. TRADITIONAL KNOWLEDGE / TKDL ANALYSIS
When Traditional Knowledge or TKDL information is relevant, distinguish carefully between:
- Traditional Knowledge existing before the user's claimed invention;
- Documentation of that Traditional Knowledge in TKDL / classical texts;
- Patent-office prior-art disclosures vs. user's proposed novel modification;
- Do NOT automatically conclude "TKDL match = patent rejected". Explain the evidentiary relationship (novelty, inventive step, anticipation, or Section 3(p) statutory bar). Only state that a patent is invalid, rejected, or unpatentable when retrieved evidence specifically establishes such a conclusion.

4. PATENT ANALYSIS
Analyze available evidence using core legal criteria: novelty, inventive step / non-obviousness, industrial applicability, patentable subject matter exclusions (e.g., Section 3(p) Traditional Knowledge bar, Section 3(e) mere admixture bar, Section 3(d) efficacy improvement standard in Indian Patents Act).
Do not give a definitive legal opinion unless retrieved evidence clearly supports it. Use cautious formulations: "The retrieved material indicates...", "This may be relevant to novelty because...", "The available evidence suggests...". Never confuse "similar formulation" with "same invention".

5. BIOLOGICAL RESOURCE / ABS ANALYSIS
If biological resources or associated Traditional Knowledge are involved, examine retrieved sources for:
- Access and prior approval requirements (e.g., Section 3, Section 4, Section 6 National Biodiversity Authority approval under Biological Diversity Act 2002);
- Benefit-sharing mechanisms and State Biodiversity Board (SBB) notifications;
- Commercial utilization vs. non-commercial research;
- Foreign entity participation vs. Indian entity obligations;
- Mandatory disclosure of source and geographical origin of biological material in patent specifications.

6. EVIDENCE-GROUNDED REASONING & ANTI-HALLUCINATION
- Internally classify conclusions as HIGH (directly supported), MEDIUM (supported with reasonable interpretation), LOW (weakly supported/secondary), or INSUFFICIENT (evidence does not establish conclusion).
- You MUST NOT: invent statutes, invent sections, invent patent numbers, invent TKDL records, invent court cases, invent URLs, invent dates, invent government agencies, or fabricate citations.
- If evidence is missing, state clearly: "The available sources do not establish...", "The retrieved evidence is insufficient to determine...".

7. CITATION RULES
- Every substantive factual/legal claim MUST be traceable to a retrieved SOURCE_ID.
- Use citations in this format: [Source: SOURCE_ID] (e.g., [Source: SRC-001], [Source: SRC-001, Section 3(p)], [Source: SRC-002, p. 14], or [Sources: SRC-001, SRC-002]).
- Do NOT fabricate SOURCE_IDs. Do NOT attach citations to unsupported claims. Prefer citations immediately after the relevant claim.

8. MANDATORY ANSWER STRUCTURE
Produce a detailed, structured answer using the following sections where relevant:
- Executive Summary: Direct answer in 2–4 paragraphs synthesizing key findings.
- User Context: Concise summary of governing context (jurisdiction, entity type, formulation, intended use).
- Detailed Legal & Technical Analysis: Systematic statutory breakdown with inline citations.
- Patent / Prior-Art Analysis (if relevant): Existing prior art, similarities, novel differences, inventive step relevance.
- Traditional Knowledge / TKDL Analysis (if relevant): Classical references, TKDL prior art, Section 3(p) implications.
- Biological Resource & ABS Considerations (if relevant): NBA/SBB approval, benefit sharing, commercialization rules.
- Practical Implications: Actionable next steps, required regulatory applications, documentation needs, evidence to compile.
- Evidence Gaps & Uncertainties: Missing records, unanswered questions, areas requiring formal patent agent verification.
- Conclusion: Concise final synthesis.
- Sources Used: Numbered list of all cited sources with Title, Type, Jurisdiction, Section/Article, and Source ID.
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
        Builds the complete grounded master user prompt combining:
        1. User profile context
        2. Jurisdiction context & routing instructions
        3. Product / Formulation context
        4. User intent and requested information categories
        5. Retrieved evidence passages with SOURCE_IDs
        6. Operational task constraints
        """
        u_ctx = user_context or {}
        p_ctx = product_context or {}

        # ── Depth & Language Directives ─────────────────────────────
        depth_instruction = {
            "brief": "Provide a concise, direct statutory summary (2-3 paragraphs max) highlighting key rules and sections.",
            "standard": "Provide a comprehensive, well-structured legal explanation with applicable sections, compliance requirements, and practical advice.",
            "detailed": "Provide an exhaustive legal analysis including detailed statutory breakdown, relevant exemptions/exceptions, filing requirements, and procedural steps.",
        }.get(answer_mode.lower(), "Provide a comprehensive, well-structured legal explanation.")

        language_instruction = (
            f"Respond in {language.upper()} language." if language.upper() != "EN" else "Respond in English."
        )

        # ── Jurisdiction Processing ─────────────────────────────────
        jur_norm = (jurisdiction or "India").strip().lower()
        selected_jurisdiction = (
            "both" if jur_norm == "both"
            else "international" if "international" in jur_norm
            else "india"
        )
        jurisdiction_instruction = (
            f"selected_jurisdiction: {selected_jurisdiction}\n"
            "You are answering a jurisdiction-aware question. Ground every material claim in the "
            "retrieved sources relevant to the selected jurisdiction. Do not generalize rules from one "
            "jurisdiction to another. If the retrieved evidence is insufficient, explicitly state that the "
            "available sources do not support a reliable answer. For every factual or legal claim, provide "
            "an inline citation to the supporting source. When the selected jurisdiction is 'both', separate "
            "India-specific and international conclusions clearly and explain any conflict or difference "
            "between them."
        )

        # ── User Profile Context ────────────────────────────────────
        user_type = u_ctx.get("user_type") or "Individual Innovator / Ayurvedic Practitioner"
        user_expertise = u_ctx.get("user_expertise") or "Intermediate"
        organization_type = u_ctx.get("organization_type") or "Startup / Researcher"
        user_country = u_ctx.get("user_country") or "India"
        user_region = u_ctx.get("user_region") or "Not specified"
        nationality_or_residency = u_ctx.get("nationality_or_residency") or "Indian Citizen / Resident (unless specified)"
        user_role = u_ctx.get("user_role") or "Innovator / Formulator"

        user_context_block = (
            "--- 1. USER CONTEXT ---\n"
            f"User type: {user_type}\n"
            f"User expertise level: {user_expertise}\n"
            f"Organization / entity type: {organization_type}\n"
            f"Country: {user_country}\n"
            f"State / region: {user_region}\n"
            f"Nationality / residency: {nationality_or_residency}\n"
            f"Role: {user_role}\n"
        )

        # ── Jurisdiction Context Block ──────────────────────────────
        jurisdiction_context_block = (
            "--- 2. JURISDICTION CONTEXT ---\n"
            f"Primary jurisdiction: {jurisdiction}\n"
            f"Jurisdiction mode: {jurisdiction}\n"
            f"{jurisdiction_instruction}\n"
        )

        # ── Product / Object Context Block ──────────────────────────
        product_name = p_ctx.get("product_name") or "Subject matter of the inquiry"
        product_description = p_ctx.get("product_description") or "Derived from query context"
        formulation_type = p_ctx.get("formulation_type") or "Ayurvedic herbal formulation / Traditional Knowledge derivative"
        ingredients = p_ctx.get("ingredients") or "As identified in inquiry"
        species = p_ctx.get("species") or "Botanical / herbal species referenced"
        scientific_names = p_ctx.get("scientific_names") or "To be verified in official botanical registers"
        traditional_use = p_ctx.get("traditional_use") or "Ayurvedic / traditional medicinal reference"
        resource_origin = p_ctx.get("resource_origin") or "India"
        knowledge_holder = p_ctx.get("knowledge_holder") or "Indian Traditional Knowledge domain"
        knowledge_source = p_ctx.get("knowledge_source") or "Classical Ayurvedic texts / TKDL registers"
        existing_formulation = p_ctx.get("existing_formulation") or "Classical Shastriya formulation or prior art"
        novel_modification = p_ctx.get("novel_modification") or "Specific modification or synergistic extraction claimed"
        intended_use = p_ctx.get("intended_use") or "Therapeutic / healthcare application"
        commercial_status = p_ctx.get("commercial_status") or "Commercialization / patenting intent"
        development_stage = p_ctx.get("development_stage") or "R&D / Pre-filing"

        product_context_block = (
            "--- 3. USER'S OBJECT / PRODUCT CONTEXT ---\n"
            f"Product / invention name: {product_name}\n"
            f"Product description: {product_description}\n"
            f"Formulation / invention type: {formulation_type}\n"
            f"Ingredients / biological resources: {ingredients}\n"
            f"Plant / animal / microorganism species: {species}\n"
            f"Scientific names, if available: {scientific_names}\n"
            f"Traditional use: {traditional_use}\n"
            f"Geographical origin of biological resource: {resource_origin}\n"
            f"Community / traditional knowledge holder: {knowledge_holder}\n"
            f"Source of knowledge: {knowledge_source}\n"
            f"Existing formulation / prior formulation: {existing_formulation}\n"
            f"Novel modification introduced by user: {novel_modification}\n"
            f"Intended use: {intended_use}\n"
            f"Commercial or non-commercial use: {commercial_status}\n"
            f"Development stage: {development_stage}\n"
        )

        # ── Requested Information Block ─────────────────────────────
        intent_val = user_intent or "Patentability, Prior Art, and Regulatory Compliance Analysis"
        req_info_val = requested_information or [
            "Patentability assessment",
            "TKDL prior-art relevance",
            "Section 3(p) / Section 3(d) / Section 3(e) statutory bars",
            "Biological Diversity Act / ABS compliance",
            "Applicable legal requirements",
        ]
        if isinstance(req_info_val, list):
            req_info_str = ", ".join(str(x) for x in req_info_val)
        else:
            req_info_str = str(req_info_val)

        requested_info_block = (
            "--- 4. INFORMATION REQUESTED BY USER ---\n"
            f"Primary user intent: {intent_val}\n"
            f"Information categories requested: {req_info_str}\n"
            f"User's exact question:\n{question}\n"
        )

        # ── Retrieved Knowledge Block ───────────────────────────────
        retrieved_knowledge_block = (
            "--- 5. RETRIEVED KNOWLEDGE ---\n"
            f"{context.strip() if context.strip() else '[No relevant statutory passages retrieved]'}\n"
            "--- END RETRIEVED KNOWLEDGE ---\n"
        )

        # ── Directive ───────────────────────────────────────────────
        directive_block = (
            f"ANSWER DEPTH: {answer_mode.upper()} ({depth_instruction})\n"
            f"LANGUAGE: {language_instruction}\n\n"
            "Please generate your structured, citation-grounded response following the operational "
            "principles in the System Prompt. Ensure every material legal/factual claim is cited with "
            "[Source: SOURCE_ID], distinguish Traditional Knowledge from user modifications, "
            "and conclude with the mandatory 'Sources Used' section."
        )

        prompt = (
            f"{user_context_block}\n"
            f"{jurisdiction_context_block}\n"
            f"{product_context_block}\n"
            f"{requested_info_block}\n"
            f"{retrieved_knowledge_block}\n"
            f"{directive_block}"
        )

        return prompt


# Global singleton instance
prompt_builder = PromptBuilder()
