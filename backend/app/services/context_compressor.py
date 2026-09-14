"""
backend/app/services/context_compressor.py
------------------------------------------
Context Compression & Token Reducer for IP-SAKTI Sahayak.
Optimizes prompt context window by removing duplicates via MD5 hashing,
normalizing legalese formatting, and adhering strictly to token budgets.
"""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Any, Dict, List, Tuple

try:
    from backend.app.schemas.chat import CitationItem
except ImportError:
    from app.schemas.chat import CitationItem

log = logging.getLogger("app.services.context_compressor")


class ContextCompressor:
    """
    Cleans, deduplicates, and compresses retrieved legal document chunks
    to maximize LLM prompt efficiency and eliminate redundant tokens.
    """

    @staticmethod
    def _compute_hash(text: str) -> str:
        """Computes MD5 hash of normalized text for deduplication."""
        normalized = re.sub(r"\s+", " ", text.strip().lower())
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()

    def deduplicate_chunks(self, chunks: list[dict]) -> list[dict]:
        """
        Removes exact or near-duplicate text blocks based on MD5 content hashing.

        Parameters
        ----------
        chunks : list[dict]
            Raw or candidate retrieved chunk dictionaries containing a 'text' key.

        Returns
        -------
        list[dict]
            Filtered list of unique chunks preserving initial rank order.
        """
        seen_hashes: set[str] = set()
        unique_chunks: list[dict] = []

        for chunk in chunks:
            raw_text = chunk.get("text", "").strip()
            if not raw_text:
                continue

            content_hash = self._compute_hash(raw_text)
            if content_hash not in seen_hashes:
                seen_hashes.add(content_hash)
                unique_chunks.append(chunk)

        log.debug(
            "Deduplication: reduced %d chunks down to %d unique chunks",
            len(chunks),
            len(unique_chunks),
        )
        return unique_chunks

    def compress_passage(self, text: str) -> str:
        """
        Normalizes whitespace, strips repetitive headers/footers, and removes
        non-informative line breaks from statutory excerpts.

        Parameters
        ----------
        text : str
            Raw passage text.

        Returns
        -------
        str
            Cleaned and condensed text string.
        """
        if not text:
            return ""

        cleaned = text

        # Strip common statutory header/footer boilerplate & page markers
        cleaned = re.sub(r"(?i)page\s+\d+(\s+of\s+\d+)?", "", cleaned)
        cleaned = re.sub(r"(?i)the gazette of india.*?(extraordinary|part)?", "", cleaned)
        cleaned = re.sub(r"(?i)ministry of commerce and industry", "", cleaned)

        # Remove hyphenated line-break wraps (e.g., "inven-\ntion" -> "invention")
        cleaned = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", cleaned)

        # Normalize redundant newlines to single newlines
        cleaned = re.sub(r"\n\s*\n+", "\n", cleaned)

        # Replace excessive horizontal whitespace with a single space
        cleaned = re.sub(r"[ \t]+", " ", cleaned)

        return cleaned.strip()

    def build_prompt_context(
        self,
        chunks: list[dict],
        max_tokens: int = 1500,
    ) -> tuple[str, list[dict]]:
        """
        Compresses each chunk and constructs a clean context block:
        `[Source: {source} | Section: {section}]\\n{compressed_text}`

        Ensures cumulative context length remains strictly under `max_tokens`.
        (Approximates 1 token ~= 4 characters for conservative safety).

        Parameters
        ----------
        chunks : list[dict]
            Input candidate chunks.
        max_tokens : int
            Maximum token budget for prompt injection (default: 1500).

        Returns
        -------
        tuple[str, list[dict]]
            (formatted_context_string, cleaned_chunks)
        """
        unique_chunks = self.deduplicate_chunks(chunks)
        max_chars = max_tokens * 4  # Standard conservative token-to-char conversion

        context_blocks: list[str] = []
        cleaned_chunks: list[dict] = []
        current_chars = 0

        for chunk in unique_chunks:
            source = chunk.get("source", "Legal Statute")
            section = chunk.get("section", "General")
            raw_text = chunk.get("text", "")

            compressed_text = self.compress_passage(raw_text)
            if not compressed_text:
                continue

            block = f"[Source: {source} | Section: {section}]\n{compressed_text}"
            block_len = len(block) + 2  # including newline separator

            if current_chars + block_len > max_chars:
                # If even the first block exceeds max_chars, truncate it
                if not context_blocks:
                    truncated_text = compressed_text[: max_chars - 100] + "..."
                    block = f"[Source: {source} | Section: {section}]\n{truncated_text}"
                    context_blocks.append(block)
                    chunk_copy = dict(chunk)
                    chunk_copy["text"] = truncated_text
                    cleaned_chunks.append(chunk_copy)
                break

            context_blocks.append(block)
            current_chars += block_len

            chunk_copy = dict(chunk)
            chunk_copy["text"] = compressed_text
            cleaned_chunks.append(chunk_copy)

        formatted_context = "\n\n".join(context_blocks).strip()
        log.info(
            "Built prompt context with %d chunks (~%d tokens) within %d token budget.",
            len(cleaned_chunks),
            current_chars // 4,
            max_tokens,
        )

        return formatted_context, cleaned_chunks

    # Backward compatibility helper for existing routers
    def compress_and_format(
        self,
        ranked_passages: list[dict],
        max_passages: int = 3,
        min_relevance_score: float = 0.35,
    ) -> tuple[str, list[CitationItem]]:
        """
        Maintains API compatibility with existing router endpoints.
        """
        context_str, cleaned = self.build_prompt_context(ranked_passages[:max_passages], max_tokens=1500)

        citations: list[CitationItem] = []
        for c in cleaned:
            source = c.get("source", "Legal Statute")
            section = c.get("section", "Section Reference")
            citations.append(
                CitationItem(
                    source=source,
                    section=section,
                    text=c.get("text", ""),
                    relevance=f"Grounded in {source} ({section}).",
                )
            )

        return context_str, citations


# Global singleton instance
context_compressor = ContextCompressor()
