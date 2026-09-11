"""
backend/app/routers/chat.py
----------------------------
Thin FastAPI router for POST /api/chat.

All RAG logic is delegated to app.rag.service.answer_question().
This router handles only HTTP concerns: request validation, error
mapping, audit logging, and response serialisation.
"""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, CitationItem
from app.services.audit import log_transaction
from app.rag.service import answer_question

log = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="RAG-powered Ayurvedic IP legal Q&A",
    description=(
        "Accepts a legal question, jurisdiction, and language.  Retrieves "
        "relevant passages from the local ChromaDB corpus using BGE embeddings, "
        "applies a similarity guardrail, and returns a Gemini-generated grounded "
        "answer with source citations and a legal disclaimer."
    ),
)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """
    Full RAG pipeline: validate → delegate to service → audit → respond.

    Raises
    ------
    HTTPException 500
        When the Gemini API call fails unexpectedly.
    """
    t_start = time.perf_counter()

    log.info(
        "Chat request | jurisdiction=%s | language=%s | question='%.80s...'",
        payload.jurisdiction,
        payload.language,
        payload.question,
    )

    try:
        result = answer_question(
            question=payload.question,
            jurisdiction=payload.jurisdiction,
            language=payload.language,
        )
    except RuntimeError as exc:
        log.error("Gemini service failure: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="The language model service encountered an error. Please try again.",
        )

    # Build typed response
    citations = [
        CitationItem(
            source=c["source"],
            section=c["section"],
            text=c["text"],
        )
        for c in result["citations"]
    ]

    confidence = result["confidence"]

    log.info(
        "Returning answer | confidence=%s | citations=%d",
        confidence,
        len(citations),
    )

    # Async audit logging — must not block the HTTP response
    latency_ms = (time.perf_counter() - t_start) * 1000
    await asyncio.to_thread(
        log_transaction,
        payload.question,
        result["query_scrubbed"],
        payload.jurisdiction,
        payload.language,
        confidence,
        latency_ms,
    )

    return ChatResponse(
        answer=result["answer"],
        citations=citations,
        confidence=confidence,
        disclaimer=result["disclaimer"],
    )
