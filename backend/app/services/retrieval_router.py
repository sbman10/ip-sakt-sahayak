"""
backend/app/services/retrieval_router.py
-----------------------------------------
Retrieval Router, Canary Traffic Controller, and Safe Fallback Service for IP-SAKTI Sahayak.

Provides a single, stable retrieval entry point that routes queries
to the production vector backend (Qdrant Hybrid) with BM25 fallback,
guaranteeing strict schema normalization, non-leaking correlation logging,
evidence validation, and safe fallback.

Invariants:
- Default backend is 'qdrant_hybrid'.
- If Qdrant fails, times out, returns empty results, or fails citation/filter
  validation when fallback is enabled, safely falls back to lexical BM25.
- Result schemas are 100% normalized and standardized.
- Qdrant native scores are preserved directly.
- Telemetry never logs raw queries, tokens, or PII.
"""

from __future__ import annotations

import concurrent.futures
import hashlib
import logging
import re
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.services.rag_trace import record_stage

log = logging.getLogger("app.services.retrieval_router")

# Error categories for telemetry and safe logging
CATEGORY_TIMEOUT = "qdrant_timeout"
CATEGORY_EMBEDDING = "embedding_failure"
CATEGORY_CONNECTION = "qdrant_connection_error"
CATEGORY_SCHEMA = "schema_incompatible"
CATEGORY_MALFORMED = "malformed_payload"
CATEGORY_EMPTY = "empty_results"
CATEGORY_FILTER_MISMATCH = "filter_mismatch"
CATEGORY_CITATION_FAILURE = "citation_validation_failure"
CATEGORY_UNEXPECTED = "unexpected_exception"


def _safe_exception_text(exc: Exception, limit: int = 280) -> str:
    """Return a bounded exception summary with common secret formats redacted."""
    message = re.sub(
        r"(?i)(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        str(exc),
    )
    return message[:limit]


def _categorize_exception(exc: Exception) -> str:
    """Classify an exception into a safe, controlled telemetry category."""
    if isinstance(exc, (concurrent.futures.TimeoutError, TimeoutError)):
        return CATEGORY_TIMEOUT

    exc_str = str(exc).lower()
    exc_type = type(exc).__name__.lower()

    if "timeout" in exc_str or "timed out" in exc_str:
        return CATEGORY_TIMEOUT
    if "embed" in exc_str or "token" in exc_str or "huggingface" in exc_str or "inference" in exc_str:
        return CATEGORY_EMBEDDING
    if "connection" in exc_str or "connect" in exc_str or "dns" in exc_str or "unreachable" in exc_str:
        return CATEGORY_CONNECTION
    if "schema" in exc_str or "incompatible" in exc_str or "dimension" in exc_str:
        return CATEGORY_SCHEMA
    if "payload" in exc_str or "malformed" in exc_str or "keyerror" in exc_type:
        return CATEGORY_MALFORMED

    return CATEGORY_UNEXPECTED


def normalize_chroma_result(
    doc: Dict[str, Any],
    fallback_used: bool = False,
    fallback_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Normalizes a BM25 / lexical fallback result dictionary into the standardized schema.
    Preserves existing distance and RRF score fields for downstream consumers.
    """
    meta = doc.get("metadata") or {}
    doc_id = str(doc.get("id") or meta.get("id") or meta.get("chunk_id") or "")
    chunk_id = str(meta.get("chunk_id") or doc_id)
    score = float(doc.get("rrf_score", doc.get("score", 0.0)))
    dist = float(doc.get("distance", doc.get("vector_distance", 1.0)))
    sim = float(doc.get("vector_similarity", max(0.0, min(1.0, 1.0 - dist))))
    vector_rank = doc.get("vector_rank")
    dense_score = doc.get("dense_score")
    if dense_score is None and vector_rank is not None:
        dense_score = sim
    raw_bm25 = float(doc.get("bm25_score", doc.get("raw_bm25", 0.0)) or 0.0)
    sparse_score = doc.get("sparse_score")
    if sparse_score is None:
        sparse_score = round(raw_bm25 / (raw_bm25 + 10.0), 4) if raw_bm25 > 0 else 0.0

    backend_label = "bm25_fallback" if fallback_used else "bm25"

    return {
        # Core standardized fields (identical across all backends)
        "id": doc_id,
        "point_id": doc_id,
        "chunk_id": chunk_id,
        "text": doc.get("text", ""),
        "source": doc.get("source") or meta.get("source", "Legal Statute"),
        "authority": meta.get("authority", ""),
        "document_id": meta.get("document_id", ""),
        "section": doc.get("section") or meta.get("section", "General"),
        "jurisdiction": doc.get("jurisdiction") or meta.get("jurisdiction", "India"),
        "document_type": doc.get("document_type", "statute"),
        "domain": meta.get("domain", "patents"),
        "language": meta.get("language", "en"),
        "page": doc.get("page") or meta.get("page"),
        "page_number": doc.get("page_number") or meta.get("page_number"),
        "source_url": doc.get("source_url") or meta.get("source_url"),
        "url": doc.get("url") or meta.get("url"),
        "context_before": doc.get("context_before") or meta.get("context_before"),
        "context_after": doc.get("context_after") or meta.get("context_after"),
        "score": score,
        "metadata": meta if meta else dict(doc),
        # Real branch scores (deterministic metrics)
        "dense_score": dense_score,
        "sparse_score": sparse_score,
        "raw_bm25": raw_bm25,
        # Compatibility fields for retrieval gate, reranker, and telemetry
        "distance": dist,
        "vector_distance": dist,
        "vector_similarity": sim,
        "rrf_score": score,
        # Preserve the legacy score type for existing confidence/gate code;
        # fusion_type carries the important distinction from native Qdrant RRF.
        "retrieval_score_type": "rrf",
        "fusion_type": "legacy_manual_rrf",
        "retrieval_backend": backend_label,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "vector_rank": vector_rank,
        "bm25_rank": doc.get("bm25_rank"),
        "bm25_score": raw_bm25,
        "has_dense_evidence": vector_rank is not None,
    }


# Backwards compatibility alias
normalize_fallback_result = normalize_chroma_result


def normalize_qdrant_result(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a Qdrant Hybrid result dictionary into the standardized schema.
    Strictly preserves native Qdrant score without converting via Chroma formulas.
    """
    meta = doc.get("metadata") or doc.get("payload") or {}
    point_id = str(doc.get("point_id") or doc.get("id") or "")
    chunk_id = str(doc.get("chunk_id") or meta.get("chunk_id") or point_id)
    native_score = float(doc.get("score", 0.0))

    # For downstream compatibility (e.g. retrieval gate checks distance < threshold)
    # distance is inferred inversely from score where higher score means lower distance,
    # but the primary 'score' field remains 100% native Qdrant score.
    compat_dist = max(0.0, min(1.0, 1.0 - min(1.0, native_score)))

    # Extract fields without erasing explicit empty strings
    text_val = doc.get("text") if doc.get("text") is not None else meta.get("text", "")
    src_val = doc.get("source") if doc.get("source") is not None else meta.get("source")
    if src_val is None:
        src_val = "Legal Statute"
    auth_val = doc.get("authority") if doc.get("authority") is not None else meta.get("authority", "")
    doc_id_val = doc.get("document_id") if doc.get("document_id") is not None else meta.get("document_id", "")
    sec_val = doc.get("section") if doc.get("section") is not None else meta.get("section")
    if sec_val is None:
        sec_val = "General"
    jur_val = doc.get("jurisdiction") if doc.get("jurisdiction") is not None else meta.get("jurisdiction")
    if jur_val is None:
        jur_val = "India"
    doc_type_val = doc.get("document_type") if doc.get("document_type") is not None else meta.get("document_type", "statute")
    domain_val = doc.get("domain") if doc.get("domain") is not None else meta.get("domain", "patents")
    lang_val = doc.get("language") if doc.get("language") is not None else meta.get("language", "en")

    return {
        # Core standardized fields (identical across all backends)
        "id": point_id,
        "point_id": point_id,
        "chunk_id": chunk_id,
        "text": text_val,
        "source": src_val,
        "authority": auth_val,
        "document_id": doc_id_val,
        "section": sec_val,
        "jurisdiction": jur_val,
        "document_type": doc_type_val,
        "domain": domain_val,
        "language": lang_val,
        "page": doc.get("page") if doc.get("page") is not None else meta.get("page"),
        "page_number": doc.get("page_number") if doc.get("page_number") is not None else meta.get("page_number"),
        "source_url": doc.get("source_url") if doc.get("source_url") is not None else meta.get("source_url"),
        "url": doc.get("url") if doc.get("url") is not None else meta.get("url"),
        "context_before": doc.get("context_before") if doc.get("context_before") is not None else meta.get("context_before"),
        "context_after": doc.get("context_after") if doc.get("context_after") is not None else meta.get("context_after"),
        "score": native_score,  # Native score preserved directly
        "metadata": meta,
        # Real branch scores (deterministic metrics)
        "dense_score": doc.get("dense_score"),
        "sparse_score": doc.get("sparse_score"),
        "raw_bm25": doc.get("raw_bm25"),
        # Compatibility fields for retrieval gate, reranker, and telemetry
        "distance": doc.get("distance", compat_dist),
        "vector_distance": doc.get("vector_distance", compat_dist),
        "vector_similarity": native_score,
        "rrf_score": native_score,
        "retrieval_score_type": "qdrant_rrf",
        "fusion_type": "qdrant_native_rrf",
        "retrieval_backend": "qdrant_hybrid",
        "fallback_used": False,
        "fallback_reason": None,
    }


def validate_qdrant_evidence(
    points: List[Dict[str, Any]],
    requested_jurisdiction: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Validates retrieved candidate points from Qdrant:
    1. Every point must have non-empty 'text'.
    2. Every point must have essential citation metadata: 'source', 'authority', 'document_id', 'section'.
    3. If requested_jurisdiction is provided and specific ('India' or 'International'),
       the point's jurisdiction must match or be compatible ('Both' or matches requested).
    4. Citation traceability: must have valid 'document_id' and 'chunk_id' / 'point_id'.

    Returns:
        (is_valid, failure_category_or_none)
    """
    if not points:
        return True, None

    for pt in points:
        text = pt.get("text")
        if not text or not str(text).strip():
            return False, CATEGORY_MALFORMED

        source = pt.get("source")
        if not source or not str(source).strip():
            return False, CATEGORY_CITATION_FAILURE

        doc_id = pt.get("document_id")
        if not doc_id or not str(doc_id).strip():
            return False, CATEGORY_CITATION_FAILURE

        authority = pt.get("authority")
        if not authority or not str(authority).strip():
            return False, CATEGORY_CITATION_FAILURE

        section = pt.get("section")
        if not section or not str(section).strip():
            return False, CATEGORY_CITATION_FAILURE

        chunk_id = pt.get("chunk_id") or pt.get("point_id") or pt.get("id")
        if not chunk_id or not str(chunk_id).strip():
            return False, CATEGORY_CITATION_FAILURE

        # Jurisdiction match check
        if requested_jurisdiction and requested_jurisdiction.strip().lower() not in ("both", ""):
            req_jur = requested_jurisdiction.strip().lower()
            pt_jur = str(pt.get("jurisdiction", "")).strip().lower()
            if pt_jur and pt_jur != "both" and pt_jur != req_jur:
                return False, CATEGORY_FILTER_MISMATCH

    return True, None


def should_route_to_qdrant(
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    query: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Determines whether a query should route to Qdrant canary or stay on Chroma/BM25.
    Uses deterministic SHA-256 modulo 100 hashing based on session/user/request/query.

    Returns:
        (is_qdrant, routing_reason)
    """
    selected_backend = (settings.RETRIEVAL_BACKEND or "chroma_bm25").strip().lower()
    if selected_backend == "qdrant_hybrid":
        return True, "explicit_qdrant_backend"

    if not getattr(settings, "QDRANT_CANARY_ENABLED", False):
        return False, "canary_disabled"

    traffic_percent = int(getattr(settings, "QDRANT_TRAFFIC_PERCENT", 0))
    if traffic_percent <= 0:
        return False, "traffic_percent_zero"

    if traffic_percent >= 100:
        return True, "traffic_percent_100"

    # Deterministic hash selection: priority session_id > user_id > request_id > query
    routing_key = (
        (session_id and session_id.strip())
        or (user_id and user_id.strip())
        or (request_id and request_id.strip())
        or (query and query.strip())
        or ""
    )
    if not routing_key:
        return False, "no_routing_key"

    sha256_hex = hashlib.sha256(routing_key.encode("utf-8")).hexdigest()
    bucket = int(sha256_hex[:8], 16) % 100

    if bucket < traffic_percent:
        return True, f"canary_selected_bucket_{bucket}"
    else:
        return False, f"canary_unselected_bucket_{bucket}"


class CanaryMetricsTracker:
    """
    Thread-safe operational telemetry tracker for canary retrieval rollout.
    Records request distributions, latencies, fallback counts, and error categories
    without ever storing raw queries, tokens, or PII.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.total_requests = 0
            self.chroma_requests = 0
            self.qdrant_requests = 0
            self.qdrant_served = 0
            self.qdrant_fallbacks = 0
            self.fallback_reasons: Dict[str, int] = {}
            self.chroma_latencies_ms: List[float] = []
            self.qdrant_latencies_ms: List[float] = []

    def record_chroma_request(self, latency_ms: float) -> None:
        with self._lock:
            self.total_requests += 1
            self.chroma_requests += 1
            self.chroma_latencies_ms.append(latency_ms)

    def record_qdrant_attempt(self) -> None:
        with self._lock:
            self.total_requests += 1
            self.qdrant_requests += 1

    def record_qdrant_success(self, latency_ms: float) -> None:
        with self._lock:
            self.qdrant_served += 1
            self.qdrant_latencies_ms.append(latency_ms)

    def record_qdrant_fallback(self, reason: str) -> None:
        with self._lock:
            self.qdrant_fallbacks += 1
            self.fallback_reasons[reason] = self.fallback_reasons.get(reason, 0) + 1

    def get_metrics(self) -> Dict[str, Any]:
        with self._lock:
            def _calc_p95(lats: List[float]) -> float:
                if not lats:
                    return 0.0
                sorted_lats = sorted(lats)
                idx = int(len(sorted_lats) * 0.95)
                return sorted_lats[min(idx, len(sorted_lats) - 1)]

            def _calc_p50(lats: List[float]) -> float:
                if not lats:
                    return 0.0
                sorted_lats = sorted(lats)
                idx = int(len(sorted_lats) * 0.50)
                return sorted_lats[min(idx, len(sorted_lats) - 1)]

            fallback_rate = (
                (self.qdrant_fallbacks / self.qdrant_requests)
                if self.qdrant_requests > 0
                else 0.0
            )

            return {
                "total_requests": self.total_requests,
                "chroma_requests": self.chroma_requests,
                "qdrant_requests": self.qdrant_requests,
                "qdrant_served": self.qdrant_served,
                "qdrant_fallbacks": self.qdrant_fallbacks,
                "fallback_rate": round(fallback_rate, 4),
                "fallback_reasons": dict(self.fallback_reasons),
                "chroma_p50_latency_ms": round(_calc_p50(self.chroma_latencies_ms), 2),
                "chroma_p95_latency_ms": round(_calc_p95(self.chroma_latencies_ms), 2),
                "qdrant_p50_latency_ms": round(_calc_p50(self.qdrant_latencies_ms), 2),
                "qdrant_p95_latency_ms": round(_calc_p95(self.qdrant_latencies_ms), 2),
            }


canary_metrics_tracker = CanaryMetricsTracker()


class RetrievalRouter:
    """
    Enterprise retrieval router managing backend selection, deterministic canary
    traffic routing, safe timeout execution, and automatic fallback to ChromaDB+BM25.
    """

    def __init__(self) -> None:
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=4, thread_name_prefix="qdrant_router"
        )

    def _execute_fallback(
        self,
        query: str,
        jurisdiction: str,
        top_k: int,
        fallback_used: bool = False,
        fallback_reason: Optional[str] = None,
        **filters: Any,
    ) -> List[Dict[str, Any]]:
        """Call fallback BM25 retrieval service and normalize results."""
        from app.services.retrieval_service import hybrid_rrf_search

        raw_candidates = hybrid_rrf_search(
            query=query,
            jurisdiction=jurisdiction,
            top_k=top_k,
            **filters,
        )
        return [
            normalize_fallback_result(
                c,
                fallback_used=fallback_used,
                fallback_reason=fallback_reason,
            )
            for c in raw_candidates
        ]

    # Alias for backwards compatibility
    _execute_chroma = _execute_fallback

    def _execute_qdrant_direct(
        self,
        query: str,
        jurisdiction: str,
        top_k: int,
        trace: Optional[list[dict[str, Any]]] = None,
        **filters: Any,
    ) -> List[Dict[str, Any]]:
        """Call Qdrant hybrid store directly targeting the production collection."""
        from app.services.qdrant_hybrid_store import qdrant_hybrid_store

        target_collection = settings.QDRANT_PRODUCTION_COLLECTION or "ragvyn_prod_v2"

        raw_points = qdrant_hybrid_store.query_hybrid(
            query_text=query,
            collection_name=target_collection,
            top_k=top_k,
            jurisdiction=jurisdiction,
            trace=trace,
            **filters,
        )

        if not isinstance(raw_points, list):
            raise ValueError(f"Qdrant returned non-list response: {type(raw_points)}")

        normalized_points = []
        for pt in raw_points:
            if not isinstance(pt, dict):
                raise ValueError(f"Malformed point structure: expected dict, got {type(pt)}")
            if not pt.get("text") and not (pt.get("metadata") or {}).get("text") and not (pt.get("payload") or {}).get("text"):
                raise ValueError("Malformed point: missing text content")
            normalized_points.append(normalize_qdrant_result(pt))

        return normalized_points

    def retrieve(
        self,
        query: str,
        jurisdiction: str = "India",
        top_k: int = 5,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        trace: Optional[list[dict[str, Any]]] = None,
        **filters: Any,
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval across the configured backend with deterministic
        canary routing, evidence validation, and automatic fallback to ChromaDB+BM25.
        """
        if not query or not query.strip():
            return []

        req_id = request_id or str(uuid.uuid4())[:8]
        query_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()[:8]
        start_time = time.perf_counter()
        record_stage(
            trace,
            "retrieval_routing",
            "started",
            "Selecting verified retrieval backend",
            details={"request_id": req_id},
        )

        # Determine backend routing via deterministic canary selector
        use_qdrant, routing_reason = should_route_to_qdrant(
            session_id=session_id or filters.get("session_id"),
            user_id=user_id or filters.get("user_id"),
            request_id=req_id,
            query=query,
        )

        # -------------------------------------------------------------
        # Path A: Lexical BM25 (Non-Qdrant Traffic)
        # -------------------------------------------------------------
        if not use_qdrant:
            record_stage(
                trace,
                "retrieval_routing",
                "completed",
                "Using legacy hybrid fallback",
                details={"backend": "legacy_hybrid_rrf", "reason": routing_reason},
            )
            try:
                results = self._execute_fallback(
                    query=query,
                    jurisdiction=jurisdiction,
                    top_k=top_k,
                    fallback_used=False,
                    fallback_reason=None,
                    **filters,
                )
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                canary_metrics_tracker.record_chroma_request(latency_ms)
                log.info(
                    "[%s] Retrieval complete | backend: lexical_bm25 | reason: %s | query_hash: %s | "
                    "results: %d | latency: %.2fms",
                    req_id,
                    routing_reason,
                    query_hash,
                    len(results),
                    latency_ms,
                )
                return results
            except Exception as exc:
                latency_ms = (time.perf_counter() - start_time) * 1000.0
                canary_metrics_tracker.record_chroma_request(latency_ms)
                log.error(
                    "[%s] Primary fallback retrieval error: %s (%s) | query_hash: %s | latency: %.2fms",
                    req_id,
                    type(exc).__name__,
                    _safe_exception_text(exc),
                    query_hash,
                    latency_ms,
                )
                record_stage(
                    trace,
                    "retrieval_fallback",
                    "failed",
                    "Legacy fallback retrieval failed",
                    details={"reason": _categorize_exception(exc)},
                )
                return []

        # -------------------------------------------------------------
        # Path B: Qdrant Hybrid Production Retrieval with Safe Fallback
        # -------------------------------------------------------------
        fallback_needed = False
        fallback_category: Optional[str] = None
        qdrant_results: List[Dict[str, Any]] = []

        timeout_sec = float(getattr(settings, "QDRANT_REQUEST_TIMEOUT_SECONDS", 5.0))
        fallback_enabled = bool(getattr(settings, "QDRANT_FALLBACK_ENABLED", True))

        canary_metrics_tracker.record_qdrant_attempt()
        record_stage(
            trace,
            "qdrant_hybrid",
            "started",
            "Searching dense and sparse Qdrant indexes",
            details={"collection": settings.QDRANT_PRODUCTION_COLLECTION, "top_k": top_k},
        )

        try:
            future = self._executor.submit(
                self._execute_qdrant_direct,
                query,
                jurisdiction,
                top_k,
                trace=trace,
                **filters,
            )
            qdrant_results = future.result(timeout=timeout_sec)

            # Check for empty results
            if len(qdrant_results) == 0:
                fallback_needed = True
                fallback_category = CATEGORY_EMPTY
                log.warning(
                    "[%s] Qdrant returned 0 results | query_hash: %s. Fallback enabled=%s.",
                    req_id,
                    query_hash,
                    fallback_enabled,
                )
            else:
                # Evidence and citation validation
                is_valid, validation_err = validate_qdrant_evidence(
                    qdrant_results,
                    requested_jurisdiction=jurisdiction,
                )
                if not is_valid:
                    fallback_needed = True
                    fallback_category = validation_err or CATEGORY_MALFORMED
                    log.warning(
                        "[%s] Qdrant evidence validation failed [%s] | query_hash: %s. Fallback enabled=%s.",
                        req_id,
                        fallback_category,
                        query_hash,
                        fallback_enabled,
                    )

        except Exception as exc:
            fallback_needed = True
            fallback_category = _categorize_exception(exc)
            log.warning(
                "[%s] Qdrant retrieval exception [%s]: %s (%s) | query_hash: %s. Fallback enabled=%s.",
                req_id,
                fallback_category,
                type(exc).__name__,
                _safe_exception_text(exc),
                query_hash,
                fallback_enabled,
            )

        # If Qdrant succeeded, returned non-empty results, and passed validation:
        if not fallback_needed:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            canary_metrics_tracker.record_qdrant_success(latency_ms)
            log.info(
                "[%s] Canary retrieval complete | retrieval_backend=qdrant_hybrid | reason: %s | query_hash: %s | "
                "results: %d | latency: %.2fms",
                req_id,
                routing_reason,
                query_hash,
                len(qdrant_results),
                latency_ms,
            )
            record_stage(
                trace,
                "qdrant_hybrid",
                "completed",
                "Qdrant native RRF returned verified evidence",
                details={
                    "backend": "qdrant_hybrid",
                    "score_type": "qdrant_rrf",
                    "result_count": len(qdrant_results),
                },
                started_at=start_time,
            )
            return qdrant_results

        # Fallback needed - record metric
        canary_metrics_tracker.record_qdrant_fallback(fallback_category or "unknown")

        # If fallback is disabled:
        if not fallback_enabled:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            log.warning(
                "[%s] Qdrant canary failed (%s) and QDRANT_FALLBACK_ENABLED=False. "
                "Returning controlled empty results | query_hash: %s | latency: %.2fms",
                req_id,
                fallback_category,
                query_hash,
                latency_ms,
            )
            return []

        # Execute safe fallback to BM25 lexical search:
        try:
            fallback_results = self._execute_fallback(
                query=query,
                jurisdiction=jurisdiction,
                top_k=top_k,
                fallback_used=True,
                fallback_reason=fallback_category,
                **filters,
            )
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            log.warning(
                "[%s] Fallback succeeded | backend: bm25_fallback | reason: %s | query_hash: %s | "
                "results: %d | latency: %.2fms",
                req_id,
                fallback_category,
                query_hash,
                len(fallback_results),
                latency_ms,
            )
            record_stage(
                trace,
                "qdrant_hybrid",
                "failed",
                "Qdrant native search unavailable; using safe fallback",
                details={"reason": fallback_category, "fallback_backend": "legacy_hybrid_rrf"},
            )
            record_stage(
                trace,
                "retrieval_fallback",
                "completed" if fallback_results else "failed",
                "Legacy fallback retrieval completed" if fallback_results else "Legacy fallback returned no evidence",
                details={"result_count": len(fallback_results), "reason": fallback_category},
            )
            return fallback_results
        except Exception as fallback_exc:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            log.error(
                "[%s] Dual failure: Both Qdrant and fallback failed. "
                "Qdrant reason: %s | Fallback error: %s | query_hash: %s | latency: %.2fms",
                req_id,
                fallback_category,
                type(fallback_exc).__name__,
                query_hash,
                latency_ms,
            )
            record_stage(
                trace,
                "qdrant_hybrid",
                "failed",
                "Qdrant native search failed",
                details={"reason": fallback_category},
            )
            record_stage(
                trace,
                "retrieval_fallback",
                "failed",
                "Both retrieval backends failed",
                details={"reason": _categorize_exception(fallback_exc)},
            )
            return []


# Global singleton instance
retrieval_router = RetrievalRouter()


def retrieve(
    query: str,
    jurisdiction: str = "India",
    top_k: int = 5,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    trace: Optional[list[dict[str, Any]]] = None,
    **filters: Any,
) -> List[Dict[str, Any]]:
    """Stable public API for retrieval router."""
    return retrieval_router.retrieve(
        query=query,
        jurisdiction=jurisdiction,
        top_k=top_k,
        request_id=request_id,
        session_id=session_id,
        user_id=user_id,
        trace=trace,
        **filters,
    )
