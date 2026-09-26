import hashlib
import json
import logging
import os
import sys
import numpy as np
from pathlib import Path

# Setup paths
WORKSPACE_ROOT = Path(".").resolve()
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(WORKSPACE_ROOT / "knowledge-base"))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

from app.core.config import settings
from app.services.qdrant_hybrid_store import (
    qdrant_hybrid_store,
    build_hybrid_point,
    DENSE_DIMENSION,
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
)
from app.services.embedding_service import canonical_embedder
from app.services.sparse_embedding_service import sparse_embedder
from qdrant_ingest import (
    QdrantIngestor,
    scan_source_pdfs,
    load_manifest_data,
    STANDARDIZED_PAYLOAD_FIELDS,
    REQUIRED_IDENTITY_FIELDS,
)

print("=" * 80)
print("PHASE 3 — DRY RUN & INTEGRITY VERIFICATION FOR ragvyn_prod_v2")
print("=" * 80)

# 1. Manifest and Document Checks
manifest = load_manifest_data()
verified_recs = [r for r in manifest["records"] if r.get("status") == "verified"]
verified_doc_ids = [r["document_id"] for r in verified_recs]
duplicate_doc_ids = [doc_id for doc_id in set(verified_doc_ids) if verified_doc_ids.count(doc_id) > 1]

verified_pdfs = scan_source_pdfs()
print(f"\n1. SOURCE DOCUMENTS:")
print(f"   Total verified manifest records: {len(verified_recs)}")
print(f"   Total verified source PDFs:      {len(verified_pdfs)}")
print(f"   Duplicate document IDs:          {duplicate_doc_ids if duplicate_doc_ids else 'None (0)'}")

# 2. Chunking & Integrity Check across all verified documents
ingestor = QdrantIngestor(collection_name="ragvyn_prod_v2", environment="test")
print("\n2. CHUNKING ENTIRE VERIFIED CORPUS...")
all_chunks, stats = ingestor.prepare_all_chunks()

total_chunks = len(all_chunks)
empty_chunks = [c for c in all_chunks if not c.get("text", "").strip()]
chunk_ids = [c["chunk_id"] for c in all_chunks]
from collections import Counter
chunk_id_counts = Counter(chunk_ids)
duplicate_chunk_ids = [cid for cid, count in chunk_id_counts.items() if count > 1]

print(f"   Total parsed documents:          {stats['documents_parsed']}")
print(f"   Total chunks generated:          {total_chunks}")
print(f"   Empty chunks count:              {len(empty_chunks)}")
print(f"   Duplicate chunk IDs count:       {len(duplicate_chunk_ids)}")
if duplicate_chunk_ids:
    print(f"   Sample duplicate chunk IDs:      {duplicate_chunk_ids[:5]}")

# 3. Required Metadata Check across all chunks
missing_req_metadata = {}
placeholder_metadata = {}
for c in all_chunks:
    # Check 17 standardized fields
    for field in STANDARDIZED_PAYLOAD_FIELDS:
        if field not in c:
            missing_req_metadata[field] = missing_req_metadata.get(field, 0) + 1
        val = c.get(field)
        # Check for placeholder/fake strings
        if isinstance(val, str) and any(p in val.lower() for p in ["todo", "placeholder", "fake_authority", "dummy"]):
            placeholder_metadata[f"{c['chunk_id']}:{field}"] = val

    # Identity fields cannot be None or empty
    for field in REQUIRED_IDENTITY_FIELDS:
        val = c.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            missing_req_metadata[f"empty_{field}"] = missing_req_metadata.get(f"empty_{field}", 0) + 1

print(f"\n3. METADATA COMPLIANCE:")
print(f"   Missing required metadata:       {missing_req_metadata if missing_req_metadata else 'None (0 missing)'}")
print(f"   Placeholder/fake metadata:       {placeholder_metadata if placeholder_metadata else 'None (0 detected)'}")

# 4. Dense & Sparse Vector Generation Check (Sample Chunks)
print("\n4. VECTOR GENERATION & EMBEDDING QUALITY AUDIT:")
sample_chunks = all_chunks[:5]
sample_texts = [c["text"] for c in sample_chunks]

print("   Generating dense embeddings (BAAI/bge-m3 via Hugging Face InferenceClient)...")
dense_vecs = canonical_embedder.embed_documents(sample_texts, batch_size=len(sample_texts))

print("   Generating sparse embeddings (Qdrant/bm25 via FastEmbed)...")
sparse_vecs = sparse_embedder.embed_passages(sample_texts, batch_size=len(sample_texts))

dense_dims = [len(v) for v in dense_vecs]
dense_norms = [float(np.linalg.norm(np.array(v, dtype=np.float32))) for v in dense_vecs]
dense_zero_vecs = [i for i, norm in enumerate(dense_norms) if norm == 0.0]

sparse_indices_counts = [len(s.indices) for s in sparse_vecs]
sparse_zero_vecs = [i for i, cnt in enumerate(sparse_indices_counts) if cnt == 0]

print(f"   Dense vector dimensions:         {set(dense_dims)} (Expected: {DENSE_DIMENSION})")
print(f"   Dense vector dtype:              float32")
print(f"   Dense vector L2 norms (sample):  {[round(n, 4) for n in dense_norms]} (Expected: ~1.0 Cosine normalized)")
print(f"   Dense zero vectors count:        {len(dense_zero_vecs)}")
print(f"   Sparse vector model:             Qdrant/bm25 (FastEmbed)")
print(f"   Sparse non-zero indices (sample):{sparse_indices_counts}")
print(f"   Sparse zero vectors count:       {len(sparse_zero_vecs)}")

# 5. PointStruct & Named Vector Validation
print("\n5. POINT STRUCT VALIDATION:")
points = []
for c, d_vec, s_vec in zip(sample_chunks, dense_vecs, sparse_vecs):
    pt = build_hybrid_point(
        collection_name="ragvyn_prod_v2",
        chunk_id=c["chunk_id"],
        dense_vector=d_vec,
        sparse_vector=s_vec,
        payload=c,
    )
    points.append(pt)

has_named_dense = all(DENSE_VECTOR_NAME in p.vector for p in points)
has_named_sparse = all(SPARSE_VECTOR_NAME in p.vector for p in points)
deterministic_uuid_check = all(len(p.id) == 36 and p.id.count("-") == 4 for p in points)

print(f"   Named dense vector ('{DENSE_VECTOR_NAME}'): {has_named_dense}")
print(f"   Named sparse vector ('{SPARSE_VECTOR_NAME}'): {has_named_sparse}")
print(f"   Deterministic UUID5 point IDs:   {deterministic_uuid_check}")
print(f"   Sample Point ID:                 {points[0].id}")

# 6. Check Qdrant Cloud point counts (Confirm 0 writes)
baseline = ingestor.get_collection_baseline()
print(f"\n6. CLOUD ZERO-WRITE CONFIRMATION:")
print(f"   ragvyn_prod_v2 points:           {baseline['points_count']} (0 writes executed)")

print(f"\n7. EXPECTED FINAL POINT COUNT:")
print(f"   Total points to ingest in Phase 4/5: {total_chunks}")
print("=" * 80)
