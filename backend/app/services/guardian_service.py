"""
backend/app/services/guardian_service.py
-----------------------------------------
Grounded Dual-Use Guardian generator.

Given the retrieved statutory context (from the SAME hybrid RAG pipeline used
by /api/chat), this service asks Gemini to return a STRUCTURED JSON compliance
matrix spanning multiple regulatory / IP dimensions (Patent/IP, AYUSH
manufacturing license, Biodiversity/ABS, FSSAI/food), each grounded in the
retrieved statutes.

NOTHING is hard-coded: each dimension's applicability, obligation, law basis,
authority and next step is decided by the model from the retrieved evidence.
This module only builds the prompt, calls the model (with key-pool
retry/fallback), and parses JSON.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.core.gemini_pool import (
    ResourceExhaustedError,
    gemini_key_pool,
    execute_with_retry_and_fallback,
)

log = logging.getLogger("app.services.guardian_service")


_GUARDIAN_SYSTEM_PROMPT = (
    "You are IP-SAKTI Sahayak's Dual-Use Guardian for Ayurvedic / traditional knowledge "
    "products. An Ayurvedic product usually needs MORE than a patent — depending on how it is "
    "sold and what it contains, the innovator may also need an AYUSH manufacturing license, "
    "Biodiversity Act (NBA / ABS) approval for biological resources, and/or FSSAI registration "
    "if sold as a food/nutraceutical. Your job is to produce a holistic compliance matrix for "
    "the described product, using ONLY the retrieved legal source passages provided.\n\n"
    "For EACH relevant dimension, decide whether it applies, what the obligation is, which "
    "authority governs it, and the concrete next step — all grounded in the retrieved sources.\n\n"
    "HARD RULES:\n"
    "1. Ground EVERY obligation, statute reference and authority in the retrieved passages. "
    "Never invent statutes, sections, license names or authorities absent from the context.\n"
    "2. If the retrieved context does not support a dimension, mark its applicability 'unknown' "
    "and say the sources do not cover it — do NOT fabricate a requirement.\n"
    "3. Cover the dimensions the sources actually support (typically: Patent / IP; AYUSH "
    "Manufacturing License; Biodiversity / ABS; FSSAI / Food). Omit a dimension entirely only "
    "if it is clearly not applicable to the described product.\n"
    "4. Output MUST be a single valid JSON object and nothing else — no markdown, no prose.\n\n"
    "OUTPUT JSON SCHEMA (all keys required):\n"
    "{\n"
    '  "summary": "<one paragraph plain-language overall picture>",\n'
    '  "priority_actions": ["<most urgent cross-cutting action first>", ...],\n'
    '  "dimensions": [\n'
    "    {\n"
    '      "dimension": "<area e.g. Patent / IP | AYUSH Manufacturing License | Biodiversity / ABS | FSSAI / Food>",\n'
    '      "applicability": "required" | "likely" | "conditional" | "not_applicable" | "unknown",\n'
    '      "obligation": "<what must be done, plain language>",\n'
    '      "law_basis": ["<statute/section/rule from sources>", ...],\n'
    '      "authority": "<governing authority from sources>",\n'
    '      "next_step": "<concrete next action>"\n'
    "    }\n"
    "  ]\n"
    "}\n"
)


def _build_guardian_call(
    product: str,
    positioning: str,
    context_str: str,
    jurisdiction: str = "India",
    api_key: str = "",
) -> str:
    llm = ChatGoogleGenerativeAI(
        model=settings.PRIMARY_MODEL,
        google_api_key=api_key,
        temperature=0.15,
        top_p=0.9,
        max_output_tokens=1600,
    )

    jur_norm = (jurisdiction or "India").strip().lower()
    selected_jurisdiction = (
        "both" if jur_norm == "both"
        else "international" if "international" in jur_norm
        else "india"
    )

    user_content = (
        f"selected_jurisdiction: {selected_jurisdiction}\n\n"
        f"--- RETRIEVED LEGAL CONTEXT ---\n"
        f"{context_str if context_str.strip() else '[No relevant passages retrieved]'}\n"
        f"--- END CONTEXT ---\n\n"
        f"PRODUCT:\n{product}\n\n"
        f"POSITIONING / HOW SOLD:\n{positioning.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON compliance matrix object as specified. Ground every dimension, "
        f"obligation and law reference in the retrieved context above."
    )

    messages = [
        SystemMessage(content=_GUARDIAN_SYSTEM_PROMPT),
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


def _safe_parse_json(raw: str) -> Dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError as e:
        log.warning("Guardian JSON parse failed: %s | raw head: %s", e, raw[:200])
    return {}


def _as_list(v: Any) -> List[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


async def generate_guardian(
    product: str,
    positioning: str,
    context_str: str,
    jurisdiction: str = "India",
) -> Dict[str, Any]:
    """
    Produce a structured, grounded compliance matrix dict from the retrieved
    context. Always returns a usable dict; on any failure it degrades to an
    empty matrix with a calm summary.
    """
    _VALID_APPLIC = {"required", "likely", "conditional", "not_applicable", "unknown"}

    jur_norm = (jurisdiction or "India").strip().lower()
    selected_jurisdiction = (
        "both" if jur_norm == "both"
        else "international" if "international" in jur_norm
        else "india"
    )

    user_content = (
        f"selected_jurisdiction: {selected_jurisdiction}\n\n"
        f"--- RETRIEVED LEGAL / COMPLIANCE CONTEXT ---\n"
        f"{context_str if context_str.strip() else '[No relevant passages retrieved]'}\n"
        f"--- END CONTEXT ---\n\n"
        f"PRODUCT DESCRIPTION:\n{product}\n\n"
        f"POSITIONING / HOW IT IS SOLD:\n{positioning.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON compliance guardian object as specified. Ground every "
        f"obligation and reference in the retrieved context above."
    )

    try:
        from app.services.llm_providers import llm_orchestrator
        resp = await llm_orchestrator.generate_answer(
            system_prompt=_GUARDIAN_SYSTEM_PROMPT,
            user_prompt=user_content,
            max_output_tokens=2000,
            temperature=0.15,
            raise_on_failure=True,
        )
        raw = resp.text
    except Exception as e:
        log.warning("llm_orchestrator guardian call failed or fallback needed: %s", e)
        try:
            raw = await execute_with_retry_and_fallback(
                _build_guardian_call,
                product=product,
                positioning=positioning,
                context_str=context_str,
                jurisdiction=jurisdiction,
            )
        except ResourceExhaustedError:
            log.error("All LLM keys exhausted during guardian generation.")
            return _empty_matrix(
                "The compliance service is temporarily rate-limited. Please try again shortly."
            )
        except Exception as e2:
            log.error("Guardian generation failed: %s", e2, exc_info=True)
            return _empty_matrix(
                "The compliance engine could not be reached right now. Please try again."
            )

    data = _safe_parse_json(raw)
    if not data:
        return _empty_matrix(
            "I could not build a grounded compliance matrix from the available legal sources "
            "for this product. Please add more detail on how it is sold, or consult the "
            "relevant authority."
        )

    dims_out: List[Dict[str, Any]] = []
    for d in (data.get("dimensions") or []):
        if not isinstance(d, dict):
            continue
        applic = str(d.get("applicability", "unknown")).strip().lower()
        if applic not in _VALID_APPLIC:
            applic = "unknown"
        dimension = str(d.get("dimension", "")).strip()
        obligation = str(d.get("obligation", "")).strip()
        if not dimension and not obligation:
            continue
        dims_out.append({
            "dimension": dimension or "Compliance",
            "applicability": applic,
            "obligation": obligation or "See sources.",
            "law_basis": _as_list(d.get("law_basis")),
            "authority": str(d.get("authority", "")).strip(),
            "next_step": str(d.get("next_step", "")).strip(),
        })

    summary = str(data.get("summary", "")).strip()
    if not summary and not dims_out:
        return _empty_matrix(
            "I could not build a grounded compliance matrix from the available legal sources. "
            "Please add more detail, or consult the relevant authority."
        )

    return {
        "summary": summary or "Here is the compliance picture based on the available legal sources.",
        "priority_actions": _as_list(data.get("priority_actions")),
        "dimensions": dims_out,
    }


def _empty_matrix(summary: str) -> Dict[str, Any]:
    return {
        "summary": summary,
        "priority_actions": [
            "Add more detail on your product and how it is sold, then try again.",
        ],
        "dimensions": [],
    }
