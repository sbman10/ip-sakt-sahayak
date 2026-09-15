"""
backend/app/routers/chat.py
----------------------------
Complete RAG Orchestration Router for IP-SAKTI Sahayak.
Assembles the full 12-stage grounded reasoning pipeline:
  PII Scrub -> Hybrid RRF -> Retrieval Gate -> Conditional Rerank ->
  Context Compress -> Gemini Generation -> Claim Verification ->
  Confidence Calculation -> Claim Guardrails -> Audit Log -> Response
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import Conversation, Message, get_db
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    CitationItem,
    CitationScore,
    ConfidenceScore,
)

# Pipeline services
from app.services.pii_scrubber import pii_scrubber, scrub_pii
from app.services.retrieval_service import hybrid_rrf_search
from app.services.retrieval_gate import evaluate_retrieval_quality, get_abstention_response
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.llm_service import generate_grounded_answer
from app.services.claim_verifier import claim_verifier
from app.services.confidence_calculator import compute_composite_confidence
from app.services.claim_guardrails import enforce_claim_guardrails
from app.services.audit_service import async_log_audit_transaction

# Legacy services kept for streaming endpoint compatibility
from app.services.guardrails import guardrail_service
from app.services.llm import stream_grounded_answer

log = logging.getLogger("app.routers.chat")

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Statutory RAG Legal Q&A",
    description=(
        "Processes legal question through the complete 12-stage grounded reasoning pipeline: "
        "DPDP PII scrubbing, hybrid RRF search, retrieval gate, conditional CrossEncoder reranking, "
        "context compression, Gemini generation, claim verification, composite confidence scoring, "
        "claim guardrails, and audit logging."
    ),
)
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Main dialogue turn endpoint executing the complete RAG pipeline.
    """
    # ── Stage (a): Start latency timer ──────────────────────────
    start_time = time.perf_counter()
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"

    # ── Stage (b): PII Scrubbing (DPDP Compliance) ──────────────
    scrubbed_query = pii_scrubber.scrub_query(raw_query)

    # ── Stage (c): Hybrid RRF Retrieval (ChromaDB + BM25) ──────
    try:
        candidates = hybrid_rrf_search(
            query=scrubbed_query,
            jurisdiction=jurisdiction,
            top_k=8,
        )
    except Exception as e:
        log.error("Hybrid retrieval failed: %s", e, exc_info=True)
        candidates = []

    # ── Stage (d): Retrieval Gate — Abstention if insufficient ──
    gate_result = evaluate_retrieval_quality(
        candidates=candidates,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
    )

    if not gate_result["is_sufficient"]:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        abstention = get_abstention_response()
        confidence = ConfidenceScore(
            score=abstention["confidence"]["score"],
            label=abstention["confidence"]["label"],
            reason=abstention["confidence"]["reason"],
            citation_scores=[],
        )
        return ChatResponse(
            answer=abstention["answer"],
            citations=[],
            confidence=confidence,
            latency_ms=round(elapsed_ms, 2),
            status="no_data",
            conversation_id=request.conversation_id,
        )

    # ── Stage (e): Conditional CrossEncoder Reranking ───────────
    best_distance = gate_result.get("best_distance", 1.0)
    reranked_passages, reranker_skipped = await conditional_rerank(
        query=scrubbed_query,
        candidates=candidates,
        skip_threshold=settings.RERANK_SKIP_THRESHOLD,
        final_k=4,
    )

    top_rerank_score = (
        reranked_passages[0].get("reranker_score", 1.0)
        if reranked_passages
        else 0.5
    )
    # If reranker was skipped, treat reranker relevance as 1.0
    effective_rerank_score = 1.0 if reranker_skipped else top_rerank_score

    # ── Stage (f): Context Compression & Citation Formatting ────
    context_text, cleaned_chunks = context_compressor.build_prompt_context(
        chunks=reranked_passages,
        max_tokens=1500,
    )

    # Build CitationItem list from cleaned chunks
    citations: list[CitationItem] = []
    for chunk in cleaned_chunks:
        citations.append(
            CitationItem(
                source=chunk.get("source", "Legal Statute"),
                section=chunk.get("section", "General"),
                text=chunk.get("text", ""),
                relevance=f"Grounded in {chunk.get('source', 'source')} ({chunk.get('section', 'section')}).",
            )
        )

    # ── Stage (g): Grounded LLM Generation via Gemini ───────────
    answer = await generate_grounded_answer(
        query=scrubbed_query,
        context_str=context_text,
        answer_mode=answer_mode,
    )

    # ── Stage (h): Claim Extraction & Citation Entailment ───────
    citation_dicts = [{"source": c.source, "text": c.text} for c in citations]
    citation_entailment, citation_coverage, citation_scores_list = (
        await claim_verifier.evaluate_citations(
            answer_text=answer,
            citations=citation_dicts,
        )
    )

    # ── Stage (i): Composite Confidence Calculation ─────────────
    confidence = compute_composite_confidence(
        best_vector_distance=best_distance,
        reranker_score=effective_rerank_score,
        citation_entailment=citation_entailment,
        citation_coverage=citation_coverage,
        citation_scores=citation_scores_list,
    )

    # ── Stage (j): Post-Generation Claim Guardrails ─────────────
    answer, confidence = enforce_claim_guardrails(answer, confidence)

    # ── Stage (k): Audit Logging (Background) ──────────────────
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    try:
        await async_log_audit_transaction(
            db_session=db,
            raw_query=raw_query,
            scrubbed_query=scrubbed_query,
            jurisdiction=jurisdiction,
            language=language,
            confidence_score=confidence.score,
            latency_ms=elapsed_ms,
        )
    except Exception as audit_err:
        log.warning("Audit log error: %s", audit_err)

    # Persist conversation turn to DB
    conv_id = request.conversation_id
    try:
        if not conv_id:
            conv = Conversation(
                id=str(uuid.uuid4()),
                title=raw_query[:50] + ("..." if len(raw_query) > 50 else ""),
                jurisdiction=jurisdiction,
            )
            db.add(conv)
            db.commit()
            conv_id = conv.id

        msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            sender="bot",
            raw_query=raw_query,
            scrubbed_query=scrubbed_query,
            answer=answer,
            confidence_score=confidence.score,
            confidence_label=confidence.label,
        )
        db.add(msg)
        db.commit()
    except Exception as db_err:
        log.warning("Could not persist conversation turn to DB: %s", db_err)

    # ── Stage (l): Return ChatResponse ──────────────────────────
    return ChatResponse(
        answer=answer,
        citations=citations,
        confidence=confidence,
        latency_ms=round(elapsed_ms, 2),
        status="answered",
        conversation_id=conv_id,
    )


@router.post(
    "/chat/stream",
    summary="Streaming Grounded Legal Q&A",
    description="Streams real-time tokens from Gemini for low time-to-first-token UI rendering.",
)
async def chat_stream_endpoint(
    request: ChatRequest,
):
    """
    Streaming SSE endpoint for real-time typewriter output.
    Uses the legacy synchronous streaming path for token-by-token delivery.
    """
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"

    scrubbed_query = scrub_pii(raw_query)

    # Fast guardrail check
    is_safe, refusal_msg = guardrail_service.check_input_relevance(scrubbed_query)
    if not is_safe:
        async def _stream_refusal():
            yield f"data: {json.dumps({'chunk': refusal_msg or ''})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_stream_refusal(), media_type="text/event-stream")

    # Hybrid retrieve
    try:
        candidates = hybrid_rrf_search(
            query=scrubbed_query,
            jurisdiction=jurisdiction,
            top_k=5,
        )
    except Exception:
        candidates = []

    reranked, _ = await conditional_rerank(
        query=scrubbed_query,
        candidates=candidates,
        skip_threshold=settings.RERANK_SKIP_THRESHOLD,
        final_k=3,
    )

    context_text, cleaned_chunks = context_compressor.build_prompt_context(reranked, max_tokens=1500)

    # Build citation items
    citations = []
    for chunk in cleaned_chunks:
        citations.append(CitationItem(
            source=chunk.get("source", "Legal Statute"),
            section=chunk.get("section", "General"),
            text=chunk.get("text", ""),
            relevance=f"Grounded in {chunk.get('source', 'source')}.",
        ))

    def _generate_stream():
        # First send citation metadata payload
        citation_data = [c.model_dump() for c in citations]
        yield f"data: {json.dumps({'type': 'citations', 'citations': citation_data})}\n\n"

        for token in stream_grounded_answer(
            question=scrubbed_query,
            context=context_text,
            jurisdiction=jurisdiction,
            language=language,
            answer_mode=answer_mode,
        ):
            yield f"data: {json.dumps({'chunk': token})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(_generate_stream(), media_type="text/event-stream")
