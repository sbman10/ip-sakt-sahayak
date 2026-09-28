"""
backend/app/routers/conversations.py
-------------------------------------
FastAPI router for conversation/session management.

Endpoints:
- POST /api/conversations       Create new conversation
- GET /api/conversations        List all conversations
- GET /api/conversations/{id}   Get conversation with messages
- DELETE /api/conversations/{id} Delete conversation
- POST /api/conversations/{id}/feedback  Submit feedback
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import TenantContext, get_optional_tenant_context
from app.core.permissions import Permission, check_permission_or_raise
from app.models.database import Conversation, Feedback, Message, Source, User, get_db
from app.routers.auth import get_current_user

log = logging.getLogger(__name__)

router = APIRouter()


def _assert_owner(
    conv: Conversation,
    current_user: Optional[User] = None,
    tenant: Optional[TenantContext] = None,
) -> None:
    """
    Enforce per-user and per-organisation conversation isolation.

    A conversation may be read/updated/deleted only by its owner and within
    its tenant organisation. We return 404 rather than 403 so we do not leak
    the existence of another user's or organisation's data.
    """
    caller_org_id = tenant.organisation_id if tenant else None
    conv_org_id = getattr(conv, "organisation_id", None)

    # If the conversation belongs to an organisation, caller must be in the same organisation
    if conv_org_id is not None:
        if caller_org_id != conv_org_id:
            raise HTTPException(status_code=404, detail="Conversation not found")

    owner_id = getattr(conv, "user_id", None)
    if owner_id is None:
        return  # legacy / anonymous conversation — open
    caller_id = tenant.user_id if tenant else (current_user.id if current_user else None)
    if caller_id != owner_id:
        raise HTTPException(status_code=404, detail="Conversation not found")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    """Request body for creating a new conversation."""
    title: Optional[str] = None
    jurisdiction: str = "India"
    language: str = "en"


class ConversationUpdate(BaseModel):
    """Request body for renaming / pinning a conversation (PATCH)."""
    title: Optional[str] = None
    is_pinned: Optional[bool] = None


class MessageOut(BaseModel):
    """Response schema for a message."""
    id: int
    role: str
    content: str
    confidence: Optional[str] = None
    citations: Optional[List[dict]] = None
    latency_ms: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    """Response schema for a conversation."""
    id: str
    title: Optional[str] = None
    jurisdiction: str
    language: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ConversationDetail(ConversationOut):
    """Detailed conversation with messages."""
    messages: List[MessageOut] = []


class FeedbackCreate(BaseModel):
    """Request body for submitting feedback."""
    message_id: int
    rating: str  # "positive" or "negative"
    comment: Optional[str] = None


class StatsOut(BaseModel):
    """Response schema for system stats."""
    total_conversations: int
    total_messages: int
    total_sources: int
    avg_latency_ms: Optional[float]
    confidence_distribution: dict
    jurisdiction_distribution: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/conversations", response_model=ConversationOut, tags=["Conversations"])
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    current_user: Optional[User] = Depends(get_current_user),
) -> ConversationOut:
    """Create a new conversation session (owned by the caller and active organisation)."""
    user_id = tenant.user_id if tenant else (current_user.id if current_user else None)
    org_id = tenant.organisation_id if tenant else None

    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.CONVERSATION_CREATE)

    conv = Conversation(
        title=payload.title,
        jurisdiction=payload.jurisdiction,
        language=payload.language,
        user_id=user_id,
        organisation_id=org_id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    
    log.info("Created conversation: %s (user: %s, org: %s)", conv.id, user_id, org_id)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        jurisdiction=conv.jurisdiction,
        language=conv.language,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/conversations", response_model=List[ConversationOut], tags=["Conversations"])
def list_conversations(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    current_user: Optional[User] = Depends(get_current_user),
) -> List[ConversationOut]:
    """List conversations belonging to the caller and active organisation."""
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.CONVERSATION_READ)
    query = db.query(Conversation)
    if tenant and tenant.organisation_id:
        # Strict tenant scope: conversations for this active organisation
        query = query.filter(Conversation.organisation_id == tenant.organisation_id)
    elif current_user:
        # Logged-in: own conversations + legacy anonymous ones
        query = query.filter(
            (Conversation.user_id == current_user.id)
            | (Conversation.user_id.is_(None))
        )
    else:
        # Anonymous caller: only unowned conversations
        query = query.filter(Conversation.user_id.is_(None))

    conversations = (
        query
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for conv in conversations:
        msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        result.append(ConversationOut(
            id=conv.id,
            title=conv.title or f"Chat {conv.created_at.strftime('%b %d, %H:%M')}",
            jurisdiction=conv.jurisdiction,
            language=conv.language,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=msg_count,
        ))
    
    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail, tags=["Conversations"])
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    current_user: Optional[User] = Depends(get_current_user),
) -> ConversationDetail:
    """Get a conversation with all its messages (owner- and tenant-scoped)."""
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.CONVERSATION_READ)
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user, tenant)
    
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    
    msg_list = []
    for msg in messages:
        citations = None
        if msg.citations_json:
            try:
                citations = json.loads(msg.citations_json)
            except json.JSONDecodeError:
                citations = None
        
        msg_list.append(MessageOut(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            confidence=msg.confidence,
            citations=citations,
            latency_ms=msg.latency_ms,
            created_at=msg.created_at,
        ))
    
    return ConversationDetail(
        id=conv.id,
        title=conv.title or f"Chat {conv.created_at.strftime('%b %d, %H:%M')}",
        jurisdiction=conv.jurisdiction,
        language=conv.language,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(messages),
        messages=msg_list,
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut, tags=["Conversations"])
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    current_user: Optional[User] = Depends(get_current_user),
) -> ConversationOut:
    """Rename a conversation and/or toggle its pinned state (owner- and tenant-scoped)."""
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.CONVERSATION_UPDATE)
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user, tenant)

    if payload.title is not None:
        conv.title = payload.title.strip()[:255] or conv.title
    if payload.is_pinned is not None:
        conv.is_pinned = payload.is_pinned

    db.commit()
    db.refresh(conv)

    msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
    log.info("Updated conversation: %s", conversation_id)
    return ConversationOut(
        id=conv.id,
        title=conv.title or f"Chat {conv.created_at.strftime('%b %d, %H:%M')}",
        jurisdiction=conv.jurisdiction,
        language=conv.language,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=msg_count,
    )


@router.delete("/conversations/{conversation_id}", tags=["Conversations"])
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """Delete a conversation and all its messages (owner- and tenant-scoped)."""
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.CONVERSATION_DELETE)
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user, tenant)
    
    db.delete(conv)
    db.commit()
    
    log.info("Deleted conversation: %s", conversation_id)
    return {"status": "deleted", "id": conversation_id}


@router.post("/feedback", tags=["Feedback"])
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db)
) -> dict:
    """Submit feedback for a message response."""
    # Verify message exists
    msg = db.query(Message).filter(Message.id == payload.message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    feedback = Feedback(
        message_id=payload.message_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    
    log.info("Feedback recorded for message %d: %s", payload.message_id, payload.rating)
    return {"status": "recorded", "message_id": payload.message_id}


@router.get("/stats", response_model=StatsOut, tags=["Statistics"])
def get_stats(db: Session = Depends(get_db)) -> StatsOut:
    """Get system statistics for the dashboard."""
    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()
    total_sources = db.query(Source).count()
    
    # Average latency
    from sqlalchemy import func
    avg_latency = db.query(func.avg(Message.latency_ms)).filter(
        Message.latency_ms.isnot(None)
    ).scalar()
    
    # Confidence distribution
    confidence_counts = {}
    for conf in ["high", "moderate", "low"]:
        count = db.query(Message).filter(Message.confidence == conf).count()
        confidence_counts[conf] = count
    
    # Jurisdiction distribution
    jurisdiction_counts = {}
    for jur in ["India", "International"]:
        count = db.query(Conversation).filter(Conversation.jurisdiction == jur).count()
        jurisdiction_counts[jur] = count
    
    return StatsOut(
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_sources=total_sources,
        avg_latency_ms=round(avg_latency, 2) if avg_latency else None,
        confidence_distribution=confidence_counts,
        jurisdiction_distribution=jurisdiction_counts,
    )


@router.get("/sources", response_model=List[dict], tags=["Sources"])
def list_sources(db: Session = Depends(get_db)) -> List[dict]:
    """List all legal sources in the corpus."""
    sources = db.query(Source).order_by(Source.jurisdiction, Source.name).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "jurisdiction": s.jurisdiction,
            "source_type": s.source_type,
            "chunk_count": s.chunk_count,
            "description": s.description,
            "effective_date": s.effective_date.isoformat() if s.effective_date else None,
        }
        for s in sources
    ]
