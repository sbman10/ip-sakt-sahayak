"""
backend/app/rag/document_loader.py
------------------------------------
PDF text extraction using PyMuPDF (fitz).

Extracts text page-by-page from a PDF file and returns a list of
PageContent objects.  Handles unreadable or text-empty PDFs gracefully
with logged warnings.
"""

from __future__ import annotations

import logging
from pathlib import Path

import fitz  # PyMuPDF

from app.rag.models import PageContent

log = logging.getLogger(__name__)


def extract_pages(pdf_path: Path) -> list[PageContent]:
    """
    Extract text from every page of a PDF file.

    Parameters
    ----------
    pdf_path:
        Path to the PDF file.

    Returns
    -------
    list[PageContent]
        One PageContent per page that contains extractable text.
        Empty list if the PDF is unreadable or has no text.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        log.error("PDF file not found: %s", pdf_path)
        return []

    pages: list[PageContent] = []

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:
        log.error("Failed to open PDF '%s': %s", pdf_path.name, exc)
        return []

    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_number = page_idx + 1
            raw_text = page.get_text("text")

            # Clean null bytes and excessive whitespace
            clean_text = raw_text.replace("\x00", "").strip()
            if clean_text:
                pages.append(PageContent(page_number=page_number, text=clean_text))
    finally:
        doc.close()

    if not pages:
        log.warning(
            "No readable text extracted from '%s'. "
            "The PDF may be image-only or corrupted.",
            pdf_path.name,
        )

    return pages
