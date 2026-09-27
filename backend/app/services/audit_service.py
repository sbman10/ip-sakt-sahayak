"""
backend/app/services/audit_service.py
-------------------------------------
Database Audit & Metrics Logging Service for IP-SAKTI Sahayak.
Persists query telemetry, DPDP-compliant scrubbed representations,
composite confidence metrics, and response latencies to PostgreSQL (Supabase).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional

try:
    from backend.app.models.db import AuditLog
    from backend.app.models.database import SessionLocal, engine
    from backend.app.core.async_utils import run_in_threadpool
except ImportError:
    from app.models.db import AuditLog
    from app.models.database import SessionLocal, engine
    from app.core.async_utils import run_in_threadpool

log = logging.getLogger("app.services.audit_service")

# Ensure table exists on first module load
try:
    AuditLog.metadata.create_all(bind=engine)
except Exception as _init_err:
    log.debug("AuditLog table init note: %s", _init_err)


def _sync_insert_audit(
    raw_query: str,
    scrubbed_query: str,
    jurisdiction: str,
    language: str,
    confidence_score: int,
    latency_ms: float,
    user_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
    session: Optional[Any] = None,
) -> None:
    """Synchronously inserts an audit log record inside a dedicated session."""
    owns_session = False
    db = session
    if db is None:
        db = SessionLocal()
        owns_session = True

    try:
        record = AuditLog(
            query_raw=raw_query,
            query_scrubbed=scrubbed_query,
            jurisdiction=jurisdiction,
            language=language,
            confidence_score=int(confidence_score),
            latency_ms=float(latency_ms),
            user_id=user_id,
            organisation_id=organisation_id,
            timestamp=datetime.utcnow(),
        )
        db.add(record)
        db.commit()
        log.info(
            "Audit transaction logged successfully (ID: %s, confidence: %d, latency: %.1fms, user: %s, org: %s)",
            getattr(record, "id", "new"),
            confidence_score,
            latency_ms,
            user_id,
            organisation_id,
        )
    except Exception as e:
        log.error("Failed to commit audit log transaction: %s", e, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        if owns_session:
            try:
                db.close()
            except Exception:
                pass


async def async_log_audit_transaction(
    db_session: Any,
    raw_query: str,
    scrubbed_query: str,
    jurisdiction: str,
    language: str,
    confidence_score: int,
    latency_ms: float,
    user_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
) -> None:
    """
    Asynchronously persists query telemetry and composite confidence metrics
    without blocking the caller or raising exceptions on failure.

    Parameters
    ----------
    db_session : Any
        Active SQLAlchemy session or None (a fresh session will be allocated).
    raw_query : str
        Original prompt entered by user.
    scrubbed_query : str
        PII-scrubbed prompt according to DPDP standards.
    jurisdiction : str
        Legal jurisdiction context ('India' or 'International').
    language : str
        Response language code ('EN', 'HI', etc.).
    confidence_score : int
        Composite confidence score (0-100).
    latency_ms : float
        End-to-end turn processing latency in milliseconds.
    user_id : Optional[str]
        Authenticated user ID if available.
    organisation_id : Optional[str]
        Authenticated organisation ID for tenant-scoped telemetry.
    """
    try:
        # If db_session is an active Session, use fresh SessionLocal in worker thread
        # to ensure safe thread isolation.
        await run_in_threadpool(
            _sync_insert_audit,
            raw_query=raw_query,
            scrubbed_query=scrubbed_query,
            jurisdiction=jurisdiction,
            language=language,
            confidence_score=confidence_score,
            latency_ms=latency_ms,
            user_id=user_id,
            organisation_id=organisation_id,
            session=None,
        )
    except Exception as e:
        log.warning("Non-critical error in async_log_audit_transaction: %s", e)


def log_admin_action(
    action: str,
    actor_user_id: str,
    organisation_id: str,
    details: str,
    db: Optional[Any] = None,
) -> None:
    """
    Synchronously records an administrative action (e.g., member add, role update, deletion)
    in the audit_logs table for Phase 5 security and compliance auditing.
    """
    owns_session = False
    session = db
    if session is None:
        session = SessionLocal()
        owns_session = True

    try:
        record = AuditLog(
            query_raw=f"ADMIN_ACTION: {action} | {details}",
            query_scrubbed=f"ADMIN_ACTION: {action}",
            jurisdiction="Administrative",
            language="en",
            confidence_score=100,
            latency_ms=0.0,
            user_id=actor_user_id,
            organisation_id=organisation_id,
            timestamp=datetime.utcnow(),
        )
        session.add(record)
        session.commit()
        log.info(
            "Admin audit recorded: [%s] by user %s in org %s (%s)",
            action,
            actor_user_id,
            organisation_id,
            details,
        )
    except Exception as e:
        log.error("Failed to commit admin audit log: %s", e, exc_info=True)
        try:
            session.rollback()
        except Exception:
            pass
    finally:
        if owns_session:
            try:
                session.close()
            except Exception:
                pass

