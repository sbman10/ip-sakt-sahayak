"""
scratch/run_retrieval_audit.py
-----------------------------
Executes the retrieval audit for Phase 3B closure on ragvyn_hybrid_test_v2.
Runs 5 queries across:
  - Dense-only top 10 (bge_m3)
  - Sparse-only top 10 (bm25)
  - Hybrid RRF top 10
Reporting: section, document_id, chunk_id, score, and rank.
"""

import json
import sys
from pathlib import Path

# Setup path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
KB_DIR = ROOT_DIR / "knowledge-base"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(KB_DIR) not in sys.path:
    sys.path.insert(0, str(KB_DIR))

from app.services.qdrant_hybrid_store import (
    qdrant_hybrid_store,
    DENSE_VECTOR_NAME,
    SPARSE_VECTOR_NAME,
)
from app.services.embedding_service import canonical_embedder
from app.services.sparse_embedding_service import sparse_embedder
from qdrant_client import models as qmodels

TARGET_COLLECTION = "ragvyn_hybrid_test_v2"

QUERIES = [
    "What does Section 3(p) of the Indian Patents Act say?",
    "Section 3(p) traditional knowledge patentability",
    "Section 3(d) enhanced efficacy",
    "Section 3(e) mere admixture",
    "Section 2(1)(ja) inventive step",
]

def run_audit():
    client = qdrant_hybrid_store.get_client()
    qdrant_hybrid_store.verify_collection_schema(TARGET_COLLECTION)

    audit_results = {}

    for query_text in QUERIES:
        print(f"\n========================================================")
        print(f"QUERY: {query_text}")
        print(f"========================================================")

        dense_vec = canonical_embedder.embed_query(query_text)
        sparse_vec = sparse_embedder.embed_query(query_text)

        # 1. Dense-only Top 10
        dense_res = client.query_points(
            collection_name=TARGET_COLLECTION,
            query=dense_vec,
            using=DENSE_VECTOR_NAME,
            limit=10,
            with_payload=True,
        )
        dense_hits = []
        for rank, pt in enumerate(dense_res.points, start=1):
            p = pt.payload or {}
            dense_hits.append({
                "rank": rank,
                "score": float(pt.score),
                "section": p.get("section", "N/A"),
                "document_id": p.get("document_id", "N/A"),
                "chunk_id": p.get("chunk_id", "N/A"),
                "text_preview": (p.get("text", "")[:100] + "...").replace("\n", " "),
            })

        # 2. Sparse-only Top 10
        sparse_res = client.query_points(
            collection_name=TARGET_COLLECTION,
            query=sparse_vec,
            using=SPARSE_VECTOR_NAME,
            limit=10,
            with_payload=True,
        )
        sparse_hits = []
        for rank, pt in enumerate(sparse_res.points, start=1):
            p = pt.payload or {}
            sparse_hits.append({
                "rank": rank,
                "score": float(pt.score),
                "section": p.get("section", "N/A"),
                "document_id": p.get("document_id", "N/A"),
                "chunk_id": p.get("chunk_id", "N/A"),
                "text_preview": (p.get("text", "")[:100] + "...").replace("\n", " "),
            })

        # 3. Hybrid RRF Top 10
        prefetch = [
            qmodels.Prefetch(
                query=dense_vec,
                using=DENSE_VECTOR_NAME,
                limit=40,
            ),
            qmodels.Prefetch(
                query=sparse_vec,
                using=SPARSE_VECTOR_NAME,
                limit=40,
            ),
        ]
        hybrid_res = client.query_points(
            collection_name=TARGET_COLLECTION,
            prefetch=prefetch,
            query=qmodels.FusionQuery(fusion=qmodels.Fusion.RRF),
            limit=10,
            with_payload=True,
        )
        hybrid_hits = []
        for rank, pt in enumerate(hybrid_res.points, start=1):
            p = pt.payload or {}
            hybrid_hits.append({
                "rank": rank,
                "score": float(pt.score),
                "section": p.get("section", "N/A"),
                "document_id": p.get("document_id", "N/A"),
                "chunk_id": p.get("chunk_id", "N/A"),
                "text_preview": (p.get("text", "")[:100] + "...").replace("\n", " "),
            })

        audit_results[query_text] = {
            "dense_top10": dense_hits,
            "sparse_top10": sparse_hits,
            "hybrid_top10": hybrid_hits,
        }

        print("\n--- DENSE TOP 10 ---")
        for h in dense_hits:
            print(f"Rank {h['rank']:2d} | Score: {h['score']:.4f} | Section: {h['section']:<16} | Doc: {h['document_id']:<24} | Chunk: {h['chunk_id']}")
        print("\n--- SPARSE TOP 10 ---")
        for h in sparse_hits:
            print(f"Rank {h['rank']:2d} | Score: {h['score']:.4f} | Section: {h['section']:<16} | Doc: {h['document_id']:<24} | Chunk: {h['chunk_id']}")
        print("\n--- HYBRID RRF TOP 10 ---")
        for h in hybrid_hits:
            print(f"Rank {h['rank']:2d} | Score: {h['score']:.4f} | Section: {h['section']:<16} | Doc: {h['document_id']:<24} | Chunk: {h['chunk_id']}")

    out_file = ROOT_DIR / "reports" / "phase3b_retrieval_audit.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(audit_results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved audit results to {out_file}")

if __name__ == "__main__":
    run_audit()
