"""
backend/app/routers/guardian.py
-------------------------------
Dual-Use Guardian endpoint.

POST /api/guardian takes a product + how it is positioned and returns a
grounded, holistic compliance matrix across IP and regulatory dimensions
(Patent/IP, AYUSH manufacturing license, Biodiversity/ABS, FSSAI/food) with
per-dimension obligation, statutory basis, governing authority and next step,
plus evidence citations.

It REUSES the exact same RAG retrieval stack as /api/chat:
  PII scrub -> Hybrid RRF -> Retrieval Gate -> Conditional Rerank ->
  Context Compress -> grounded Guardian LLM (structured JSON).

Nothing is hard-coded — the matrix is decided by the model from the
retrieved corpus. This router only orchestrates + shapes the response.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.chat import CitationItem
from app.schemas.guardian import GuardianRequest, GuardianResponse, ComplianceDimension

from app.services.pii_scrubber import pii_scrubber
from app.services.retrieval_service import hybrid_rrf_search
from app.services.retrieval_gate import evaluate_retrieval_quality
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.guardian_service import generate_guardian

log = logging.getLogger("app.routers.guardian")

router = APIRouter()


def _resolve_source_filters(jurisdiction: str) -> list[str]:
    jur = (jurisdiction or "India").strip().lower()
    if jur == "both":
        return ["india_statutes", "international_treaties"]
    if "international" in jur:
        return ["international_treaties"]
    return ["india_statutes"]


def _confidence_from_retrieval(best_distance: float, n_dims: int, n_citations: int) -> int:
    if n_dims == 0 or n_citations == 0:
        return max(0, min(30, int((1.0 - best_distance) * 40)))
    sim = max(0.0, min(1.0, 1.0 - float(best_distance)))
    return max(35, min(96, int(round(sim * 100))))


@router.post(
    "/guardian",
    response_model=GuardianResponse,
    summary="Dual-Use Guardian (holistic IP + regulatory compliance)",
    description=(
        "Screens an Ayurvedic product across all applicable compliance dimensions — patent / IP, "
        "AYUSH manufacturing license, Biodiversity Act (NBA/ABS), and FSSAI/food — returning a "
        "holistic matrix with per-dimension obligations, statutory basis, authority, and next "
        "steps. Uses the same hybrid RAG retrieval pipeline as /api/chat."
    ),
)
async def guardian_endpoint(request: GuardianRequest) -> GuardianResponse:
    start_time = time.perf_counter()

    product = request.product.strip()
    positioning = (request.positioning or "").strip()
    jurisdiction = request.jurisdiction or "India"
    source_filters = _resolve_source_filters(jurisdiction)

    # ── Stage 1: PII scrub ─────────────────────────────────────
    scrubbed = pii_scrubber.scrub_query(product)
    scrubbed_pos = pii_scrubber.scrub_query(positioning) if positioning else ""

    # ── Stage 2: retrieval query spanning all compliance dimensions
    retrieval_query = (
        f"What legal and regulatory compliance does the Ayurvedic product '{scrubbed}' "
        f"{('positioned as ' + scrubbed_pos + ' ') if scrubbed_pos else ''}"
        f"need — patent/IP eligibility, AYUSH manufacturing license (Rule 158-B / Drugs and "
        f"Cosmetics Act), Biological Diversity Act NBA/ABS approval, and FSSAI food registration?"
    )

    # ── Stage 3: Hybrid RRF retrieval ──────────────────────────
    try:
        candidates = hybrid_rrf_search(
            query=retrieval_query,
            jurisdiction=jurisdiction,
            top_k=10,
        )
    except Exception as e:
        log.error("Guardian retrieval failed: %s", e, exc_info=True)
        candidates = []

    # ── Stage 4: Retrieval gate ────────────────────────────────
    gate_result = evaluate_retrieval_quality(
        candidates=candidates,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
    )
    best_distance = gate_result.get("best_distance", 1.0)

    if not gate_result["is_sufficient"]:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return GuardianResponse(
            summary=(
                "I could not find enough authoritative material in the knowledge base to build a "
                "reliable compliance matrix for this product. Please add detail on the exact "
                "ingredients and how it is sold (medicine vs food), or consult the relevant "
                "authority (AYUSH Licensing, NBA, FSSAI)."
            ),
            dimensions=[],
            priority_actions=[
                "Add detail on ingredients and positioning (medicine vs food), then try again.",
                "Consult the relevant regulatory authority for your product category.",
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
        final_k=6,
    )

    # ── Stage 6: Context compression + citations ───────────────
    context_text, cleaned_chunks = context_compressor.build_prompt_context(
        chunks=reranked_passages,
        max_tokens=2000,
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

    # ── Stage 7: Grounded structured compliance matrix (LLM) ───
    guardian_data = await generate_guardian(
        product=scrubbed,
        positioning=scrubbed_pos,
        context_str=context_text,
        jurisdiction=jurisdiction,
    )

    dimensions = [ComplianceDimension(**d) for d in guardian_data["dimensions"]]
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    confidence = _confidence_from_retrieval(best_distance, len(dimensions), len(citations))
    status = "ok" if dimensions else "no_data"

    return GuardianResponse(
        summary=guardian_data["summary"],
        dimensions=dimensions,
        priority_actions=guardian_data["priority_actions"],
        citations=citations,
        confidence=confidence,
        latency_ms=round(elapsed_ms, 2),
        status=status,
        jurisdiction=jurisdiction,
        source_filters=source_filters,
    )
