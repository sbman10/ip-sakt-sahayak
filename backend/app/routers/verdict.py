"""
backend/app/routers/verdict.py
------------------------------
Patentability Verdict Engine ("Biopiracy Shield") endpoint.

POST /api/verdict takes a formulation and returns a grounded traffic-light
verdict (RED / YELLOW / GREEN / UNKNOWN) with statutory basis, next steps,
and evidence citations.

It REUSES the exact same RAG retrieval stack as /api/chat:
  PII scrub -> Hybrid RRF -> Retrieval Gate -> Conditional Rerank ->
  Context Compress -> grounded Verdict LLM (structured JSON).

Nothing is hard-coded — the verdict is decided by the model from the
retrieved corpus. This router only orchestrates + shapes the response.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.chat import CitationItem
from app.schemas.verdict import VerdictRequest, VerdictResponse

from app.services.pii_scrubber import pii_scrubber
from app.services.retrieval_router import retrieve
from app.services.retrieval_gate import evaluate_retrieval_quality
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.verdict_service import generate_verdict

log = logging.getLogger("app.routers.verdict")

router = APIRouter()


def _resolve_source_filters(jurisdiction: str) -> list[str]:
    jur = (jurisdiction or "India").strip().lower()
    if jur == "both":
        return ["india_statutes", "international_treaties"]
    if "international" in jur:
        return ["international_treaties"]
    return ["india_statutes"]


def _confidence_from_retrieval(best_distance: float, verdict: str, n_citations: int) -> int:
    """
    Derive a 0-100 confidence from real retrieval signals — NOT hard-coded.

    - Stronger vector match (lower distance) => higher confidence.
    - An UNKNOWN verdict is inherently low confidence regardless of distance.
    - No citations => cannot be confident.
    """
    if verdict == "UNKNOWN" or n_citations == 0:
        return max(0, min(30, int((1.0 - best_distance) * 40)))
    # best_distance is a cosine distance in [0, ~2]; clamp then invert to a
    # similarity-like 0..1, scale to 0..100.
    sim = max(0.0, min(1.0, 1.0 - float(best_distance)))
    score = int(round(sim * 100))
    return max(35, min(96, score))


@router.post(
    "/verdict",
    response_model=VerdictResponse,
    summary="Patentability Verdict Engine (Biopiracy Shield)",
    description=(
        "Screens an Ayurvedic formulation / herb combination and returns a grounded "
        "traffic-light patentability verdict (RED / YELLOW / GREEN) with statutory basis, "
        "TKDL/prior-art evidence citations, compliance flags, and concrete next steps. "
        "Uses the same hybrid RAG retrieval pipeline as /api/chat."
    ),
)
async def verdict_endpoint(request: VerdictRequest) -> VerdictResponse:
    start_time = time.perf_counter()

    formulation = request.formulation.strip()
    intended_use = (request.intended_use or "").strip()
    jurisdiction = request.jurisdiction or "India"
    source_filters = _resolve_source_filters(jurisdiction)

    # ── Stage 1: PII scrub (DPDP) ──────────────────────────────
    scrubbed = pii_scrubber.scrub_query(formulation)
    scrubbed_use = pii_scrubber.scrub_query(intended_use) if intended_use else ""

    # ── Stage 2: build a retrieval query that biases toward prior-art / TKDL /
    #    Section 3(p) evidence, from the user's own words (not hard-coded facts).
    retrieval_query = (
        f"Is the Ayurvedic formulation '{scrubbed}' "
        f"{('for ' + scrubbed_use + ' ') if scrubbed_use else ''}"
        f"patentable, or is it traditional knowledge / prior art under Section 3(p), "
        f"TKDL, or the Biological Diversity Act?"
    )

    # ── Stage 3: Hybrid RRF retrieval ──────────────────────────
    try:
        candidates = retrieve(
            query=retrieval_query,
            jurisdiction=jurisdiction,
            top_k=8,
        )
    except Exception as e:
        log.error("Verdict retrieval failed: %s", e, exc_info=True)
        candidates = []

    # ── Stage 4: Retrieval gate ────────────────────────────────
    gate_result = evaluate_retrieval_quality(
        candidates=candidates,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
    )
    best_distance = gate_result.get("best_distance", 1.0)

    if not gate_result["is_sufficient"]:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return VerdictResponse(
            verdict="UNKNOWN",
            verdict_label="Insufficient Evidence",
            summary=(
                "I could not find enough authoritative material in the knowledge base to "
                "screen this formulation reliably. This does not mean it is patentable or "
                "not — it means a formal prior-art search by a registered patent agent is "
                "needed. You can also add more detail about the formulation and its claimed "
                "novelty and screen again."
            ),
            law_basis=[],
            next_steps=[
                "Add detail on the exact ingredients, ratios, and what is claimed to be new.",
                "Consult a registered patent agent for a formal prior-art / novelty search.",
            ],
            compliance_flags=[],
            citations=[],
            confidence=_confidence_from_retrieval(best_distance, "UNKNOWN", 0),
            latency_ms=round(elapsed_ms, 2),
            status="no_data",
            jurisdiction=jurisdiction,
            source_filters=source_filters,
        )

    # ── Stage 5: Conditional rerank ────────────────────────────
    reranked_passages, _ = await conditional_rerank(
        query=retrieval_query,
        candidates=candidates,
        skip_threshold=settings.RERANK_SKIP_THRESHOLD,
        final_k=4,
    )

    # ── Stage 6: Context compression + citations ───────────────
    context_text, cleaned_chunks = context_compressor.build_prompt_context(
        chunks=reranked_passages,
        max_tokens=1500,
    )

    citations: list[CitationItem] = [
        CitationItem(
            source=chunk.get("source", "Legal Statute"),
            section=chunk.get("section", "General"),
            text=chunk.get("text", ""),
            relevance=f"Evidence from {chunk.get('source', 'source')} ({chunk.get('section', 'section')}).",
        )
        for chunk in cleaned_chunks
    ]

    # ── Stage 7: Grounded structured verdict (LLM) ─────────────
    verdict_data = await generate_verdict(
        formulation=scrubbed,
        intended_use=scrubbed_use,
        context_str=context_text,
        jurisdiction=jurisdiction,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    verdict = verdict_data["verdict"]
    confidence = _confidence_from_retrieval(best_distance, verdict, len(citations))
    status = "ok" if verdict != "UNKNOWN" else "no_data"

    return VerdictResponse(
        verdict=verdict,
        verdict_label=verdict_data["verdict_label"],
        summary=verdict_data["summary"],
        law_basis=verdict_data["law_basis"],
        next_steps=verdict_data["next_steps"],
        compliance_flags=verdict_data["compliance_flags"],
        citations=citations,
        confidence=confidence,
        latency_ms=round(elapsed_ms, 2),
        status=status,
        jurisdiction=jurisdiction,
        source_filters=source_filters,
    )
