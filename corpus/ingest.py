"""
corpus/ingest.py
----------------
Offline ingestion pipeline for IP-SAKTI Sahayak.

Reads PDF documents from ``corpus/data/raw/``, chunks them into
overlapping 500-word blocks, embeds them with all-MiniLM-L6-v2, and
stores them in a local PersistentChromaDB instance.

Usage
-----
    python corpus/ingest.py

Prerequisites
-------------
    pip install pymupdf chromadb sentence-transformers

Collections produced
--------------------
    india_statutes          - PDFs stored in corpus/data/raw/india/
    international_treaties  - PDFs stored in corpus/data/raw/international/

    If you have not split your raw directory into sub-folders yet,
    the script will fall back to auto-detecting the jurisdiction from
    the filename (files containing "WIPO", "PCT", "TRIPS", "Nagoya"
    are routed to international_treaties; everything else goes to
    india_statutes).
"""

from __future__ import annotations

import hashlib
import logging
import os
import sys
from pathlib import Path
from typing import Generator

# ---------------------------------------------------------------------------
# Third-party imports – guard with friendly error messages
# ---------------------------------------------------------------------------
try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    sys.exit("ERROR: PyMuPDF is not installed. Run:  pip install pymupdf")

try:
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")
    import chromadb
    from chromadb.config import Settings
except ImportError:
    sys.exit("ERROR: ChromaDB is not installed. Run:  pip install chromadb")

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    sys.exit(
        "ERROR: sentence-transformers is not installed. Run:  pip install sentence-transformers"
    )

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
# Resolve relative to THIS file so the script works from any CWD.
_CORPUS_DIR = Path(__file__).parent
RAW_DIR = _CORPUS_DIR / "data" / "raw"
CHROMA_DB_DIR = _CORPUS_DIR / "chroma_db"

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

CHUNK_WORDS = 500       # target chunk size in words
OVERLAP_WORDS = 50      # overlap between consecutive chunks

# Keywords that identify international-jurisdiction documents by filename
_INTERNATIONAL_KEYWORDS = {"wipo", "pct", "trips", "nagoya", "cbd", "upov", "international"}

# ChromaDB collection names
COLLECTION_INDIA = "india_statutes"
COLLECTION_INTERNATIONAL = "international_treaties"

# ChromaDB upsert batch size (avoids hitting gRPC/SQLite limits)
BATCH_SIZE = 64


# ---------------------------------------------------------------------------
# Utility: Detect jurisdiction from filename
# ---------------------------------------------------------------------------

def _detect_jurisdiction(filename: str) -> str:
    """
    Return the collection name based on the document filename.

    Files inside a sub-folder named ``india/`` or ``international/``
    take precedence; otherwise the filename is matched against known
    international-treaty keywords.
    """
    parts = Path(filename).parts
    if "international" in [p.lower() for p in parts]:
        return COLLECTION_INTERNATIONAL
    if "india" in [p.lower() for p in parts]:
        return COLLECTION_INDIA

    stem_lower = Path(filename).stem.lower()
    if any(kw in stem_lower for kw in _INTERNATIONAL_KEYWORDS):
        return COLLECTION_INTERNATIONAL
    return COLLECTION_INDIA


# ---------------------------------------------------------------------------
# Utility: PDF → raw text per page
# ---------------------------------------------------------------------------

def extract_pages(pdf_path: Path) -> Generator[tuple[int, str], None, None]:
    """
    Yield ``(page_number, page_text)`` tuples for every page in *pdf_path*.

    Uses PyMuPDF's ``get_text("text")`` for clean Unicode output.
    Skips pages with no extractable text (e.g. scanned images without OCR).

    Parameters
    ----------
    pdf_path:
        Absolute or relative path to the PDF file.

    Yields
    ------
    tuple[int, str]
        ``(1-based page number, extracted text)``
    """
    doc = fitz.open(str(pdf_path))
    for page_index in range(len(doc)):
        page = doc.load_page(page_index)
        text = page.get_text("text")
        if text.strip():
            yield page_index + 1, text
    doc.close()


# ---------------------------------------------------------------------------
# Utility: Sliding-window word chunker
# ---------------------------------------------------------------------------

def chunk_text(
    text: str,
    chunk_words: int = CHUNK_WORDS,
    overlap_words: int = OVERLAP_WORDS,
) -> list[str]:
    """
    Split *text* into overlapping word-level chunks.

    Parameters
    ----------
    text:
        Raw text string (may contain newlines, extra whitespace, etc.).
    chunk_words:
        Target maximum number of words per chunk.
    overlap_words:
        Number of words from the end of the previous chunk to prepend
        to the next chunk, ensuring context continuity across boundaries.

    Returns
    -------
    list[str]
        List of text chunks. Each chunk is at most *chunk_words* words.
    """
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_words
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        # Advance by (chunk_words - overlap_words) so the next chunk
        # starts *overlap_words* words before the current end.
        start += chunk_words - overlap_words

    return chunks


# ---------------------------------------------------------------------------
# Utility: Stable document ID
# ---------------------------------------------------------------------------

def _make_chunk_id(source: str, section: str, chunk_index: int) -> str:
    """
    Generate a deterministic, collision-resistant ID for a chunk.

    Uses MD5 (not for security — purely for a short, stable hash).
    This allows re-running the ingestor without duplicating records
    (ChromaDB upsert semantics de-duplicate by ID).
    """
    raw = f"{source}::{section}::chunk_{chunk_index}"
    return hashlib.md5(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Core ingestion function
# ---------------------------------------------------------------------------

def ingest_pdf(
    pdf_path: Path,
    collection: chromadb.Collection,
    embedding_model: SentenceTransformer,
) -> int:
    """
    Parse, chunk, embed, and upsert a single PDF into *collection*.

    Parameters
    ----------
    pdf_path:
        Path to the PDF file.
    collection:
        An initialised ChromaDB collection.
    embedding_model:
        A loaded SentenceTransformer model used to produce embeddings.

    Returns
    -------
    int
        Total number of chunks upserted into the collection.
    """
    source_name = pdf_path.stem  # e.g. "Patents_Act_1970"
    log.info("Processing: %s", pdf_path.name)

    all_ids: list[str] = []
    all_embeddings: list[list[float]] = []
    all_documents: list[str] = []
    all_metadatas: list[dict] = []

    chunk_index = 0

    for page_num, page_text in extract_pages(pdf_path):
        section_label = f"Page {page_num}"
        for chunk in chunk_text(page_text):
            chunk_id = _make_chunk_id(source_name, section_label, chunk_index)
            embedding = embedding_model.encode(chunk, convert_to_list=True)

            all_ids.append(chunk_id)
            all_embeddings.append(embedding)
            all_documents.append(chunk)
            all_metadatas.append({"source": source_name, "section": section_label})
            chunk_index += 1

    if not all_ids:
        log.warning("No extractable text found in %s. Skipping.", pdf_path.name)
        return 0

    # Upsert in batches to stay within ChromaDB's per-call limits.
    for batch_start in range(0, len(all_ids), BATCH_SIZE):
        batch_end = batch_start + BATCH_SIZE
        collection.upsert(
            ids=all_ids[batch_start:batch_end],
            embeddings=all_embeddings[batch_start:batch_end],
            documents=all_documents[batch_start:batch_end],
            metadatas=all_metadatas[batch_start:batch_end],
        )

    log.info(
        "  -> Upserted %d chunks from '%s' into collection '%s'.",
        chunk_index,
        pdf_path.name,
        collection.name,
    )
    return chunk_index


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """
    Discover all PDFs under ``corpus/data/raw/``, route them to the correct
    ChromaDB collection, and ingest them.

    Directory layout (optional but recommended for clarity)::

        corpus/data/raw/
        ├── india/
        │   ├── Patents_Act_1970.pdf
        │   └── Biological_Diversity_Act_2002.pdf
        └── international/
            ├── TRIPS_Agreement.pdf
            └── Nagoya_Protocol.pdf

    A flat layout (all PDFs in ``corpus/data/raw/``) also works; jurisdiction
    is inferred from the filename in that case.
    """
    if not RAW_DIR.exists():
        log.error(
            "Raw data directory does not exist: %s\n"
            "Create it and drop your PDF files there, then re-run this script.",
            RAW_DIR,
        )
        sys.exit(1)

    pdf_files = list(RAW_DIR.rglob("*.pdf"))
    if not pdf_files:
        log.error(
            "No PDF files found under %s.\n"
            "Add at least one PDF and re-run.",
            RAW_DIR,
        )
        sys.exit(1)

    log.info("Found %d PDF file(s) to ingest.", len(pdf_files))

    # -----------------------------------------------------------------------
    # Initialise ChromaDB
    # -----------------------------------------------------------------------
    CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
    log.info("Initialising ChromaDB at: %s", CHROMA_DB_DIR)
    chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

    # Create (or retrieve existing) collections.
    india_collection = chroma_client.get_or_create_collection(
        name=COLLECTION_INDIA,
        metadata={"description": "Indian IP statutes and regulations"},
    )
    international_collection = chroma_client.get_or_create_collection(
        name=COLLECTION_INTERNATIONAL,
        metadata={"description": "International IP treaties and conventions"},
    )

    collection_map = {
        COLLECTION_INDIA: india_collection,
        COLLECTION_INTERNATIONAL: international_collection,
    }

    # -----------------------------------------------------------------------
    # Load embedding model (downloaded once, cached locally by HF Hub)
    # -----------------------------------------------------------------------
    log.info("Loading embedding model: %s (this may take a moment on first run)...", EMBEDDING_MODEL_NAME)
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    log.info("Embedding model loaded.")

    # -----------------------------------------------------------------------
    # Ingest every PDF
    # -----------------------------------------------------------------------
    total_chunks = 0
    for pdf_path in sorted(pdf_files):
        jurisdiction = _detect_jurisdiction(str(pdf_path))
        target_collection = collection_map[jurisdiction]
        chunks_added = ingest_pdf(pdf_path, target_collection, embedding_model)
        total_chunks += chunks_added

    log.info(
        "Ingestion complete. Total chunks stored: %d  |  "
        "india_statutes: %d  |  international_treaties: %d",
        total_chunks,
        india_collection.count(),
        international_collection.count(),
    )


if __name__ == "__main__":
    main()
