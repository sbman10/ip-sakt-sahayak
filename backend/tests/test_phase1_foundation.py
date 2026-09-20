"""
backend/tests/test_phase1_foundation.py
---------------------------------------
Comprehensive Phase 1 Foundation Test Suite.

Verifies:
1. HF BGE-M3 document vector dimension (1024-dim, Python list[float])
2. HF BGE-M3 query vector dimension (1024-dim, Python list[float])
3. Dense vector unit L2 normalization
4. No silent local BGE-M3 fallback upon HF failure
5. Sparse passage embedding using passage_embed() (int indices, float values)
6. Sparse query embedding using query_embed()
7. Sparse embedding determinism and validation of empty/invalid inputs
8. Named dense (bge_m3) and sparse (bm25) Qdrant PointStruct construction
9. Deterministic UUID5 point ID generation
10. Payload completeness and validation of mandatory schema fields
11. Incompatible Qdrant collection detection
12. Live Qdrant Cloud schema verification against ragvyn_hybrid_test
13. Test isolation and immutability of real database files
"""

from __future__ import annotations

import math
import os
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from qdrant_client import models as qmodels

from app.core.config import settings
from app.services.embedding_service import (
    CanonicalEmbeddingService,
    EmbeddingServiceError,
    canonical_embedder,
)
from app.services.sparse_embedding_service import (
    SparseEmbeddingService,
    sparse_embedder,
)
from app.services.qdrant_hybrid_store import (
    DENSE_DIMENSION,
    DENSE_VECTOR_NAME,
    MANDATORY_PAYLOAD_FIELDS,
    SPARSE_VECTOR_NAME,
    IncompatibleSchemaError,
    QdrantHybridStore,
    build_hybrid_point,
    generate_point_id,
    qdrant_hybrid_store,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# 1 & 2. Dense Embeddings Dimensions (Document & Query)
# ---------------------------------------------------------------------------
def test_01_hf_bge_m3_document_vector_dimension():
    """Verify Hugging Face BGE-M3 document embedding produces Python list of 1024 floats."""
    docs = [
        "Section 3(p) of the Patents Act excludes traditional knowledge from patentability.",
        "Withania somnifera (Ashwagandha) formulations documented in the Ayurvedic Pharmacopoeia.",
    ]
    batch_vectors = canonical_embedder.embed_documents(docs, batch_size=2)

    assert isinstance(batch_vectors, list)
    assert len(batch_vectors) == 2

    for vec in batch_vectors:
        assert isinstance(vec, list), "Vector must be converted to Python list"
        assert len(vec) == DENSE_DIMENSION, f"Expected {DENSE_DIMENSION} floats, got {len(vec)}"
        assert all(isinstance(x, float) for x in vec), "All elements must be float"


def test_02_hf_bge_m3_query_vector_dimension():
    """Verify Hugging Face BGE-M3 query embedding produces Python list of 1024 floats."""
    query = "Is turmeric formulation patentable under Indian law?"
    query_vec = canonical_embedder.embed_query(query)

    assert isinstance(query_vec, list), "Query vector must be a Python list"
    assert len(query_vec) == DENSE_DIMENSION
    assert all(isinstance(x, float) for x in query_vec)

    # Expose metadata check
    meta = canonical_embedder.get_metadata()
    assert meta["model"] == "BAAI/bge-m3"
    assert meta["dimension"] == 1024
    assert meta["is_hf_bge_m3"] is True


# ---------------------------------------------------------------------------
# 3. Dense Vector Normalization
# ---------------------------------------------------------------------------
def test_03_dense_vector_normalization():
    """Verify returned dense embeddings have unit L2 norm (norm ≈ 1.0)."""
    vec = canonical_embedder.embed_query("Patents Act 1970 Section 3(d)")
    norm = math.sqrt(sum(x * x for x in vec))
    assert math.isclose(norm, 1.0, rel_tol=1e-2), f"Expected norm ~1.0, got {norm}"


# ---------------------------------------------------------------------------
# 4. No Silent Local BGE-M3 Fallback
# ---------------------------------------------------------------------------
def test_04_no_local_bge_m3_fallback_on_hf_failure():
    """Verify that Hugging Face inference failures raise EmbeddingServiceError without local fallback."""
    failing_embedder = CanonicalEmbeddingService(
        token="invalid_hf_token_000000000000000000",
        local_fallback=False,
        max_retries=1,
    )

    with pytest.raises(EmbeddingServiceError) as exc_info:
        failing_embedder.embed_query("Section 3(p) inquiry")

    assert "HF dense embedding failed" in str(exc_info.value) or "401" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 5 & 6. Sparse Embeddings (Passage & Query)
# ---------------------------------------------------------------------------
def test_05_sparse_passage_embedding():
    """Verify FastEmbed passage_embed() produces SparseVector with int indices and float values."""
    passages = [
        "Curcuma longa (Haridra / Turmeric) wound healing properties documented in Sushruta Samhita.",
        "National Biodiversity Authority approval required for patent grant on Indian biological resources.",
    ]
    sparse_vecs = sparse_embedder.embed_passages(passages, batch_size=2)

    assert isinstance(sparse_vecs, list)
    assert len(sparse_vecs) == 2

    for s_vec in sparse_vecs:
        assert isinstance(s_vec, qmodels.SparseVector)
        assert len(s_vec.indices) > 0
        assert len(s_vec.indices) == len(s_vec.values)
        assert all(isinstance(idx, int) for idx in s_vec.indices)
        assert all(isinstance(val, float) for val in s_vec.values)


def test_06_sparse_query_embedding():
    """Verify FastEmbed query_embed() produces SparseVector with int indices and float values."""
    query = "Section 3(p) TKDL traditional knowledge"
    s_vec = sparse_embedder.embed_query(query)

    assert isinstance(s_vec, qmodels.SparseVector)
    assert len(s_vec.indices) > 0
    assert all(isinstance(idx, int) for idx in s_vec.indices)
    assert all(isinstance(val, float) for val in s_vec.values)


# ---------------------------------------------------------------------------
# 7. Sparse Determinism and Input Validation
# ---------------------------------------------------------------------------
def test_07_sparse_embedding_determinism_and_validation():
    """Verify sparse output is deterministic and rejects empty/invalid text."""
    text = "Ayurvedic proprietary medicine formulation"
    v1 = sparse_embedder.embed_query(text)
    v2 = sparse_embedder.embed_query(text)

    assert v1.indices == v2.indices
    assert v1.values == v2.values

    # Validation: empty string
    with pytest.raises(ValueError):
        sparse_embedder.embed_query("")

    # Validation: whitespace string
    with pytest.raises(ValueError):
        sparse_embedder.embed_query("   ")

    # Validation: empty passage in list
    with pytest.raises(ValueError):
        sparse_embedder.embed_passages(["Valid passage", "  "])


# ---------------------------------------------------------------------------
# 8. Dual-Vector Hybrid Point Construction
# ---------------------------------------------------------------------------
def test_08_hybrid_point_construction_named_vectors():
    """Verify PointStruct contains named vectors bge_m3 and bm25, and rejects single-vector inputs."""
    dense = [0.01] * 1024
    sparse = qmodels.SparseVector(indices=[101, 202], values=[1.25, 2.50])
    payload = {
        "text": "Patents Act Section 3(e) mere admixture bar",
        "document_id": "DOC-SEC-03E",
        "source": "The Patents Act, 1970",
        "jurisdiction": "India",
        "authority": "Indian Patent Office",
        "document_type": "statute",
        "domain": "Patent Law",
        "section": "Section 3(e)",
        "language": "en",
        "publication_date": "1970-09-19",
        "priority_date": "1970-09-19",
    }

    point = build_hybrid_point(
        collection_name="ragvyn_hybrid_test",
        chunk_id="IN-PAT-SEC-03E",
        dense_vector=dense,
        sparse_vector=sparse,
        payload=payload,
    )

    assert isinstance(point, qmodels.PointStruct)
    assert DENSE_VECTOR_NAME in point.vector
    assert SPARSE_VECTOR_NAME in point.vector
    assert len(point.vector[DENSE_VECTOR_NAME]) == 1024
    assert isinstance(point.vector[SPARSE_VECTOR_NAME], qmodels.SparseVector)

    # Rejection: invalid dense dimension
    with pytest.raises(ValueError):
        build_hybrid_point("ragvyn_hybrid_test", "bad-dim", [0.1] * 512, sparse, payload)

    # Rejection: invalid sparse vector
    with pytest.raises(TypeError):
        build_hybrid_point("ragvyn_hybrid_test", "bad-sparse", dense, [1.0, 2.0], payload)  # type: ignore


# ---------------------------------------------------------------------------
# 9. Deterministic UUID5 Point ID Generation
# ---------------------------------------------------------------------------
def test_09_uuid5_point_id_generation():
    """Verify point ID is generated as a deterministic, valid UUID5 string (not a raw string)."""
    pid1 = generate_point_id("ragvyn_hybrid_test", "chunk-unique-42")
    pid2 = generate_point_id("ragvyn_hybrid_test", "chunk-unique-42")
    pid_diff = generate_point_id("ragvyn_hybrid_test", "chunk-unique-43")

    # Valid UUID format
    parsed_uuid = uuid.UUID(pid1)
    assert parsed_uuid.version == 5

    # Determinism
    assert pid1 == pid2
    assert pid1 != pid_diff


# ---------------------------------------------------------------------------
# 10. Payload Completeness & Validation
# ---------------------------------------------------------------------------
def test_10_payload_completeness_and_validation():
    """Verify all mandatory payload fields are enforced during point construction."""
    dense = [0.01] * 1024
    sparse = qmodels.SparseVector(indices=[1], values=[1.0])

    complete_payload = {
        "text": "Valid text",
        "document_id": "DOC-1",
        "source": "Source 1",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "Patents",
        "section": "1",
        "language": "en",
        "publication_date": "1970-01-01",
        "priority_date": "1970-01-01",
    }

    point = build_hybrid_point("ragvyn_hybrid_test", "chunk-test", dense, sparse, complete_payload)
    for field in MANDATORY_PAYLOAD_FIELDS:
        assert field in point.payload, f"Mandatory field '{field}' missing from payload"

    # Missing mandatory field
    incomplete_payload = dict(complete_payload)
    del incomplete_payload["authority"]

    with pytest.raises(ValueError) as exc:
        build_hybrid_point("ragvyn_hybrid_test", "chunk-bad", dense, sparse, incomplete_payload)
    assert "Missing mandatory payload field 'authority'" in str(exc.value)


# ---------------------------------------------------------------------------
# 11. Incompatible Collection Detection
# ---------------------------------------------------------------------------
def test_11_incompatible_collection_detection():
    """Verify store raises IncompatibleSchemaError when schema does not match hybrid contract."""
    store = QdrantHybridStore(url="https://mock.qdrant.io", api_key="mock_key")

    mock_client = MagicMock()
    # Mock collection with missing sparse vector configuration
    mock_col_info = MagicMock()
    mock_col_info.config.params.vectors = {
        "bge_m3": MagicMock(size=1024, distance=qmodels.Distance.COSINE)
    }
    mock_col_info.config.params.sparse_vectors = {}  # Missing bm25!
    mock_col_info.payload_schema = {}
    mock_client.get_collection.return_value = mock_col_info

    with patch.object(store, "get_client", return_value=mock_client):
        with pytest.raises(IncompatibleSchemaError) as exc:
            store.verify_collection_schema("bad_collection")
        assert "missing required named sparse vector 'bm25'" in str(exc.value)


# ---------------------------------------------------------------------------
# 12. Live Qdrant Cloud Schema Verification
# ---------------------------------------------------------------------------
def test_12_qdrant_schema_verification_against_cloud():
    """Verify live Qdrant Cloud test collection (ragvyn_hybrid_test) passes schema check."""
    report = qdrant_hybrid_store.verify_collection_schema("ragvyn_hybrid_test")

    assert report["is_compatible"] is True
    assert report["collection_name"] == "ragvyn_hybrid_test"
    assert report["dense_vector"]["name"] == "bge_m3"
    assert report["dense_vector"]["size"] == 1024
    assert report["dense_vector"]["distance"] == "Cosine"
    assert report["sparse_vector"]["name"] == "bm25"
    assert report["sparse_vector"]["modifier"] == "idf"


# ---------------------------------------------------------------------------
# 13. Test Isolation and File Immutability
# ---------------------------------------------------------------------------
def test_13_test_isolation_and_file_immutability():
    """Verify test runs use isolated paths and do not point to real persistent databases."""
    # Settings CHROMA_DB_DIR must point to a temporary test directory
    assert "test_env" in settings.CHROMA_DB_DIR or "ip_sakti_test" in settings.CHROMA_DB_DIR
    assert "test_env" in settings.DATABASE_URL or "ip_sakti_test" in settings.DATABASE_URL
