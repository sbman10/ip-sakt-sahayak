"""
backend/tests/conftest.py
-------------------------
Pytest configuration hooks and session fixtures for test isolation.
Runs BEFORE any test modules are collected or imported to ensure:
- ChromaDB is cloned into an isolated temporary directory.
- SQLite database is cloned into an isolated temporary database.
- Production/development files (chroma_db, ip_sakti.db, bm25_index.pkl) are NEVER modified by test runs.
"""

import os
import shutil
import tempfile
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
_ISOLATION_CONTEXT = {}


def pytest_configure(config):
    """
    Hook called before any test files are loaded or imported.
    Sets environment variables and prepares isolated directories before
    singletons (like settings, database engines, or vector stores) initialize.
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="ip_sakti_test_"))
    temp_chroma_dir = temp_dir / "chroma_db"
    temp_sqlite_path = temp_dir / "ip_sakti_test.db"
    test_db_url = f"sqlite:///{temp_sqlite_path}"
    
    # 1. Copy real ChromaDB if present
    real_chroma_dir = BACKEND_DIR / "chroma_db"
    if real_chroma_dir.exists():
        shutil.copytree(str(real_chroma_dir), str(temp_chroma_dir))
    else:
        temp_chroma_dir.mkdir(parents=True, exist_ok=True)
        
    # 2. Copy real SQLite DB if present
    real_sqlite_path = BACKEND_DIR / "ip_sakti.db"
    if real_sqlite_path.exists():
        shutil.copy2(str(real_sqlite_path), str(temp_sqlite_path))

    # 3. Export environment variables before settings/modules are imported
    os.environ["CHROMA_DB_DIR"] = str(temp_chroma_dir)
    os.environ["DATABASE_URL"] = test_db_url

    _ISOLATION_CONTEXT["temp_dir"] = temp_dir
    _ISOLATION_CONTEXT["chroma_dir"] = temp_chroma_dir
    _ISOLATION_CONTEXT["sqlite_path"] = temp_sqlite_path
    _ISOLATION_CONTEXT["test_db_url"] = test_db_url


def pytest_unconfigure(config):
    """Clean up temporary test artifacts upon pytest completion."""
    temp_dir = _ISOLATION_CONTEXT.get("temp_dir")
    if temp_dir and temp_dir.exists():
        shutil.rmtree(str(temp_dir), ignore_errors=True)


@pytest.fixture(scope="session", autouse=True)
def apply_runtime_test_patches():
    """
    Session fixture ensuring any lazily imported or dynamically referenced
    database engines, sessionmakers, and vector stores target the isolated test environment.
    """
    test_db_url = _ISOLATION_CONTEXT.get("test_db_url")
    temp_chroma_dir = _ISOLATION_CONTEXT.get("chroma_dir")

    test_engine = create_engine(
        test_db_url,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Patch settings
    from app.core.config import settings
    settings.CHROMA_DB_DIR = str(temp_chroma_dir)
    settings.DATABASE_URL = test_db_url

    # Patch database engines and sessionmakers
    import app.models.database as app_database
    import app.services.audit_service as audit_service

    app_database.engine = test_engine
    app_database.SessionLocal = TestSessionLocal
    app_database.DATABASE_URL = test_db_url

    audit_service.engine = test_engine
    audit_service.SessionLocal = TestSessionLocal

    # Patch documents router if already loaded
    try:
        import app.routers.documents as docs_router
        docs_router.CHROMA_DB_PATH = str(temp_chroma_dir)
        docs_router._chroma_client = None
    except Exception:
        pass

    # Patch unified vector store if loaded
    try:
        from app.services.patentability.vector_store import unified_vector_store
        unified_vector_store.chroma_path = str(temp_chroma_dir)
    except Exception:
        pass

    yield _ISOLATION_CONTEXT
