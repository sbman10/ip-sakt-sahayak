"""
backend/tests/conftest.py
-------------------------
Pytest configuration hooks and session fixtures for test isolation.
Runs BEFORE any test modules are collected or imported to ensure:
- An isolated ephemeral SQLite database is created in a temporary directory for unit testing.
- Singletons and settings target this isolated test environment.
- Production and development databases are never modified by test runs.
"""

import os
import shutil
import sys
import tempfile
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_ISOLATION_CONTEXT = {}


def pytest_configure(config):
    """
    Hook called before any test files are loaded or imported.
    Sets environment variables and prepares isolated directories before
    singletons (like settings, database engines, or vector stores) initialize.
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="ip_sakti_test_"))
    temp_sqlite_path = temp_dir / "ip_sakti_test.db"
    test_db_url = f"sqlite:///{temp_sqlite_path}"

    # Export environment variables before settings/modules are imported
    os.environ["DATABASE_URL"] = test_db_url
    os.environ["RETRIEVAL_BACKEND"] = "qdrant_hybrid"
    os.environ["ENABLE_LOCAL_BGE_PRELOAD"] = "false"
    os.environ["ENABLE_CROSS_ENCODER"] = "false"

    from app.core.config import settings
    settings.DATABASE_URL = test_db_url
    settings.RETRIEVAL_BACKEND = "qdrant_hybrid"
    settings.ENABLE_LOCAL_BGE_PRELOAD = False
    settings.ENABLE_CROSS_ENCODER = False

    test_engine = create_engine(
        test_db_url,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    import app.models.database as app_database
    import app.services.audit_service as audit_service

    app_database.engine = test_engine
    app_database.SessionLocal = TestSessionLocal
    app_database.DATABASE_URL = test_db_url

    audit_service.engine = test_engine
    audit_service.SessionLocal = TestSessionLocal

    try:
        from unittest.mock import MagicMock
        from app.services.qdrant_service import qdrant_service
        from app.core.models import model_registry
        qdrant_service.ensure_collections = MagicMock(return_value={
            "india_statutes": "exists",
            "international_treaties": "exists",
            "user_uploads": "exists",
        })
        model_registry.load_models = MagicMock(return_value=None)
    except Exception:
        pass

    app_database.init_db(test_engine)

    _ISOLATION_CONTEXT["temp_dir"] = temp_dir
    _ISOLATION_CONTEXT["sqlite_path"] = temp_sqlite_path
    _ISOLATION_CONTEXT["test_db_url"] = test_db_url
    _ISOLATION_CONTEXT["test_engine"] = test_engine
    _ISOLATION_CONTEXT["TestSessionLocal"] = TestSessionLocal


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
    test_engine = _ISOLATION_CONTEXT.get("test_engine")
    TestSessionLocal = _ISOLATION_CONTEXT.get("TestSessionLocal")

    from app.core.config import settings
    settings.DATABASE_URL = test_db_url

    import app.models.database as app_database
    import app.services.audit_service as audit_service

    app_database.engine = test_engine
    app_database.SessionLocal = TestSessionLocal
    app_database.DATABASE_URL = test_db_url

    audit_service.engine = test_engine
    audit_service.SessionLocal = TestSessionLocal

    yield _ISOLATION_CONTEXT
