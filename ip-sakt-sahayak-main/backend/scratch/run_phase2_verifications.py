"""
backend/scratch/run_phase2_verifications.py
-------------------------------------------
Executes the required Phase 2 verification queries:
1. Unfiltered hybrid search: "What does Section 3(p) of the Indian Patents Act say?"
2. Metadata-filtered hybrid search: jurisdiction="India", document_type="statute"
3. Shadow retrieval comparison run
"""

import json
import os
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.services.qdrant_hybrid_store import qdrant_hybrid_store
from app.services.retrieval_service import hybrid_rrf_search
from app.services.shadow_retrieval import log_and_record_shadow_comparison

print("==================================================")
print("1. RUNNING HYBRID SEARCH QUERY:")
print("Query: 'What does Section 3(p) of the Indian Patents Act say?'")
print("==================================================")

results_unfiltered = qdrant_hybrid_store.query_hybrid(
    query_text="What does Section 3(p) of the Indian Patents Act say?",
    top_k=3,
)

print(f"Returned {len(results_unfiltered)} results from ragvyn_hybrid_test:")
for i, res in enumerate(results_unfiltered, 1):
    print(f"\n--- Result #{i} ---")
    print(f"Point ID: {res['point_id']}")
    print(f"RRF Score: {res['score']:.6f}")
    print(f"Chunk ID: {res['chunk_id']}")
    print(f"Source: {res['source']}")
    print(f"Section: {res['section']}")
    print(f"Jurisdiction: {res['jurisdiction']}")
    print(f"Document Type: {res['document_type']}")
    print(f"Text Snippet: {res['text'][:150]}...")

print("\n==================================================")
print("2. RUNNING METADATA-FILTERED QUERY:")
print("Filter: jurisdiction='India', document_type='statute'")
print("==================================================")

results_filtered = qdrant_hybrid_store.query_hybrid(
    query_text="What does Section 3(p) of the Indian Patents Act say?",
    jurisdiction="India",
    document_type="statute",
    top_k=3,
)

print(f"Returned {len(results_filtered)} filtered results from ragvyn_hybrid_test:")
for i, res in enumerate(results_filtered, 1):
    print(f"\n--- Result #{i} ---")
    print(f"Point ID: {res['point_id']}")
    print(f"RRF Score: {res['score']:.6f}")
    print(f"Chunk ID: {res['chunk_id']}")
    print(f"Source: {res['source']}")
    print(f"Section: {res['section']}")
    print(f"Jurisdiction: {res['jurisdiction']}")
    print(f"Document Type: {res['document_type']}")
    print(f"Text Snippet: {res['text'][:150]}...")

print("\n==================================================")
print("3. RUNNING SHADOW COMPARISON RUN:")
print("==================================================")

# Execute existing Chroma+BM25 RRF retrieval
chroma_results = hybrid_rrf_search(
    query="What does Section 3(p) of the Indian Patents Act say?",
    jurisdiction="India",
    top_k=3,
)

print(f"Chroma/BM25 legacy retrieval returned {len(chroma_results)} candidates:")
for i, c in enumerate(chroma_results, 1):
    print(f"  Chroma #{i}: id={c.get('id')}, rrf={c.get('rrf_score', 0):.4f}, sec={c.get('section')}, src={c.get('source')}")

# Run shadow comparison
comparison = log_and_record_shadow_comparison(
    query="What does Section 3(p) of the Indian Patents Act say?",
    jurisdiction="India",
    top_k=3,
    chroma_results=chroma_results,
)

if comparison:
    print("\nShadow Comparison Metrics:")
    print(f"  Chunk Overlap Count: {comparison['metrics']['chunk_id_overlap_count']}")
    print(f"  Chunk Overlap Ratio: {comparison['metrics']['chunk_id_overlap_ratio']}")
    print(f"  Doc Overlap Count: {comparison['metrics']['doc_id_overlap_count']}")
    print(f"  Doc Overlap Items: {comparison['metrics']['doc_id_overlap_items']}")
    print(f"  Jurisdiction Consistency: {comparison['metrics']['jurisdiction_consistency']}")
    print(f"  Malformed Payload Records: {comparison['metrics']['malformed_payload_count']}")
    print(f"  Qdrant Top Hit Point ID: {comparison['qdrant_top_k'][0]['point_id'] if comparison['qdrant_top_k'] else 'none'}")
    print(f"  Qdrant Top Hit Score: {comparison['qdrant_top_k'][0]['qdrant_score'] if comparison['qdrant_top_k'] else 0}")
print("\nAll Phase 2 verification queries completed successfully.")
