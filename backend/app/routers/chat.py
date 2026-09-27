"""
backend/app/routers/chat.py
----------------------------
Complete RAG Orchestration Router for IP-SAKTI Sahayak.
Assembles the full grounded reasoning pipeline:
  PII Scrub -> Intent Classification & Routing ->
  [Non-knowledge Direct Response OR Hybrid RRF -> Retrieval Gate ->
   Conditional Rerank -> Context Compress -> Master Prompt Gemini Generation ->
   Claim Verification -> Composite Confidence -> Guardrails -> Audit Log -> Persist]
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
from app.models.database import Conversation, Message, User, get_db
from app.routers.auth import get_current_user
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    CitationItem,
    CitationScore,
    ConfidenceScore,
)

# Pipeline services
from app.services.pii_scrubber import pii_scrubber, scrub_pii
from app.services.intent_classifier import (
    intent_classifier,
    build_chitchat_response,
    build_clarification_response,
    build_out_of_scope_response,
    build_unsafe_response,
)
from app.services.retrieval_router import retrieve
# Alias for full backward compatibility with tests patching app.routers.chat.hybrid_rrf_search
hybrid_rrf_search = retrieve
from app.services.retrieval_gate import evaluate_retrieval_quality, get_abstention_response
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.llm_service import generate_grounded_answer
from app.services.claim_verifier import claim_verifier
from app.services.confidence_calculator import compute_composite_confidence
from app.services.claim_guardrails import enforce_claim_guardrails
from app.services.audit_service import async_log_audit_transaction

# Legacy streaming service
from app.services.guardrails import guardrail_service
from app.services.llm import stream_grounded_answer

log = logging.getLogger("app.routers.chat")

router = APIRouter()


def _resolve_source_filters(jurisdiction: str) -> list[str]:
    """Map a jurisdiction value to the ChromaDB collections that will be queried.

    Used for response observability so clients can see exactly which corpora a
    turn was grounded in. 'Both' fans out across both collections.
    """
    jur = (jurisdiction or "India").strip().lower()
    if jur == "both":
        return ["india_statutes", "international_treaties"]
    if "international" in jur:
        return ["international_treaties"]
    return ["india_statutes"]


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Statutory RAG Legal Q&A with Intent Routing",
    description=(
        "Processes query through DPDP PII scrubbing, intent classification, "
        "and either direct response (chitchat/clarification/out_of_scope) or "
        "hybrid RRF search, retrieval gate, reranking, master prompt Gemini generation, "
        "claim verification, composite confidence, and audit logging."
    ),
)
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
) -> ChatResponse:
    """
    Main dialogue turn endpoint executing intent-routed RAG pipeline.
    """
    # ── Stage (a): Start latency timer ──────────────────────────
    start_time = time.perf_counter()
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"
    source_filters = _resolve_source_filters(jurisdiction)

    # ── Stage (b): PII Scrubbing (DPDP Compliance) ──────────────
    scrubbed_query = pii_scrubber.scrub_query(raw_query)

    # ── Context Profile & Formulation Extraction ────────────────
    ctx_dict = request.context if isinstance(request.context, dict) else {}
    user_context = {
        "user_type": request.user_type or ctx_dict.get("user_type"),
        "user_expertise": request.user_expertise or ctx_dict.get("user_expertise"),
        "organization_type": request.organization_type or ctx_dict.get("organization_type"),
        "user_country": request.user_country or ctx_dict.get("user_country", "India"),
        "user_region": request.user_region or ctx_dict.get("user_region"),
        "nationality_or_residency": request.nationality_or_residency or ctx_dict.get("nationality_or_residency"),
        "user_role": request.user_role or ctx_dict.get("user_role"),
    }
    product_context = {
        "product_name": request.product_name or ctx_dict.get("product_name"),
        "product_description": request.product_description or ctx_dict.get("product_description"),
        "formulation_type": request.formulation_type or ctx_dict.get("formulation_type"),
        "ingredients": request.ingredients or ctx_dict.get("ingredients"),
        "species": request.species or ctx_dict.get("species"),
        "scientific_names": request.scientific_names or ctx_dict.get("scientific_names"),
        "traditional_use": request.traditional_use or ctx_dict.get("traditional_use"),
        "resource_origin": request.resource_origin or ctx_dict.get("resource_origin"),
        "knowledge_holder": request.knowledge_holder or ctx_dict.get("knowledge_holder"),
        "knowledge_source": request.knowledge_source or ctx_dict.get("knowledge_source"),
        "existing_formulation": request.existing_formulation or ctx_dict.get("existing_formulation"),
        "novel_modification": request.novel_modification or ctx_dict.get("novel_modification"),
        "intended_use": request.intended_use or ctx_dict.get("intended_use"),
        "commercial_status": request.commercial_status or ctx_dict.get("commercial_status"),
        "development_stage": request.development_stage or ctx_dict.get("development_stage"),
    }
    user_intent = request.user_intent or ctx_dict.get("user_intent")
    requested_information = request.requested_information or ctx_dict.get("requested_information")

    # ── Fetch Recent Conversation History for Query Rewriting ──
    conversation_context = ""
    if request.conversation_id:
        try:
            recent_msgs = (
                db.query(Message)
                .filter(Message.conversation_id == request.conversation_id)
                .order_by(Message.id.desc())
                .limit(4)
                .all()
            )
            if recent_msgs:
                chrono = list(reversed(recent_msgs))
                conversation_context = "\n".join(
                    f"{m.role.capitalize()}: {m.content[:300]}" for m in chrono
                )
        except Exception as e:
            log.debug("Could not fetch conversation history for context: %s", e)

    # ── Stage (b.1): Intent Classification & Early Routing ──────
    classification = await intent_classifier.classify_intent(
        query=scrubbed_query,
        conversation_context=conversation_context,
        jurisdiction=jurisdiction,
        language=language,
    )
    log.info(
        "Intent routed: %s (confidence=%.2f, rewritten=%s)",
        classification.intent,
        classification.confidence,
        bool(classification.rewritten_query),
    )

    if classification.intent == "CHITCHAT":
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return build_chitchat_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            latency_ms=elapsed_ms,
        )

    if classification.intent == "CLARIFICATION_NEEDED":
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return build_clarification_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            latency_ms=elapsed_ms,
        )

    if classification.intent == "OUT_OF_SCOPE":
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return build_out_of_scope_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            latency_ms=elapsed_ms,
        )

    if classification.intent == "UNSAFE_OR_DISALLOWED":
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return build_unsafe_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            latency_ms=elapsed_ms,
        )

    # For KNOWLEDGE_SEEK: use rewritten query for retrieval if available
    retrieval_query = classification.rewritten_query.strip() or scrubbed_query

    # ── Stage (c): Hybrid RRF Retrieval (ChromaDB + BM25) ──────
    try:
        candidates = hybrid_rrf_search(
            query=retrieval_query,
            jurisdiction=jurisdiction,
            top_k=8,
            document_ids=request.document_ids,  # Scope to user-uploaded docs if provided
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
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            intent=classification.intent,
            intent_confidence=classification.confidence,
            rewritten_query_used=classification.rewritten_query if classification.rewritten_query else None,
        )

    # ── Stage (e): Conditional CrossEncoder Reranking ───────────
    best_distance = gate_result.get("best_distance", 1.0)
    reranked_passages, reranker_skipped = await conditional_rerank(
        query=retrieval_query,
        candidates=candidates,
        skip_threshold=settings.RERANK_SKIP_THRESHOLD,
        final_k=4,
    )

    top_rerank_score = (
        reranked_passages[0].get("reranker_score", 0.5)
        if reranked_passages
        else 0.5
    )
    if reranker_skipped:
        effective_rerank_score = max(0.0, min(1.0, 1.0 - best_distance))
    else:
        effective_rerank_score = top_rerank_score

    # ── Stage (f): Context Compression & Citation Formatting ────
    context_text, cleaned_chunks = context_compressor.build_prompt_context(
        chunks=reranked_passages,
        max_tokens=3500,
    )

    # Build CitationItem list from cleaned chunks with SOURCE_ID traceability
    citations: list[CitationItem] = []
    for idx, chunk in enumerate(cleaned_chunks, start=1):
        source_id = chunk.get("source_id") or f"SRC-{idx:03d}"
        source_name = chunk.get("source", "Legal Statute")
        section_name = chunk.get("section", "General")
        
        # Detect if this is a user-uploaded document
        # User docs have jurisdiction="User Document" or have user_id in metadata
        chunk_meta = chunk.get("metadata", {})
        is_user_doc = (
            chunk.get("jurisdiction") == "User Document" or
            chunk_meta.get("jurisdiction") == "User Document" or
            bool(chunk_meta.get("user_id")) or
            bool(chunk.get("user_id"))
        )
        original_filename = chunk_meta.get("original_filename") or chunk.get("original_filename")
        
        citations.append(
            CitationItem(
                source_id=source_id,
                source=source_name,
                section=section_name,
                text=chunk.get("text", ""),
                relevance=f"[{source_id}] Grounded in {source_name} ({section_name}).",
                is_user_document=is_user_doc,
                original_filename=original_filename if is_user_doc else None,
            )
        )

    # ── Stage (g): Grounded LLM Generation via Gemini ───────────
    try:
        answer = await generate_grounded_answer(
            query=scrubbed_query,
            context_str=context_text,
            answer_mode=answer_mode,
            jurisdiction=jurisdiction,
            language=language,
            user_context=user_context,
            product_context=product_context,
            user_intent=user_intent,
            requested_information=requested_information,
        )
    except Exception as gen_err:
        log.error("LLM generation failed: %s", gen_err, exc_info=True)
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return ChatResponse(
            answer=(
                "I found relevant sources in the knowledge base, but the "
                "answer service is temporarily unavailable (rate-limited or server error). "
                "The cited sources below are still relevant to your query."
            ),
            citations=citations,
            confidence=ConfidenceScore(
                score=0,
                label="Low",
                reason="Answer generation service was temporarily unavailable.",
                citation_scores=[],
            ),
            latency_ms=round(elapsed_ms, 2),
            status="degraded",
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            intent=classification.intent,
            intent_confidence=classification.confidence,
            rewritten_query_used=classification.rewritten_query if classification.rewritten_query else None,
        )

    if not answer or not answer.strip():
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return ChatResponse(
            answer=(
                "I could not compose a confident answer from the current "
                "knowledge base for this query. You may rephrase the question "
                "or consult a qualified IP professional for authoritative guidance."
            ),
            citations=citations,
            confidence=ConfidenceScore(
                score=15,
                label="Low",
                reason="Generation returned no usable content.",
                citation_scores=[],
            ),
            latency_ms=round(elapsed_ms, 2),
            status="no_data",
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
            intent=classification.intent,
            intent_confidence=classification.confidence,
            rewritten_query_used=classification.rewritten_query if classification.rewritten_query else None,
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

    # Persist conversation turn to DB (both user question AND assistant answer)
    conv_id = request.conversation_id
    try:
        if not conv_id:
            conv = Conversation(
                id=str(uuid.uuid4()),
                title=raw_query[:50] + ("..." if len(raw_query) > 50 else ""),
                jurisdiction=jurisdiction,
                user_id=current_user.id if current_user else None,
            )
            db.add(conv)
            db.commit()
            conv_id = conv.id

        # Save user's question first
        user_msg = Message(
            conversation_id=conv_id,
            role="user",
            content=raw_query,
            confidence=None,
            citations_json=None,
            latency_ms=None,
        )
        db.add(user_msg)
        db.commit()

        # Save assistant's answer
        assistant_msg = Message(
            conversation_id=conv_id,
            role="assistant",
            content=answer,
            confidence=confidence.label.lower() if confidence else "low",
            citations_json=json.dumps([c.model_dump() for c in citations]),
            latency_ms=elapsed_ms,
        )
        db.add(assistant_msg)
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
        jurisdiction=jurisdiction,
        source_filters=source_filters,
        intent=classification.intent,
        intent_confidence=classification.confidence,
        rewritten_query_used=classification.rewritten_query if classification.rewritten_query else None,
    )


@router.post(
    "/chat/stream",
    summary="Streaming Grounded Legal Q&A with Intent Routing",
    description="Streams real-time tokens from Gemini with intent-based early routing.",
)
async def chat_stream_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Streaming SSE endpoint with full intent-routing parity.
    Non-knowledge queries return their direct response without triggering retrieval.
    """
    raw_query = request.question.strip()
    jurisdiction = request.jurisdiction or "India"
    language = request.language or "EN"
    answer_mode = request.answer_mode or "standard"
    source_filters = _resolve_source_filters(jurisdiction)

    scrubbed_query = scrub_pii(raw_query)

    # ── Persist conversation and user message at start ──────────
    conv_id = request.conversation_id
    try:
        if not conv_id:
            conv = Conversation(
                id=str(uuid.uuid4()),
                title=raw_query[:50] + ("..." if len(raw_query) > 50 else ""),
                jurisdiction=jurisdiction,
                user_id=current_user.id if current_user else None,
            )
            db.add(conv)
            db.commit()
            conv_id = conv.id

        # Save user's question
        user_msg = Message(
            conversation_id=conv_id,
            role="user",
            content=raw_query,
            confidence=None,
            citations_json=None,
            latency_ms=None,
        )
        db.add(user_msg)
        db.commit()
    except Exception as db_err:
        log.warning("Could not persist user message to DB: %s", db_err)

    # Context profile extraction
    ctx_dict = request.context if isinstance(request.context, dict) else {}
    user_context = {
        "user_type": request.user_type or ctx_dict.get("user_type"),
        "user_expertise": request.user_expertise or ctx_dict.get("user_expertise"),
        "organization_type": request.organization_type or ctx_dict.get("organization_type"),
        "user_country": request.user_country or ctx_dict.get("user_country", "India"),
        "user_region": request.user_region or ctx_dict.get("user_region"),
        "nationality_or_residency": request.nationality_or_residency or ctx_dict.get("nationality_or_residency"),
        "user_role": request.user_role or ctx_dict.get("user_role"),
    }
    product_context = {
        "product_name": request.product_name or ctx_dict.get("product_name"),
        "product_description": request.product_description or ctx_dict.get("product_description"),
        "formulation_type": request.formulation_type or ctx_dict.get("formulation_type"),
        "ingredients": request.ingredients or ctx_dict.get("ingredients"),
        "species": request.species or ctx_dict.get("species"),
        "scientific_names": request.scientific_names or ctx_dict.get("scientific_names"),
        "traditional_use": request.traditional_use or ctx_dict.get("traditional_use"),
        "resource_origin": request.resource_origin or ctx_dict.get("resource_origin"),
        "knowledge_holder": request.knowledge_holder or ctx_dict.get("knowledge_holder"),
        "knowledge_source": request.knowledge_source or ctx_dict.get("knowledge_source"),
        "existing_formulation": request.existing_formulation or ctx_dict.get("existing_formulation"),
        "novel_modification": request.novel_modification or ctx_dict.get("novel_modification"),
        "intended_use": request.intended_use or ctx_dict.get("intended_use"),
        "commercial_status": request.commercial_status or ctx_dict.get("commercial_status"),
        "development_stage": request.development_stage or ctx_dict.get("development_stage"),
    }
    user_intent = request.user_intent or ctx_dict.get("user_intent")
    requested_information = request.requested_information or ctx_dict.get("requested_information")

    # ── Intent Classification & Early Routing for Streaming ───────
    classification = await intent_classifier.classify_intent(
        query=scrubbed_query,
        conversation_context="",
        jurisdiction=jurisdiction,
        language=language,
    )

    if classification.intent == "CHITCHAT":
        resp = build_chitchat_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
        )

        def _stream_chitchat():
            yield f"data: {json.dumps({'type': 'meta', 'intent': 'CHITCHAT', 'jurisdiction': jurisdiction, 'source_filters': source_filters})}\n\n"
            yield f"data: {json.dumps({'type': 'citations', 'citations': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': resp.answer})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'answered', 'completed': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(_stream_chitchat(), media_type="text/event-stream")

    if classification.intent == "CLARIFICATION_NEEDED":
        resp = build_clarification_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
        )

        def _stream_clarification():
            yield f"data: {json.dumps({'type': 'meta', 'intent': 'CLARIFICATION_NEEDED', 'jurisdiction': jurisdiction, 'source_filters': source_filters})}\n\n"
            yield f"data: {json.dumps({'type': 'citations', 'citations': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': resp.answer})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'answered', 'completed': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(_stream_clarification(), media_type="text/event-stream")

    if classification.intent == "OUT_OF_SCOPE":
        resp = build_out_of_scope_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
        )

        def _stream_out_of_scope():
            yield f"data: {json.dumps({'type': 'meta', 'intent': 'OUT_OF_SCOPE', 'jurisdiction': jurisdiction, 'source_filters': source_filters})}\n\n"
            yield f"data: {json.dumps({'type': 'citations', 'citations': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': resp.answer})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'answered', 'completed': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(_stream_out_of_scope(), media_type="text/event-stream")

    if classification.intent == "UNSAFE_OR_DISALLOWED":
        resp = build_unsafe_response(
            classification=classification,
            conversation_id=request.conversation_id,
            jurisdiction=jurisdiction,
            source_filters=source_filters,
        )

        def _stream_unsafe():
            yield f"data: {json.dumps({'type': 'meta', 'intent': 'UNSAFE_OR_DISALLOWED', 'jurisdiction': jurisdiction, 'source_filters': source_filters})}\n\n"
            yield f"data: {json.dumps({'type': 'citations', 'citations': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': resp.answer})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'answered', 'completed': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(_stream_unsafe(), media_type="text/event-stream")

    # KNOWLEDGE_SEEK: use rewritten query for retrieval if present
    retrieval_query = classification.rewritten_query.strip() or scrubbed_query

    # Hybrid retrieve
    try:
        candidates = hybrid_rrf_search(
            query=retrieval_query,
            jurisdiction=jurisdiction,
            top_k=5,
            document_ids=request.document_ids,  # Scope to user-uploaded docs if provided
        )
    except Exception:
        candidates = []

    # Retrieval Gate
    gate_result = evaluate_retrieval_quality(
        candidates=candidates,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
    )
    if not gate_result["is_sufficient"]:
        abstention = get_abstention_response()

        def _stream_abstention():
            yield f"data: {json.dumps({'type': 'meta', 'intent': 'KNOWLEDGE_SEEK', 'jurisdiction': jurisdiction, 'source_filters': source_filters})}\n\n"
            yield f"data: {json.dumps({'type': 'citations', 'citations': []})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': abstention['answer']})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'no_data', 'completed': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(_stream_abstention(), media_type="text/event-stream")

    reranked, _ = await conditional_rerank(
        query=retrieval_query,
        candidates=candidates,
        skip_threshold=settings.RERANK_SKIP_THRESHOLD,
        final_k=3,
    )

    context_text, cleaned_chunks = context_compressor.build_prompt_context(reranked, max_tokens=3500)

    # Build citation items with SOURCE_IDs
    citations = []
    for idx, chunk in enumerate(cleaned_chunks, start=1):
        source_id = chunk.get("source_id") or f"SRC-{idx:03d}"
        source_name = chunk.get("source", "Legal Statute")
        section_name = chunk.get("section", "General")
        citations.append(
            CitationItem(
                source_id=source_id,
                source=source_name,
                section=section_name,
                text=chunk.get("text", ""),
                relevance=f"[{source_id}] Grounded in {source_name} ({section_name}).",
            )
        )

    def _generate_stream():
        # Emit metadata first (observability + intent)
        yield f"data: {json.dumps({'type': 'meta', 'intent': classification.intent, 'jurisdiction': jurisdiction, 'source_filters': source_filters, 'rewritten_query': classification.rewritten_query or None})}\n\n"
        # Then send citation metadata payload
        citation_data = [c.model_dump() for c in citations]
        yield f"data: {json.dumps({'type': 'citations', 'citations': citation_data})}\n\n"

        had_error = False
        try:
            for token in stream_grounded_answer(
                question=scrubbed_query,
                context=context_text,
                jurisdiction=jurisdiction,
                language=language,
                answer_mode=answer_mode,
                user_context=user_context,
                product_context=product_context,
                user_intent=user_intent,
                requested_information=requested_information,
            ):
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        except Exception as stream_err:
            had_error = True
            log.error("Streaming generation failed: %s", stream_err, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(stream_err), 'status': 'degraded'})}\n\n"

        if not had_error:
            yield f"data: {json.dumps({'type': 'done', 'done': True, 'status': 'answered', 'completed': True, 'conversation_id': conv_id})}\n\n"

    return StreamingResponse(_generate_stream(), media_type="text/event-stream")
