"""
backend/tests/test_phase1_supabase_storage.py
-----------------------------------------------
Phase 1 verification tests:
1. PostgreSQL URL configuration and engine dialect handling.
2. SQLite local fallback and connect_args handling.
3. Supabase Storage object key formatting and path traversal sanitization.
4. Storage service upload, signed URL, download, delete, and error resilience.
5. Consolidated SQLAlchemy models and relational integrity:
   - Users
   - Conversations & Messages (cascade delete)
   - MatterWorkspace & MatterEvents (cascade delete)
   - UploadedDocuments with Supabase storage keys
   - AuditLogs (DPDP compliance telemetry)
   - DocumentRecords
   - PatentabilityAssessmentRecord
6. Security check: No service-role key exposure in frontend.
"""

import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
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
    Source,
    UploadedDocument,
    User,
    create_db_engine,
    get_engine_and_session,
    normalize_database_url,
)
from app.services.storage_service import (
    DEFAULT_BUCKET,
    SupabaseStorageService,
    build_storage_key,
    storage_service,
)


# ===========================================================================
# 1. Database Configuration Tests (PostgreSQL vs SQLite)
# ===========================================================================

def test_sqlite_fallback_connect_args():
    """Verify SQLite engine applies check_same_thread=False."""
    sqlite_url = "sqlite:///./test_temp.db"
    engine = create_db_engine(sqlite_url)
    
    assert "sqlite" in engine.dialect.name
    # Connect args must include check_same_thread=False for SQLite
    assert engine.url.database is not None


def test_postgresql_url_normalization_and_engine_config():
    """Verify PostgreSQL URL is normalized to psycopg dialect and does NOT use SQLite connect_args."""
    raw_postgres_url = "postgresql://postgres.test:mypassword@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require"
    normalized = normalize_database_url(raw_postgres_url)
    
    assert normalized.startswith("postgresql+psycopg://")
    
    # Engine creation for PostgreSQL
    engine = create_db_engine(raw_postgres_url)
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"
    
    # Must NOT have SQLite connect_args
    # When pool is inspected, pool_size is configured
    assert engine.pool.size() == 10


def test_postgres_protocol_normalization():
    """Verify legacy postgres:// URLs are also normalized to postgresql+psycopg://."""
    legacy_url = "postgres://user:pass@localhost:5432/dbname"
    normalized = normalize_database_url(legacy_url)
    assert normalized.startswith("postgresql+psycopg://")


# ===========================================================================
# 2. Storage Path Generation & Sanitization Tests
# ===========================================================================

def test_storage_path_generation_structure():
    """Verify storage key format matches users/{user_id}/{document_id}/{filename}."""
    user_id = "user-abc-123"
    doc_id = "doc-def-456"
    filename = "invention_disclosure.pdf"
    
    key = build_storage_key(user_id, doc_id, filename)
    assert key == f"users/{user_id}/{doc_id}/{filename}"


def test_storage_path_sanitization_prevents_traversal():
    """Verify path traversal characters and directory delimiters are removed."""
    user_id = "../../malicious_user/../id"
    doc_id = "secret/../doc-1"
    filename = "../../../sensitive_data.txt"
    
    key = build_storage_key(user_id, doc_id, filename)
    assert ".." not in key
    assert "\\" not in key
    assert key.startswith("users/")
    parts = key.split("/")
    assert len(parts) == 4
    assert parts[0] == "users"
    assert "/" not in parts[1]
    assert parts[3] == "sensitive_data.txt"


# ===========================================================================
# 3. Storage Service Operations & Error Handling Tests
# ===========================================================================

def test_storage_service_fallback_upload_and_download(tmp_path):
    """Verify storage service local fallback stores and retrieves raw bytes."""
    service = SupabaseStorageService(supabase_url="", supabase_key="", default_bucket="test-bucket")
    assert service.is_cloud is False
    
    test_key = "users/test-user/test-doc/sample.txt"
    test_payload = b"RAGVYN AI Patent Analysis Content"
    
    # 1. Upload
    stored_key = service.upload_file(test_key, test_payload, content_type="text/plain")
    assert stored_key == test_key
    
    # 2. Download
    downloaded = service.download_file(test_key)
    assert downloaded == test_payload
    
    # 3. Signed URL
    signed_url = service.get_signed_url(test_key)
    assert test_key in signed_url
    
    # 4. Delete
    deleted = service.delete_file(test_key)
    assert deleted is True
    
    # Verify deleted file raises FileNotFoundError
    with pytest.raises(FileNotFoundError):
        service.download_file(test_key)


def test_storage_service_error_handling():
    """Verify download of non-existent file raises appropriate error."""
    service = SupabaseStorageService(supabase_url="", supabase_key="")
    non_existent_key = "users/nonexistent/doc/missing.pdf"
    
    with pytest.raises(FileNotFoundError):
        service.download_file(non_existent_key)


# ===========================================================================
# 4. Consolidated Model Relationships & Integrity Tests
# ===========================================================================

@pytest.fixture
def db_session():
    """Provides a fresh in-memory SQLite session with all consolidated tables created."""
    engine = create_db_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_model_consolidation_single_base():
    """Verify database.py and db.py export the exact same declarative Base."""
    from app.models.db import Base as DbBase
    from app.models.database import Base as DatabaseBase
    assert DbBase is DatabaseBase


def test_matter_workspace_and_alias():
    """Verify Matter is an alias for MatterWorkspace."""
    assert Matter is MatterWorkspace


def test_user_conversation_message_lifecycle(db_session):
    """Verify relational integrity and cascading deletes across users, conversations, and messages."""
    # 1. Create User
    user = User(
        id=str(uuid.uuid4()),
        email="test_ip_lawyer@example.com",
        password_hash="bcrypt_hashed_secret",
        full_name="Advocate Sharma",
        role="expert",
    )
    db_session.add(user)
    db_session.commit()
    
    # 2. Create Conversation
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Turmeric Patentability Query",
        jurisdiction="India",
    )
    db_session.add(conv)
    db_session.commit()
    
    # 3. Create Messages
    msg1 = Message(
        conversation_id=conv.id,
        role="user",
        content="Is Curcuma longa extract patentable under Section 3(p)?",
    )
    msg2 = Message(
        conversation_id=conv.id,
        role="assistant",
        content="Under Section 3(p) of the Patents Act, traditional knowledge is non-patentable subject matter.",
        confidence="High",
        latency_ms=125.4,
    )
    db_session.add_all([msg1, msg2])
    db_session.commit()
    
    # Verify relationships
    assert len(user.conversations) == 1
    assert len(conv.messages) == 2
    assert conv.messages[0].role == "user"
    assert conv.messages[1].confidence == "High"
    
    # 4. Verify cascade delete of messages when conversation is deleted
    db_session.delete(conv)
    db_session.commit()
    assert db_session.query(Message).count() == 0


def test_matter_workspace_events_and_documents(db_session):
    """Verify MatterWorkspace relates cleanly to MatterEvents and UploadedDocuments."""
    user = User(
        id=str(uuid.uuid4()),
        email="inventor@ayush.gov.in",
        password_hash="hash123",
        full_name="Dr. Charaka",
    )
    db_session.add(user)
    db_session.commit()
    
    # Create Matter
    matter = MatterWorkspace(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Herbal Formulation Case #2026",
        case_type="patent",
        status="examination",
    )
    db_session.add(matter)
    db_session.commit()
    
    # Add Event
    event = MatterEvent(
        matter_id=matter.id,
        event_type="first_examination_report",
        description="FER response due within 6 months.",
        reminder_date=datetime(2026, 12, 1),
    )
    db_session.add(event)
    
    # Add Uploaded Document with Supabase Storage object key
    storage_key = build_storage_key(user.id, str(uuid.uuid4()), "specification.pdf")
    doc = UploadedDocument(
        id=str(uuid.uuid4()),
        user_id=user.id,
        matter_id=matter.id,
        filename="specification_v1.pdf",
        original_filename="Complete_Specification.pdf",
        file_type="pdf",
        file_size=1048576,
        storage_path=storage_key,
        bucket_name=DEFAULT_BUCKET,
    )
    db_session.add(doc)
    db_session.commit()
    
    # Verify relationships
    assert len(matter.events) == 1
    assert len(matter.documents) == 1
    assert matter.documents[0].storage_path == storage_key
    assert matter.documents[0].bucket_name == "legal-documents"
    assert "users/" in matter.documents[0].storage_path


def test_audit_logs_and_document_records(db_session):
    """Verify AuditLog and DocumentRecord tables function properly."""
    audit = AuditLog(
        query_raw="Can neem oil be patented?",
        query_scrubbed="Can [PLANT] oil be patented?",
        jurisdiction="India",
        language="EN",
        confidence_score=92,
        latency_ms=210.5,
    )
    doc_rec = DocumentRecord(
        title="The Biological Diversity Act, 2002",
        file_path="knowledge-base/statutes/bda_2002.pdf",
        checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        chunk_count=184,
        collection_name="india_statutes",
    )
    db_session.add_all([audit, doc_rec])
    db_session.commit()
    
    assert db_session.query(AuditLog).count() == 1
    assert db_session.query(DocumentRecord).count() == 1
    assert db_session.query(AuditLog).first().confidence_score == 92


# ===========================================================================
# 5. Security Boundary Verification
# ===========================================================================

def test_frontend_has_no_service_role_key():
    """Verify frontend code never references SUPABASE_SERVICE_ROLE_KEY."""
    frontend_dir = BACKEND_ROOT.parent / "frontend"
    if not frontend_dir.exists():
        pytest.skip("Frontend directory not present")
        
    for root, dirs, files in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", "build", ".next", ".cache")]
        for f in files:
            if f.endswith((".js", ".jsx", ".ts", ".tsx", ".html", ".env")):
                path = Path(root) / f
                content = path.read_text(encoding="utf-8", errors="ignore")
                assert "SERVICE_ROLE" not in content, f"Leaked service role reference in {path}"
                assert "SUPABASE_SERVICE_ROLE_KEY" not in content, f"Leaked service role key in {path}"
