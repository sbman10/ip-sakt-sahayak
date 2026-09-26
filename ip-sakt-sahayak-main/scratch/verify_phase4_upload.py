import json
import sys
from pathlib import Path
import numpy as np

WORKSPACE_ROOT = Path(".").resolve()
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from app.services.qdrant_hybrid_store import qdrant_hybrid_store

client = qdrant_hybrid_store.get_client()

print("=" * 80)
print("PHASE 4 — VERIFYING RETRIEVED POINTS FROM ragvyn_prod_v2")
print("=" * 80)

# 1. Retrieve all 5 points from ragvyn_prod_v2
records, _ = client.scroll(
    collection_name="ragvyn_prod_v2",
    limit=10,
    with_payload=True,
    with_vectors=True,
)

print(f"Retrieved points count: {len(records)}")

required_payload_fields = [
    "text",
    "chunk_id",
    "document_id",
    "authority",
    "jurisdiction",
    "document_type",
    "section",
]

verification_results = {
    "point_ids": [],
    "named_dense_exists": True,
    "named_sparse_exists": True,
    "dense_length_1024": True,
    "dense_nonzero": True,
    "sparse_nonzero": True,
    "required_payload_fields_present": True,
    "no_fake_citations": True,
    "no_unnamed_vectors": True,
}

for idx, r in enumerate(records):
    pid = str(r.id)
    verification_results["point_ids"].append(pid)
    payload = r.payload or {}
    vector_dict = r.vector or {}

    print(f"\n--- Point {idx + 1}: {pid} ---")
    print(f"  Chunk ID:        {payload.get('chunk_id')}")
    print(f"  Document ID:     {payload.get('document_id')}")
    print(f"  Authority:       {payload.get('authority')}")
    print(f"  Jurisdiction:    {payload.get('jurisdiction')}")
    print(f"  Document Type:   {payload.get('document_type')}")
    print(f"  Section:         {payload.get('section')}")
    print(f"  Title:           {payload.get('title')}")
    print(f"  Publication Date:{payload.get('publication_date')}")

    # Vector checks
    dense_vec = vector_dict.get("bge_m3")
    sparse_vec = vector_dict.get("bm25")

    if dense_vec is None:
        verification_results["named_dense_exists"] = False
        print("  [FAIL] Missing 'bge_m3' vector")
    else:
        d_len = len(dense_vec)
        norm = float(np.linalg.norm(np.array(dense_vec, dtype=np.float32)))
        print(f"  Dense 'bge_m3':  dim={d_len}, norm={norm:.4f}")
        if d_len != 1024:
            verification_results["dense_length_1024"] = False
        if norm == 0.0:
            verification_results["dense_nonzero"] = False

    if sparse_vec is None:
        verification_results["named_sparse_exists"] = False
        print("  [FAIL] Missing 'bm25' vector")
    else:
        indices = getattr(sparse_vec, "indices", [])
        values = getattr(sparse_vec, "values", [])
        print(f"  Sparse 'bm25':   non-zero tokens={len(indices)}")
        if len(indices) == 0:
            verification_results["sparse_nonzero"] = False

    # Old default unnamed vector format check
    if not isinstance(vector_dict, dict) or not set(vector_dict.keys()).issubset({"bge_m3", "bm25"}):
        verification_results["no_unnamed_vectors"] = False
        print("  [FAIL] Unnamed or unexpected vector format detected")

    # Payload checks
    for field in required_payload_fields:
        val = payload.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            print(f"  [FAIL] Missing required payload field: {field}")
            verification_results["required_payload_fields_present"] = False

    # Check for fake citations
    text = payload.get("text", "")
    for fake_term in ["fake citation", "placeholder citation", "dummy citation", "foo", "bar"]:
        if fake_term in text.lower():
            verification_results["no_fake_citations"] = False
            print(f"  [FAIL] Fake citation term detected: {fake_term}")

# 8. Check other collections point counts
col_counts = {
    "ragvyn_prod_v2": client.get_collection("ragvyn_prod_v2").points_count,
    "ragvyn_prod_v1": client.get_collection("ragvyn_prod_v1").points_count,
    "ragvyn_hybrid_test_v2": client.get_collection("ragvyn_hybrid_test_v2").points_count,
    "ragvyn_hybrid_test": client.get_collection("ragvyn_hybrid_test").points_count,
    "ragvyn_test": client.get_collection("ragvyn_test").points_count,
}

print("\n" + "=" * 80)
print("VERIFICATION SUMMARY:")
for k, v in verification_results.items():
    print(f"  {k}: {v}")

print("\nCOLLECTION POINT COUNTS:")
for col, cnt in col_counts.items():
    print(f"  {col}: {cnt}")
print("=" * 80)
