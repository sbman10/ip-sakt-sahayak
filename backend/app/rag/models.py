"""
backend/app/rag/models.py
--------------------------
Plain data models used internally by the RAG pipeline.

These are pure Python dataclasses — no FastAPI or Pydantic dependency — so
the RAG package can be tested and reused independently of the HTTP layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PageContent:
    """Raw text extracted from a single PDF page."""

    page_number: int
    text: str


@dataclass(frozen=True)
class DocumentChunk:
    """
    A chunk of text ready for embedding and storage.

    Attributes
    ----------
    chunk_id:
        Deterministic, stable ID derived from (source_path, chunk_index).
        Used as the ChromaDB document ID so re-ingestion is idempotent.
    text:
        The chunk content (concatenated words from the sliding window).
    source_filename:
        Basename of the source PDF (e.g. "patents_act_1970.pdf").
    source_path:
        Relative or absolute path to the source PDF.
    page_start:
        First page number covered by this chunk.
    page_end:
        Last page number covered by this chunk.
    chunk_index:
        Sequential index of this chunk within the source document.
    """

    chunk_id: str
    text: str
    source_filename: str
    source_path: str
    page_start: int
    page_end: int
    chunk_index: int


@dataclass
class RetrievedChunk:
    """
    A chunk returned by vector search, enriched with distance/score.

    Attributes
    ----------
    chunk_id:
        ChromaDB document ID.
    text:
        The chunk content.
    source_filename:
        Basename of the source PDF.
    page_start:
        First page covered.
    page_end:
        Last page covered.
    distance:
        Cosine distance returned by ChromaDB (0 = identical, 2 = opposite).
    """

    chunk_id: str
    text: str
    source_filename: str
    page_start: int
    page_end: int
    distance: float


@dataclass
class CitationResult:
    """
    A formatted citation ready for the API response.

    Maps directly to the CitationItem Pydantic schema defined in
    backend/app/schemas/chat.py.
    """

    source: str
    section: str
    text: str
