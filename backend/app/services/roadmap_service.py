"""
backend/app/services/roadmap_service.py
----------------------------------------
Grounded IP Journey Roadmap generator.

Given the retrieved statutory context (from the SAME hybrid RAG pipeline used
by /api/chat), this service asks Gemini to return a STRUCTURED JSON roadmap:
an ordered set of journey stages (file -> publish -> RFE -> FER -> grant ->
renewals) plus pre-filing prerequisites, each grounded in the retrieved
statutory timelines.

NOTHING is hard-coded: the stages, timelines, statutory basis and actions are
all decided by the model from the retrieved evidence. This module only builds
the prompt, calls the model (with key-pool retry/fallback), and parses JSON.
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

log = logging.getLogger("app.services.roadmap_service")


_ROADMAP_SYSTEM_PROMPT = (
    "You are IP-SAKTI Sahayak's IP Journey Roadmap engine for Ayurvedic / traditional "
    "knowledge innovators. Your job is to lay out the innovator's personalized IP journey as "
    "an ordered timeline of stages, using ONLY the retrieved legal source passages provided.\n\n"
    "The journey typically covers pre-filing prerequisites (e.g. NBA / ABS approval under the "
    "Biological Diversity Act if biological resources are used; a novelty / prior-art check), "
    "then the patent lifecycle (filing, publication, request for examination (RFE), first "
    "examination report (FER) response, grant, and post-grant renewals).\n\n"
    "HARD RULES:\n"
    "1. Ground EVERY stage, timeline and statutory reference in the retrieved passages. Never "
    "invent statutory timelines, sections or steps that are not present in the context.\n"
    "2. If the retrieved context does not support a timeline for a stage, leave that stage's "
    "timeline empty rather than guessing a number.\n"
    "3. Personalize: reflect what the innovation is and where the user currently is.\n"
    "4. Output MUST be a single valid JSON object and nothing else — no markdown, no prose.\n\n"
    "OUTPUT JSON SCHEMA (all keys required):\n"
    "{\n"
    '  "overview": "<one paragraph plain-language overview>",\n'
    '  "prerequisites": ["<thing to do before filing>", ...],\n'
    '  "stages": [\n'
    "    {\n"
    '      "key": "<short key e.g. filing|publication|rfe|fer|grant|renewals>",\n'
    '      "title": "<stage name>",\n'
    '      "timeline": "<when, from sources; empty if unknown>",\n'
    '      "description": "<what happens, plain language>",\n'
    '      "law_basis": ["<statute/section from sources>", ...],\n'
    '      "action_items": ["<what the innovator must do>", ...],\n'
    '      "status": "required" | "conditional" | "optional" | "info"\n'
    "    }\n"
    "  ]\n"
    "}\n"
)


def _build_roadmap_call(
    innovation: str,
    stage: str,
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
        f"INNOVATION:\n{innovation}\n\n"
        f"CURRENT STAGE:\n{stage.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON roadmap object as specified. Ground every stage, timeline and "
        f"law reference in the retrieved context above."
    )

    messages = [
        SystemMessage(content=_ROADMAP_SYSTEM_PROMPT),
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
        log.warning("Roadmap JSON parse failed: %s | raw head: %s", e, raw[:200])
    return {}


def _as_list(v: Any) -> List[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


async def generate_roadmap(
    innovation: str,
    stage: str,
    context_str: str,
    jurisdiction: str = "India",
) -> Dict[str, Any]:
    """
    Produce a structured, grounded roadmap dict from the retrieved context.
    Always returns a usable dict; on any failure it degrades to an empty-stage
    roadmap with a calm overview so the caller can respond gracefully.
    """
    _VALID_STATUS = {"required", "conditional", "optional", "info"}

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
        f"INNOVATION:\n{innovation}\n\n"
        f"CURRENT STAGE:\n{stage.strip() or '[not provided]'}\n\n"
        f"Return ONLY the JSON roadmap object as specified. Ground every stage, timeline and "
        f"law reference in the retrieved context above."
    )

    try:
        from app.services.llm_providers import llm_orchestrator
        resp = await llm_orchestrator.generate_answer(
            system_prompt=_ROADMAP_SYSTEM_PROMPT,
            user_prompt=user_content,
            max_output_tokens=1600,
            temperature=0.15,
            raise_on_failure=True,
        )
        raw = resp.text
    except Exception as e:
        log.warning("llm_orchestrator roadmap call failed or fallback needed: %s", e)
        try:
            raw = await execute_with_retry_and_fallback(
                _build_roadmap_call,
                innovation=innovation,
                stage=stage,
                context_str=context_str,
                jurisdiction=jurisdiction,
            )
        except ResourceExhaustedError:
            log.error("All LLM keys exhausted during roadmap generation.")
            return _empty_roadmap(
                "The roadmap service is temporarily rate-limited. Please try again shortly."
            )
        except Exception as e2:
            log.error("Roadmap generation failed: %s", e2, exc_info=True)
            return _empty_roadmap(
                "The roadmap engine could not be reached right now. Please try again."
            )

    data = _safe_parse_json(raw)
    if not data:
        return _empty_roadmap(
            "I could not build a grounded roadmap from the available legal sources for this "
            "innovation. Please add more detail, or consult a registered patent agent."
        )

    stages_out: List[Dict[str, Any]] = []
    for st in (data.get("stages") or []):
        if not isinstance(st, dict):
            continue
        status = str(st.get("status", "info")).strip().lower()
        if status not in _VALID_STATUS:
            status = "info"
        title = str(st.get("title", "")).strip()
        description = str(st.get("description", "")).strip()
        if not title and not description:
            continue
        stages_out.append({
            "key": str(st.get("key", "")).strip(),
            "title": title or "Stage",
            "timeline": str(st.get("timeline", "")).strip(),
            "description": description or title,
            "law_basis": _as_list(st.get("law_basis")),
            "action_items": _as_list(st.get("action_items")),
            "status": status,
        })

    overview = str(data.get("overview", "")).strip()
    if not overview and not stages_out:
        return _empty_roadmap(
            "I could not build a grounded roadmap from the available legal sources. Please add "
            "more detail, or consult a registered patent agent."
        )

    return {
        "overview": overview or "Here is the IP journey based on the available legal sources.",
        "prerequisites": _as_list(data.get("prerequisites")),
        "stages": stages_out,
    }


def _empty_roadmap(overview: str) -> Dict[str, Any]:
    return {
        "overview": overview,
        "prerequisites": [
            "Add more detail about your innovation and its current stage, then try again.",
        ],
        "stages": [],
    }
