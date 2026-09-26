"""
backend/app/services/document_processor.py
------------------------------------------
PDF extraction and chunking pipeline utilizing PyMuPDF (fitz) and
LangChain's RecursiveCharacterTextSplitter for optimal statutory and treaty text splitting.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter

log = logging.getLogger("app.services.document_processor")


class DocumentProcessor:
    """
    Service for parsing and chunking PDF documents into structured passages.
    """

    @staticmethod
    def _clean_source_name(pdf_path: str) -> str:
        """Derives a human-readable, clean document title from filename."""
        base_name = Path(pdf_path).stem
        # Replace underscores and dashes with spaces, title-case words
        clean_title = base_name.replace("_", " ").replace("-", " ").strip().title()
        return clean_title

    def extract_pages_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extract plain text from a PDF file on a page-by-page basis.

        Parameters
        ----------
        pdf_path : str
            Path to the input PDF file.

        Returns
        -------
        List[Dict[str, Any]]
            List of dictionaries with keys:
            - 'page_number': int (1-indexed)
            - 'text': str (cleaned text content)

        Raises
        ------
        FileNotFoundError
            If the provided PDF path does not exist.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

        pages_data: List[Dict[str, Any]] = []
        try:
            doc = fitz.open(pdf_path)
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                text = page.get_text("text").strip()
                if not text:
                    # Skip empty or unreadable pages
                    continue

                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": text,
                })
            doc.close()
        except Exception as e:
            log.error("Error reading PDF %s: %s", pdf_path, e, exc_info=True)
            raise RuntimeError(f"Failed to extract text from {pdf_path}: {e}") from e

        log.info("Extracted %d non-empty pages from %s", len(pages_data), Path(pdf_path).name)
        return pages_data

    def chunk_pdf(
        self,
        pdf_path: str,
        chunk_size: int = 750,
        chunk_overlap: int = 50,
        jurisdiction: str = "India",
    ) -> List[Dict[str, Any]]:
        """
        Extract and chunk a PDF document using LegalHierarchicalChunker for
        statutory preservation, legal breadcrumb prefixing, and BGE-M3 optimization.
        """
        pages = self.extract_pages_from_pdf(pdf_path)
        if not pages:
            log.warning("No readable text found in %s", pdf_path)
            return []

        source_title = self._clean_source_name(pdf_path)
        from app.services.legal_chunker import legal_chunker

        chunks = legal_chunker.chunk_legal_pages(
            pages=pages,
            source_title=source_title,
            jurisdiction=jurisdiction,
        )
        log.info("Generated %d legal hierarchical chunks from %s", len(chunks), Path(pdf_path).name)
        return chunks
