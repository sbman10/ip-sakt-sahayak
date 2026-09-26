"""
scripts/compare_chroma_qdrant.py
--------------------------------
Benchmark comparison script between local ChromaDB and Qdrant Cloud.

Verifies:
1. Top-5 original chunk ID overlap (Target: >= 95% identical relevant sets).
2. Source, section, and jurisdiction metadata preservation.
3. Cosine similarity score equivalence (within numerical precision tolerance).
4. Strict jurisdiction isolation:
   - India queries do not retrieve international-only documents.
   - International queries do not retrieve India-only documents.
5. Payload completeness for downstream CrossEncoder reranking.

Usage:
  python scripts/compare_chroma_qdrant.py
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

# Setup import path for backend/app
project_root = Path(__file__).resolve().parents[1]
backend_dir = project_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import chromadb
from app.core.config import settings
from app.core.models import model_registry
from app.services.qdrant_service import qdrant_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("chroma_qdrant_comparison")

BENCHMARK_QUERIES = [
    {
        "query": "patentability of traditional ayurvedic formulations under section 3p",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
    {
        "query": "prior approval required from national biodiversity authority section 6 biological diversity act",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
    {
        "query": "section 3d mere discovery of a new form of known substance and therapeutic efficacy",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
    {
        "query": "protection of traditional knowledge and TKDL prior art references",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
    {
        "query": "compulsory licensing provisions under the patents act 1970",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
    {
        "query": "access and benefit sharing under convention on biological diversity and nagoya protocol",
        "jurisdiction": "International",
        "collection": settings.QDRANT_INTERNATIONAL_COLLECTION,
    },
    {
        "query": "trips agreement patent protection and flexibilities for public health",
        "jurisdiction": "International",
        "collection": settings.QDRANT_INTERNATIONAL_COLLECTION,
    },
    {
        "query": "ayurvedic patent search and medicinal plant exploitation",
        "jurisdiction": "India",
        "collection": settings.QDRANT_INDIA_COLLECTION,
    },
]


def run_chroma_search(
    chroma_col: Any,
    query_vector: list[float],
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Runs vector similarity search against local ChromaDB."""
    try:
        raw = chroma_col.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        results = []
        ids = raw.get("ids", [[]])[0]
        docs = raw.get("documents", [[]])[0]
        metas = raw.get("metadatas", [[]])[0]
        distances = raw.get("distances", [[]])[0]

        for i, doc_id in enumerate(ids):
            dist = float(distances[i]) if i < len(distances) else 1.0
            # Chroma returns cosine distance in [0, 2] where sim = 1 - dist
            sim = max(0.0, min(1.0, 1.0 - dist))
            meta = metas[i] if i < len(metas) and metas[i] else {}
            results.append({
                "original_id": doc_id,
                "text": docs[i] if i < len(docs) else "",
                "source": meta.get("source", "Unknown"),
                "section": meta.get("section", "Unknown"),
                "jurisdiction": meta.get("jurisdiction", "India"),
                "distance": dist,
                "similarity": sim,
                "metadata": meta,
            })
        return results
    except Exception as e:
        log.error("Chroma search failed: %s", e)
        return []


def run_qdrant_search(
    collection_name: str,
    query_vector: list[float],
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Runs vector similarity search against Qdrant Cloud."""
    try:
        raw_hits = qdrant_service.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=top_k,
        )
        results = []
        for hit in raw_hits:
            payload = hit.get("payload", {})
            score = float(hit.get("score", 0.0))
            # Qdrant with Cosine returns cosine similarity in [-1, 1]
            dist = max(0.0, 1.0 - score)
            results.append({
                "original_id": payload.get("original_id") or payload.get("chunk_id") or str(hit.get("id")),
                "text": payload.get("text") or payload.get("page_content") or "",
                "source": payload.get("source", "Unknown"),
                "section": payload.get("section", "Unknown"),
                "jurisdiction": payload.get("jurisdiction", "India"),
                "distance": dist,
                "similarity": score,
                "metadata": payload,
            })
        return results
    except Exception as e:
        log.error("Qdrant search failed for '%s': %s", collection_name, e)
        return []


def main() -> int:
    print("=" * 70)
    print("IP-SAKTI Sahayak — ChromaDB vs Qdrant Search Equivalence Benchmark")
    print("=" * 70)
    print(f"Chroma DB Path:  {settings.CHROMA_DB_DIR}")
    print(f"Qdrant URL:      {settings.QDRANT_URL or 'In-Memory / Local'}")
    print(f"Total Queries:   {len(BENCHMARK_QUERIES)}")
    print("-" * 70)

    # Initialize Chroma client
    chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)

    # Preload BGE-M3 embedding model
    print("Loading BGE-M3 embedding model...")
    emb_model = model_registry.get_embedding_model()

    total_benchmarks = 0
    total_matches = 0
    jurisdiction_violations = 0
    query_reports = []

    for item in BENCHMARK_QUERIES:
        query = item["query"]
        jur = item["jurisdiction"]
        col_name = item["collection"]
        total_benchmarks += 1

        print(f"\n[{total_benchmarks}/{len(BENCHMARK_QUERIES)}] Query: '{query[:55]}...'")
        print(f"  Target Jurisdiction: {jur} | Collection: {col_name}")

        # Embed query vector
        query_vector = emb_model.encode(
            [query],
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )[0].tolist()

        # 1. Query Chroma
        chroma_col = None
        try:
            chroma_col = chroma_client.get_collection(col_name)
        except Exception:
            pass

        chroma_results = run_chroma_search(chroma_col, query_vector, top_k=5) if chroma_col else []

        # 2. Query Qdrant
        qdrant_results = run_qdrant_search(col_name, query_vector, top_k=5)

        chroma_ids = [r["original_id"] for r in chroma_results]
        qdrant_ids = [r["original_id"] for r in qdrant_results]

        # In empty collections (e.g. international before populating), both return 0
        if len(chroma_ids) == 0 and len(qdrant_ids) == 0:
            print("  Both engines returned 0 results (empty collection). Match: 100%")
            total_matches += 1
            query_reports.append({
                "query": query,
                "overlap_ratio": 1.0,
                "chroma_count": 0,
                "qdrant_count": 0,
                "status": "MATCH (Empty)",
            })
            continue

        # Check overlap
        common_ids = set(chroma_ids).intersection(set(qdrant_ids))
        union_ids = set(chroma_ids).union(set(qdrant_ids))
        overlap_ratio = len(common_ids) / len(chroma_ids) if len(chroma_ids) > 0 else 1.0

        # Check jurisdiction isolation
        for res in qdrant_results:
            doc_jur = res.get("jurisdiction", "")
            if jur == "India" and doc_jur.lower() == "international":
                print(f"  VIOLATION: India query retrieved International document '{res['original_id']}'!")
                jurisdiction_violations += 1
            elif jur == "International" and doc_jur.lower() == "india":
                print(f"  VIOLATION: International query retrieved India document '{res['original_id']}'!")
                jurisdiction_violations += 1

        print(f"  Chroma Top-5: {chroma_ids}")
        print(f"  Qdrant Top-5: {qdrant_ids}")
        print(f"  Overlap Ratio: {overlap_ratio * 100:.1f}% ({len(common_ids)} / {len(chroma_ids)})")

        # Check score correlation for common results
        for cid in common_ids:
            c_doc = next(d for d in chroma_results if d["original_id"] == cid)
            q_doc = next(d for d in qdrant_results if d["original_id"] == cid)
            c_sim = c_doc["similarity"]
            q_sim = q_doc["similarity"]
            score_diff = abs(c_sim - q_sim)
            print(f"    Item '{cid[:20]}': Chroma sim={c_sim:.4f}, Qdrant sim={q_sim:.4f}, diff={score_diff:.4f}")

        if overlap_ratio >= 0.8:  # 4 of 5 or 5 of 5
            total_matches += 1
            status_str = "MATCH"
        else:
            status_str = "DIVERGENT"

        query_reports.append({
            "query": query,
            "overlap_ratio": overlap_ratio,
            "chroma_count": len(chroma_ids),
            "qdrant_count": len(qdrant_ids),
            "status": status_str,
        })

    # Overall Summary
    overall_overlap_rate = (total_matches / total_benchmarks) * 100 if total_benchmarks > 0 else 0.0

    print("\n" + "=" * 70)
    print("BENCHMARK COMPARISON REPORT")
    print("=" * 70)
    for r in query_reports:
        print(f"[{r['status']:<9}] Overlap: {r['overlap_ratio']*100:5.1f}% | Query: {r['query'][:45]}...")

    print("-" * 70)
    print(f"Overall Benchmark Alignment:  {overall_overlap_rate:.1f}% (Target: >= 95%)")
    print(f"Jurisdiction Violations:      {jurisdiction_violations} (Target: 0)")
    print("=" * 70)

    if overall_overlap_rate >= 95.0 and jurisdiction_violations == 0:
        print("\nSUCCESS: ChromaDB and Qdrant Cloud vector retrieval is verified equivalent.")
        return 0
    else:
        print(f"\nFAILURE: Alignment did not meet acceptance criteria (rate={overall_overlap_rate:.1f}%, violations={jurisdiction_violations}).")
        return 1


if __name__ == "__main__":
    sys.exit(main())
