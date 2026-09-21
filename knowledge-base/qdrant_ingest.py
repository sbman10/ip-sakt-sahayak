"""
knowledge-base/qdrant_ingest.py
-------------------------------
Safe, Restartable, Multi-Mode Qdrant Hybrid Ingestion Pipeline for IP-SAKTI Sahayak.

Phase 2 Corrective Ingestion Requirements:
- Source reading: knowledge-base/sources/ with metadata.yaml & source.yaml resolution.
- Parsing & chunking: DocumentProcessor + LegalHierarchicalChunker.
- Dense embeddings: canonical_embedder.embed_documents() (BAAI/bge-m3, 1024-d, normalized, HF InferenceClient).
- Sparse embeddings: sparse_embedder.embed_passages() (Qdrant/bm25, FastEmbed, passage_embed()).
- Dry-run correctness: Strictly uses embed_documents() and embed_passages() for document passages (never embed_query()).
- Retry-safe uploads: Always uses qdrant_hybrid_store.upsert_points() with exponential backoff and wait=True.
- Collection baseline: Records collection name, points count, existing point IDs before and after upload.
- Strict metadata validation: Enforces 12 mandatory fields; validates ISO-8601 dates; aborts full ingest on missing fields unless overridden.
- Target collection: ragvyn_hybrid_test (ragvyn_prod_v1 strictly prohibited).
- Modes:
    1. preflight: Verify schema, counts, baseline, and metadata completeness; upload nothing.
    2. dry-run: Parse, build points, optional embedding generation via document methods, upload nothing.
    3. test-upload: Ingest exactly N chunks (e.g. 5) into ragvyn_hybrid_test with baseline tracking and retries.
    4. full: Ingest complete corpus into ragvyn_hybrid_test (requires explicit --confirm).

Usage:
    python knowledge-base/qdrant_ingest.py --mode preflight
    python knowledge-base/qdrant_ingest.py --mode dry-run
    python knowledge-base/qdrant_ingest.py --mode dry-run --embed
    python knowledge-base/qdrant_ingest.py --mode test-upload --limit 5
    python knowledge-base/qdrant_ingest.py --mode full --confirm
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Ensure UTF-8 output on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import yaml
from qdrant_client import models as qmodels

# Setup workspace and backend paths
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = WORKSPACE_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from app.core.config import settings
from app.services.document_processor import DocumentProcessor
from app.services.embedding_service import canonical_embedder
from app.services.qdrant_hybrid_store import (
    DENSE_DIMENSION,
    DENSE_VECTOR_NAME,
    MANDATORY_PAYLOAD_FIELDS,
    SPARSE_VECTOR_NAME,
    IncompatibleSchemaError,
    build_hybrid_point,
    generate_point_id,
    qdrant_hybrid_store,
)
from app.services.sparse_embedding_service import sparse_embedder

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("QdrantIngestor")

SOURCES_DIR = WORKSPACE_ROOT / "knowledge-base" / "sources"
MANIFEST_FILE = WORKSPACE_ROOT / "knowledge-base" / "registry" / "source_manifest.jsonl"
AUTHORITY_REGISTRY_FILE = WORKSPACE_ROOT / "knowledge-base" / "registry" / "authority_registry.json"
PROHIBITED_COLLECTION = "ragvyn_prod_v1"

# 17 standardized payload fields for IP-SAKTI Sahayak knowledge base
STANDARDIZED_PAYLOAD_FIELDS = [
    "chunk_id",
    "document_id",
    "text",
    "title",
    "authority",
    "jurisdiction",
    "domain",
    "document_type",
    "section",
    "language",
    "publication_date",
    "priority_date",
    "source_url",
    "page",
    "checksum",
    "embedding_model",
    "vector_dimension",
]

# Required identity fields that must never be null or empty
REQUIRED_IDENTITY_FIELDS = [
    "chunk_id",
    "document_id",
    "text",
    "title",
    "authority",
    "jurisdiction",
    "domain",
    "document_type",
    "section",
    "language",
    "page",
    "checksum",
    "embedding_model",
    "vector_dimension",
    # Backward compatibility with qdrant_hybrid_store
    "source",
    "embedding_dimension",
    "sparse_model",
]

# Optional temporal and reference fields
OPTIONAL_TEMPORAL_FIELDS = [
    "publication_date",
    "priority_date",
]

ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$")

_MANIFEST_CACHE: Optional[Dict[str, Any]] = None


def load_manifest_data() -> Dict[str, Any]:
    """Loads source_manifest.jsonl indexed by relative path, filename, checksum, and document_id."""
    global _MANIFEST_CACHE
    if _MANIFEST_CACHE is not None:
        return _MANIFEST_CACHE

    cache: Dict[str, Any] = {
        "by_path": {},
        "by_name": {},
        "by_checksum": {},
        "by_id": {},
        "records": [],
    }

    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    rec = json.loads(line)
                    cache["records"].append(rec)
                    sp = rec.get("source_path", "").replace("\\", "/")
                    cache["by_path"][sp] = rec
                    cache["by_name"][Path(sp).name.lower()] = rec
                    if rec.get("checksum"):
                        cache["by_checksum"][rec["checksum"]] = rec
                    if rec.get("document_id"):
                        cache["by_id"][rec["document_id"]] = rec
        except Exception as e:
            logger.warning("Could not read manifest %s: %s", MANIFEST_FILE, e)

    _MANIFEST_CACHE = cache
    return cache


def scan_source_pdfs(limit_docs: Optional[int] = None, doc_id: Optional[str] = None) -> List[Path]:
    """
    Scans knowledge-base for verified source PDFs using source_manifest.jsonl.
    Excludes entries with status 'needs_review', 'duplicate', or 'excluded'.
    Falls back to walking SOURCES_DIR excluding needs-review if manifest is unavailable.
    """
    manifest = load_manifest_data()
    verified_pdfs: List[Path] = []

    if manifest["records"]:
        for rec in manifest["records"]:
            if rec.get("status") == "verified":
                if doc_id and rec.get("document_id") != doc_id:
                    continue
                sp = rec.get("source_path", "")
                if sp.lower().endswith(".pdf"):
                    p = (WORKSPACE_ROOT / "knowledge-base" / sp).resolve()
                    if p.exists():
                        verified_pdfs.append(p)
        if verified_pdfs:
            unique_pdfs = sorted(list(dict.fromkeys(verified_pdfs)))
            if limit_docs:
                return unique_pdfs[:limit_docs]
            return unique_pdfs

    # Fallback to scanning SOURCES_DIR excluding needs-review
    pdf_paths: List[Path] = []
    if SOURCES_DIR.exists():
        for root, _, files in os.walk(SOURCES_DIR):
            if "needs-review" in Path(root).parts:
                continue
            for f in files:
                if f.lower().endswith(".pdf"):
                    p = Path(root) / f
                    pdf_paths.append(p)
    unique_paths = sorted(list(dict.fromkeys(pdf_paths)))
    if limit_docs:
        return unique_paths[:limit_docs]
    return unique_paths


def validate_and_normalize_iso_date(date_val: Any) -> Tuple[Optional[str], bool]:
    """
    Validates and normalizes date values.
    Returns: (normalized_date_str_or_None, is_valid)
    - If empty, None, or 'null' -> (None, True)
    - If valid ISO date -> ("YYYY-MM-DD", True)
    - If invalid non-empty string -> (raw_str, False)
    """
    if date_val is None or date_val == "":
        return None, True
    if isinstance(date_val, (datetime.date, datetime.datetime)):
        return date_val.strftime("%Y-%m-%d"), True

    s = str(date_val).strip()
    if not s or s.lower() in ("null", "none"):
        return None, True

    # 4-digit year e.g. '1970'
    if len(s) == 4 and s.isdigit():
        return f"{s}-01-01", True

    # 10-digit standard YYYY-MM-DD
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        try:
            datetime.datetime.strptime(s, "%Y-%m-%d")
            return s, True
        except ValueError:
            return s, False

    # General ISO-8601 datetime format
    try:
        dt = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), True
    except (ValueError, TypeError):
        return s, False


def validate_chunk_metadata(
    chunk: Dict[str, Any],
    allow_incomplete_metadata: bool = True,
) -> Tuple[bool, List[str]]:
    """
    Strictly validates a single chunk against metadata requirements.
    - Required identity fields must never be missing or empty.
    - Optional temporal fields (publication_date, priority_date) may be None/null if source lacks them.
    - If temporal fields are present and non-empty, they must be valid ISO-8601 dates (arbitrary strings rejected).
    """
    hard_errors: List[str] = []
    temporal_issues: List[str] = []

    # 1. Identity fields
    for field in REQUIRED_IDENTITY_FIELDS:
        val = chunk.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            hard_errors.append(f"missing_{field}")

    # 2. Temporal fields
    for date_field in OPTIONAL_TEMPORAL_FIELDS:
        val = chunk.get(date_field)
        if val is None or (isinstance(val, str) and not val.strip()):
            temporal_issues.append(f"missing_{date_field}")
        else:
            _, is_valid = validate_and_normalize_iso_date(val)
            if not is_valid:
                hard_errors.append(f"invalid_iso_date:{date_field}='{val}'")

    if allow_incomplete_metadata:
        is_valid = (len(hard_errors) == 0)
    else:
        is_valid = (len(hard_errors) == 0 and len(temporal_issues) == 0)

    all_issues = hard_errors + temporal_issues
    return (is_valid, all_issues)


def generate_validation_report(
    chunks: List[Dict[str, Any]],
    allow_incomplete_metadata: bool = True,
) -> Dict[str, Any]:
    """
    Produces a comprehensive metadata validation report across all candidate chunks.
    Separates chunks into:
    - valid_chunks: chunks with complete identity and valid (or validly null) temporal metadata
    - incomplete_chunks: chunks missing optional temporal dates (stored as None/null)
    - invalid_chunks: chunks with missing required identity fields or invalid date strings
    """
    valid_chunks: List[Dict[str, Any]] = []
    incomplete_chunks: List[Dict[str, Any]] = []
    invalid_chunks: List[Dict[str, Any]] = []
    missing_fields_counter: Dict[str, int] = {}

    for c in chunks:
        missing_identity = [
            f for f in REQUIRED_IDENTITY_FIELDS
            if c.get(f) is None or (isinstance(c.get(f), str) and not c.get(f).strip())
        ]
        missing_temporal = []
        invalid_dates = []
        for date_field in OPTIONAL_TEMPORAL_FIELDS:
            d_val = c.get(date_field)
            if d_val is None or (isinstance(d_val, str) and not d_val.strip()):
                missing_temporal.append(f"missing_{date_field}")
            else:
                _, is_valid = validate_and_normalize_iso_date(d_val)
                if not is_valid:
                    invalid_dates.append(f"invalid_iso_date:{date_field}='{d_val}'")

        for f in missing_identity + missing_temporal + invalid_dates:
            missing_fields_counter[f] = missing_fields_counter.get(f, 0) + 1

        record = {
            "chunk_id": c.get("chunk_id", "unknown"),
            "document_id": c.get("document_id", "unknown"),
            "source_pdf": c.get("file_name", "unknown"),
            "section": c.get("section", ""),
            "missing_identity_fields": missing_identity,
            "missing_temporal_fields": missing_temporal,
            "invalid_dates": invalid_dates,
            "all_issues": missing_identity + missing_temporal + invalid_dates,
        }

        if missing_identity or invalid_dates:
            invalid_chunks.append(record)
        elif missing_temporal:
            incomplete_chunks.append(record)
        else:
            valid_chunks.append(c)

    is_overall_valid = (len(invalid_chunks) == 0) and (len(incomplete_chunks) == 0 or allow_incomplete_metadata)

    return {
        "total_chunks": len(chunks),
        "valid_chunks_count": len(valid_chunks),
        "incomplete_chunks_count": len(incomplete_chunks),
        "invalid_chunks_count": len(invalid_chunks),
        "is_valid": is_overall_valid,
        "missing_fields_summary": missing_fields_counter,
        "sample_invalid_records": invalid_chunks[:10] if invalid_chunks else incomplete_chunks[:10],
        "incomplete_chunks": incomplete_chunks,
        "invalid_chunks": invalid_chunks,
    }


def load_source_provenance(pdf_path: Path) -> Dict[str, Any]:
    """
    Loads provenance metadata using source_manifest.jsonl as the primary canonical source.
    Falls back to local source.yaml / metadata.yaml or directory structure without inventing metadata.
    """
    manifest = load_manifest_data()
    rec: Optional[Dict[str, Any]] = None

    try:
        rel_kb = str(pdf_path.relative_to(WORKSPACE_ROOT / "knowledge-base")).replace("\\", "/")
        rec = manifest["by_path"].get(rel_kb)
    except ValueError:
        pass

    if not rec:
        rec = manifest["by_name"].get(pdf_path.name.lower())

    if not rec and pdf_path.exists():
        try:
            h = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
            rec = manifest["by_checksum"].get(h)
        except Exception:
            pass

    if rec:
        pub_d, _ = validate_and_normalize_iso_date(rec.get("publication_date"))
        pri_d, _ = validate_and_normalize_iso_date(rec.get("priority_date"))
        return {
            "document_id": rec.get("document_id", pdf_path.stem),
            "title": rec.get("title") or DocumentProcessor._clean_source_name(str(pdf_path)),
            "source": rec.get("title") or DocumentProcessor._clean_source_name(str(pdf_path)),
            "authority": rec.get("authority", "Official Regulatory Authority"),
            "document_type": rec.get("document_type", "statute"),
            "domain": rec.get("domain", "General IP Law"),
            "jurisdiction": rec.get("jurisdiction", "India"),
            "publication_date": pub_d if pub_d else None,
            "priority_date": pri_d if pri_d else None,
            "language": rec.get("language", "en"),
            "source_url": rec.get("source_url") or None,
            "checksum": rec.get("checksum") or None,
            "status": rec.get("status", "verified"),
        }

    # Fallback to directory structure and YAML files if not in manifest
    clean_title = DocumentProcessor._clean_source_name(str(pdf_path))
    meta: Dict[str, Any] = {
        "document_id": pdf_path.stem,
        "title": clean_title,
        "source": clean_title,
        "authority": "Official Regulatory Authority",
        "document_type": "statute",
        "domain": "General IP Law",
        "publication_date": None,
        "priority_date": None,
        "language": "en",
        "jurisdiction": "India",
        "source_url": None,
        "checksum": None,
        "status": "verified",
    }

    path_str = str(pdf_path).lower()
    if "international" in path_str:
        meta["jurisdiction"] = "International"
        meta["document_type"] = "treaty"
        meta["domain"] = "international-treaties"
    elif "biodiversity" in path_str:
        meta["domain"] = "biodiversity-abs"
    elif "traditional" in path_str or "tkdl" in path_str or "ccras" in path_str:
        meta["domain"] = "traditional-knowledge"
    elif "ayush" in path_str or "drugs" in path_str:
        meta["domain"] = "ayush-drug-regulation"
    elif "food" in path_str or "cosmetics" in path_str or "fssai" in path_str:
        meta["domain"] = "food-cosmetics-advertising"
    elif "rules" in path_str:
        meta["document_type"] = "rules"
        meta["domain"] = "patents"

    # Compute checksum if possible
    if pdf_path.exists():
        try:
            meta["checksum"] = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        except Exception:
            pass

    # Traverse parent directories for source.yaml / metadata.yaml
    curr = pdf_path.parent
    source_yaml_path: Optional[Path] = None
    metadata_yaml_path: Optional[Path] = None

    while curr and curr != curr.parent and "sources" in [p.name for p in curr.parents] + [curr.name]:
        if (curr / "source.yaml").exists() and not source_yaml_path:
            source_yaml_path = curr / "source.yaml"
        if (curr / "metadata.yaml").exists() and not metadata_yaml_path:
            metadata_yaml_path = curr / "metadata.yaml"
        curr = curr.parent

    if source_yaml_path and source_yaml_path.exists():
        try:
            with open(source_yaml_path, "r", encoding="utf-8") as f:
                s_data = yaml.safe_load(f) or {}
                meta["document_id"] = s_data.get("source_id", meta["document_id"])
                meta["title"] = s_data.get("title", meta["title"])
                meta["source"] = meta["title"]
                meta["authority"] = s_data.get("issuing_authority", meta["authority"])
                meta["document_type"] = s_data.get("source_type", meta["document_type"])
                pub_d, _ = validate_and_normalize_iso_date(s_data.get("publication_date"))
                pri_d, _ = validate_and_normalize_iso_date(s_data.get("effective_date") or pub_d)
                meta["publication_date"] = pub_d if pub_d else None
                meta["priority_date"] = pri_d if pri_d else None
                meta["language"] = s_data.get("language", "en")
                meta["source_url"] = s_data.get("official_url") or None
                jur_raw = s_data.get("jurisdiction", "")
                if jur_raw.lower() == "india":
                    meta["jurisdiction"] = "India"
                elif jur_raw.lower() == "international":
                    meta["jurisdiction"] = "International"
        except Exception as ex:
            logger.warning("Could not read %s: %s", source_yaml_path, ex)

    if metadata_yaml_path and metadata_yaml_path.exists():
        try:
            with open(metadata_yaml_path, "r", encoding="utf-8") as f:
                m_data = yaml.safe_load(f) or {}
                if not meta["publication_date"]:
                    pub_d, _ = validate_and_normalize_iso_date(m_data.get("publication_date"))
                    meta["publication_date"] = pub_d if pub_d else None
                if not meta["priority_date"]:
                    pri_d, _ = validate_and_normalize_iso_date(m_data.get("effective_date") or meta["publication_date"])
                    meta["priority_date"] = pri_d if pri_d else None
        except Exception as ex:
            logger.warning("Could not read %s: %s", metadata_yaml_path, ex)

    return meta


class QdrantIngestor:
    """
    Orchestrates preflight, dry-run, test-upload, and full ingestion into Qdrant Cloud.
    Guarantees retry-safe uploads, baseline tracking, and strict metadata validation.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        batch_size: int = 16,
        environment: str = "test",
        confirm_production: bool = False,
    ) -> None:
        self.collection_name = collection_name or settings.QDRANT_COLLECTION or "ragvyn_hybrid_test"
        self.batch_size = batch_size
        self.environment = (environment or "test").lower().strip()
        self.confirm_production = bool(confirm_production)
        self.doc_processor = DocumentProcessor()

        # Strict safety invariant
        if self.collection_name.strip() == PROHIBITED_COLLECTION:
            if self.environment != "production" or not self.confirm_production:
                raise ValueError(
                    f"Writing to production collection '{PROHIBITED_COLLECTION}' is prohibited during Phase 2 "
                    f"unless running with --environment production and --confirm-production. "
                    f"Target must be '{settings.QDRANT_COLLECTION}' or a designated test collection."
                )

    def get_collection_baseline(self) -> Dict[str, Any]:
        """Records collection state before and after upload operations."""
        client = qdrant_hybrid_store.get_client()
        points_count = 0
        existing_point_ids: List[str] = []

        try:
            col_info = client.get_collection(self.collection_name)
            points_count = col_info.points_count or 0
            offset = None
            while True:
                records, offset = client.scroll(
                    collection_name=self.collection_name,
                    limit=10000,
                    offset=offset,
                    with_payload=False,
                    with_vectors=False,
                )
                existing_point_ids.extend(str(r.id) for r in records)
                if offset is None:
                    break
        except Exception as exc:
            logger.warning("Could not fetch collection baseline for '%s': %s", self.collection_name, exc)

        return {
            "collection_name": self.collection_name,
            "points_count": points_count,
            "point_ids": existing_point_ids,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    def prepare_all_chunks(
        self,
        limit_docs: Optional[int] = None,
        doc_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Parses all discovered PDFs into standardized chunks with complete normalized metadata."""
        pdf_files = scan_source_pdfs(limit_docs=limit_docs, doc_id=doc_id)
        all_chunks: List[Dict[str, Any]] = []
        stats: Dict[str, Any] = {
            "documents_discovered": len(pdf_files),
            "documents_parsed": 0,
            "documents_failed": 0,
            "total_chunks": 0,
            "missing_metadata_fields": set(),
        }

        for pdf_path in pdf_files:
            provenance = load_source_provenance(pdf_path)
            # Skip non-verified files
            if provenance.get("status") in ("needs_review", "duplicate", "excluded"):
                logger.info("Skipping non-verified document %s (status: %s)", pdf_path.name, provenance.get("status"))
                continue

            try:
                raw_chunks = self.doc_processor.chunk_pdf(
                    str(pdf_path),
                    jurisdiction=provenance["jurisdiction"],
                )
                if not raw_chunks:
                    logger.warning("No chunks produced from %s", pdf_path.name)
                    continue

                for rc in raw_chunks:
                    chunk_item = {
                        # 17 standardized payload fields for IP-SAKTI Sahayak:
                        "chunk_id": rc["chunk_id"],
                        "document_id": provenance["document_id"],
                        "text": rc["text"],
                        "title": provenance.get("title") or provenance.get("source") or DocumentProcessor._clean_source_name(str(pdf_path)),
                        "authority": provenance.get("authority", "Official Regulatory Authority"),
                        "jurisdiction": provenance.get("jurisdiction", "India"),
                        "domain": provenance.get("domain", "General IP Law"),
                        "document_type": provenance.get("document_type", "statute"),
                        "section": rc.get("section", ""),
                        "language": provenance.get("language", "en"),
                        "publication_date": provenance.get("publication_date"),  # ISO YYYY-MM-DD or None
                        "priority_date": provenance.get("priority_date"),        # ISO YYYY-MM-DD or None
                        "source_url": provenance.get("source_url"),              # string or None
                        "page": rc.get("page_number", 1),
                        "checksum": provenance.get("checksum"),
                        "embedding_model": settings.HF_EMBEDDING_MODEL,
                        "vector_dimension": DENSE_DIMENSION,

                        # Backward compatibility and auxiliary fields:
                        "source": provenance.get("title") or provenance.get("source") or DocumentProcessor._clean_source_name(str(pdf_path)),
                        "page_number": rc.get("page_number", 1),
                        "parent_section": rc.get("parent_section", rc.get("section", "")),
                        "chapter": rc.get("chapter", "General Provisions"),
                        "file_name": pdf_path.name,
                        "embedding_dimension": DENSE_DIMENSION,
                        "sparse_model": "Qdrant/bm25",
                    }

                    # Check for empty mandatory identity fields
                    for field in REQUIRED_IDENTITY_FIELDS:
                        val = chunk_item.get(field)
                        if val is None or (isinstance(val, str) and not val.strip()):
                            stats["missing_metadata_fields"].add(f"{field} (in {pdf_path.name})")

                    all_chunks.append(chunk_item)

                stats["documents_parsed"] += 1

            except Exception as e:
                logger.error("Failed to parse %s: %s", pdf_path.name, e, exc_info=True)
                stats["documents_failed"] += 1

        stats["total_chunks"] = len(all_chunks)
        stats["sec3_clauses_count"] = sum(
            1 for c in all_chunks
            if c.get("parent_section") == "Section 3" and c.get("document_id") == "patents-act-1970"
        )
        stats["missing_metadata_fields"] = sorted(list(stats["missing_metadata_fields"]))
        return all_chunks, stats

    def run_preflight(self, limit_docs: Optional[int] = None, doc_id: Optional[str] = None) -> Dict[str, Any]:
        """Preflight mode: verifies collection schema, baseline, and counts without uploading."""
        logger.info("=== Qdrant Ingestion [PREFLIGHT MODE] ===")
        logger.info("Target Collection: %s", self.collection_name)

        # 1. Schema check
        schema_report = qdrant_hybrid_store.verify_collection_schema(self.collection_name)

        # 2. Baseline check
        baseline = self.get_collection_baseline()

        # 3. Count sources and chunks
        all_chunks, stats = self.prepare_all_chunks(limit_docs=limit_docs, doc_id=doc_id)

        # 4. Metadata validation report
        val_report = generate_validation_report(all_chunks, allow_incomplete_metadata=True)

        report = {
            "mode": "preflight",
            "target_collection": self.collection_name,
            "schema_verified": schema_report["is_compatible"],
            "total_pdfs": stats["documents_discovered"],
            "total_chunks": stats["total_chunks"],
            "valid_chunks": val_report["valid_chunks_count"],
            "incomplete_chunks": val_report["incomplete_chunks_count"],
            "invalid_chunks": val_report["invalid_chunks_count"],
            "exact_missing_fields": val_report["missing_fields_summary"],
            "existing_qdrant_point_count": baseline["points_count"],
            "all_required_payload_indexes": schema_report["indexed_payload_fields"],
            "zero_writes_confirmed": True,
            "upload_executed": False,
        }

        logger.info(
            "Preflight complete: %d PDFs, %d chunks (%d valid, %d incomplete, %d invalid). Existing points: %d",
            stats["documents_discovered"],
            stats["total_chunks"],
            val_report["valid_chunks_count"],
            val_report["incomplete_chunks_count"],
            val_report["invalid_chunks_count"],
            baseline["points_count"],
        )
        return report

    def run_dry_run(
        self,
        embed: bool = False,
        limit_chunks: int = 10,
        limit_docs: Optional[int] = None,
        doc_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dry-run mode: builds points and optionally generates embeddings, but uploads nothing.
        Correctness invariant: Strictly calls embed_documents() and embed_passages() for passages.
        Guarantees zero writes to Qdrant Cloud.
        """
        logger.info("=== Qdrant Ingestion [DRY-RUN MODE] (embed=%s) ===", embed)
        schema_verified = False
        try:
            schema_report = qdrant_hybrid_store.verify_collection_schema(self.collection_name)
            schema_verified = schema_report["is_compatible"]
        except Exception as exc:
            logger.warning("Target collection schema verification: %s", exc)

        all_chunks, stats = self.prepare_all_chunks(limit_docs=limit_docs, doc_id=doc_id)
        points_built = 0
        validation_errors = []

        val_report = generate_validation_report(all_chunks, allow_incomplete_metadata=True)

        sample_chunks = all_chunks[:limit_chunks] if not embed else all_chunks[:min(5, len(all_chunks))]
        sample_texts = [c["text"] for c in sample_chunks]

        if sample_chunks:
            if embed:
                logger.info("Dry-run generating real embeddings via document methods (embed_documents, embed_passages)...")
                dense_vectors = canonical_embedder.embed_documents(sample_texts, batch_size=len(sample_chunks))
                sparse_vectors = sparse_embedder.embed_passages(sample_texts, batch_size=len(sample_chunks))
            else:
                dense_vectors = [[0.0] * DENSE_DIMENSION for _ in sample_chunks]
                sparse_vectors = [qmodels.SparseVector(indices=[1], values=[1.0]) for _ in sample_chunks]

            for c, d_vec, s_vec in zip(sample_chunks, dense_vectors, sparse_vectors):
                try:
                    pt = build_hybrid_point(
                        collection_name=self.collection_name,
                        chunk_id=c["chunk_id"],
                        dense_vector=d_vec,
                        sparse_vector=s_vec,
                        payload=c,
                    )
                    # Verify 17 standardized payload fields are present
                    for f in STANDARDIZED_PAYLOAD_FIELDS:
                        if f not in c:
                            raise ValueError(f"Missing 17-field contract member: {f}")
                    points_built += 1
                except Exception as e:
                    validation_errors.append(f"Chunk '{c['chunk_id']}': {e}")

        report = {
            "mode": "dry-run",
            "target_collection": self.collection_name,
            "schema_verified": schema_verified,
            "documents_parsed": stats["documents_parsed"],
            "total_chunks_discovered": stats["total_chunks"],
            "sample_points_built": points_built,
            "validation_errors": validation_errors,
            "valid_chunks": val_report["valid_chunks_count"],
            "incomplete_chunks": val_report["incomplete_chunks_count"],
            "invalid_chunks": val_report["invalid_chunks_count"],
            "missing_fields_summary": val_report["missing_fields_summary"],
            "zero_writes_confirmed": True,
            "upload_executed": False,
        }
        logger.info("Dry-run complete: %d points validated, 0 writes executed.", points_built)
        return report

    def run_test_upload(self, limit: int = 5, allow_incomplete_metadata: bool = True) -> Dict[str, Any]:
        """
        Test-upload mode: uploads exactly N chunks into test collection using retry-safe store method.
        Records baseline before and after to track collisions and new points.
        """
        if self.collection_name.strip() == PROHIBITED_COLLECTION:
            raise ValueError(
                f"Test-upload mode is strictly forbidden against production collection '{PROHIBITED_COLLECTION}'. "
                "Only full verified production ingestion is permitted."
            )

        logger.info("=== Qdrant Ingestion [TEST-UPLOAD MODE] (limit=%d) ===", limit)
        qdrant_hybrid_store.verify_collection_schema(self.collection_name)

        all_chunks, stats = self.prepare_all_chunks()
        if not all_chunks:
            raise RuntimeError("No chunks available for test upload.")

        # 1. Baseline before upload
        baseline_before = self.get_collection_baseline()

        target_chunks = all_chunks[:limit]
        texts = [c["text"] for c in target_chunks]

        logger.info("Generating dual-vector embeddings for %d test chunks...", len(target_chunks))
        dense_vectors = canonical_embedder.embed_documents(texts, batch_size=len(texts))
        sparse_vectors = sparse_embedder.embed_passages(texts, batch_size=len(texts))

        points: List[qmodels.PointStruct] = []
        uploaded_ids: List[str] = []
        for chunk, d_vec, s_vec in zip(target_chunks, dense_vectors, sparse_vectors):
            pt = build_hybrid_point(
                collection_name=self.collection_name,
                chunk_id=chunk["chunk_id"],
                dense_vector=d_vec,
                sparse_vector=s_vec,
                payload=chunk,
            )
            points.append(pt)
            uploaded_ids.append(pt.id)

        # 2. Upload points with exponential retry
        res = qdrant_hybrid_store.upsert_points(
            collection_name=self.collection_name,
            points=points,
            max_retries=3,
            retry_delay=1.0,
        )

        # 3. Baseline after upload
        baseline_after = self.get_collection_baseline()

        existing_set = set(baseline_before["point_ids"])
        uploaded_set = set(uploaded_ids)
        collisions = sorted(list(uploaded_set & existing_set))
        newly_created = sorted(list(uploaded_set - existing_set))

        report = {
            "mode": "test-upload",
            "target_collection": self.collection_name,
            "chunks_requested": limit,
            "points_before": baseline_before["points_count"],
            "points_uploaded": len(points),
            "points_after": baseline_after["points_count"],
            "deterministic_id_collisions": len(collisions),
            "newly_created_points": len(newly_created),
            "point_ids": uploaded_ids,
            "upsert_status": res.status.value if hasattr(res.status, "value") else str(res.status),
            "dual_vectors_verified": all(
                DENSE_VECTOR_NAME in p.vector and SPARSE_VECTOR_NAME in p.vector for p in points
            ),
            "upload_executed": True,
        }
        logger.info(
            "Test-upload complete: %d points uploaded (before: %d, after: %d, collisions: %d, new: %d).",
            len(points),
            baseline_before["points_count"],
            baseline_after["points_count"],
            len(collisions),
            len(newly_created),
        )
        return report

    def run_full_ingestion(
        self,
        confirm: bool = False,
        batch_size: int = 16,
        allow_incomplete_metadata: bool = False,
    ) -> Dict[str, Any]:
        """
        Full ingestion mode: uploads complete corpus into target collection.
        Requires explicit confirm=True flag. Reruns are idempotent via UUID5 IDs.
        Strictly enforces metadata validation before embedding.
        For ragvyn_prod_v1, requires environment='production' and confirm_production=True.
        """
        is_prod = (self.collection_name.strip() == PROHIBITED_COLLECTION)

        if is_prod:
            if self.environment != "production":
                raise ValueError(
                    f"Production ingestion requires --environment production, got '{self.environment}'."
                )
            if not self.confirm_production:
                raise ValueError(
                    "Production ingestion requires explicit --confirm-production flag."
                )
            print("\n" + "=" * 80)
            print("  [WARNING] ATTENTION: EXECUTING PRODUCTION INGESTION INTO ragvyn_prod_v1")
            print(f"  Target Collection: {self.collection_name} | Environment: {self.environment}")
            print("  This operation will populate the official production vector collection.")
            print("=" * 80 + "\n")
            logger.warning("EXECUTING PRODUCTION INGESTION INTO %s", self.collection_name)

        if not confirm:
            raise ValueError(
                "Full corpus ingestion requires explicit confirmation (--confirm flag). "
                "Aborting to prevent unintentional full uploads."
            )

        start_time = time.time()
        logger.info("=== Qdrant Ingestion [FULL CORPUS MODE] ===")
        logger.info("Target Collection: %s | Batch Size: %d", self.collection_name, batch_size)

        qdrant_hybrid_store.verify_collection_schema(self.collection_name)
        all_chunks, stats = self.prepare_all_chunks()
        total_chunks = len(all_chunks)

        # Audit against approved v2 reference collection
        if is_prod:
            logger.info("Auditing candidate chunks against reference collection 'ragvyn_hybrid_test_v2'...")
            client = qdrant_hybrid_store.get_client()
            v2_records, _ = client.scroll(
                collection_name="ragvyn_hybrid_test_v2",
                limit=10000,
                with_payload=True,
                with_vectors=False,
            )
            v2_chunk_ids = {r.payload.get("chunk_id") for r in v2_records if r.payload}
            candidate_chunk_ids = {c["chunk_id"] for c in all_chunks}
            if len(all_chunks) != 753:
                raise ValueError(f"Expected exactly 753 chunks for production corpus, found {len(all_chunks)}.")
            if len(v2_chunk_ids) != 753:
                raise ValueError(f"Expected reference collection 'ragvyn_hybrid_test_v2' to have 753 chunk IDs, found {len(v2_chunk_ids)}.")
            diff_ids = candidate_chunk_ids.symmetric_difference(v2_chunk_ids)
            if diff_ids:
                raise ValueError(
                    f"Production candidate chunks differ from v2 reference chunks: {len(diff_ids)} discrepancies. "
                    f"Sample: {list(diff_ids)[:5]}"
                )
            logger.info("[OK] Reference audit passed: candidate chunks match 'ragvyn_hybrid_test_v2' 753/753 exactly.")

        # Validate metadata across all chunks before touching network or embedding
        validation_report = generate_validation_report(all_chunks, allow_incomplete_metadata=allow_incomplete_metadata)
        if validation_report["invalid_chunks_count"] > 0:
            raise ValueError(
                f"Full ingestion aborted: {validation_report['invalid_chunks_count']} chunks have missing required identity fields or invalid dates. "
                f"Identity fields can never be missing. Details: {validation_report['invalid_chunks'][0]}"
            )
        if validation_report["incomplete_chunks_count"] > 0 and not allow_incomplete_metadata:
            raise ValueError(
                f"Full ingestion aborted: {validation_report['incomplete_chunks_count']} chunks have missing optional temporal metadata. "
                f"Run with --allow-incomplete-metadata to proceed with safe datetime omission. "
                f"First incomplete: {validation_report['incomplete_chunks'][0]}"
            )

        baseline_before = self.get_collection_baseline()
        existing_set = set(baseline_before["point_ids"])

        points_uploaded = 0
        batches_failed = 0
        all_uploaded_ids: List[str] = []
        failed_chunk_ids: List[str] = []
        failed_doc_ids: Set[str] = set()

        logger.info(
            "Starting ingestion of %d chunks across %d batches (Collection baseline: %d existing points)...",
            total_chunks,
            (total_chunks + batch_size - 1) // batch_size,
            len(existing_set),
        )

        for i in range(0, total_chunks, batch_size):
            batch_chunks = all_chunks[i : i + batch_size]
            batch_point_ids = [
                generate_point_id(self.collection_name, c["chunk_id"]) for c in batch_chunks
            ]

            # Fast resume: Skip batch if all point IDs already exist in collection
            if set(batch_point_ids).issubset(existing_set):
                points_uploaded += len(batch_chunks)
                all_uploaded_ids.extend(batch_point_ids)
                if (i // batch_size) % 50 == 0 or (i + len(batch_chunks)) >= total_chunks:
                    logger.info(
                        "Verified existing points for batch %d..%d / %d (Total verified: %d)",
                        i,
                        i + len(batch_chunks),
                        total_chunks,
                        points_uploaded,
                    )
                continue

            batch_texts = [c["text"] for c in batch_chunks]

            try:
                # 1. Generate dual vectors
                dense_vecs = canonical_embedder.embed_documents(batch_texts, batch_size=batch_size)
                sparse_vecs = sparse_embedder.embed_passages(batch_texts, batch_size=batch_size)

                # 2. Build PointStructs
                batch_points: List[qmodels.PointStruct] = []
                for c, d_vec, s_vec in zip(batch_chunks, dense_vecs, sparse_vecs):
                    pt = build_hybrid_point(
                        collection_name=self.collection_name,
                        chunk_id=c["chunk_id"],
                        dense_vector=d_vec,
                        sparse_vector=s_vec,
                        payload=c,
                    )
                    batch_points.append(pt)
                    all_uploaded_ids.append(pt.id)

                # 3. Upsert batch to Qdrant Cloud with exponential retries
                qdrant_hybrid_store.upsert_points(
                    collection_name=self.collection_name,
                    points=batch_points,
                    max_retries=3,
                    retry_delay=1.0,
                )
                points_uploaded += len(batch_points)
                logger.info("Upserted batch %d..%d / %d (Total: %d)", i, i + len(batch_points), total_chunks, points_uploaded)

            except Exception as exc:
                batches_failed += 1
                logger.error("Failed to ingest batch %d..%d: %s", i, i + len(batch_chunks), exc)
                for c in batch_chunks:
                    failed_chunk_ids.append(c["chunk_id"])
                    failed_doc_ids.add(c["document_id"])
                raise RuntimeError(
                    f"Ingestion halted on batch {i}: {exc}. "
                    f"Failed chunk count in batch: {len(batch_chunks)}. "
                    f"Sample failed chunk: {batch_chunks[0]['chunk_id']}"
                ) from exc

        baseline_after = self.get_collection_baseline()
        existing_set = set(baseline_before["point_ids"])
        uploaded_set = set(all_uploaded_ids)
        collisions = sorted(list(uploaded_set & existing_set))
        newly_created = sorted(list(uploaded_set - existing_set))

        elapsed = time.time() - start_time
        report = {
            "mode": "full",
            "target_collection": self.collection_name,
            "documents_discovered": stats["documents_discovered"],
            "documents_parsed": stats["documents_parsed"],
            "documents_failed": stats["documents_failed"],
            "total_chunks": total_chunks,
            "expected_chunk_count": total_chunks,
            "points_before": baseline_before["points_count"],
            "points_uploaded": points_uploaded,
            "points_after": baseline_after["points_count"],
            "deterministic_id_collisions": len(collisions),
            "newly_created_points": len(newly_created),
            "points_failed": len(failed_chunk_ids),
            "failed_chunk_ids": failed_chunk_ids,
            "failed_document_ids": sorted(list(failed_doc_ids)),
            "is_count_consistent": (baseline_after["points_count"] == total_chunks),
            "dense_embedding_model": settings.HF_EMBEDDING_MODEL,
            "sparse_embedding_model": "Qdrant/bm25",
            "elapsed_seconds": round(elapsed, 2),
            "upload_executed": True,
        }
        logger.info("Full ingestion complete in %.2fs: %d points uploaded.", elapsed, points_uploaded)
        return report


def run_qdrant_ingestion(
    mode: str = "preflight",
    limit: int = 5,
    batch_size: int = 16,
    generate_embeddings: bool = False,
    embed: bool = False,
    confirm: bool = False,
    allow_incomplete_metadata: bool = False,
    collection_name: Optional[str] = None,
    environment: str = "test",
    confirm_production: bool = False,
    limit_docs: Optional[int] = None,
    doc_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Top-level invocation helper for programmatic and test execution."""
    ingestor = QdrantIngestor(
        collection_name=collection_name,
        batch_size=batch_size,
        environment=environment,
        confirm_production=confirm_production,
    )
    if mode == "preflight":
        return ingestor.run_preflight(limit_docs=limit_docs, doc_id=doc_id)
    elif mode == "dry-run":
        return ingestor.run_dry_run(embed=(generate_embeddings or embed), limit_docs=limit_docs, doc_id=doc_id)
    elif mode == "test-upload":
        return ingestor.run_test_upload(limit=limit, allow_incomplete_metadata=allow_incomplete_metadata)
    elif mode == "full":
        return ingestor.run_full_ingestion(
            confirm=confirm,
            batch_size=batch_size,
            allow_incomplete_metadata=allow_incomplete_metadata,
        )
    else:
        raise ValueError(f"Unknown mode: {mode}")


def main():
    parser = argparse.ArgumentParser(description="IP-SAKTI Sahayak Qdrant Hybrid Ingestion Pipeline")
    parser.add_argument(
        "--mode",
        choices=["preflight", "dry-run", "test-upload", "full"],
        default="preflight",
        help="Ingestion mode (preflight, dry-run, test-upload, full)",
    )
    parser.add_argument("--limit", type=int, default=5, help="Number of chunks for test-upload (default: 5)")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for embedding and upsert (default: 16)")
    parser.add_argument("--embed", action="store_true", help="Generate embeddings during dry-run using document methods")
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation required for full corpus upload")
    parser.add_argument(
        "--allow-incomplete-metadata",
        action="store_true",
        help="Allow chunks with missing dates to proceed during ingestion",
    )
    parser.add_argument("--collection", type=str, default=None, help="Target collection name (defaults to settings.QDRANT_COLLECTION)")
    parser.add_argument(
        "--environment",
        choices=["test", "production"],
        default="test",
        help="Execution environment ('test' or 'production')",
    )
    parser.add_argument(
        "--confirm-production",
        action="store_true",
        help="Explicit production confirmation flag required when targeting ragvyn_prod_v1",
    )
    parser.add_argument(
        "--limit-docs",
        type=int,
        default=None,
        help="Limit number of documents to process in preflight / dry-run",
    )
    parser.add_argument(
        "--doc-id",
        type=str,
        default=None,
        help="Filter ingestion to a specific document_id from source_manifest.jsonl",
    )

    args = parser.parse_args()

    ingestor = QdrantIngestor(
        collection_name=args.collection,
        batch_size=args.batch_size,
        environment=args.environment,
        confirm_production=args.confirm_production,
    )

    if args.mode == "preflight":
        res = ingestor.run_preflight(limit_docs=args.limit_docs, doc_id=args.doc_id)
        print("\n--- Preflight Summary ---")
        for k, v in res.items():
            print(f"  {k}: {v}")

    elif args.mode == "dry-run":
        res = ingestor.run_dry_run(embed=args.embed, limit_docs=args.limit_docs, doc_id=args.doc_id)
        print("\n--- Dry-Run Summary ---")
        for k, v in res.items():
            print(f"  {k}: {v}")

    elif args.mode == "test-upload":
        res = ingestor.run_test_upload(
            limit=args.limit,
            allow_incomplete_metadata=args.allow_incomplete_metadata,
        )
        print("\n--- Test-Upload Summary ---")
        for k, v in res.items():
            print(f"  {k}: {v}")

    elif args.mode == "full":
        res = ingestor.run_full_ingestion(
            confirm=args.confirm,
            batch_size=args.batch_size,
            allow_incomplete_metadata=args.allow_incomplete_metadata,
        )
        print("\n--- Full Ingestion Summary ---")
        for k, v in res.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
