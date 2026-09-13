"""
backend/app/models/database.py
-------------------------------
SQLAlchemy models for IP-SAKTI Sahayak persistent storage.

Tables:
- users: User accounts with secure password hashing
- conversations: Multi-turn chat sessions (linked to users)
- messages: Individual messages within conversations
- sources: Legal document sources in the corpus
- feedback: User feedback on responses (thumbs up/down)
- uploaded_documents: User-uploaded files for chat context
- matters: IP case/matter workspace for users
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
DATABASE_URL = "sqlite:///./ip_sakti.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite specific
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    """User account with secure authentication."""
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    role = Column(Enum("user", "admin", "expert", name="user_role"), default="user")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(20), nullable=True)
    preferences_json = Column(Text, nullable=True)  # JSON for UI preferences
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    matters = relationship("Matter", back_populates="user", cascade="all, delete-orphan")
    uploaded_documents = relationship("UploadedDocument", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """A multi-turn conversation session."""
    __tablename__ = "conversations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)  # Optional for anonymous
    title = Column(String(255), nullable=True)
    jurisdiction = Column(String(20), default="India")
    language = Column(String(10), default="en")
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Individual message in a conversation."""
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    role = Column(Enum("user", "assistant", name="message_role"), nullable=False)
    content = Column(Text, nullable=False)
    confidence = Column(String(20), nullable=True)  # high, moderate, low
    citations_json = Column(Text, nullable=True)  # JSON string of citations
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    conversation = relationship("Conversation", back_populates="messages")


class Source(Base):
    """Legal document sources in the corpus."""
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    jurisdiction = Column(String(20), nullable=False)  # India, International
    source_type = Column(String(50), nullable=False)  # statute, treaty, guideline
    file_path = Column(String(500), nullable=True)
    chunk_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    effective_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Feedback(Base):
    """User feedback on assistant responses."""
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    rating = Column(Enum("positive", "negative", name="feedback_rating"), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Matter(Base):
    """IP case/matter workspace - like Baby Shark's matter workspace."""
    __tablename__ = "matters"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    matter_type = Column(Enum("patent", "trademark", "copyright", "biodiversity", "trade_secret", name="matter_type"), nullable=False)
    status = Column(Enum("draft", "in_progress", "filed", "granted", "rejected", "abandoned", name="matter_status"), default="draft")
    description = Column(Text, nullable=True)
    jurisdiction = Column(String(20), default="India")
    priority_date = Column(DateTime, nullable=True)
    filing_date = Column(DateTime, nullable=True)
    application_number = Column(String(100), nullable=True)
    notes_json = Column(Text, nullable=True)  # JSON for checklist, deadlines, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="matters")
    documents = relationship("UploadedDocument", back_populates="matter", cascade="all, delete-orphan")


class UploadedDocument(Base):
    """User-uploaded documents for chat context and matter workspace."""
    __tablename__ = "uploaded_documents"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    matter_id = Column(String(36), ForeignKey("matters.id"), nullable=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt, image
    file_size = Column(Integer, nullable=False)  # bytes
    storage_path = Column(String(500), nullable=False)
    chunk_count = Column(Integer, default=0)  # If processed for RAG
    is_processed = Column(Boolean, default=False)
    processing_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    metadata_json = Column(Text, nullable=True)  # Extracted metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="uploaded_documents")
    matter = relationship("Matter", back_populates="documents")


# ---------------------------------------------------------------------------
# Initialize database
# ---------------------------------------------------------------------------
def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


# Auto-initialize on import
init_db()
