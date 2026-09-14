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
        chunk_size: int = 500,
        chunk_overlap: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Extract and chunk a PDF document into granular passages suitable for vector & BM25 indexing.

        Parameters
        ----------
        pdf_path : str
            Path to the PDF file.
        chunk_size : int, optional
            Maximum character length of each chunk, by default 500.
        chunk_overlap : int, optional
            Overlap character count between chunks, by default 50.

        Returns
        -------
        List[Dict[str, Any]]
            Structured chunk dictionaries with:
            - 'text': str
            - 'source': str (Cleaned document title)
            - 'section': str (e.g. 'Page 12')
            - 'chunk_id': str (Deterministic SHA256 hex digest)
            - 'page_number': int
        """
        pages = self.extract_pages_from_pdf(pdf_path)
        if not pages:
            log.warning("No readable text found in %s", pdf_path)
            return []

        source_title = self._clean_source_name(pdf_path)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )

        all_chunks: List[Dict[str, Any]] = []
        global_chunk_idx = 0

        for page in pages:
            page_num = page["page_number"]
            page_text = page["text"]
            text_splits = splitter.split_text(page_text)

            for split_idx, split_text in enumerate(text_splits):
                cleaned_split = split_text.strip()
                if not cleaned_split:
                    continue

                # Generate deterministic chunk_id: hash(source + page + index)
                id_seed = f"{source_title}_{page_num}_{split_idx}_{global_chunk_idx}".encode("utf-8")
                chunk_id = hashlib.sha256(id_seed).hexdigest()[:16]

                chunk_dict = {
                    "text": cleaned_split,
                    "source": source_title,
                    "section": f"Page {page_num}",
                    "page_number": page_num,
                    "chunk_id": chunk_id,
                }
                all_chunks.append(chunk_dict)
                global_chunk_idx += 1

        log.info("Generated %d chunks from %s", len(all_chunks), Path(pdf_path).name)
        return all_chunks
