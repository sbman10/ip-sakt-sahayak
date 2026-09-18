"""
backend/app/routers/roadmap.py
------------------------------
IP Journey Roadmap endpoint.

POST /api/roadmap takes an innovation + current stage and returns a grounded,
personalized IP journey timeline (prerequisites -> filing -> publication ->
RFE -> FER -> grant -> renewals) with per-stage statutory basis, timelines,
action items, and evidence citations.

It REUSES the exact same RAG retrieval stack as /api/chat:
  PII scrub -> Hybrid RRF -> Retrieval Gate -> Conditional Rerank ->
  Context Compress -> grounded Roadmap LLM (structured JSON).

Nothing is hard-coded — the timeline is decided by the model from the
retrieved corpus. This router only orchestrates + shapes the response.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.chat import CitationItem
from app.schemas.roadmap import RoadmapRequest, RoadmapResponse, RoadmapStage

from app.services.pii_scrubber import pii_scrubber
from app.services.retrieval_service import hybrid_rrf_search
from app.services.retrieval_gate import evaluate_retrieval_quality
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.roadmap_service import generate_roadmap

log = logging.getLogger("app.routers.roadmap")

router = APIRouter()


def _resolve_source_filters(jurisdiction: str) -> list[str]:
    jur = (jurisdiction or "India").strip().lower()
    if jur == "both":
        return ["india_statutes", "international_treaties"]
    if "international" in jur:
        return ["international_treaties"]
    return ["india_statutes"]


def _confidence_from_retrieval(best_distance: float, n_stages: int, n_citations: int) -> int:
    if n_stages == 0 or n_citations == 0:
        return max(0, min(30, int((1.0 - best_distance) * 40)))
    sim = max(0.0, min(1.0, 1.0 - float(best_distance)))
    return max(35, min(96, int(round(sim * 100))))


@router.post(
    "/roadmap",
    response_model=RoadmapResponse,
    summary="IP Journey Roadmap",
    description=(
        "Builds a personalized, grounded IP journey timeline for an Ayurvedic innovation — "
        "pre-filing prerequisites through filing, publication, RFE, FER, grant and renewals — "
        "with per-stage statutory basis, timelines, and action items. "
        "Uses the same hybrid RAG retrieval pipeline as /api/chat."
    ),
)
async def roadmap_endpoint(request: RoadmapRequest) -> RoadmapResponse:
    start_time = time.perf_counter()

    innovation = request.innovation.strip()
    stage = (request.stage or "").strip()
    jurisdiction = request.jurisdiction or "India"
    source_filters = _resolve_source_filters(jurisdiction)

    # ── Stage 1: PII scrub ─────────────────────────────────────
    scrubbed = pii_scrubber.scrub_query(innovation)
    scrubbed_stage = pii_scrubber.scrub_query(stage) if stage else ""

    # ── Stage 2: retrieval query biased toward filing lifecycle / timelines
    retrieval_query = (
        f"What is the patent filing journey and statutory timeline for the Ayurvedic "
        f"innovation '{scrubbed}'? Include filing, publication (18 months), request for "
        f"examination (RFE), first examination report (FER), grant, renewals, and any "
        f"pre-filing NBA/ABS approval under the Biological Diversity Act."
    )

    # ── Stage 3: Hybrid RRF retrieval ──────────────────────────
    try:
        candidates = hybrid_rrf_search(
            query=retrieval_query,
            jurisdiction=jurisdiction,
            top_k=8,
        )
    except Exception as e:
        log.error("Roadmap retrieval failed: %s", e, exc_info=True)
        candidates = []

    # ── Stage 4: Retrieval gate ────────────────────────────────
    gate_result = evaluate_retrieval_quality(
        candidates=candidates,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
    )
    best_distance = gate_result.get("best_distance", 1.0)

    if not gate_result["is_sufficient"]:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return RoadmapResponse(
            overview=(
                "I could not find enough authoritative material in the knowledge base to build "
                "a reliable IP journey for this innovation. Please add more detail about what "
                "the innovation is and where you currently are, or consult a registered patent "
                "agent for a personalized filing plan."
            ),
            stages=[],
            prerequisites=[
                "Add detail on the innovation and your current stage, then try again.",
                "Consult a registered patent agent for a formal filing strategy.",
            ],
            citations=[],
            confidence=_confidence_from_retrieval(best_distance, 0, 0),
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
        final_k=5,
    )

    # ── Stage 6: Context compression + citations ───────────────
    context_text, cleaned_chunks = context_compressor.build_prompt_context(
        chunks=reranked_passages,
        max_tokens=1800,
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

    # ── Stage 7: Grounded structured roadmap (LLM) ─────────────
    roadmap_data = await generate_roadmap(
        innovation=scrubbed,
        stage=scrubbed_stage,
        context_str=context_text,
        jurisdiction=jurisdiction,
    )

    stages = [RoadmapStage(**s) for s in roadmap_data["stages"]]
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    confidence = _confidence_from_retrieval(best_distance, len(stages), len(citations))
    status = "ok" if stages else "no_data"

    return RoadmapResponse(
        overview=roadmap_data["overview"],
        stages=stages,
        prerequisites=roadmap_data["prerequisites"],
        citations=citations,
        confidence=confidence,
        latency_ms=round(elapsed_ms, 2),
        status=status,
        jurisdiction=jurisdiction,
        source_filters=source_filters,
    )
