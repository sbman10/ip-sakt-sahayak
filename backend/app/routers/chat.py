"""
backend/app/routers/chat.py
----------------------------
FastAPI router powering the POST /api/chat and POST /api/chat/stream endpoints.
Integrates Hybrid RRF Retrieval, Conditional Reranking, Context Compression,
Google Gemini Grounded Generation, Claim Entailment, and Composite Confidence Scoring.
"""

from __future__ import annotations

import asyncio
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
from app.services.audit import log_transaction
from app.services.confidence_scorer import confidence_scorer
from app.services.context_compressor import context_compressor
from app.services.entailment_service import entailment_service
from app.services.guardrails import guardrail_service
from app.services.hybrid_retriever import hybrid_retriever
from app.services.llm import async_generate_grounded_answer, stream_grounded_answer
from app.services.pii_scrubber import scrub_pii
from app.services.reranker import conditional_reranker

log = logging.getLogger("app.routers.chat")

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Statutory RAG Legal Q&A",
    description="Processes legal question with DPDP PII scrubbing, hybrid search, reranking, and citation-backed Gemini generation.",
)
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Main dialogue turn endpoint executing the 5-stage grounded reasoning pipeline.
    """
    start_time = time.perf_counter()
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"

    # Stage 1: PII Scrubbing (DPDP Compliance)
    scrubbed_query = scrub_pii(raw_query)

    # Stage 2: Fast Pre-Generation Guardrail Relevance Check
    is_safe, refusal_msg = guardrail_service.check_input_relevance(scrubbed_query)
    if not is_safe:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        confidence = ConfidenceScore(
            score=95,
            label="High",
            reason="Conversational greeting or domain boundary response.",
            citation_scores=[],
        )
        return ChatResponse(
            answer=refusal_msg or "Hello! How may I assist you with Indian IP law today?",
            citations=[],
            confidence=confidence,
            latency_ms=round(elapsed_ms, 2),
            status="out_of_scope",
            conversation_id=request.conversation_id,
        )

    # Stage 3: Parallel Hybrid Retrieval (ChromaDB + BM25 with RRF Fusion)
    candidates = await hybrid_retriever.hybrid_retrieve(
        query=scrubbed_query,
        jurisdiction=jurisdiction,
        top_k=8,
    )

    top_sim = candidates[0].get("vector_similarity", 0.0) if candidates else 0.0

    # Stage 4: Grounding Guardrail Check
    is_grounded, abstention_msg = guardrail_service.check_retrieval_grounding(
        top_similarity=top_sim,
        candidate_count=len(candidates),
    )
    if not is_grounded:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        confidence = confidence_scorer.calculate_confidence(
            retrieval_similarity=top_sim,
            rerank_score=0.0,
            citation_scores=[],
            is_abstention=True,
        )
        return ChatResponse(
            answer=abstention_msg or "I cannot find an authoritative source to safely answer this query.",
            citations=[],
            confidence=confidence,
            latency_ms=round(elapsed_ms, 2),
            status="no_data",
            conversation_id=request.conversation_id,
        )

    # Stage 5: Conditional CrossEncoder Reranking
    reranked_passages = await conditional_reranker.rerank(
        query=scrubbed_query,
        candidates=candidates,
        top_k=4,
    )
    top_rerank_score = reranked_passages[0].get("rerank_score", 0.5) if reranked_passages else 0.5

    # Stage 6: Context Compression & Citation Model Generation
    context_text, citations = context_compressor.compress_and_format(
        ranked_passages=reranked_passages,
        max_passages=3,
    )

    # Stage 7: Grounded LLM Generation via Google Gemini
    try:
        answer = await async_generate_grounded_answer(
            question=scrubbed_query,
            context=context_text,
            jurisdiction=jurisdiction,
            language=language,
            answer_mode=answer_mode,
        )
    except Exception as e:
        log.error("LLM Generation failure: %s", e, exc_info=True)
        answer = (
            "An error occurred while connecting to the statutory reasoning engine. "
            "Please verify that your Gemini API key is valid."
        )

    # Stage 8: Claim Verification & Semantic Entailment Scoring
    citation_scores = await entailment_service.verify_citations(
        answer=answer,
        citations=citations,
    )

    # Stage 9: Composite Confidence Calculation
    confidence = confidence_scorer.calculate_confidence(
        retrieval_similarity=top_sim,
        rerank_score=top_rerank_score,
        citation_scores=citation_scores,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    # Stage 10: Asynchronous DB Persistence and Audit Logging
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

        # Persist message turn
        msg = Message(
            id=str(uuid.uuid4()) if hasattr(Message.id.type, 'python_type') and Message.id.type.python_type == str else None,
            conversation_id=conv_id,
            role="assistant" if hasattr(Message, "role") else "bot",
            content=answer if hasattr(Message, "content") else None,
            confidence=confidence.label if hasattr(Message, "confidence") else None,
            citations_json=json.dumps([c.model_dump() for c in citations]) if hasattr(Message, "citations_json") else None,
            latency_ms=elapsed_ms if hasattr(Message, "latency_ms") else None,
        )
        # Handle db model variation gracefully
        if hasattr(msg, "raw_query"):
            msg.raw_query = raw_query
        if hasattr(msg, "scrubbed_query"):
            msg.scrubbed_query = scrub_pii(raw_query)
        if hasattr(msg, "confidence_score"):
            msg.confidence_score = confidence.score
        if hasattr(msg, "confidence_label"):
            msg.confidence_label = confidence.label
        if hasattr(msg, "sender"):
            msg.sender = "bot"
        if hasattr(msg, "answer"):
            msg.answer = answer

        db.add(msg)
        db.commit()
    except Exception as db_err:
        log.warning("Could not persist conversation turn to DB: %s", db_err)

    # Background audit log
    try:
        log_transaction(
            query_raw=raw_query,
            query_scrubbed=scrubbed_query,
            jurisdiction=jurisdiction,
            language=language,
            confidence_score=confidence.label,
            latency_ms=elapsed_ms,
        )
    except Exception as audit_err:
        log.warning("Audit log error: %s", audit_err)

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
    """
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"

    scrubbed_query = scrub_pii(raw_query)

    # Fast check
    is_safe, refusal_msg = guardrail_service.check_input_relevance(scrubbed_query)
    if not is_safe:
        async def _stream_refusal():
            yield f"data: {json.dumps({'chunk': refusal_msg or ''})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_stream_refusal(), media_type="text/event-stream")

    # Hybrid retrieve
    candidates = await hybrid_retriever.hybrid_retrieve(
        query=scrubbed_query,
        jurisdiction=jurisdiction,
        top_k=5,
    )

    reranked = await conditional_reranker.rerank(
        query=scrubbed_query,
        candidates=candidates,
        top_k=3,
    )

    context_text, citations = context_compressor.compress_and_format(reranked, max_passages=3)

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
