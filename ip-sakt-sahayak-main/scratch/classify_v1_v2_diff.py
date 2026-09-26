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

pts_v1 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v1.extend(records)
    if nxt is None: break
    offset = nxt

pts_v2 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test_v2", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v2.extend(records)
    if nxt is None: break
    offset = nxt

v1_corpus = [p.payload for p in pts_v1 if not str(p.payload.get("chunk_id", "")).startswith("test-") and not str(p.payload.get("chunk_id", "")).startswith("live_smoke")]
v2_corpus = [p.payload for p in pts_v2]

v1_by_id = {c["chunk_id"]: c for c in v1_corpus}
v2_by_id = {c["chunk_id"]: c for c in v2_corpus}

# Check all chunks in v1
print(f"Total v1 chunks: {len(v1_corpus)}")
print(f"Total v2 chunks: {len(v2_corpus)}")

# Let's find chunks that represent the net 133 difference or are removed
# A chunk in v1 is considered 'removed' if its chunk_id does not exist in v2.
# Among the 431 non-identical chunk_ids:
# 1. Did the substantive text survive in v2? (Yes, for 428 of them!)
# 2. What were the specific footnote chunks and TOC chunks that caused the count to drop from 886 to 753?

# Let's inspect which chunks in v1 were footnote artifacts:
fn_chunks = []
toc_chunks = []
heading_chunks = []
empty_chunks = []
genuine_statutory = []
unknown = []

# Footnote regex
FN_RE = re.compile(r"^\s*\d+\.\s+(?:Subs\.|Ins\.|Omitted|The words|The brackets|Added by|Certain words|Certain expressions|Clause|Sub-clause|Sub-section|Word|Proviso|Explanation)\b", re.IGNORECASE)

for c in v1_corpus:
    cid = c["chunk_id"]
    text = c["text"]
    sec = c.get("section", "")
    pg = c.get("page_number", 0)
    lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().startswith("[")]
    body = " ".join(lines)
    
    # Is it TOC?
    if (c["document_id"] == "patents-act-1970" and pg and pg <= 6 and "ARRANGEMENT OF SECTIONS" in text.upper()) or "ARRANGEMENT OF RULES" in text.upper():
        toc_chunks.append((cid, sec, pg, body[:100]))
    # Is it footnote section header?
    elif "Subs" in sec or "Ins" in sec or "Omitted" in sec or (lines and FN_RE.match(lines[0])) or (cid not in v2_by_id and any(term in sec for term in ["Subs", "Ins", "Omitted"])):
        fn_chunks.append((cid, sec, pg, body[:100]))

print(f"TOC chunks in v1: {len(toc_chunks)}")
print(f"Footnote chunks in v1: {len(fn_chunks)}")
