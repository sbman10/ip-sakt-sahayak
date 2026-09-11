"""
backend/app/rag/chunking.py
-----------------------------
Page-aware sliding-window chunk generation.

Takes extracted page data and produces overlapping DocumentChunk objects
with deterministic IDs, accurate page ranges, and configurable window
parameters.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Sequence

from app.rag.models import DocumentChunk, PageContent

log = logging.getLogger(__name__)


def _make_chunk_id(source_path: str, chunk_index: int) -> str:
    """
    Generate a deterministic, stable chunk ID.

    The ID is a SHA-256 hex digest of the source path and chunk index.
    This ensures that re-ingesting the same unchanged document produces
    the same IDs, enabling idempotent upserts in ChromaDB.
    """
    raw = f"{source_path}::chunk::{chunk_index}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def chunk_document(
    pages: Sequence[PageContent],
    source_filename: str,
    source_path: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[DocumentChunk]:
    """
    Split extracted pages into overlapping word-level chunks.

    Parameters
    ----------
    pages:
        Ordered list of PageContent objects from document_loader.
    source_filename:
        Basename of the source PDF file.
    source_path:
        Full or relative path to the source PDF file.
    chunk_size:
        Number of words per chunk (sliding window width).
    chunk_overlap:
        Number of overlapping words between consecutive chunks.

    Returns
    -------
    list[DocumentChunk]
        Ordered chunks with page-range metadata and stable IDs.
    """
    if not pages:
        return []

    # Build a flat list of (word, page_number) tuples
    word_tokens: list[tuple[str, int]] = []
    for page in pages:
        tokens = page.text.split()
        for token in tokens:
            word_tokens.append((token, page.page_number))

    total_words = len(word_tokens)
    if total_words == 0:
        return []

    step = max(1, chunk_size - chunk_overlap)
    chunks: list[DocumentChunk] = []

    for chunk_index, start_idx in enumerate(range(0, total_words, step)):
        end_idx = min(start_idx + chunk_size, total_words)
        window = word_tokens[start_idx:end_idx]

        if not window:
            break

        chunk_words = [w for w, _ in window]
        page_start = window[0][1]
        page_end = window[-1][1]

        chunk_id = _make_chunk_id(source_path, chunk_index)
        text = " ".join(chunk_words)

        chunks.append(
            DocumentChunk(
                chunk_id=chunk_id,
                text=text,
                source_filename=source_filename,
                source_path=source_path,
                page_start=page_start,
                page_end=page_end,
                chunk_index=chunk_index,
            )
        )

        # Stop if we reached the end of the document
        if end_idx >= total_words:
            break

    log.info(
        "Chunked '%s' into %d chunks (window=%d, overlap=%d, total_words=%d).",
        source_filename,
        len(chunks),
        chunk_size,
        chunk_overlap,
        total_words,
    )
    return chunks
