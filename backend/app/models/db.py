"""
backend/app/models/db.py
------------------------
SQLAlchemy ORM models for IP-SAKTI Sahayak supporting SQLite (local dev)
and PostgreSQL (production environments).

Entities:
- User: Authentication, credentials, and profile
- Conversation: Multi-turn chat session metadata
- Message: Discrete query and grounded response turns
- AuditLog: Immutable compliance and query audit ledger
- DocumentRecord: Ingested corpus document tracking and checksums
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    """Registered user entity with credentials and status."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """Multi-turn conversation thread."""
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    jurisdiction = Column(String(50), default="India", nullable=False)
    title = Column(String(255), default="New Chat", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Individual dialogue turn (user prompt or bot response)."""
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    sender = Column(String(10), nullable=False)  # "user" or "bot"
    raw_query = Column(Text, nullable=True)
    scrubbed_query = Column(Text, nullable=True)
    answer = Column(Text, nullable=True)
    confidence_score = Column(Integer, nullable=True)
    confidence_label = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class AuditLog(Base):
    """Immutable audit record for DPDP Act compliance and system telemetry."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query_raw = Column(Text, nullable=True)
    query_scrubbed = Column(Text, nullable=True)
    jurisdiction = Column(String(50), nullable=True)
    language = Column(String(10), nullable=True)
    confidence_score = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentRecord(Base):
    """Metadata registry for ingested knowledge corpus documents."""
    __tablename__ = "document_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    checksum = Column(String(64), unique=True, nullable=False, index=True)
    chunk_count = Column(Integer, default=0, nullable=False)
    collection_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
