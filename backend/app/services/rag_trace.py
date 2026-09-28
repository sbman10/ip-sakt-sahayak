"""Small, safe tracing helpers for the RAG request pipeline.

The trace is intentionally an in-memory list owned by one request.  It contains
stage names, status, timings, and bounded operational metadata only; raw
queries, document text, vectors, credentials, and PII must never be added.
"""

from __future__ import annotations

import re
import time
from typing import Any, MutableSequence, Optional


StageTrace = MutableSequence[dict[str, Any]]

_SECRET_RE = re.compile(
    r"(?i)(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+"
)


def safe_detail(value: Any, limit: int = 240) -> Any:
    """Return a bounded, non-secret representation suitable for an SSE trace."""
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, (list, tuple, set)):
        return [safe_detail(item, limit=80) for item in list(value)[:20]]
    if isinstance(value, dict):
        return {
            str(key): safe_detail(item, limit=80)
            for key, item in list(value.items())[:20]
            if str(key).lower() not in {"query", "raw_query", "text", "vector", "embedding"}
        }
    text = _SECRET_RE.sub(r"\1=[REDACTED]", str(value))
    return text[:limit]


def record_stage(
    trace: Optional[StageTrace],
    stage_id: str,
    status: str,
    label: str,
    *,
    details: Optional[dict[str, Any]] = None,
    started_at: Optional[float] = None,
) -> None:
    """Append one ordered stage event without ever making tracing fatal."""
    if trace is None:
        return
    try:
        event: dict[str, Any] = {
            "type": "stage",
            "sequence": len(trace) + 1,
            "stage_id": stage_id,
            "status": status,
            "label": label,
        }
        if started_at is not None:
            event["duration_ms"] = round((time.perf_counter() - started_at) * 1000, 2)
        if details:
            event["details"] = safe_detail(details)
        trace.append(event)
    except Exception:
        # Observability must never break retrieval or answer generation.
        return
