"""
backend/app/services/prompt_builder.py
--------------------------------------
Prompt construction service for IP-SAKTI Sahayak enforcing strict statutory grounding,
citation attribution, anti-hallucination rules, and jurisdiction awareness.
"""

from __future__ import annotations

from typing import Optional


class PromptBuilder:
    """
    Constructs system and user prompts for Google Gemini grounded legal reasoning.
    """

    SYSTEM_PROMPT = (
        "You are IP-SAKTI Sahayak, an authoritative, expert AI legal assistant specializing in "
        "Ayurvedic and Indian Intellectual Property Law, Traditional Knowledge protection (TKDL), "
        "the Patents Act 1970, the Biological Diversity Act 2002, the Drugs & Cosmetics Act 1940, "
        "and international treaties (Nagoya Protocol, TRIPS, WIPO).\n\n"
        "CORE OPERATIONAL RULES:\n"
        "1. STRICT GROUNDING: Answer the question using ONLY the factual legal information in the "
        "retrieved source passages provided below. Do NOT hallucinate sections, rules, or case law.\n"
        "2. STATUTORY CITATION: Explicitly cite the exact legal acts, sections, rules, or treaty articles "
        "mentioned in the source passages (e.g. 'Under Section 3(p) of the Patents Act, 1970...').\n"
        "3. AYUSH DOMAIN ACCURACY: Distinguish accurately between:\n"
        "   - Classical / Shastriya formulations (TKDL barred under Section 3(p))\n"
        "   - Novel modified formulations / synergistic combinations (Section 3(d) / Section 3(e))\n"
        "   - Biological Diversity Act approval requirements (Section 6 NBA approval before patent grant)\n"
        "4. ABSTENTION RULE: If the retrieved sources do not contain adequate legal grounds to answer "
        "authoritatively, state clearly: 'I cannot find an authoritative statutory ground in the legal registers to safely answer this question.'\n"
        "5. STRUCTURE & TONE: Maintain a professional, objective, advisory tone with clear headings, "
        "statutory analysis, and practical compliance guidance."
    )

    @classmethod
    def build_user_prompt(
        cls,
        question: str,
        context: str,
        jurisdiction: str = "India",
        language: str = "EN",
        answer_mode: str = "standard",
    ) -> str:
        """
        Builds the grounded user prompt with retrieved context passages and formatting constraints.
        """
        depth_instruction = {
            "brief": "Provide a concise, direct statutory summary (2-3 paragraphs max) highlighting key rules and sections.",
            "standard": "Provide a comprehensive, well-structured legal explanation with applicable sections, compliance requirements, and practical advice.",
            "detailed": "Provide an exhaustive legal analysis including detailed statutory breakdown, relevant exemptions/exceptions, filing requirements, and procedural steps.",
        }.get(answer_mode.lower(), "Provide a comprehensive, well-structured legal explanation.")

        language_instruction = (
            f"Respond in {language.upper()} language." if language.upper() != "EN" else "Respond in English."
        )

        prompt = (
            f"JURISDICTION: {jurisdiction}\n"
            f"ANSWER DEPTH: {answer_mode.upper()} ({depth_instruction})\n"
            f"LANGUAGE: {language_instruction}\n\n"
            f"--- RETRIEVED LEGAL CONTEXT ---\n"
            f"{context if context.strip() else '[No relevant statutory passages retrieved]'}\n"
            f"--- END CONTEXT ---\n\n"
            f"USER QUESTION:\n{question}\n\n"
            f"Please provide your citation-grounded statutory answer following the operational rules:"
        )

        return prompt


# Global singleton instance
prompt_builder = PromptBuilder()
