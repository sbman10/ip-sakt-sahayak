"""
backend/app/services/verdict_service.py
----------------------------------------
Grounded Patentability Verdict generator for the "Biopiracy Shield".

Given the retrieved statutory / TKDL context (produced by the SAME hybrid RAG
pipeline used by /api/chat), this service asks Gemini to return a STRUCTURED
JSON verdict (RED / YELLOW / GREEN) grounded strictly in that context.

Nothing is hard-coded: the verdict, reasoning, law basis, next steps and
compliance flags are all decided by the model from the retrieved evidence.
This module only builds the prompt, calls the model (with the existing
key-pool retry/fallback), and safely parses the JSON.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.core.gemini_pool import (
    ResourceExhaustedError,
    gemini_key_pool,
    execute_with_retry_and_fallback,
)

log = logging.getLogger("app.services.verdict_service")


# ---------------------------------------------------------------------------
# System prompt — instructs the model to reason ONLY from retrieved context
# and to return a strict JSON object. This is instruction, not a canned answer.
# ---------------------------------------------------------------------------
_VERDICT_SYSTEM_PROMPT = (
    "You are IP-SAKTI Sahayak's Patentability Verdict Engine for Ayurvedic / traditional "
    "knowledge innovations. Your job is to screen a user's formulation and decide whether it "
    "is likely patentable in the given jurisdiction, using ONLY the retrieved legal source "
    "passages provided.\n\n"
    "DECISION FRAMEWORK (apply strictly, and ONLY from the retrieved sources):\n"
    "- RED  (Likely NOT patentable): the formulation appears to be traditional knowledge, a "
    "known classical/Shastriya formulation, or a mere aggregation/duplication of known "
    "properties of traditionally-known components — barred (e.g. Section 3(p) of the Patents "
    "Act 1970), or already documented as prior art (e.g. TKDL).\n"
    "- YELLOW (Uncertain / Conditional): it MIGHT be patentable only if a genuine novelty / "
    "inventive step is shown (e.g. a new synergistic effect, a novel process or delivery "
    "system under Section 3(d)/3(e)), or more information is needed.\n"
    "- GREEN (Potentially patentable): the retrieved sources give no indication it is "
    "traditional knowledge or known prior art, and it plausibly shows novelty — but a formal "
    "search is still required.\n"
    "- UNKNOWN: the retrieved sources are insufficient to decide. Do NOT guess.\n\n"
    "HARD RULES:\n"
    "1. Ground EVERY statement in the retrieved passages. Never invent statutes, sections, or "
    "TKDL entries that are not present in the context.\n"
    "2. If the context does not support a confident decision, use UNKNOWN and say so.\n"
    "3. Also flag any regulatory obligations that the sources mention (e.g. NBA / ABS approval "
    "under the Biological Diversity Act 2002 for biological resources, AYUSH licensing).\n"
    "4. Output MUST be a single valid JSON object and nothing else — no markdown, no prose "
    "before or after.\n\n"
    "OUTPUT JSON SCHEMA (all keys required):\n"
    "{\n"
    '  "verdict": "RED" | "YELLOW" | "GREEN" | "UNKNOWN",\n'
    '  "verdict_label": "<short human label>",\n'
    '  "summary": "<one paragraph, plain language, why>",\n'
    '  "law_basis": ["<statute/section drawn ONLY from sources>", ...],\n'
    '  "next_steps": ["<concrete actionable step>", ...],\n'
    '  "compliance_flags": ["<other regulatory obligation from sources>", ...]\n'
    "}\n"
)


def _build_verdict_call(
    formulation: str,
    intended_use: str,
    context_str: str,
    jurisdiction: str = "India",
    api_key: str = "",
) -> str:
    """
    Synchronous grounded verdict LLM call. Executed via the key-pool
    retry/fallback wrapper (execute_with_retry_and_fallback).
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.PRIMARY_MODEL,
        google_api_key=api_key,
        temperature=0.1,          # low temp — deterministic, evidence-bound
        top_p=0.9,
        max_output_tokens=900,
    )

    jur_norm = (jurisdiction or "India").strip().lower()
    selected_jurisdiction = (
        "both" if jur_norm == "both"
        else "international" if "international" in jur_norm
        else "india"
    )

    user_content = (
        f"selected_jurisdiction: {selected_jurisdiction}\n\n"
        f"--- RETRIEVED LEGAL / TKDL CONTEXT ---\n"
        f"{context_str if context_str.strip() else '[No relevant passages retrieved]'}\n"
        f"--- END CONTEXT ---\n\n"
        f"FORMULATION TO SCREEN:\n{formulation}\n\n"
        f"INTENDED USE / CLAIMED NOVELTY:\n{intended_use.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON verdict object as specified. Ground every field in the "
        f"retrieved context above."
    )

    messages = [
        SystemMessage(content=_VERDICT_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    try:
        response = llm.invoke(messages)
        content = response.content
        if isinstance(content, list):
            content = "".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in content
            )
        return content or ""
    except Exception as e:
        err_msg = str(e).lower()
        if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
            gemini_key_pool.mark_key_failed(api_key, status_code=429)
        elif "500" in err_msg or "503" in err_msg:
            gemini_key_pool.mark_key_failed(api_key, status_code=500)
        raise


def _safe_parse_verdict_json(raw: str) -> Dict[str, Any]:
    """
    Robustly extract the JSON object from the model output.

    Models sometimes wrap JSON in ```json fences or add stray text. We strip
    fences and grab the outermost {...} block. On any failure we return a safe
    UNKNOWN structure rather than raising — the router turns that into a calm
    'insufficient evidence' verdict.
    """
    if not raw or not raw.strip():
        return {}

    text = raw.strip()

    # Strip ```json ... ``` or ``` ... ``` fences if present.
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()

    # Grab the outermost brace block.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError as e:
        log.warning("Verdict JSON parse failed: %s | raw head: %s", e, raw[:200])

    return {}


async def generate_verdict(
    formulation: str,
    intended_use: str,
    context_str: str,
    jurisdiction: str = "India",
) -> Dict[str, Any]:
    """
    Produce a structured, grounded verdict dict from the retrieved context.

    Returns a normalized dict with keys:
      verdict, verdict_label, summary, law_basis, next_steps, compliance_flags
    Always returns a usable dict (never raises); on any model/parse failure it
    degrades to an UNKNOWN verdict so the caller can respond calmly.
    """
    _VALID = {"RED", "YELLOW", "GREEN", "UNKNOWN"}

    jur_norm = (jurisdiction or "India").strip().lower()
    selected_jurisdiction = (
        "both" if jur_norm == "both"
        else "international" if "international" in jur_norm
        else "india"
    )

    user_content = (
        f"selected_jurisdiction: {selected_jurisdiction}\n\n"
        f"--- RETRIEVED LEGAL / TKDL CONTEXT ---\n"
        f"{context_str if context_str.strip() else '[No relevant passages retrieved]'}\n"
        f"--- END CONTEXT ---\n\n"
        f"FORMULATION TO SCREEN:\n{formulation}\n\n"
        f"INTENDED USE / CLAIMED NOVELTY:\n{intended_use.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON verdict object as specified. Ground every field in the "
        f"retrieved context above."
    )

    try:
        from app.services.llm_providers import llm_orchestrator
        resp = await llm_orchestrator.generate_answer(
            system_prompt=_VERDICT_SYSTEM_PROMPT,
            user_prompt=user_content,
            max_output_tokens=900,
            temperature=0.1,
            raise_on_failure=True,
        )
        raw = resp.text
    except Exception as e:
        log.warning("llm_orchestrator verdict call failed or fallback needed: %s", e)
        try:
            raw = await execute_with_retry_and_fallback(
                _build_verdict_call,
                formulation=formulation,
                intended_use=intended_use,
                context_str=context_str,
                jurisdiction=jurisdiction,
            )
        except ResourceExhaustedError:
            log.error("All LLM keys exhausted during verdict generation.")
            return _unknown_verdict(
                "The screening service is temporarily rate-limited. Please try again shortly."
            )
        except Exception as e2:
            log.error("Verdict generation failed: %s", e2, exc_info=True)
            return _unknown_verdict(
                "The screening engine could not be reached right now. Please try again."
            )

    data = _safe_parse_verdict_json(raw)
    if not data:
        return _unknown_verdict(
            "I could not derive a confident verdict from the available legal sources for this "
            "formulation. Please rephrase, add detail on the intended novelty, or consult a "
            "registered patent agent."
        )

    # Normalize + validate fields (defensive; never trust model output blindly).
    verdict = str(data.get("verdict", "UNKNOWN")).strip().upper()
    if verdict not in _VALID:
        verdict = "UNKNOWN"

    def _as_list(v: Any) -> list[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str) and v.strip():
            return [v.strip()]
        return []

    label = str(data.get("verdict_label", "")).strip() or _default_label(verdict)
    summary = str(data.get("summary", "")).strip() or label

    return {
        "verdict": verdict,
        "verdict_label": label,
        "summary": summary,
        "law_basis": _as_list(data.get("law_basis")),
        "next_steps": _as_list(data.get("next_steps")),
        "compliance_flags": _as_list(data.get("compliance_flags")),
    }


def _default_label(verdict: str) -> str:
    return {
        "RED": "Likely Not Patentable",
        "YELLOW": "Uncertain / Conditional",
        "GREEN": "Potentially Patentable",
        "UNKNOWN": "Insufficient Evidence",
    }.get(verdict, "Insufficient Evidence")


def _unknown_verdict(summary: str) -> Dict[str, Any]:
    return {
        "verdict": "UNKNOWN",
        "verdict_label": "Insufficient Evidence",
        "summary": summary,
        "law_basis": [],
        "next_steps": [
            "Add more detail about your formulation and its claimed novelty, then screen again.",
            "Consult a registered patent agent for a formal prior-art search.",
        ],
        "compliance_flags": [],
    }
