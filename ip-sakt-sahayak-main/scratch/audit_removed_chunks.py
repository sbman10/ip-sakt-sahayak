"""
scratch/audit_removed_chunks.py
-------------------------------
Comprehensive audit comparing the 886-chunk corpus in ragvyn_hybrid_test
against the 753-chunk corpus in ragvyn_hybrid_test_v2.

Classifies every chunk that was removed or restructured:
- footnote artifact
- table-of-contents artifact
- duplicate heading
- empty/non-substantive text
- genuine statutory content
- unknown
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store

client = qdrant_hybrid_store.get_client()

print("Fetching all points from ragvyn_hybrid_test (v1)...")
pts_v1 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v1.extend(records)
    if nxt is None:
        break
    offset = nxt

print("Fetching all points from ragvyn_hybrid_test_v2 (v2)...")
pts_v2 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test_v2", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v2.extend(records)
    if nxt is None:
        break
    offset = nxt

v1_corpus = [
    p.payload for p in pts_v1
    if not str(p.payload.get("chunk_id", "")).startswith("test-")
    and not str(p.payload.get("chunk_id", "")).startswith("live_smoke")
]
v2_corpus = [p.payload for p in pts_v2]

print(f"v1 corpus chunks: {len(v1_corpus)}")
print(f"v2 corpus chunks: {len(v2_corpus)}")

# Map v2 text by document
v2_doc_text = defaultdict(str)
for c in v2_corpus:
    v2_doc_text[c["document_id"]] += "\n" + c["text"]

v2_chunk_map = {c["chunk_id"]: c for c in v2_corpus}
v1_chunk_map = {c["chunk_id"]: c for c in v1_corpus}

identical_chunk_ids = set(v1_chunk_map.keys()) & set(v2_chunk_map.keys())
non_identical_v1_ids = set(v1_chunk_map.keys()) - set(v2_chunk_map.keys())

print(f"Identical chunk_ids: {len(identical_chunk_ids)}")
print(f"Non-identical v1 chunk_ids to audit: {len(non_identical_v1_ids)}")

# Classification rules
FOOTNOTE_PATTERNS = [
    r"^\s*\d+\.\s+(?:Subs\.|Ins\.|Omitted|The words|The brackets|Added by|Certain words|Certain expressions|Clause|Sub-clause|Sub-section|Word|Proviso|Explanation|Second proviso|Rule)\b",
    r"Subs\.\s+by\s+Act",
    r"Ins\.\s+by\s+Act",
    r"omitted\s+by\s+Act",
    r"\(w\.e\.f\.\s+\d+-\d+-\d+\)",
    r"w\.e\.f\.",
]

TOC_PATTERNS = [
    r"ARRANGEMENT OF SECTIONS",
    r"ARRANGEMENT OF RULES",
    r"CHAPTER\s+[IVXLCDM]+\s*$",
    r"^\s*SECTIONS\s*$",
    r"^\s*RULES\s*$",
]

results = []
classification_counts = defaultdict(int)
substantive_lost = []

for cid in sorted(list(non_identical_v1_ids)):
    payload = v1_chunk_map[cid]
    doc_id = payload["document_id"]
    text = payload["text"]
    sec = payload.get("section", "")
    page_no = payload.get("page_number")
    
    # Extract body without breadcrumb header
    lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().startswith("[")]
    body = "\n".join(lines)
    
    # Check if substantive body is preserved in v2
    # Check multiple substantive sample sentences
    is_preserved_in_v2 = False
    
    # Clean normalized search
    norm_body = " ".join(body.split())
    norm_v2 = " ".join(v2_doc_text[doc_id].split())
    
    if len(norm_body) > 30:
        # Check slices
        mid = len(norm_body) // 2
        sample1 = norm_body[:min(50, len(norm_body))]
        sample2 = norm_body[max(0, mid-25):min(len(norm_body), mid+25)]
        sample3 = norm_body[-min(50, len(norm_body)):]
        
        if sample1 in norm_v2 or sample2 in norm_v2 or sample3 in norm_v2:
            is_preserved_in_v2 = True
    elif len(norm_body) > 0 and norm_body in norm_v2:
        is_preserved_in_v2 = True
        
    if is_preserved_in_v2:
        classification = "re-indexed/subdivided section (content preserved in v2)"
        classification_counts[classification] += 1
        results.append({
            "chunk_id": cid,
            "document_id": doc_id,
            "section": sec,
            "page_number": page_no,
            "classification": classification,
            "preserved_in_v2": True,
            "text_preview": body[:120],
            "reason": "Substantive text exists in v2 under corrected section sub-clause or re-indexed chunk."
        })
        continue

    # If NOT in v2, classify the removed content
    classification = "unknown"
    reason = ""

    # Check for empty / whitespace / punctuation only
    if not norm_body or re.fullmatch(r"[\*\s\.\,\-\_0-9]+", norm_body):
        classification = "empty/non-substantive text"
        reason = "Chunk body consists solely of whitespace, page markers, or asterisks (*)."

    # Check for Table of Contents
    elif any(re.search(p, text, re.IGNORECASE) for p in TOC_PATTERNS) or (page_no and page_no <= 6 and "patents-act-1970" in doc_id and "ARRANGEMENT" in text.upper()):
        classification = "table-of-contents artifact"
        reason = "TOC index entry listing section names before statutory enactment text."

    # Check for footnote artifact
    elif any(re.search(p, body, re.IGNORECASE) for p in FOOTNOTE_PATTERNS) or (sec and ("Subs" in sec or "Ins" in sec or "Omitted" in sec or "w.e.f" in sec)):
        classification = "footnote artifact"
        reason = "Statutory amendment footnote citing Act number, amendment date, or substitution notice."

    # Check for duplicate heading
    elif len(lines) <= 2 and any(term in body.upper() for term in ["PATENTS ACT", "THE PATENTS ACT", "THE DRUGS AND COSMETICS ACT", "BIOLOGICAL DIVERSITY ACT"]):
        classification = "duplicate heading"
        reason = "Running header or duplicate title line across PDF page split."

    else:
        # Check if genuine statutory content
        if re.search(r"\b(?:shall|may|prohibited|punishable|offence|patent|license|authority)\b", body, re.IGNORECASE) and len(body) > 100:
            classification = "genuine statutory content"
            reason = "Contains legal obligations, prohibitions, or definitions."
            substantive_lost.append({
                "chunk_id": cid,
                "document_id": doc_id,
                "section": sec,
                "page_number": page_no,
                "text": body,
            })
        else:
            classification = "empty/non-substantive text"
            reason = "Fragment lacking statutory operative substance."

    classification_counts[classification] += 1
    results.append({
        "chunk_id": cid,
        "document_id": doc_id,
        "section": sec,
        "page_number": page_no,
        "classification": classification,
        "preserved_in_v2": False,
        "text_preview": body[:120],
        "reason": reason
    })

print("\n--- Removed / Restructured Chunk Classification Summary ---")
for k, v in sorted(classification_counts.items()):
    print(f"  {k}: {v}")

print(f"\nSubstantive lost chunks: {len(substantive_lost)}")
if substantive_lost:
    print("ALERT: SUBSTANTIVE TEXT LOST!")
    for s in substantive_lost:
        print(f"  LOST: {s['chunk_id']} | {s['section']} | pg {s['page_number']}")
        print(f"  Preview: {s['text'][:150]}")
else:
    print("CONFIRMED: ZERO genuine statutory content chunks were lost.")

# Write report JSON
out_path = WORKSPACE_ROOT / "reports" / "phase3b_removed_chunk_audit.json"
out_data = {
    "total_v1_corpus_chunks": len(v1_corpus),
    "total_v2_corpus_chunks": len(v2_corpus),
    "identical_chunk_ids": len(identical_chunk_ids),
    "audited_non_identical_chunks": len(results),
    "classification_summary": dict(classification_counts),
    "substantive_content_lost_count": len(substantive_lost),
    "status": "PASSED" if len(substantive_lost) == 0 else "FAILED",
    "audited_chunks": results,
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out_data, f, indent=2)
print(f"\nExported audit report to: {out_path}")
