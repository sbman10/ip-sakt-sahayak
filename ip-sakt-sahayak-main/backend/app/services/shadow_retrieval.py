"""
backend/app/services/shadow_retrieval.py
-----------------------------------------
Phase 5C: Non-destructive, Safe Production Qdrant Shadow Validation Service.

When QDRANT_SHADOW_RETRIEVAL is enabled:
- Executes Qdrant hybrid retrieval in shadow mode strictly against the verified
  production shadow collection (defaults to 'ragvyn_prod_v1').
- Enforces strict collection guards: test collections ('ragvyn_hybrid_test', 'ragvyn_hybrid_test_v2') are hard-rejected.
- Implements circuit breaker, bounded timeout, and sampling rate protections.
- Logs and records safe comparative metrics (latencies, overlap, consistency, schema completeness).
- Never leaks API keys, tokens, or raw private data.
- User-facing responses strictly retain existing Chroma/BM25 results.
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings
from app.services.qdrant_hybrid_store import MANDATORY_PAYLOAD_FIELDS, qdrant_hybrid_store

log = logging.getLogger("app.services.shadow_retrieval")

# Directory for shadow comparison reports (relative to project root)
_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
SHADOW_REPORT_DIR = _WORKSPACE_ROOT / "reports" / "shadow"

# Thread pool dedicated to shadow retrieval isolation
_SHADOW_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="qdrant_shadow_worker")

# Cache of verified collections
_VERIFIED_SHADOW_COLLECTIONS: Set[str] = set()

# Prohibited collection identifiers for production shadow retrieval
PROHIBITED_COLLECTIONS: Set[str] = {"ragvyn_hybrid_test", "ragvyn_hybrid_test_v2"}


class CircuitBreaker:
    """
    In-memory Circuit Breaker to prevent cascading delays or overwhelming
    remote vector databases during degradation or outages.
    """

    def __init__(self, max_failures: int = 3, cooldown_seconds: float = 60.0) -> None:
        self.max_failures = max_failures
        self.cooldown_seconds = cooldown_seconds
        self.consecutive_failures = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.last_failure_time: Optional[float] = None

    def can_execute(self) -> bool:
        if self.state == "CLOSED":
            return True
        now = time.time()
        if self.state == "OPEN":
            if self.last_failure_time and (now - self.last_failure_time) >= self.cooldown_seconds:
                self.state = "HALF_OPEN"
                log.info("Shadow retrieval circuit breaker transitioned to HALF_OPEN (cooldown expired).")
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return True

    def record_success(self) -> None:
        self.consecutive_failures = 0
        self.state = "CLOSED"
        self.last_failure_time = None

    def record_failure(self, reason: str = "") -> None:
        self.consecutive_failures += 1
        self.last_failure_time = time.time()
        eff_max = getattr(settings, "QDRANT_SHADOW_MAX_FAILURES", self.max_failures)
        if self.consecutive_failures >= eff_max:
            self.state = "OPEN"
            log.warning(
                "Shadow retrieval circuit breaker TRIPPED to OPEN: %d consecutive failures (reason: %s). Cooldown: %.1fs",
                self.consecutive_failures,
                reason,
                self.cooldown_seconds,
            )

    def reset(self) -> None:
        self.consecutive_failures = 0
        self.state = "CLOSED"
        self.last_failure_time = None


# Global CircuitBreaker singleton
shadow_circuit_breaker = CircuitBreaker()


def verify_shadow_collection_preflight(collection_name: str) -> bool:
    """
    Validates that the target shadow collection exists and meets the dual-vector
    and index schema requirements. For ragvyn_prod_v1, verifies status GREEN and 753 points.
    Results are cached in memory.
    """
    if collection_name in _VERIFIED_SHADOW_COLLECTIONS:
        return True

    clean_name = collection_name.strip().lower()
    if clean_name in PROHIBITED_COLLECTIONS or "test" in clean_name:
        log.error("PROHIBITED COLLECTION REJECTED: '%s' is not allowed for production shadow deployment.", collection_name)
        return False

    try:
        qdrant_hybrid_store.verify_collection_schema(collection_name)
        if clean_name == "ragvyn_prod_v1":
            client = qdrant_hybrid_store.get_client()
            col_info = client.get_collection(collection_name=collection_name)
            status_str = str(getattr(col_info, "status", "")).lower()
            if "green" not in status_str:
                log.error("Production shadow collection '%s' status is not green: %s", collection_name, status_str)
                return False
            points_count = getattr(col_info, "points_count", None)
            if points_count != 753:
                log.error("Production shadow collection '%s' points count mismatch: expected 753, found %s", collection_name, points_count)
                return False

        _VERIFIED_SHADOW_COLLECTIONS.add(collection_name)
        log.info("Shadow collection pre-flight verified: '%s'", collection_name)
        return True
    except Exception as exc:
        log.warning("Shadow collection pre-flight failed for '%s': %s", collection_name, exc)
        return False


def compare_retrieval_results(
    query: str,
    jurisdiction_requested: str,
    top_k: int,
    chroma_results: List[Dict[str, Any]],
    qdrant_results: List[Dict[str, Any]],
    chroma_latency_ms: float = 0.0,
    qdrant_latency_ms: float = 0.0,
    timeout_status: bool = False,
) -> Dict[str, Any]:
    """
    Analyzes and compares two candidate retrieval result sets:
    - Chroma/BM25 legacy hybrid results
    - Qdrant Cloud hybrid results (ragvyn_prod_v1)

    Evaluates:
    - top-k document IDs and chunk IDs
    - overlap (intersection and Jaccard ratio)
    - jurisdiction consistency
    - section overlap / consistency
    - score distribution and ordering
    - payload schema completeness & evidence quality in Qdrant results
    - safe privacy metadata (SHA-256 hashed query ID, zero secrets)
    """
    # 1. Extract Chroma candidates
    chroma_top_k: List[Dict[str, Any]] = []
    chroma_chunk_ids: List[str] = []
    chroma_doc_ids: List[str] = []
    chroma_sections: List[str] = []
    chroma_jurisdictions: List[str] = []

    for rank, doc in enumerate(chroma_results, start=1):
        meta = doc.get("metadata") or {}
        chunk_id = str(doc.get("id") or doc.get("chunk_id") or meta.get("chunk_id") or "")
        doc_id = str(meta.get("document_id") or doc.get("source") or meta.get("source") or "")
        sec = str(doc.get("section") or meta.get("section") or "")
        jur = str(doc.get("jurisdiction") or meta.get("jurisdiction") or "")

        chroma_chunk_ids.append(chunk_id)
        chroma_doc_ids.append(doc_id)
        chroma_sections.append(sec)
        chroma_jurisdictions.append(jur)

        chroma_top_k.append({
            "rank": rank,
            "id": chunk_id,
            "document_id": doc_id,
            "source": doc.get("source") or meta.get("source") or "",
            "section": sec,
            "jurisdiction": jur,
            "retrieval_score_type": "chroma_rrf",
            "rrf_score": doc.get("rrf_score"),
            "vector_distance": doc.get("vector_distance"),
            "bm25_score": doc.get("bm25_score"),
        })

    # 2. Extract Qdrant candidates & validate payload fields
    qdrant_top_k: List[Dict[str, Any]] = []
    qdrant_chunk_ids: List[str] = []
    qdrant_doc_ids: List[str] = []
    qdrant_sections: List[str] = []
    qdrant_jurisdictions: List[str] = []
    malformed_payload_records: List[Dict[str, Any]] = []

    for rank, doc in enumerate(qdrant_results, start=1):
        p = doc.get("payload") or doc.get("metadata") or {}
        point_id = str(doc.get("point_id") or doc.get("id") or "")
        chunk_id = str(doc.get("chunk_id") or p.get("chunk_id") or "")
        doc_id = str(doc.get("document_id") or p.get("document_id") or doc.get("source") or "")
        sec = str(doc.get("section") or p.get("section") or "")
        jur = str(doc.get("jurisdiction") or p.get("jurisdiction") or "")
        txt = str(doc.get("text") or p.get("text") or "")

        qdrant_chunk_ids.append(chunk_id)
        qdrant_doc_ids.append(doc_id)
        qdrant_sections.append(sec)
        qdrant_jurisdictions.append(jur)

        # Validate mandatory payload fields and evidence quality
        missing_fields = [f for f in MANDATORY_PAYLOAD_FIELDS if f not in p or p[f] is None or (isinstance(p[f], str) and not p[f].strip())]
        if not txt.strip() and "text" not in missing_fields:
            missing_fields.append("text")

        if missing_fields:
            malformed_payload_records.append({
                "point_id": point_id,
                "chunk_id": chunk_id,
                "missing_or_empty_fields": missing_fields,
            })

        qdrant_top_k.append({
            "rank": rank,
            "point_id": point_id,
            "chunk_id": chunk_id,
            "document_id": doc_id,
            "source": doc.get("source") or p.get("source") or "",
            "section": sec,
            "jurisdiction": jur,
            "document_type": doc.get("document_type") or p.get("document_type") or "",
            "retrieval_score_type": "qdrant_rrf",
            "qdrant_score": doc.get("score"),
            "has_valid_evidence": len(missing_fields) == 0,
            "missing_fields": missing_fields if missing_fields else None,
        })

    # 3. Compute overlaps
    chunk_overlap = sorted(list(set(c for c in chroma_chunk_ids if c) & set(q for q in qdrant_chunk_ids if q)))
    doc_overlap = sorted(list(set(c for c in chroma_doc_ids if c) & set(q for q in qdrant_doc_ids if q)))
    section_overlap = sorted(list(set(c for c in chroma_sections if c) & set(q for q in qdrant_sections if q)))

    max_possible_chunk_overlap = max(1, min(len(chroma_chunk_ids), len(qdrant_chunk_ids)))
    chunk_overlap_ratio = len(chunk_overlap) / max_possible_chunk_overlap

    # 4. Check jurisdiction consistency
    req_jur = jurisdiction_requested.strip().lower()
    if req_jur in ("india", "international"):
        qdrant_jur_consistent = all(
            j.lower() == req_jur for j in qdrant_jurisdictions if j
        ) if qdrant_jurisdictions else True
    else:
        qdrant_jur_consistent = True

    # 5. Safe query privacy identifier (SHA-256 hash)
    query_hash = hashlib.sha256(query.strip().encode("utf-8")).hexdigest()[:16]

    return {
        "request_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query_hash": query_hash,
        "query_length": len(query),
        "jurisdiction_requested": jurisdiction_requested,
        "top_k": top_k,
        "timing_ms": {
            "chroma_latency_ms": round(chroma_latency_ms, 2),
            "qdrant_latency_ms": round(qdrant_latency_ms, 2),
            "timeout_status": timeout_status,
        },
        "circuit_breaker_state": shadow_circuit_breaker.state,
        "counts": {
            "chroma_candidates": len(chroma_results),
            "qdrant_candidates": len(qdrant_results),
        },
        "metrics": {
            "chunk_id_overlap_count": len(chunk_overlap),
            "chunk_id_overlap_ratio": round(chunk_overlap_ratio, 4),
            "chunk_id_overlap_items": chunk_overlap,
            "doc_id_overlap_count": len(doc_overlap),
            "doc_id_overlap_items": doc_overlap,
            "section_overlap_count": len(section_overlap),
            "section_overlap_items": section_overlap,
            "jurisdiction_consistency": qdrant_jur_consistent,
            "malformed_payload_count": len(malformed_payload_records),
        },
        "malformed_payload_records": malformed_payload_records,
        "chroma_top_k": chroma_top_k,
        "qdrant_top_k": qdrant_top_k,
    }


def record_shadow_report(report_data: Dict[str, Any]) -> Optional[Path]:
    """
    Saves a JSON shadow comparison report to the local directory.
    Never logs or persists authentication tokens, API keys, or raw PII.
    """
    try:
        SHADOW_REPORT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        report_id = report_data.get("request_id", uuid.uuid4().hex)[:8]
        report_path = SHADOW_REPORT_DIR / f"shadow_retrieval_{timestamp_slug}_{report_id}.json"

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)

        return report_path
    except Exception as exc:
        log.warning("Failed to record shadow comparison report file: %s", exc)
        return None


def _execute_qdrant_query_direct(
    query: str,
    collection_name: str,
    top_k: int,
    jurisdiction_filter: Optional[str],
) -> List[Dict[str, Any]]:
    """Worker function executed inside ThreadPoolExecutor with timeout."""
    return qdrant_hybrid_store.query_hybrid(
        query_text=query,
        collection_name=collection_name,
        top_k=top_k,
        jurisdiction=jurisdiction_filter,
    )


def log_and_record_shadow_comparison(
    query: str,
    jurisdiction: str,
    top_k: int,
    chroma_results: List[Dict[str, Any]],
    collection_name: Optional[str] = None,
    chroma_latency_ms: float = 0.0,
) -> Optional[Dict[str, Any]]:
    """
    Executes Qdrant shadow retrieval safely:
    1. Validates QDRANT_SHADOW_RETRIEVAL is active.
    2. Resolves dedicated shadow collection (defaults to 'ragvyn_hybrid_test_v2').
    3. Strictly rejects 'ragvyn_prod_v1'.
    4. Evaluates sampling rate.
    5. Checks circuit-breaker state.
    6. Verifies schema pre-flight (cached).
    7. Executes query bounded by QDRANT_SHADOW_TIMEOUT_SECONDS in a dedicated thread.
    8. Records safe comparison metrics.
    9. Guarantees zero side-effects or failure propagation to user-facing flow.
    """
    try:
        # 1. Feature flag guard
        if not getattr(settings, "QDRANT_SHADOW_RETRIEVAL", False):
            return None

        # 2. Resolve shadow collection (defaults to production collection for Phase 5C)
        target_collection = (
            collection_name
            or getattr(settings, "QDRANT_SHADOW_COLLECTION", None)
            or "ragvyn_prod_v1"
        ).strip()

        # 3. Hard rejection of prohibited collection
        clean_target = target_collection.lower()
        if clean_target in PROHIBITED_COLLECTIONS or "test" in clean_target:
            log.error(
                "CRITICAL SECURITY / SAFETY VIOLATION: Shadow retrieval requested against prohibited collection '%s'. "
                "Shadow execution ABORTED.",
                target_collection,
            )
            return None

        # 4. Sampling rate check
        sample_rate = float(getattr(settings, "QDRANT_SHADOW_SAMPLE_RATE", 1.0))
        if sample_rate < 1.0 and random.random() > sample_rate:
            log.debug("Shadow request sampled out (sample_rate=%.2f)", sample_rate)
            return None

        # 5. Circuit-breaker check
        if not shadow_circuit_breaker.can_execute():
            log.debug(
                "Shadow request skipped: circuit breaker is %s (consecutive failures: %d).",
                shadow_circuit_breaker.state,
                shadow_circuit_breaker.consecutive_failures,
            )
            return None

        # 6. Pre-flight schema validation (cached)
        if not verify_shadow_collection_preflight(target_collection):
            shadow_circuit_breaker.record_failure("preflight_verification_failed")
            return None

        # Determine Qdrant jurisdiction filter
        jur_clean = jurisdiction.strip().lower()
        if jur_clean == "both":
            q_jur = None
        elif "international" in jur_clean:
            q_jur = "International"
        elif "india" in jur_clean:
            q_jur = "India"
        else:
            q_jur = None

        timeout_sec = float(getattr(settings, "QDRANT_SHADOW_TIMEOUT_SECONDS", 3.0))

        # 7. Execute bounded shadow query via thread pool
        t_start = time.perf_counter()
        qdrant_results: List[Dict[str, Any]] = []
        timeout_status = False

        try:
            future = _SHADOW_EXECUTOR.submit(
                _execute_qdrant_query_direct,
                query,
                target_collection,
                top_k,
                q_jur,
            )
            qdrant_results = future.result(timeout=timeout_sec)
            qdrant_latency_ms = (time.perf_counter() - t_start) * 1000.0
            shadow_circuit_breaker.record_success()

        except FutureTimeoutError:
            timeout_status = True
            qdrant_latency_ms = (time.perf_counter() - t_start) * 1000.0
            shadow_circuit_breaker.record_failure("timeout")
            log.warning(
                "Qdrant shadow retrieval timed out after %.2fs on collection '%s'. User request unaffected.",
                timeout_sec,
                target_collection,
            )
            qdrant_results = []

        except Exception as query_exc:
            qdrant_latency_ms = (time.perf_counter() - t_start) * 1000.0
            shadow_circuit_breaker.record_failure(str(query_exc))
            log.warning(
                "Qdrant shadow retrieval failed non-blockingly: %s. User request unaffected.",
                query_exc,
            )
            qdrant_results = []

        # 8. Compute safe comparison metrics
        comparison = compare_retrieval_results(
            query=query,
            jurisdiction_requested=jurisdiction,
            top_k=top_k,
            chroma_results=chroma_results,
            qdrant_results=qdrant_results,
            chroma_latency_ms=chroma_latency_ms,
            qdrant_latency_ms=qdrant_latency_ms,
            timeout_status=timeout_status,
        )

        report_file = record_shadow_report(comparison)

        log.info(
            "Shadow Retrieval: query_hash=%s | Latency (Chroma: %.1fms, Qdrant: %.1fms) | "
            "Candidates (Chroma: %d, Qdrant: %d) | Overlap: chunk=%d (%.1f%%), doc=%d | "
            "Timeout: %s | Report: %s",
            comparison["query_hash"],
            chroma_latency_ms,
            qdrant_latency_ms,
            len(chroma_results),
            len(qdrant_results),
            comparison["metrics"]["chunk_id_overlap_count"],
            comparison["metrics"]["chunk_id_overlap_ratio"] * 100,
            comparison["metrics"]["doc_id_overlap_count"],
            timeout_status,
            report_file.name if report_file else "none",
        )

        return comparison

    except Exception as err:
        log.warning("Shadow retrieval non-blocking exception: %s", err, exc_info=True)
        return None
