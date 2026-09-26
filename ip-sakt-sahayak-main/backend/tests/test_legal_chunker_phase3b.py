"""
backend/tests/test_legal_chunker_phase3b.py
-------------------------------------------
Regression and validation test suite for Phase 3B:
- Footnote rejection (amendment lines are never treated as statutory sections).
- Genuine statutory section recognition (Sections 1, 2, 3, 4, 5, 6, 7, etc.).
- Granular Section 3 sub-clause extraction (clauses a through p, specifically a, d, e, p).
- Section 3(p) content integrity (contains traditional knowledge exclusion without footnote text).
- False-label prevention (Section 3(p) is never labeled Section 6; footnotes are not sections).
- Idempotent determinism (chunking twice yields identical chunk IDs, section metadata, and text).
"""

import re
import sys
from pathlib import Path
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.legal_chunker import (
    _FOOTNOTE_RE,
    _SECTION_START_REGEX,
    legal_chunker,
)
from app.services.document_processor import DocumentProcessor

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
PATENTS_ACT_PDF = WORKSPACE_ROOT / "knowledge-base" / "sources" / "india" / "statutes" / "patents-act-1970" / "versions" / "1970-original" / "original" / "patents-act-1970.pdf"


def test_footnote_rejection():
    """Verify known amendment footnote patterns are rejected."""
    sample_footnotes = [
        "6. Subs. by Act 15 of 2005, s. 3, for clause (d) (w.e.f. 1-1-2005).",
        "3. Omitted by Act 33 of 2021, s. 13 (w.e.f. 4-4-2021).",
        "The words substituted by Act 15 of 2005, s. 2.",
        "1. Ins. by Act 38 of 2002, s. 4 (w.e.f. 20-5-2003).",
        "2. The words 'and includes the Council' omitted by Act 15 of 2005.",
        "3. Sub-clause (B) omitted by Act 33 of 2021, s. 13.",
        "1. Clause (g) omitted by Act 38 of 2002, s. 4.",
        "3. Sub-sections (2) and (3) omitted by s. 66, ibid.",
        "1. 1-4-1978, vide notification No. S.O. 799, dated 10-3-1978.",
        "2. Added by Act 15 of 2005, s. 76.",
        "5. Repealed by Act 38 of 2002, s. 10.",
    ]

    for fn in sample_footnotes:
        m = re.match(r"^(?:\d+\.\s+)?(.*)", fn)
        content = m.group(1) if m else fn
        assert _FOOTNOTE_RE.search(content) is not None, f"Expected footnote to be rejected: '{fn}'"


def test_genuine_section_recognition():
    """Verify genuine statutory section headers are recognized and NOT rejected by footnote filter."""
    sample_sections = [
        "What are not inventions.—The following are not inventions",
        "Persons entitled to apply for patents.—(1) Subject to",
        "Form of application.—(1) Every application for a patent",
        "Inventions relating to atomic energy not patentable.—No patent",
        "[Inventions where only methods or processes of manufacture patentable.] Omitted by Act 15 of 2005",
        "Definitions and interpretation.—(1) In this Act",
        "Short title, extent and commencement.—(1) This Act may be called",
    ]

    for sec in sample_sections:
        assert _FOOTNOTE_RE.search(sec) is None, f"Genuine section was incorrectly flagged as footnote: '{sec}'"


@pytest.mark.skipif(not PATENTS_ACT_PDF.exists(), reason="Patents Act PDF not found")
def test_patents_act_section3_clauses_extracted():
    """Verify that Patents Act 1970 produces granular Section 3(a)-(p) sub-clause chunks."""
    dp = DocumentProcessor()
    chunks = dp.chunk_pdf(str(PATENTS_ACT_PDF))

    sec3_chunks = [c for c in chunks if c.get("parent_section") == "Section 3"]
    assert len(sec3_chunks) == 15, f"Expected 15 sub-clauses for Section 3, got {len(sec3_chunks)}"

    clause_sections = {c["section"] for c in sec3_chunks}
    for expected_sec in ["Section 3(a)", "Section 3(d)", "Section 3(e)", "Section 3(p)"]:
        assert expected_sec in clause_sections, f"Missing expected clause: {expected_sec}"

    # Verify Section 3(p) content
    sec3p = next(c for c in sec3_chunks if c["section"] == "Section 3(p)")
    assert "traditional knowledge" in sec3p["text"].lower()
    assert sec3p["section"] == "Section 3(p)"
    assert sec3p["parent_section"] == "Section 3"
    assert "Section 6" not in sec3p["breadcrumb"]
    assert "Subs. by Act" not in sec3p["text"], "Section 3(p) contains footnote text"


@pytest.mark.skipif(not PATENTS_ACT_PDF.exists(), reason="Patents Act PDF not found")
def test_false_label_prevention():
    """Verify Section 3(p) is not labeled Section 6, and unrelated chapters don't have spurious Section 3."""
    dp = DocumentProcessor()
    chunks = dp.chunk_pdf(str(PATENTS_ACT_PDF))

    for c in chunks:
        # Check Section 3(p) is never labeled Section 6
        if "traditional knowledge" in c.get("text", "").lower() and "Section 3(p)" in c.get("breadcrumb", ""):
            assert c.get("section") == "Section 3(p)"
            assert c.get("section") != "Section 6"
            assert "Section 6" not in c.get("breadcrumb", "")

        # Check footnotes never become section names
        assert not c.get("section", "").startswith("Section Subs"), f"Mislabeled section: {c.get('section')}"
        assert not c.get("section", "").startswith("Section Ins"), f"Mislabeled section: {c.get('section')}"

        # Unrelated chapters (Chapters IV-XXIII) must NOT be labeled Section 3
        chapter = c.get("chapter", "")
        if "chapter iv" in chapter.lower() or "chapter v" in chapter.lower() or "chapter xviii" in chapter.lower():
            assert c.get("parent_section") != "Section 3", f"Spurious Section 3 in {chapter}: {c.get('chunk_id')}"


@pytest.mark.skipif(not PATENTS_ACT_PDF.exists(), reason="Patents Act PDF not found")
def test_chunking_determinism():
    """Verify chunking twice produces identical chunk IDs, section metadata, and text."""
    dp = DocumentProcessor()
    chunks1 = dp.chunk_pdf(str(PATENTS_ACT_PDF))
    chunks2 = dp.chunk_pdf(str(PATENTS_ACT_PDF))

    assert len(chunks1) == len(chunks2), "Chunk count differs across runs"
    for c1, c2 in zip(chunks1, chunks2):
        assert c1["chunk_id"] == c2["chunk_id"], f"Chunk ID mismatch: {c1['chunk_id']} vs {c2['chunk_id']}"
        assert c1["section"] == c2["section"], f"Section mismatch: {c1['section']} vs {c2['section']}"
        assert c1["parent_section"] == c2["parent_section"], f"Parent section mismatch: {c1['parent_section']} vs {c2['parent_section']}"
        assert c1["text"] == c2["text"], f"Text mismatch in {c1['chunk_id']}"
