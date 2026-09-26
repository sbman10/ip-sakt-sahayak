"""
backend/app/models/db.py
------------------------
Compatibility re-export layer for IP-SAKTI Sahayak.
Consolidated onto the authoritative SQLAlchemy Base and models defined in
app.models.database to resolve the duplicate Base/model discrepancy while
maintaining 100% backwards compatibility for existing imports.
"""

from __future__ import annotations

from app.models.database import (
    AuditLog,
    Base,
    Conversation,
    DocumentRecord,
    Feedback,
    Matter,
    MatterEvent,
    MatterWorkspace,
    Message,
    PatentabilityAssessmentRecord,
    SessionLocal,
    Source,
    UploadedDocument,
    User,
    engine,
    get_db,
    init_db,
)

__all__ = [
    "Base",
    "User",
    "Conversation",
    "Message",
    "AuditLog",
    "DocumentRecord",
    "Matter",
    "MatterWorkspace",
    "MatterEvent",
    "UploadedDocument",
    "PatentabilityAssessmentRecord",
    "Source",
    "Feedback",
    "engine",
    "SessionLocal",
    "get_db",
    "init_db",
]
