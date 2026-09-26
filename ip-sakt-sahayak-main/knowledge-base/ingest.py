"""
knowledge-base/ingest.py
------------------------
[DEPRECATED in Phase 2]
Legacy offline ingestion script for ChromaDB and rank_bm25 using local SentenceTransformer.

For canonical Qdrant hybrid ingestion using Hugging Face BAAI/bge-m3 (dense 1024-d)
and FastEmbed Qdrant/bm25 (sparse), use:
    knowledge-base/qdrant_ingest.py

Architectural roles:
- BGE-M3 via Hugging Face InferenceClient: dense embeddings (documents & queries)
- FastEmbed Qdrant/bm25: sparse embeddings (passage_embed & query_embed)
- CrossEncoder: neural reranking only (reranker_service.py)
- ChromaDB: legacy retrieval backend
- Qdrant: shadow hybrid retrieval during Phase 2

Usage (Legacy):
    python knowledge-base/ingest.py
"""

import warnings

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure backend modules can be imported
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = WORKSPACE_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from app.services.bm25_service import PersistedBM25Index
from app.services.document_processor import DocumentProcessor

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("UnifiedIngestor")

# Directory configurations
KB_DIR = WORKSPACE_ROOT / "knowledge-base"
KB_SOURCES_DIR = KB_DIR / "sources"
KB_MANIFEST_PATH = KB_DIR / "registry" / "source_manifest.jsonl"

# Target Storage Destinations
try:
    from app.core.config import settings
    DEFAULT_CHROMA_DIR = Path(settings.CHROMA_DB_DIR)
    DEFAULT_EMBEDDING_MODEL = settings.EMBEDDING_MODEL_NAME
except ImportError:
    DEFAULT_CHROMA_DIR = BACKEND_DIR / os.getenv("CHROMA_DB_DIR", "chroma_db_bge_m3")
    DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-m3")

BACKEND_CHROMA_PATH = DEFAULT_CHROMA_DIR
BACKEND_BM25_PATH = BACKEND_DIR / "bm25_index.pkl"

# Collection Names
COLLECTION_INDIA = "india_statutes"
COLLECTION_INTERNATIONAL = "international_treaties"

# Router Keywords
INDIA_KEYWORDS = ["patent", "biodiversity", "drugs", "cosmetics", "tkdl", "nba", "ccras", "india"]
INTERNATIONAL_KEYWORDS = ["nagoya", "wipo", "trips", "treaty", "international", "pct"]


def load_manifest_lookup() -> Dict[str, Dict[str, Any]]:
    """Loads source_manifest.jsonl indexed by relative path, filename, and checksum."""
    lookup: Dict[str, Dict[str, Any]] = {}
    if not KB_MANIFEST_PATH.exists():
        return lookup
    try:
        import json
        with open(KB_MANIFEST_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    r = json.loads(line)
                    sp = r.get("source_path", "").replace("\\", "/")
                    lookup[sp] = r
                    lookup[Path(sp).name.lower()] = r
    except Exception as e:
        logger.warning("Could not read manifest %s: %s", KB_MANIFEST_PATH, e)
    return lookup


def determine_jurisdiction(file_path: Path) -> Tuple[str, str]:
    """
    Determines jurisdiction and target Chroma collection based on manifest record
    with fallback to directory structure and filename keywords.
    Returns: (collection_name, jurisdiction_label)
    """
    manifest_lookup = load_manifest_lookup()
    try:
        rel_str = str(file_path.relative_to(KB_DIR)).replace("\\", "/")
    except ValueError:
        rel_str = file_path.name

    rec = manifest_lookup.get(rel_str) or manifest_lookup.get(file_path.name.lower())
    if rec:
        jur = rec.get("jurisdiction", "").strip()
        if jur.lower() == "international":
            return COLLECTION_INTERNATIONAL, "International"
        elif jur.lower() == "india":
            return COLLECTION_INDIA, "India"

    path_str = str(file_path).lower()
    filename = file_path.name.lower()

    if "international" in path_str or any(kw in filename for kw in INTERNATIONAL_KEYWORDS):
        return COLLECTION_INTERNATIONAL, "International"

    if "india" in path_str or any(kw in filename for kw in INDIA_KEYWORDS):
        return COLLECTION_INDIA, "India"

    # Default fallback
    return COLLECTION_INDIA, "India"


def scan_all_pdfs() -> List[Path]:
    """Finds all verified PDF legal documents in knowledge base sources directory."""
    pdf_paths: List[Path] = []
    manifest_lookup = load_manifest_lookup()

    if KB_SOURCES_DIR.exists():
        for root, _, files in os.walk(KB_SOURCES_DIR):
            for f in files:
                if f.lower().endswith(".pdf"):
                    pdf_path = Path(root) / f
                    try:
                        rel_str = str(pdf_path.relative_to(KB_DIR)).replace("\\", "/")
                    except ValueError:
                        rel_str = pdf_path.name

                    rec = manifest_lookup.get(rel_str) or manifest_lookup.get(f.lower())
                    if rec and rec.get("status") in ("excluded", "duplicate", "needs_review"):
                        continue
                    if "needs-review" in rel_str:
                        continue

                    if pdf_path not in pdf_paths:
                        pdf_paths.append(pdf_path)

    return sorted(pdf_paths)


def run_ingestion(
    batch_size: int = 8,
    embedding_model_name: str | None = None,
) -> None:
    """
    Orchestrates end-to-end PDF extraction, vector indexing, and BM25 index compilation.
    """
    warnings.warn(
        "knowledge-base/ingest.py is deprecated in Phase 2. "
        "Use knowledge-base/qdrant_ingest.py for canonical Qdrant hybrid ingestion.",
        DeprecationWarning,
        stacklevel=2,
    )
    embedding_model_name = embedding_model_name or os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL)
    logger.info("=== Starting IP-SAKTI Sahayak Unified Ingestion Pipeline ===")
    logger.info("Workspace Root: %s", WORKSPACE_ROOT)
    logger.info("Target ChromaDB: %s", BACKEND_CHROMA_PATH)
    logger.info("Target BM25 Index: %s", BACKEND_BM25_PATH)
    logger.info("Embedding Model: %s", embedding_model_name)

    pdf_files = scan_all_pdfs()
    if not pdf_files:
        logger.error("No PDF files discovered in %s", KB_SOURCES_DIR)
        return

    logger.info("Discovered %d PDF document(s) for ingestion.", len(pdf_files))

    # 1. Initialize Document Processor & Model
    doc_processor = DocumentProcessor()
    logger.info("Loading SentenceTransformer embedding model: %s...", embedding_model_name)
    embedder = SentenceTransformer(embedding_model_name)

    # 2. Initialize ChromaDB client & collections
    BACKEND_CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=str(BACKEND_CHROMA_PATH))

    collection_india = chroma_client.get_or_create_collection(
        name=COLLECTION_INDIA,
        metadata={"hnsw:space": "cosine", "description": "Indian IP statutes, AYUSH & TKDL rules"},
    )
    collection_intl = chroma_client.get_or_create_collection(
        name=COLLECTION_INTERNATIONAL,
        metadata={"hnsw:space": "cosine", "description": "International IP treaties & agreements"},
    )

    all_indexed_chunks: List[Dict[str, Any]] = []
    india_chunk_count = 0
    intl_chunk_count = 0

    # 3. Process each PDF
    for idx, pdf_path in enumerate(pdf_files, 1):
        target_collection_name, jurisdiction_label = determine_jurisdiction(pdf_path)
        logger.info(
            "[%d/%d] Processing '%s' -> %s (%s)",
            idx,
            len(pdf_files),
            pdf_path.name,
            target_collection_name,
            jurisdiction_label,
        )

        try:
            chunks = doc_processor.chunk_pdf(str(pdf_path), jurisdiction=jurisdiction_label)
            if not chunks:
                logger.warning("No text chunks generated for %s, skipping.", pdf_path.name)
                continue

            # Attach jurisdiction to metadata
            for chunk in chunks:
                chunk["jurisdiction"] = jurisdiction_label
                chunk["collection_name"] = target_collection_name
                chunk["file_path"] = str(pdf_path)

            target_collection = (
                collection_india if target_collection_name == COLLECTION_INDIA else collection_intl
            )

            # 4. Embed in batches and upsert to ChromaDB
            total_chunks = len(chunks)
            for b_start in range(0, total_chunks, batch_size):
                b_end = min(b_start + batch_size, total_chunks)
                batch_chunks = chunks[b_start:b_end]

                batch_texts = [c["text"] for c in batch_chunks]
                batch_ids = [c["chunk_id"] for c in batch_chunks]
                batch_metadatas = [
                    {
                        "source": c.get("source", ""),
                        "section": c.get("section", ""),
                        "section_title": c.get("section_title", ""),
                        "chapter": c.get("chapter", ""),
                        "page_number": c.get("page_number", 1),
                        "jurisdiction": c.get("jurisdiction", jurisdiction_label),
                    }
                    for c in batch_chunks
                ]

                # Compute dense vector embeddings
                batch_embeddings = embedder.encode(
                    batch_texts,
                    batch_size=batch_size,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                ).tolist()

                # Upsert into ChromaDB
                target_collection.upsert(
                    ids=batch_ids,
                    documents=batch_texts,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas,
                )

            if target_collection_name == COLLECTION_INDIA:
                india_chunk_count += total_chunks
            else:
                intl_chunk_count += total_chunks

            all_indexed_chunks.extend(chunks)
            logger.info("Upserted %d chunks from %s into ChromaDB.", total_chunks, pdf_path.name)

        except Exception as e:
            logger.error("Error processing %s: %s", pdf_path.name, e, exc_info=True)

    # 5. Build and save global PersistedBM25Index
    logger.info("=== Building Persisted BM25 Index ===")
    logger.info("Total chunks across all collections: %d", len(all_indexed_chunks))

    bm25_engine = PersistedBM25Index()
    bm25_engine.build_and_save(all_indexed_chunks, str(BACKEND_BM25_PATH))

    logger.info("=== Ingestion Summary ===")
    logger.info("Total PDFs Processed:       %d", len(pdf_files))
    logger.info("India Statutes Chunks:      %d", india_chunk_count)
    logger.info("International Treaties Chunks: %d", intl_chunk_count)
    logger.info("Total Ingested Chunks:      %d", len(all_indexed_chunks))
    logger.info("ChromaDB Persisted Path:    %s", BACKEND_CHROMA_PATH)
    logger.info("BM25 Index Persisted Path:  %s", BACKEND_BM25_PATH)
    logger.info("=== Ingestion Completed Successfully ===")


def build_qdrant_hybrid_points(
    chunks: List[Dict[str, Any]],
    collection_name: str = "ragvyn_hybrid_test",
    batch_size: int = 16,
) -> List[Any]:
    """
    Constructs dual-vector PointStructs for Qdrant Cloud ingestion using
    the canonical Hugging Face dense embedder and FastEmbed BM25 sparse embedder.
    Enforces strict UUID5 IDs and complete payload metadata.
    """
    from app.services.embedding_service import canonical_embedder
    from app.services.sparse_embedding_service import sparse_embedder
    from app.services.qdrant_hybrid_store import build_hybrid_point

    if not chunks:
        return []

    texts = [c["text"] for c in chunks]
    dense_vectors = canonical_embedder.embed_documents(texts, batch_size=batch_size)
    sparse_vectors = sparse_embedder.embed_passages(texts, batch_size=batch_size)

    points = []
    for item, d_vec, s_vec in zip(chunks, dense_vectors, sparse_vectors):
        pt = build_hybrid_point(
            collection_name=collection_name,
            chunk_id=item["chunk_id"],
            dense_vector=d_vec,
            sparse_vector=s_vec,
            payload=item,
        )
        points.append(pt)
    return points


if __name__ == "__main__":
    run_ingestion()
