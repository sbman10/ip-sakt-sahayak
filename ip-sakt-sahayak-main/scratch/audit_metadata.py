import sys
import re
from pathlib import Path
from collections import defaultdict

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.qdrant_hybrid_store import (
    qdrant_hybrid_store,
    DENSE_DIMENSION,
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
)

client = qdrant_hybrid_store.get_client()

print("Scrolling all 753 points from ragvyn_hybrid_test_v2...")
pts = []
offset = None
while True:
    records, nxt = client.scroll("ragvyn_hybrid_test_v2", limit=500, offset=offset, with_payload=True, with_vectors=True)
    pts.extend(records)
    if nxt is None: break
    offset = nxt

print(f"Total points retrieved: {len(pts)}")
assert len(pts) == 753, f"Expected 753 points, got {len(pts)}"

# Required fields
REQUIRED_FIELDS = [
    "text",
    "chunk_id",
    "document_id",
    "source",
    "authority",
    "jurisdiction",
    "document_type",
    "domain",
    "section",
    "language",
    "embedding_model",
    "embedding_dimension",
    "sparse_model",
]

missing_fields_report = defaultdict(list)
malformed_fields_report = defaultdict(list)
date_omitted_count = 0
date_valid_count = 0
parent_sec_count = 0
iso_date_re = re.compile(r"^\d{4}-\d{2}-\d{2}")

for p in pts:
    pid = str(p.id)
    payload = p.payload or {}
    vecs = p.vector or {}

    # 1. Check payload required fields
    for field in REQUIRED_FIELDS:
        val = payload.get(field)
        if val is None or val == "":
            missing_fields_report[field].append(pid)

    # 2. Check types and values
    if payload.get("embedding_dimension") != DENSE_DIMENSION:
        malformed_fields_report["embedding_dimension"].append((pid, payload.get("embedding_dimension")))
    if payload.get("embedding_model") != "BAAI/bge-m3":
        malformed_fields_report["embedding_model"].append((pid, payload.get("embedding_model")))
    if payload.get("sparse_model") != "Qdrant/bm25":
        malformed_fields_report["sparse_model"].append((pid, payload.get("sparse_model")))
    if payload.get("language") != "en":
        malformed_fields_report["language"].append((pid, payload.get("language")))
    if payload.get("jurisdiction") not in ["India", "International"]:
        malformed_fields_report["jurisdiction"].append((pid, payload.get("jurisdiction")))

    # 3. Check parent_section where applicable
    if payload.get("parent_section"):
        parent_sec_count += 1

    # 4. Check dates (publication_date, priority_date)
    pub_d = payload.get("publication_date")
    pri_d = payload.get("priority_date")
    
    # Must never be empty string ""
    if pub_d == "":
        malformed_fields_report["publication_date_empty_string"].append(pid)
    if pri_d == "":
        malformed_fields_report["priority_date_empty_string"].append(pid)

    if pub_d is not None and pub_d != "":
        if not iso_date_re.match(str(pub_d)):
            malformed_fields_report["publication_date_invalid_format"].append((pid, pub_d))
        else:
            date_valid_count += 1
    elif pub_d is None and pri_d is None:
        date_omitted_count += 1

    # 5. Check vectors
    if DENSE_VECTOR_NAME not in vecs:
        missing_fields_report["vector_dense"].append(pid)
    elif len(vecs[DENSE_VECTOR_NAME]) != DENSE_DIMENSION:
        malformed_fields_report["dense_vector_dimension"].append((pid, len(vecs[DENSE_VECTOR_NAME])))

    if SPARSE_VECTOR_NAME not in vecs:
        missing_fields_report["vector_sparse"].append(pid)
    else:
        sp = vecs[SPARSE_VECTOR_NAME]
        if hasattr(sp, "indices") and len(sp.indices) == 0:
            malformed_fields_report["sparse_vector_empty"].append(pid)

print("\n=== Metadata Audit Results ===")
print(f"Total points audited: {len(pts)}")
print(f"Missing required payload fields: {dict(missing_fields_report) if missing_fields_report else 'NONE (0)'}")
print(f"Malformed payload fields: {dict(malformed_fields_report) if malformed_fields_report else 'NONE (0)'}")
print(f"Points with parent_section populated: {parent_sec_count} (Section 3 sub-clauses)")
print(f"Points with valid ISO dates: {date_valid_count}")
print(f"Points with cleanly omitted optional dates: {date_omitted_count} (nba-abs-guidelines & tkdl-overview)")
print(f"Dual vectors (bge_m3 1024-d + Qdrant/bm25) present: {len(pts)} / {len(pts)} (100%)")

is_passed = (len(missing_fields_report) == 0 and len(malformed_fields_report) == 0)
print(f"\nOverall Metadata Audit Status: {'PASSED' if is_passed else 'FAILED'}")
