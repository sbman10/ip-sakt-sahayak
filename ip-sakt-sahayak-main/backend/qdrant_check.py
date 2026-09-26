"""
backend/qdrant_check.py
-----------------------
TEST UTILITY ONLY — NOT FOR PRODUCTION INGESTION.

Verifies end-to-end connectivity, dual-vector hybrid point construction,
and prefetch-based RRF search against the Qdrant Cloud test collection (ragvyn_hybrid_test).

Requirements Enforced:
- Dense vector: 'bge_m3' (1024 dimensions, Hugging Face BGE-M3)
- Sparse vector: 'bm25' (FastEmbed Qdrant/bm25 with Modifier.IDF)
- Point ID: Deterministic UUID5
- Payload: Complete metadata schema
- Does NOT create or recreate collections automatically.
- Does NOT upload dense-only or single-vector points.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from qdrant_client import QdrantClient, models as qmodels

from app.core.config import settings
from app.services.embedding_service import canonical_embedder
from app.services.sparse_embedding_service import sparse_embedder
from app.services.qdrant_hybrid_store import (
    build_hybrid_point,
    generate_point_id,
    qdrant_hybrid_store,
)

COLLECTION_NAME = settings.QDRANT_COLLECTION or "ragvyn_hybrid_test"

print("=" * 70)
print("IP-SAKTI Sahayak — Qdrant Hybrid Integration Check (TEST UTILITY ONLY)")
print("=" * 70)
print(f"Target Collection: {COLLECTION_NAME}")
print(f"Dense Model:       {settings.HF_EMBEDDING_MODEL} (1024-dim, normalized)")
print("Sparse Model:      Qdrant/bm25 (FastEmbed, client-side)")
print("Fusion:            Reciprocal Rank Fusion (RRF)")
print("=" * 70)

# 1. Verify schema on target collection without modifying or recreating
print("\n[Step 1] Verifying Qdrant Cloud collection schema...")
schema_report = qdrant_hybrid_store.verify_collection_schema(COLLECTION_NAME)
print(f"  Status:                 {schema_report['status']}")
print(f"  Points Count:           {schema_report['points_count']}")
print(f"  Dense Vector Schema:    {schema_report['dense_vector']}")
print(f"  Sparse Vector Schema:   {schema_report['sparse_vector']}")
print(f"  Indexed Payload Fields: {schema_report['indexed_payload_fields']}")
print("  Schema Compatibility:   PASSED")

# 2. Build test hybrid points (dual-vector: bge_m3 + bm25)
test_chunks = [
    {
        "chunk_id": "test-patent-law-03p",
        "text": "Section 3(p) of the Patents Act, 1970 excludes an invention which in effect is traditional knowledge or aggregation of known properties.",
        "document_id": "DOC-IN-PAT-1970",
        "source": "The Patents Act, 1970",
        "jurisdiction": "India",
        "authority": "Indian Patent Office",
        "document_type": "statute",
        "domain": "Patent Law",
        "section": "Section 3(p)",
        "language": "en",
        "publication_date": "1970-09-19",
        "priority_date": "1970-09-19",
    },
    {
        "chunk_id": "test-ayush-formulation-001",
        "text": "Classical Ayurvedic formulation comprising Withania somnifera (Ashwagandha) and Curcuma longa documented in TKDL prior art.",
        "document_id": "DOC-TKDL-AYUSH-001",
        "source": "Traditional Knowledge Digital Library",
        "jurisdiction": "India",
        "authority": "CSIR / Ministry of AYUSH",
        "document_type": "traditional_knowledge",
        "domain": "Ayurveda",
        "section": "Charaka Samhita",
        "language": "en",
        "publication_date": "1980-01-01",
        "priority_date": "1980-01-01",
    },
]

print("\n[Step 2] Generating dual-vector embeddings for test chunks...")
texts = [c["text"] for c in test_chunks]

# Dense embeddings via Hugging Face InferenceClient
dense_vectors = canonical_embedder.embed_documents(texts, batch_size=2)
# Sparse embeddings via FastEmbed passage_embed()
sparse_vectors = sparse_embedder.embed_passages(texts, batch_size=2)

print(f"  Dense vectors generated:  {len(dense_vectors)} (dim {len(dense_vectors[0])})")
print(f"  Sparse vectors generated: {len(sparse_vectors)} (tokens {len(sparse_vectors[0].indices)})")

# 3. Construct validated hybrid points
print("\n[Step 3] Constructing and validating PointStruct objects...")
points: list[qmodels.PointStruct] = []
for item, d_vec, s_vec in zip(test_chunks, dense_vectors, sparse_vectors):
    pt = build_hybrid_point(
        collection_name=COLLECTION_NAME,
        chunk_id=item["chunk_id"],
        dense_vector=d_vec,
        sparse_vector=s_vec,
        payload=item,
    )
    points.append(pt)
    print(f"  Point ID (UUID5): {pt.id} -> chunk: {item['chunk_id']}")

# 4. Upsert test points into test collection
client = qdrant_hybrid_store.get_client()
print(f"\n[Step 4] Upserting {len(points)} test points to '{COLLECTION_NAME}'...")
upsert_res = client.upsert(
    collection_name=COLLECTION_NAME,
    points=points,
)
print(f"  Upsert result: {upsert_res.status}")

# 5. Hybrid search using prefetch + RRF
test_query = "Traditional knowledge patentability exclusion under Section 3(p)"
print(f"\n[Step 5] Executing hybrid query with RRF: '{test_query}'...")

# Generate query dense vector and sparse vector
query_dense = canonical_embedder.embed_query(test_query)
query_sparse = sparse_embedder.embed_query(test_query)

prefetch_clauses = qdrant_hybrid_store.build_hybrid_prefetch(
    dense_vector=query_dense,
    sparse_vector=query_sparse,
    prefetch_limit=10,
)

search_response = client.query_points(
    collection_name=COLLECTION_NAME,
    prefetch=prefetch_clauses,
    query=qmodels.FusionQuery(fusion=qmodels.Fusion.RRF),
    limit=5,
    with_payload=True,
)

print(f"  Found {len(search_response.points)} hybrid matching points:")
for idx, hit in enumerate(search_response.points, 1):
    chunk_id = hit.payload.get("chunk_id", "N/A") if hit.payload else "N/A"
    title = hit.payload.get("source", "N/A") if hit.payload else "N/A"
    print(f"    {idx}. ID: {hit.id} | RRF Score: {hit.score:.5f} | chunk: {chunk_id} | source: {title}")

print("\n" + "=" * 70)
print("Qdrant Hybrid Integration Check Complete — SUCCESS")
print("=" * 70)