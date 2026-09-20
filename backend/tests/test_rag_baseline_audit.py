"""
backend/tests/test_rag_baseline_audit.py
-----------------------------------------
Baseline verification tests for Phase 0 RAG Architecture Audit.
Confirms the exact current behavior, model names, dimensions, thresholds,
RRF fusion behavior, and gate mechanisms without modifying production code.
"""

import pytest
import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.core.models import model_registry
from app.services.retrieval_gate import evaluate_retrieval_quality, get_abstention_response
from app.services.reranker_service import conditional_rerank
from app.services.context_compressor import context_compressor
from app.services.confidence_calculator import compute_composite_confidence
from app.services.retrieval_service import hybrid_rrf_search
from app.services.bm25_service import get_bm25_index
import chromadb


def test_01_runtime_embedding_model_and_dimensions():
    """Verify runtime embedding model is configured to all-MiniLM-L6-v2 with 384 dimensions."""
    # Check settings
    assert settings.EMBEDDING_MODEL_NAME == "all-MiniLM-L6-v2"
    
    # Check model registry
    embedder = model_registry.get_embedding_model()
    test_vec = embedder.encode(["Indian Patent Act 1970 Section 3(d)"])[0]
    
    assert len(test_vec) == 384, f"Expected 384-d vector, got {len(test_vec)}"


def test_02_chroma_collections_and_metadata_schema():
    """Verify persistent ChromaDB contains real collections and inspect dimensions/metadata."""
    chroma_path = settings.CHROMA_DB_DIR
    assert os.path.exists(chroma_path), f"Chroma path not found: {chroma_path}"
    
    client = chromadb.PersistentClient(path=chroma_path)
    collection_names = [c.name for c in client.list_collections()]
    
    # Must have india_statutes and international_treaties
    assert "india_statutes" in collection_names
    assert "international_treaties" in collection_names
    
    # Verify india_statutes
    india_col = client.get_collection("india_statutes")
    india_count = india_col.count()
    assert india_count > 0, "india_statutes collection is empty"
    
    sample = india_col.get(limit=1, include=["embeddings", "metadatas", "documents"])
    assert len(sample["embeddings"][0]) == 384, "Chroma vector dimension is not 384"
    
    meta = sample["metadatas"][0]
    for key in ["jurisdiction", "section", "source", "page_number"]:
        assert key in meta, f"Expected metadata key '{key}' missing from Chroma collection"


def test_03_bm25_index_loading_and_filtering():
    """Verify PersistedBM25Index loading from disk and jurisdiction filtering."""
    bm25_idx = get_bm25_index()
    if not bm25_idx.is_loaded:
        bm25_idx.load_from_disk(settings.BM25_INDEX_PATH)
    
    assert bm25_idx.is_loaded is True
    assert len(bm25_idx.documents) > 0
    
    results = bm25_idx.search("patent", top_k=3, jurisdiction="India")
    assert len(results) > 0
    for r in results:
        assert "bm25_score" in r
        assert r.get("jurisdiction", "").lower() == "india"


def test_04_retrieval_gate_distance_threshold():
    """Verify retrieval quality gate uses distance threshold 0.65 for abstention."""
    assert settings.SIMILARITY_THRESHOLD == 0.65
    
    # Distance <= 0.65 passes
    pass_candidates = [{"distance": 0.50, "rrf_score": 0.03, "text": "sample"}]
    pass_gate = evaluate_retrieval_quality(pass_candidates, similarity_threshold=settings.SIMILARITY_THRESHOLD)
    assert pass_gate["is_sufficient"] is True
    
    # Distance > 0.65 fails
    fail_candidates = [{"distance": 0.72, "rrf_score": 0.01, "text": "weak sample"}]
    fail_gate = evaluate_retrieval_quality(fail_candidates, similarity_threshold=settings.SIMILARITY_THRESHOLD)
    assert fail_gate["is_sufficient"] is False
    assert "Insufficient evidence" in fail_gate["reason"]
    
    # Empty candidates fail
    empty_gate = evaluate_retrieval_quality([], similarity_threshold=settings.SIMILARITY_THRESHOLD)
    assert empty_gate["is_sufficient"] is False


@pytest.mark.anyio
async def test_05_conditional_rerank_skip_threshold():
    """Verify reranker skips neural CrossEncoder when vector distance <= 0.25."""
    assert settings.RERANK_SKIP_THRESHOLD == 0.25
    
    # Close match (distance 0.15 <= 0.25) -> skips reranking
    close_candidates = [
        {"distance": 0.15, "text": "The Patents Act Section 3(d)", "source": "Patents Act"}
    ]
    results, skipped = await conditional_rerank(
        query="Section 3(d)",
        candidates=close_candidates,
        skip_threshold=0.25,
        final_k=1,
    )
    assert skipped is True
    assert results[0].get("rerank_skipped") is True
    assert results[0]["reranker_score"] == pytest.approx(0.85, abs=0.01)


def test_06_context_compression_and_text_dedup():
    """Verify context compressor uses MD5 hashing on text and builds structured context."""
    duplicate_chunks = [
        {"text": "Identical text passage about TKDL.", "source": "TKDL", "section": "Sec 1"},
        {"text": "identical text passage about tkdl.", "source": "TKDL", "section": "Sec 1"},
        {"text": "Different distinct text passage.", "source": "Patents Act", "section": "Sec 3"},
    ]
    
    deduped = context_compressor.deduplicate_chunks(duplicate_chunks)
    assert len(deduped) == 2, f"Expected 2 unique chunks after MD5 deduplication, got {len(deduped)}"
    
    context_str, cleaned = context_compressor.build_prompt_context(deduped, max_tokens=1500)
    assert "SOURCE_ID: SRC-001" in context_str
    assert "SOURCE_ID: SRC-002" in context_str
    assert len(cleaned) == 2


def test_07_composite_confidence_weighted_formula():
    """Verify composite confidence 4-pillar formula: 30% retrieval, 25% reranker, 30% entailment, 15% coverage."""
    # Test case:
    # vector_distance = 0.20 -> retrieval_relevance = 0.80
    # reranker_score = 0.80 -> reranker_relevance = 0.80
    # citation_entailment = 0.90
    # citation_coverage = 1.00
    # weighted = (0.30 * 0.80) + (0.25 * 0.80) + (0.30 * 0.90) + (0.15 * 1.00)
    #          = 0.24 + 0.20 + 0.27 + 0.15 = 0.86 -> 86 score -> "High"
    
    conf = compute_composite_confidence(
        best_vector_distance=0.20,
        reranker_score=0.80,
        citation_entailment=0.90,
        citation_coverage=1.00,
        citation_scores=[{"supported_claims": 2, "total_claims": 2}],
    )
    
    assert conf.score == 86
    assert conf.label == "High"


def test_08_consolidated_sqlalchemy_models():
    """Verify that models and Base are consolidated between database.py and db.py."""
    from app.models.database import User as DatabaseUser, Base as DatabaseBase
    from app.models.db import User as DbUser, Base as DbBase
    
    # Bases must now be the exact same authoritative instance
    assert DatabaseBase is DbBase
    
    # Users must be the same canonical model with UUID string primary key
    assert DatabaseUser is DbUser
    assert "VARCHAR" in str(DatabaseUser.id.property.columns[0].type)
    assert hasattr(DatabaseUser, "password_hash")
