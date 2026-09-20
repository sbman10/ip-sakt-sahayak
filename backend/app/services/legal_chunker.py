"""
backend/app/services/legal_chunker.py
--------------------------------------
Hierarchical Legal & Statutory Chunker for IP-SAKTI Sahayak.
Designed specifically for Indian and International Legal Corpora:
- The Patents Act, 1970
- The Biological Diversity Act, 2002
- Drugs and Cosmetics Act, 1940
- Patents Rules, 2003
- TKDL Guidelines & Documentation
- International Treaties (TRIPS, Nagoya Protocol)

Key Features:
1. Structural Legal Hierarchy Detection (Chapter -> Section/Rule/Article -> Subsection/Clause).
2. Semantic Context Preservation: Every chunk is prepended with its canonical legal breadcrumb
   (e.g., [Statute: The Patents Act, 1970 | Chapter II: Inventions Not Patentable | Section 3: What are not inventions | Clause (p)])
   so that BAAI/bge-m3 embeddings capture both the specific rule and its parent statutory context.
3. Natural Legal Boundary Splitting: Avoids arbitrary token cuts across provisos, definitions, and clauses.
4. BGE-M3 Optimized Sizing: Sections under ~750 words (~1,000 tokens) remain complete intact units,
   leveraging BGE-M3's 8,192-token context window.
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("app.services.legal_chunker")

# UPDATED: Phase 3B - Comprehensive footnote rejection patterns to reject statutory amendment footnotes
FOOTNOTE_START_PATTERNS = [
    r"^Subs\b",
    r"^Substituted\b",
    r"^Ins\b",
    r"^Inserted\b",
    r"^Omitted\b",
    r"^Added\b",
    r"^Repealed\b",
    r"^As\s+amended\b",
    r"^The\s+(?:words?|brackets?|provisos?|sub-sections?|sub-clauses?|clauses?|figures?|schedules?|explanations?)\b",
    r"^(?:Clauses?|Sub-clauses?|Sub-sections?|Sections?|Chapters?|Schedules?|Parts?)\b",
    r"^Certain\s+words\b",
    r"^s\.\s*\d+",  # e.g., "s. 2, ibid."
    r"^\d{1,2}-\d{1,2}-\d{4}\b",  # commencement dates e.g. "1-4-1978, vide notification..."
    r"^(?:For\s+section|In\s+section|Omit\s+|vide\s+notification)\b",
    r"^Long\s+title\b",
    r"^Preamble\s*—\s*Omit\b",
    r"^\d+\[",  # starts with footnote bracket e.g. 1[
    r"^[a-z0-9]+\s*\([a-z0-9]+\)",  # e.g. "1 (1A)"
]

_FOOTNOTE_RE = re.compile("|".join(FOOTNOTE_START_PATTERNS), re.IGNORECASE)

# Regex patterns for statutory legal markers (full-line matching for robust footnote disambiguation)
_CHAPTER_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(CHAPTER\s+[IVXLCDM\d]+[A-Z]?|THE\s+SCHEDULE)\s*[:\.\-—]?\s*([^\n]+)?",
    re.MULTILINE,
)

_SECTION_START_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(?:SECTION|SEC\.)?\s*(\b\d+[A-Z]?\b)\.\s*([^\n]+)",
    re.MULTILINE,
)

_RULE_START_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(?:RULE)?\s*(\b\d+[A-Z]?\b)\.\s*([^\n]+)",
    re.MULTILINE,
)

_ARTICLE_START_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(?:ARTICLE)?\s*(\b\d+[A-Z]?\b)\.\s*([^\n]+)",
    re.MULTILINE,
)

_SUBSECTION_CLAUSE_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(\([0-9a-zA-Z]+\))\s+",
    re.MULTILINE,
)

_PROVISO_EXPLANATION_REGEX = re.compile(
    r"(?i)(?:^|\n)\s*(Provided\s+that|Explanation\s*[—\-:\.\s]|Provided\s+further\s+that)",
    re.MULTILINE,
)


class LegalHierarchicalChunker:
    """
    Industry-standard legal chunker that preserves statutory structure and legal breadcrumbs.
    """

    def __init__(
        self,
        max_chunk_words: int = 750,
        min_chunk_words: int = 60,
        chunk_overlap_words: int = 50,
    ) -> None:
        self.max_chunk_words = max_chunk_words
        self.min_chunk_words = min_chunk_words
        self.chunk_overlap_words = chunk_overlap_words

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """Removes Gazette boilerplate, page footers, and redundant whitespace."""
        if not raw_text:
            return ""
        t = raw_text
        # Remove repetitive Gazette header / footer lines
        t = re.sub(r"(?i)the\s+gazette\s+of\s+india\s*:\s*extraordinary[^\n]*", "", t)
        t = re.sub(r"(?i)part\s+ii\s*—\s*sec(?:tion)?\s*\d+[^\n]*", "", t)
        t = re.sub(r"(?i)ministry\s+of\s+commerce\s+and\s+industry[^\n]*", "", t)
        t = re.sub(r"(?i)page\s+\d+\s+of\s+\d+", "", t)
        # Normalize hyphenated word splits across line breaks (e.g. inven- \n tion)
        t = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", t)
        # Collapse multiple spaces and blank lines
        t = re.sub(r"[ \t]+", " ", t)
        t = re.sub(r"\n\s*\n+", "\n\n", t)
        return t.strip()

    @staticmethod
    def _generate_chunk_id(source: str, section: str, chunk_index: int, text: str) -> str:
        """Deterministic chunk ID combining legal coordinates and content hash."""
        src_slug = re.sub(r"[^A-Za-z0-9]+", "-", source.lower()).strip("-")[:20]
        sec_slug = re.sub(r"[^A-Za-z0-9]+", "-", section.lower()).strip("-")[:15] or "sec"
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
        return f"{src_slug}_{sec_slug}_{chunk_index}_{content_hash}"

    def _split_long_text(
        self,
        text: str,
        breadcrumb: str,
        metadata: Dict[str, Any],
        start_chunk_idx: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Splits long text by subsections or sentences while prepending the legal breadcrumb."""
        words = text.split()
        if len(words) <= self.max_chunk_words:
            chunk_text = f"{breadcrumb}\n\n{text}".strip()
            chunk_id = self._generate_chunk_id(
                metadata.get("source", "statute"),
                metadata.get("section", "sec"),
                start_chunk_idx,
                chunk_text,
            )
            return [
                {
                    "chunk_id": chunk_id,
                    "text": chunk_text,
                    "raw_text": text,
                    "breadcrumb": breadcrumb,
                    **metadata,
                }
            ], start_chunk_idx + 1

        chunks = []
        curr_idx = start_chunk_idx
        step = max(1, self.max_chunk_words - self.chunk_overlap_words)

        for i in range(0, len(words), step):
            slice_words = words[i : i + self.max_chunk_words]
            if not slice_words:
                break
            part_text = " ".join(slice_words)
            chunk_text = f"{breadcrumb} (Part {curr_idx - start_chunk_idx + 1})\n\n{part_text}".strip()
            chunk_id = self._generate_chunk_id(
                metadata.get("source", "statute"),
                metadata.get("section", "sec"),
                curr_idx,
                chunk_text,
            )
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk_text,
                    "raw_text": part_text,
                    "breadcrumb": breadcrumb,
                    **metadata,
                }
            )
            curr_idx += 1
            if i + self.max_chunk_words >= len(words):
                break

        return chunks, curr_idx

    def _extract_section3_clauses(
        self,
        section_body: str,
        source_title: str,
        chapter_name: str,
        jurisdiction: str,
        doc_type: str,
        page_num: int,
        chunk_counter: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Extracts granular sub-clauses (a) through (p) for Section 3 of the Patents Act 1970.
        Preserves statutory context preamble and eliminates amendment footnotes.
        """
        # 1. Identify introductory statutory premise
        intro_match = re.match(
            r"(?s)^(3\.\s+What\s+are\s+not\s+inventions[^\n—\-:]*[\n—\-:]+\s*(?:The\s+following\s+are\s+not\s+inventions[^\n—\-:]*[\n—\-:]+)?)",
            section_body,
        )
        intro_text = (
            intro_match.group(1).strip()
            if intro_match
            else "3. What are not inventions.—The following are not inventions within the meaning of this Act,—"
        )

        clause_regex = re.compile(r"(?:^|\n)\s*(?:\d+\[)?\(([a-p])\)\s+", re.MULTILINE)
        matches = list(clause_regex.finditer(section_body))

        if not matches:
            breadcrumb = f"[{source_title} | {chapter_name} | Section 3: What are not inventions]"
            meta = {
                "source": source_title,
                "parent_section": "Section 3",
                "section": "Section 3",
                "section_title": "What are not inventions",
                "chapter": chapter_name,
                "jurisdiction": jurisdiction,
                "doc_type": doc_type,
                "page_number": page_num,
            }
            return self._split_long_text(section_body, breadcrumb, meta, chunk_counter)

        clauses: List[Dict[str, Any]] = []
        curr_counter = chunk_counter

        for i, m in enumerate(matches):
            clause_letter = m.group(1).lower()
            start_pos = m.start()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(section_body)
            raw_clause = section_body[start_pos:end_pos].strip()

            # Clean out footnote lines, page boundary artifacts, and standalone digits
            clean_lines = []
            for line in raw_clause.split("\n"):
                l_str = line.strip()
                # Skip standalone page numbers e.g. "10", "9"
                if l_str.isdigit() and len(l_str) <= 3:
                    continue
                # Skip footnote lines matching footnote pattern or \d+\. ...
                if _FOOTNOTE_RE.search(l_str) or re.match(r"^\d+\.\s+", l_str):
                    continue
                clean_lines.append(line)

            cleaned_clause = "\n".join(clean_lines).strip()
            # Clean leading bracket prefix e.g. 4[(b) -> (b)
            cleaned_clause = re.sub(r"^\d+\[", "", cleaned_clause).strip()
            # Clean trailing footnote brackets e.g. .]
            cleaned_clause = re.sub(r"\]\s*$", "", cleaned_clause).strip()

            if not cleaned_clause:
                continue

            sec_label = f"Section 3({clause_letter})"
            breadcrumb = f"[{source_title} | {chapter_name} | Section 3: What are not inventions | {sec_label}]"
            full_chunk_text = f"{breadcrumb}\n\n{intro_text}\n{cleaned_clause}".strip()

            chunk_id = self._generate_chunk_id(source_title, sec_label, curr_counter, full_chunk_text)
            clauses.append({
                "chunk_id": chunk_id,
                "text": full_chunk_text,
                "raw_text": cleaned_clause,
                "breadcrumb": breadcrumb,
                "source": source_title,
                "parent_section": "Section 3",
                "section": sec_label,
                "section_title": sec_label,
                "chapter": chapter_name,
                "jurisdiction": jurisdiction,
                "doc_type": doc_type,
                "page_number": page_num if clause_letter in "abcd" else page_num + 1,
            })
            curr_counter += 1

        return clauses, curr_counter

    def chunk_legal_pages(
        self,
        pages: List[Dict[str, Any]],
        source_title: str,
        jurisdiction: str = "India",
        doc_type: str = "statute",
    ) -> List[Dict[str, Any]]:
        """
        Parses pages into structured, hierarchy-aware legal chunks.
        """
        if not pages:
            return []

        # Identify full text with page spans
        full_text = ""
        char_to_page: List[int] = []
        for p in pages:
            ptxt = self.clean_text(p.get("text", "")) + "\n\n"
            pnum = p.get("page_number", 1)
            char_to_page.extend([pnum] * len(ptxt))
            full_text += ptxt

        if not full_text.strip():
            return []

        def get_page_for_char(char_pos: int) -> int:
            if 0 <= char_pos < len(char_to_page):
                return char_to_page[char_pos]
            return pages[-1].get("page_number", 1)

        # Detect Table of Contents (Arrangement of Sections) to avoid index landmarks
        toc_start = full_text.find("ARRANGEMENT OF SECTIONS")
        substantive_start = 0
        if toc_start != -1:
            m_sub = re.search(
                r"(?:BE it enacted by Parliament|ACT NO\.\s*\d+|An Act to amend)",
                full_text[toc_start:],
                re.IGNORECASE,
            )
            if m_sub:
                substantive_start = toc_start + m_sub.start()

        # 1. Discover Chapter and Section Landmarks
        is_rules = "rule" in source_title.lower() or "rules" in source_title.lower()
        is_treaty = "treaty" in source_title.lower() or "protocol" in source_title.lower() or "agreement" in source_title.lower()

        section_marker_regex = (
            _RULE_START_REGEX if is_rules
            else _ARTICLE_START_REGEX if is_treaty
            else _SECTION_START_REGEX
        )

        marker_label = "Rule" if is_rules else "Article" if is_treaty else "Section"

        # Find all sections/rules/articles (with footnote disambiguation)
        landmarks: List[Dict[str, Any]] = []
        for match in section_marker_regex.finditer(full_text):
            if match.start() < substantive_start:
                continue
            num = match.group(1)
            full_line = (match.group(2) or "").strip()
            # UPDATED: Phase 3B - Reject lines starting with amendment footnote patterns
            if _FOOTNOTE_RE.search(full_line):
                continue
            # Clean title
            sec_title = re.split(r"[\.\(—\-]", full_line)[0].strip() or f"{marker_label} {num}"
            landmarks.append({
                "type": marker_label,
                "number": num,
                "title": sec_title[:80],
                "start": match.start(),
            })

        # Also find Chapters for breadcrumbs
        chapters: List[Dict[str, Any]] = []
        for match in _CHAPTER_REGEX.finditer(full_text):
            ch_num = match.group(1).strip()
            ch_title = (match.group(2) or "").strip()
            chapters.append({
                "chapter": f"{ch_num}: {ch_title[:60]}" if ch_title else ch_num,
                "start": match.start(),
            })

        def find_parent_chapter(pos: int) -> str:
            active_chapter = "General Provisions"
            for ch in chapters:
                if ch["start"] <= pos:
                    active_chapter = ch["chapter"]
                else:
                    break
            return active_chapter

        # 2. If statutory landmarks detected, slice by Section boundaries
        chunks: List[Dict[str, Any]] = []
        chunk_counter = 1

        if landmarks:
            # Handle text before the first section (Preamble / Preliminary)
            first_pos = landmarks[0]["start"]
            if first_pos > substantive_start and first_pos - substantive_start > 150:
                preamble_text = full_text[substantive_start:first_pos].strip()
                if len(preamble_text.split()) >= self.min_chunk_words:
                    breadcrumb = f"[{source_title} | Preliminary / Preamble]"
                    meta = {
                        "source": source_title,
                        "parent_section": "Preliminary",
                        "section": "Preliminary",
                        "section_title": "Preamble & Commencement",
                        "chapter": "Preliminary",
                        "jurisdiction": jurisdiction,
                        "doc_type": doc_type,
                        "page_number": get_page_for_char(substantive_start),
                    }
                    sub_chunks, chunk_counter = self._split_long_text(
                        preamble_text, breadcrumb, meta, chunk_counter
                    )
                    chunks.extend(sub_chunks)

            # Process each landmark
            for i, lm in enumerate(landmarks):
                start_pos = lm["start"]
                end_pos = landmarks[i + 1]["start"] if i + 1 < len(landmarks) else len(full_text)
                section_body = full_text[start_pos:end_pos].strip()

                if len(section_body.split()) < 15:
                    continue

                chapter_name = find_parent_chapter(start_pos)
                sec_ref = f"{lm['type']} {lm['number']}"
                sec_title = lm["title"] or sec_ref
                page_num = get_page_for_char(start_pos)

                # Check if this is the genuine Section 3 of the Patents Act (Chapter II "What are not inventions")
                is_patents_act = "patent" in source_title.lower() and "rule" not in source_title.lower()
                is_genuine_sec3 = (
                    is_patents_act
                    and sec_ref == "Section 3"
                    and "chapter ii" in chapter_name.lower()
                    and "not inventions" in sec_title.lower()
                )

                if is_genuine_sec3:
                    sec3_subchunks, chunk_counter = self._extract_section3_clauses(
                        section_body=section_body,
                        source_title=source_title,
                        chapter_name=chapter_name,
                        jurisdiction=jurisdiction,
                        doc_type=doc_type,
                        page_num=page_num,
                        chunk_counter=chunk_counter,
                    )
                    chunks.extend(sec3_subchunks)
                    continue

                breadcrumb = f"[{source_title} | {chapter_name} | {sec_ref}: {sec_title}]"
                meta = {
                    "source": source_title,
                    "parent_section": sec_ref,
                    "section": sec_ref,
                    "section_title": sec_title,
                    "chapter": chapter_name,
                    "jurisdiction": jurisdiction,
                    "doc_type": doc_type,
                    "page_number": page_num,
                }

                sub_chunks, chunk_counter = self._split_long_text(
                    section_body, breadcrumb, meta, chunk_counter
                )
                chunks.extend(sub_chunks)

        else:
            # Fallback for non-statutory or unstructured reports (e.g. granted patent lists, TKDL overviews)
            log.info("Document '%s' has no standard section markers. Using sliding legal window.", source_title)
            words = full_text.split()
            step = max(1, self.max_chunk_words - self.chunk_overlap_words)

            for i in range(0, len(words), step):
                slice_words = words[i : i + self.max_chunk_words]
                if not slice_words:
                    break
                part_text = " ".join(slice_words)
                page_num = get_page_for_char(full_text.find(part_text[:40]))
                sec_ref = f"Page {page_num}"
                breadcrumb = f"[{source_title} | Legal Register Excerpt | {sec_ref}]"
                meta = {
                    "source": source_title,
                    "section": sec_ref,
                    "section_title": source_title,
                    "chapter": "General",
                    "jurisdiction": jurisdiction,
                    "doc_type": doc_type,
                    "page_number": page_num,
                }
                chunk_text = f"{breadcrumb}\n\n{part_text}".strip()
                chunk_id = self._generate_chunk_id(source_title, sec_ref, chunk_counter, chunk_text)
                chunks.append({
                    "chunk_id": chunk_id,
                    "text": chunk_text,
                    "raw_text": part_text,
                    "breadcrumb": breadcrumb,
                    **meta,
                })
                chunk_counter += 1
                if i + self.max_chunk_words >= len(words):
                    break

        log.info(
            "Legal chunking complete for '%s': generated %d high-fidelity statutory chunks.",
            source_title,
            len(chunks),
        )
        return chunks


legal_chunker = LegalHierarchicalChunker()
