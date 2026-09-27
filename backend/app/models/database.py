"""
backend/app/models/database.py
-------------------------------
Authoritative consolidated SQLAlchemy models for IP-SAKTI Sahayak persistent storage.
Supports PostgreSQL (Supabase production) and isolated test engines.

Entities:
- User: Authentication, credentials, and profile (UUID PK)
- Conversation: Multi-turn chat session metadata
- Message: Discrete query and grounded response turns
- MatterWorkspace: IP case/matter workspace for users
- MatterEvent: Timeline events and reminders for matters
- UploadedDocument: User-uploaded files with Supabase Storage object keys
- AuditLog: Immutable DPDP compliance and query telemetry ledger
- DocumentRecord: Ingested corpus document tracking and checksums
- PatentabilityAssessmentRecord: Structured prior-art & Section 3/6 assessment reports
- Source: Legal document sources in the statutory corpus
- Feedback: User feedback on responses (thumbs up/down)
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

from app.core.config import settings

# ---------------------------------------------------------------------------
# Database Engine Setup (Supabase PostgreSQL / Test Runner Engine)
# ---------------------------------------------------------------------------

def normalize_database_url(url: str) -> str:
    """Normalize connection string to use psycopg driver when targeting PostgreSQL."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def create_db_engine(db_url: str):
    """
    Creates an appropriate SQLAlchemy engine for PostgreSQL (production) or test runner.
    Removes SQLite-specific connect_args when connecting to PostgreSQL.
    """
    normalized_url = normalize_database_url(db_url)

    if normalized_url.startswith("sqlite"):
        return create_engine(
            normalized_url,
            connect_args={"check_same_thread": False},
            echo=False,
        )
    else:
        # PostgreSQL / Supabase configuration
        return create_engine(
            normalized_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            echo=False,
        )


def get_engine_and_session(database_url: Optional[str] = None):
    """Factory creating engine and sessionmaker bound to specified or configured URL."""
    url = database_url or settings.DATABASE_URL
    eng = create_db_engine(url)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    return eng, session_factory


engine, SessionLocal = get_engine_and_session()
Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Authoritative Models Set
# ---------------------------------------------------------------------------

class User(Base):
    """User account with secure authentication (UUID primary key)."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True, default="")
    full_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    role = Column(String(50), default="user")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(20), nullable=True)
    preferences_json = Column(Text, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    matters = relationship("MatterWorkspace", back_populates="user", cascade="all, delete-orphan")
    uploaded_documents = relationship("UploadedDocument", back_populates="user", cascade="all, delete-orphan")
    # ADDED: Phase 3 Identity & Multi-tenant relationships
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    created_organisations = relationship("Organisation", back_populates="creator", cascade="all, delete-orphan")
    organisation_memberships = relationship("OrganisationMember", back_populates="user", cascade="all, delete-orphan")


# ADDED: Phase 3 Models (Profile, Organisation, OrganisationMember)

class Profile(Base):
    """
    User profile metadata linked 1:1 to auth user.
    """
    __tablename__ = "profiles"

    id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    preferred_language = Column(String(20), nullable=True, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="profile")

    @property
    def email(self) -> str:
        """Convenience property for Pydantic serialization."""
        return self.user.email if self.user else ""


class Organisation(Base):
    """
    Multi-tenant organisation entity.
    """
    __tablename__ = "organisations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="created_organisations")
    members = relationship("OrganisationMember", back_populates="organisation", cascade="all, delete-orphan")


class OrganisationMember(Base):
    """
    Membership association between users and organisations with strict RBAC roles.
    Allowed roles: 'user', 'organisation_admin', 'reviewer', 'super_admin'
    """
    __tablename__ = "organisation_members"

    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(50), nullable=False, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organisation = relationship("Organisation", back_populates="members")
    user = relationship("User", back_populates="organisation_memberships")

    @property
    def email(self) -> Optional[str]:
        """Convenience property for Pydantic serialization."""
        return self.user.email if self.user else None

    @property
    def full_name(self) -> Optional[str]:
        """Convenience property for Pydantic serialization."""
        if self.user:
            return self.user.full_name or (self.user.profile.full_name if self.user.profile else None)
        return None



class Conversation(Base):
    """A multi-turn conversation session scoped by user and organisation."""
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    jurisdiction = Column(String(50), default="India")
    language = Column(String(10), default="en")
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="conversations")
    organisation = relationship("Organisation")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Individual message turn in a conversation."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    confidence = Column(String(20), nullable=True)
    citations_json = Column(Text, nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    conversation = relationship("Conversation", back_populates="messages")


class MatterWorkspace(Base):
    """A single IP case tracked in the Matter Workspace scoped by user and organisation."""
    __tablename__ = "matter_workspace"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    case_type = Column(String(50), nullable=False)
    application_number = Column(String(100), nullable=True)
    filing_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="draft", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="matters")
    organisation = relationship("Organisation")
    events = relationship(
        "MatterEvent",
        back_populates="matter_workspace",
        cascade="all, delete-orphan",
        order_by="MatterEvent.event_date",
    )
    documents = relationship("UploadedDocument", back_populates="matter", cascade="all, delete-orphan")


# Backward compatibility alias
Matter = MatterWorkspace


class MatterEvent(Base):
    """A timeline event or reminder attached to a matter."""
    __tablename__ = "matter_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    matter_id = Column(
        String(36),
        ForeignKey("matter_workspace.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(50), nullable=False)
    event_date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    reminder_date = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    matter_workspace = relationship("MatterWorkspace", back_populates="events")


class UploadedDocument(Base):
    """User-uploaded documents scoped by user and organisation."""
    __tablename__ = "uploaded_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True)
    matter_id = Column(String(36), ForeignKey("matter_workspace.id"), nullable=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)  # organisations/{org_id}/users/{user_id}/documents/{doc_id}/{filename}
    bucket_name = Column(String(100), default="legal-documents", nullable=False)
    chunk_count = Column(Integer, default=0)
    is_processed = Column(Boolean, default=False)
    processing_status = Column(String(50), default="pending")
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="uploaded_documents")
    organisation = relationship("Organisation")
    matter = relationship("MatterWorkspace", back_populates="documents")


class AuditLog(Base):
    """Immutable audit record for DPDP Act compliance and system telemetry."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="SET NULL"), nullable=True, index=True)
    query_raw = Column(Text, nullable=True)
    query_scrubbed = Column(Text, nullable=True)
    jurisdiction = Column(String(50), nullable=True)
    language = Column(String(10), nullable=True)
    confidence_score = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User")
    organisation = relationship("Organisation")


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


class PatentabilityAssessmentRecord(Base):
    """Persistent storage for patentability assessments scoped by tenant."""
    __tablename__ = "patentability_assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True)
    matter_id = Column(String(36), ForeignKey("matter_workspace.id"), nullable=True)
    title = Column(String(255), nullable=False)
    jurisdiction = Column(String(50), default="India")
    status = Column(String(50), default="completed")
    result_category = Column(String(100), nullable=False)
    request_json = Column(Text, nullable=False)
    report_json = Column(Text, nullable=False)
    markdown_report = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")
    organisation = relationship("Organisation")
    matter = relationship("MatterWorkspace")


class Source(Base):
    """Legal document sources in the corpus."""
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    jurisdiction = Column(String(50), nullable=False)
    source_type = Column(String(50), nullable=False)
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
    rating = Column(String(20), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------

def init_db(engine_override=None):
    """Create all tables if they don't exist, and ensure schema columns are synchronized."""
    target_engine = engine_override or engine
    Base.metadata.create_all(bind=target_engine)

    # Test runner fallback: ensure added columns exist on pre-existing tables if using local test engine
    if str(target_engine.url).startswith("sqlite"):
        with target_engine.connect() as conn:
            try:
                cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(uploaded_documents)").fetchall()]
                if cols and "bucket_name" not in cols:
                    conn.exec_driver_sql("ALTER TABLE uploaded_documents ADD COLUMN bucket_name VARCHAR(100) DEFAULT 'legal-documents'")
                    conn.commit()
            except Exception:
                pass


# Auto-initialize on import only if local test engine (avoids remote Supabase latency during imports)
try:
    if "sqlite" in str(engine.url):
        init_db()
except Exception:
    pass
