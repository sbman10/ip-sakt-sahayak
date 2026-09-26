import sys
from pathlib import Path
from collections import Counter, defaultdict

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store

client = qdrant_hybrid_store.get_client()

pts_v2 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test_v2", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v2.extend(records)
    if nxt is None: break
    offset = nxt

v2_corpus = [p.payload for p in pts_v2]

# 1. Source PDFs & document_ids
doc_counts = Counter(c["document_id"] for c in v2_corpus)
print("=== Source Documents Represented in ragvyn_hybrid_test_v2 ===")
for doc_id, count in sorted(doc_counts.items()):
    src = next(c["source"] for c in v2_corpus if c["document_id"] == doc_id)
    print(f"  {doc_id:32s} | {count:3d} chunks | source: '{src}'")

print(f"Total documents represented: {len(doc_counts)} / 9 expected.")
assert len(doc_counts) == 9, "Expected 9 documents!"

# 2. Jurisdictions
jur_counts = Counter(c["jurisdiction"] for c in v2_corpus)
print("\n=== Jurisdictions Represented ===")
for jur, count in sorted(jur_counts.items()):
    print(f"  {jur:15s} | {count:3d} chunks")
assert "India" in jur_counts and "International" in jur_counts, "Both India and International must be present!"

# 3. Document types
dtype_counts = Counter(c["document_type"] for c in v2_corpus)
print("\n=== Document Types Represented ===")
for dt, count in sorted(dtype_counts.items()):
    print(f"  {dt:15s} | {count:3d} chunks")

# 4. Total Character & Word Counts (Comparison with v1)
pts_v1 = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test", limit=500, offset=offset, with_payload=True, with_vectors=False)
    pts_v1.extend(records)
    if nxt is None: break
    offset = nxt

v1_corpus = [p.payload for p in pts_v1 if not str(p.payload.get("chunk_id", "")).startswith("test-") and not str(p.payload.get("chunk_id", "")).startswith("live_smoke")]

chars_v1 = defaultdict(int)
words_v1 = defaultdict(int)
for c in v1_corpus:
    t = c["text"]
    chars_v1[c["document_id"]] += len(t)
    words_v1[c["document_id"]] += len(t.split())

chars_v2 = defaultdict(int)
words_v2 = defaultdict(int)
for c in v2_corpus:
    t = c["text"]
    chars_v2[c["document_id"]] += len(t)
    words_v2[c["document_id"]] += len(t.split())

print("\n=== Text Volume Comparison (v1 vs v2) ===")
for doc_id in sorted(doc_counts.keys()):
    c1, c2 = chars_v1[doc_id], chars_v2[doc_id]
    w1, w2 = words_v1[doc_id], words_v2[doc_id]
    print(f"  {doc_id:32s}: v1 chars={c1:,} -> v2 chars={c2:,} | v1 words={w1:,} -> v2 words={w2:,}")

print("\nCorpus Integrity Check PASSED.")
