"""
backend/app/rag/ingestion.py
------------------------------
PDF-to-chunks-to-embeddings ingestion workflow.

Recursively finds PDF files in a source directory, extracts text page by
page, creates overlapping chunks, embeds them with the BGE model, and
upserts them idempotently into a persistent ChromaDB collection.

Usage (from backend/ directory)
-------------------------------
    # Ingest all PDFs in corpus/raw/
    python -m app.rag.ingestion --source ../corpus/raw

    # Re-index a specific file (deletes old vectors first)
    python -m app.rag.ingestion --source ../corpus/raw --reindex
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from app.rag.config import get_settings
from app.rag.document_loader import extract_pages
from app.rag.chunking import chunk_document
from app.rag.embeddings import embed_texts
from app.rag.vector_store import upsert_chunks, delete_by_source

# ---------------------------------------------------------------------------
# Logging setup (only when run as __main__)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def ingest_directory(
    source_dir: Path,
    reindex: bool = False,
) -> dict[str, int]:
    """
    Ingest all PDF files from *source_dir* into ChromaDB.

    Parameters
    ----------
    source_dir:
        Directory to scan recursively for PDF files.
    reindex:
        If True, delete existing vectors for each source file before
        re-ingesting.  Use this when a PDF has been updated on disk.

    Returns
    -------
    dict[str, int]
        Mapping of filename → number of chunks ingested.
    """
    source_dir = Path(source_dir).resolve()
    if not source_dir.exists():
        log.error("Source directory does not exist: %s", source_dir)
        return {}

    settings = get_settings()

    # Find all PDF files recursively (case-insensitive extension match)
    pdf_files = sorted(
        set(source_dir.rglob("*.pdf")) | set(source_dir.rglob("*.PDF"))
    )

    if not pdf_files:
        log.warning("No PDF files found in %s", source_dir)
        return {}

    log.info("Found %d PDF file(s) in %s", len(pdf_files), source_dir)

    results: dict[str, int] = {}

    for pdf_path in pdf_files:
        filename = pdf_path.name
        source_path_str = str(pdf_path)

        log.info("Processing: %s", filename)

        # Step 1: Extract pages
        pages = extract_pages(pdf_path)
        if not pages:
            log.warning("Skipping '%s' — no readable text.", filename)
            results[filename] = 0
            continue

        log.info(
            "  Extracted %d pages from '%s' (pages %d–%d).",
            len(pages),
            filename,
            pages[0].page_number,
            pages[-1].page_number,
        )

        # Step 2: Chunk
        chunks = chunk_document(
            pages=pages,
            source_filename=filename,
            source_path=source_path_str,
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap,
        )

        if not chunks:
            log.warning("Skipping '%s' — chunking produced 0 chunks.", filename)
            results[filename] = 0
            continue

        # Step 3: Optionally delete old vectors (re-index mode)
        if reindex:
            deleted = delete_by_source(source_path_str)
            if deleted:
                log.info("  Re-index: deleted %d old chunks for '%s'.", deleted, filename)

        # Step 4: Embed
        log.info("  Embedding %d chunks with %s ...", len(chunks), settings.rag_embedding_model)
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)

        # Step 5: Upsert
        upsert_chunks(chunks, embeddings)

        results[filename] = len(chunks)
        log.info("  Ingested %d chunks from '%s'.", len(chunks), filename)

    # Summary
    total = sum(results.values())
    log.info("=" * 60)
    log.info("INGESTION COMPLETE")
    log.info("  Files processed: %d", len(results))
    log.info("  Total chunks ingested: %d", total)
    for fname, count in results.items():
        status = f"{count} chunks" if count > 0 else "SKIPPED"
        log.info("    %s — %s", fname, status)
    log.info("=" * 60)

    return results


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """CLI entry point for ingestion."""
    parser = argparse.ArgumentParser(
        description="Ingest PDF documents into the IP-SAKTI ChromaDB vector store.",
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Path to the directory containing PDF files to ingest.",
    )
    parser.add_argument(
        "--reindex",
        action="store_true",
        default=False,
        help=(
            "Delete existing vectors for each source file before re-ingesting. "
            "Use when a PDF has been updated."
        ),
    )

    args = parser.parse_args()
    source_dir = Path(args.source)

    if not source_dir.exists():
        log.error("Source directory '%s' does not exist.", source_dir)
        sys.exit(1)

    results = ingest_directory(source_dir, reindex=args.reindex)

    if not results or all(v == 0 for v in results.values()):
        log.warning("No documents were successfully ingested.")
        sys.exit(1)


if __name__ == "__main__":
    main()
