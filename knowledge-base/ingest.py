"""
knowledge-base/ingest.py
------------------------
Unified offline ingestion script for IP-SAKTI Sahayak.
Parses raw PDF legal statutes and treaties from the knowledge base,
generates dense vector embeddings with SentenceTransformers, populates ChromaDB
collections (isolated by jurisdiction), and builds + serializes a persisted BM25 index.

Usage:
    python knowledge-base/ingest.py
"""

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


def determine_jurisdiction(file_path: Path) -> Tuple[str, str]:
    """
    Determines jurisdiction and target Chroma collection based on filepath and filename keywords.
    Returns: (collection_name, jurisdiction_label)
    """
    path_str = str(file_path).lower()
    filename = file_path.name.lower()

    if "international" in path_str or any(kw in filename for kw in INTERNATIONAL_KEYWORDS):
        return COLLECTION_INTERNATIONAL, "International"

    if "india" in path_str or any(kw in filename for kw in INDIA_KEYWORDS):
        return COLLECTION_INDIA, "India"

    # Default fallback
    return COLLECTION_INDIA, "India"


def scan_all_pdfs() -> List[Path]:
    """Finds all raw PDF legal documents in knowledge base sources directory."""
    pdf_paths: List[Path] = []
    if KB_SOURCES_DIR.exists():
        for root, _, files in os.walk(KB_SOURCES_DIR):
            for f in files:
                if f.lower().endswith(".pdf"):
                    pdf_path = Path(root) / f
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


if __name__ == "__main__":
    run_ingestion()
