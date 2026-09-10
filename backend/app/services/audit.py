"""
backend/app/services/audit.py
------------------------------
Immutable DPDP-compliant audit logging engine for IP-SAKTI Sahayak.

Responsibilities
----------------
- Initialise (or connect to) a local SQLite database at
  ``backend/audit.db``.
- Ensure the ``conversations`` table exists with the correct schema on every
  startup — idempotent via CREATE TABLE IF NOT EXISTS.
- Expose a single public function ``log_transaction`` that safely inserts
  one audit row using parameterised queries (no string interpolation,
  immune to SQL-injection by construction).

Schema
------
conversations
  id               INTEGER PRIMARY KEY AUTOINCREMENT
  timestamp        TEXT    NOT NULL  (ISO-8601 UTC, auto-populated)
  query_raw        TEXT    NOT NULL  (original user query, for compliance record)
  query_scrubbed   TEXT    NOT NULL  (PII-masked version sent to Gemini)
  jurisdiction     TEXT    NOT NULL  ("India" | "International")
  language         TEXT    NOT NULL  (ISO 639-1 code, e.g. "EN")
  confidence_score TEXT    NOT NULL  ("high" | "moderate" | "low")
  latency_ms       REAL    NOT NULL  (wall-clock round-trip time in milliseconds)

Design notes
------------
- The database file lives at ``backend/audit.db`` relative to the workspace
  root, regardless of which directory the server is launched from.
- All writes use sqlite3's built-in parameterised queries to prevent injection.
- ``log_transaction`` never raises to the caller; errors are logged and
  silently swallowed so that an audit failure never breaks the user-facing API.
- Thread safety: sqlite3 in Python uses WAL mode by default for multi-thread
  safety; we additionally set ``check_same_thread=False`` and use a module-
  level connection initialised once so repeated calls are cheap.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database path — resolved relative to THIS file so it always lands inside
# the ``backend/`` directory even when the server is launched from project root.
# ---------------------------------------------------------------------------
#   __file__  = backend/app/services/audit.py
#   .parent   = backend/app/services/
#   .parent   = backend/app/
#   .parent   = backend/
_DB_PATH: Path = Path(__file__).parent.parent.parent / "audit.db"

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------
_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS conversations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        TEXT    NOT NULL,
    query_raw        TEXT    NOT NULL,
    query_scrubbed   TEXT    NOT NULL,
    jurisdiction     TEXT    NOT NULL,
    language         TEXT    NOT NULL,
    confidence_score TEXT    NOT NULL,
    latency_ms       REAL    NOT NULL
);
"""

_INSERT_SQL = """
INSERT INTO conversations
    (timestamp, query_raw, query_scrubbed, jurisdiction, language,
     confidence_score, latency_ms)
VALUES
    (?, ?, ?, ?, ?, ?, ?);
"""


# ---------------------------------------------------------------------------
# Module-level connection (initialised once on first import)
# ---------------------------------------------------------------------------
_connection: sqlite3.Connection | None = None


def _get_connection() -> sqlite3.Connection:
    """
    Return (or lazily initialise) the SQLite connection.

    Creates the ``audit.db`` file and the ``conversations`` table if they
    do not already exist.  Uses WAL journal mode for improved concurrent-
    read performance and sets a 5-second busy timeout so transient locks
    (from multiple FastAPI worker threads) resolve gracefully.
    """
    global _connection
    if _connection is not None:
        return _connection

    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    log.info("Initialising audit database at: %s", _DB_PATH)

    conn = sqlite3.connect(
        str(_DB_PATH),
        check_same_thread=False,   # FastAPI may call from multiple threads
        timeout=5.0,               # wait up to 5 s on a locked database
    )
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute(_CREATE_TABLE_SQL)
    conn.commit()

    _connection = conn
    log.info("Audit database ready (table: conversations).")
    return _connection


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def log_transaction(
    query_raw: str,
    query_scrubbed: str,
    jurisdiction: str,
    language: str,
    confidence_score: str,
    latency_ms: float,
) -> None:
    """
    Append one immutable audit row to the ``conversations`` table.

    This function is designed to be called asynchronously (e.g. via
    ``asyncio.to_thread``) from the chat router so it does not block
    the event loop.  It must never raise — failures are logged and swallowed.

    Parameters
    ----------
    query_raw:
        The original, unmodified user query as received from the HTTP request.
        Stored for DPDP compliance audit trail.
    query_scrubbed:
        The PII-masked version of the query that was actually forwarded to
        Gemini.  Stored to demonstrate that DPDP controls were applied.
    jurisdiction:
        The jurisdiction toggle value from the request: "India" or
        "International".
    language:
        ISO 639-1 language code (e.g. "EN", "HI").
    confidence_score:
        The confidence label computed by the pipeline: "high", "moderate",
        or "low".
    latency_ms:
        End-to-end wall-clock latency in milliseconds from request receipt
        to response serialisation.
    """
    timestamp = datetime.now(tz=timezone.utc).isoformat()
    try:
        conn = _get_connection()
        conn.execute(
            _INSERT_SQL,
            (
                timestamp,
                query_raw,
                query_scrubbed,
                jurisdiction,
                language,
                confidence_score,
                float(latency_ms),
            ),
        )
        conn.commit()
        log.debug(
            "Audit row written | jurisdiction=%s | confidence=%s | latency=%.1f ms",
            jurisdiction,
            confidence_score,
            latency_ms,
        )
    except Exception as exc:  # noqa: BLE001
        # Log the failure but NEVER propagate it — audit errors must not
        # interrupt user-facing responses.
        log.error("Audit log write failed: %s", exc, exc_info=True)
