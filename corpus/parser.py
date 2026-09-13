"""
Sliding Window PDF Parser for IP-SAKTI Sahayak Backend.
Extracts clean text from legislative PDFs and generates overlapping 500-word
chunks with accurate page citations formatted as JSONL.
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pymupdf as fitz

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("PDFParser")

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent
RAW_DATA_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DATA_DIR = BASE_DIR / "data" / "processed"


def clean_source_title(file_stem: str) -> str:
    """
    Cleans raw PDF file stem into a human-readable dynamic legal Act title.
    Example: 'Patents_Act_1970' -> 'Patents Act, 1970'
             'patents_act_1970' -> 'Patents Act, 1970'
             '28012025-CCRAS-Patent-Granted' -> '28012025 CCRAS Patent Granted'
    """
    name = file_stem.replace("_", " ").replace("-", " ")
    # Replace multiple spaces with a single space
    name = re.sub(r"\s+", " ", name).strip()

    # Format year with a comma if ending with 4-digit year (e.g., 'Act 1970' -> 'Act, 1970')
    name = re.sub(r"(?<=\b[A-Za-z])\s+(\d{4})\b", r", \1", name)

    # Title-case each word while preserving standard acronyms
    words = name.split()
    capitalized_words = []
    for w in words:
        if w.isupper() and len(w) > 1:
            capitalized_words.append(w)
        else:
            capitalized_words.append(w.capitalize())

    return " ".join(capitalized_words)


def extract_pages(pdf_path: Path) -> List[Dict[str, Any]]:
    """
    Extracts text sequentially from each page of the target PDF using PyMuPDF.
    Returns a list of dicts with 1-indexed page number and extracted text.
    """
    pages_data: List[Dict[str, Any]] = []
    doc = fitz.open(str(pdf_path))

    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            text = page.get_text("text")

            # Clean null bytes and excessive whitespace
            clean_text = text.replace("\x00", "").strip()
            if clean_text:
                pages_data.append({"page": page_num, "text": clean_text})
    finally:
        doc.close()

    return pages_data


def chunk_text(
    pages_data: List[Dict[str, Any]],
    source_title: str,
    window_size: int = 500,
    overlap: int = 50,
) -> List[Dict[str, str]]:
    """
    Merges page text streams and applies a sliding window of `window_size` words
    with `overlap` words, tracking exact page ranges for citations.
    """
    if not pages_data:
        return []

    # Map each word to its originating page number
    word_tokens: List[Tuple[str, int]] = []
    for p in pages_data:
        p_num = p["page"]
        # Split page text into discrete whitespace-separated tokens
        tokens = p["text"].split()
        for token in tokens:
            word_tokens.append((token, p_num))

    total_words = len(word_tokens)
    if total_words == 0:
        return []

    step = max(1, window_size - overlap)
    chunks: List[Dict[str, str]] = []

    for start_idx in range(0, total_words, step):
        end_idx = min(start_idx + window_size, total_words)
        chunk_slice = word_tokens[start_idx:end_idx]

        if not chunk_slice:
            break

        chunk_words = [t[0] for t in chunk_slice]
        start_page = chunk_slice[0][1]
        end_page = chunk_slice[-1][1]

        if start_page == end_page:
            section_citation = f"Page {start_page}"
        else:
            section_citation = f"Pages {start_page}-{end_page}"

        chunk_text_str = " ".join(chunk_words)

        chunks.append({
            "source_title": source_title,
            "section": section_citation,
            "text": chunk_text_str,
        })

        # If reached end of document tokens, stop sliding
        if end_idx >= total_words:
            break

    return chunks


def process_all_pdfs() -> None:
    """
    Scans the raw data directory for all PDFs, parses them into overlapping
    chunks, and writes JSONL outputs to the processed directory.
    """
    if not RAW_DATA_DIR.exists():
        logger.warning(f"Raw data directory not found at: {RAW_DATA_DIR}")
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Recursively find all PDF files
    pdf_files = sorted(list(RAW_DATA_DIR.rglob("*.pdf")) + list(RAW_DATA_DIR.rglob("*.PDF")))
    # Deduplicate paths
    pdf_files = list(dict.fromkeys(pdf_files))

    if not pdf_files:
        logger.info(f"No PDF files found in {RAW_DATA_DIR}. Please place legislative PDFs there.")
        return

    logger.info(f"Found {len(pdf_files)} PDF file(s) for parsing.")

    for pdf_path in pdf_files:
        file_stem = pdf_path.stem
        source_title = clean_source_title(file_stem)

        pages_data = extract_pages(pdf_path)
        if not pages_data:
            logger.warning(f"No readable text extracted from {pdf_path.name}. Skipping.")
            continue

        start_p = pages_data[0]["page"]
        end_p = pages_data[-1]["page"]
        page_range_str = f"Pages {start_p}-{end_p}" if start_p != end_p else f"Page {start_p}"

        chunks = chunk_text(pages_data, source_title, window_size=500, overlap=50)

        output_filename = f"{file_stem}_chunks.jsonl"
        output_filepath = PROCESSED_DATA_DIR / output_filename

        with open(output_filepath, "w", encoding="utf-8") as f:
            for chunk in chunks:
                f.write(json.dumps(chunk, ensure_ascii=False) + "\n")

        logger.info(
            f"Extracting [{pdf_path.name}]... Created {len(chunks)} overlapping chunks on page-range {page_range_str}."
        )


if __name__ == "__main__":
    process_all_pdfs()
