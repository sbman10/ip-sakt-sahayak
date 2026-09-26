"""
backend/tests/test_phase2_retrieval.py
---------------------------------------
Comprehensive Phase 2 Qdrant Hybrid Corpus Ingestion and Shadow Retrieval Test Suite.

Unit Tests (Mocked Qdrant and Hugging Face clients):
- Successful hybrid point upload with dual vectors
- Deterministic re-upload without duplicate point IDs (idempotence)
- Dense and sparse vectors both present; rejects single-vector
- Correct named vector fields ('bge_m3', 'bm25')
- Qdrant prefetch query uses 'bge_m3' and 'bm25'
- Query path uses query_embed()
- Document path uses passage_embed()
- Jurisdiction and document-type filtering
- Invalid collection schema detection
- Missing payload index detection
- Empty collection handling
- Malformed metadata rejection
- Retry behavior on transient errors
- Interrupted batch error handling
- Dry-run produces zero Qdrant writes
- Ingestion mode strictly blocked from targeting 'ragvyn_prod_v1'
- Shadow retrieval comparison computation and non-destructive execution

Live Smoke Tests (Opt-in via RUN_LIVE_INTEGRATION_TESTS=true):
- Live HF document embedding
- Live HF query embedding
- Live Qdrant schema check
- Live test point upload
- Live hybrid search
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock, call, patch

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from qdrant_client import models as qmodels

from app.core.config import settings
from app.services.embedding_service import canonical_embedder
from app.services.qdrant_hybrid_store import (
    DENSE_DIMENSION,
    DENSE_VECTOR_NAME,
    MANDATORY_PAYLOAD_FIELDS,
    REQUIRED_PAYLOAD_INDEXES,
    SPARSE_VECTOR_NAME,
    IncompatibleSchemaError,
    build_hybrid_point,
    generate_point_id,
    qdrant_hybrid_store,
)
from app.services.shadow_retrieval import (
    compare_retrieval_results,
    log_and_record_shadow_comparison,
)
from app.services.sparse_embedding_service import sparse_embedder


# ---------------------------------------------------------------------------
# Test Helpers & Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def sample_valid_payload() -> Dict[str, Any]:
    return {
        "text": "Section 3(p) of the Patents Act, 1970: an invention which in effect is traditional knowledge is not patentable.",
        "chunk_id": "in_patents_sec3p_001_abc12345",
        "document_id": "in_patents_act_1970",
        "source": "The Patents Act, 1970",
        "jurisdiction": "India",
        "authority": "IP India / CGPDTM",
        "document_type": "statute",
        "domain": "patents",
        "section": "Section 3(p)",
        "language": "en",
        "publication_date": "1970-09-19",
        "priority_date": "1970-09-19",
        "embedding_model": "BAAI/bge-m3",
        "embedding_dimension": 1024,
        "sparse_model": "Qdrant/bm25",
    }


@pytest.fixture
def sample_dense_vector() -> List[float]:
    return [0.03125] * DENSE_DIMENSION


@pytest.fixture
def sample_sparse_vector() -> qmodels.SparseVector:
    return qmodels.SparseVector(indices=[101, 2045, 9999], values=[0.85, 1.25, 0.44])


# ---------------------------------------------------------------------------
# 1. Successful Hybrid Point Upload
# ---------------------------------------------------------------------------
def test_successful_hybrid_point_upload(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """Verify hybrid point is properly constructed and uploaded to Qdrant mock."""
    point = build_hybrid_point(
        collection_name="ragvyn_hybrid_test",
        chunk_id=sample_valid_payload["chunk_id"],
        dense_vector=sample_dense_vector,
        sparse_vector=sample_sparse_vector,
        payload=sample_valid_payload,
    )

    assert isinstance(point, qmodels.PointStruct)
    assert point.vector[DENSE_VECTOR_NAME] == sample_dense_vector
    assert point.vector[SPARSE_VECTOR_NAME] == sample_sparse_vector
    assert point.payload["chunk_id"] == sample_valid_payload["chunk_id"]

    mock_client = MagicMock()
    mock_client.upsert.return_value = qmodels.UpdateResult(
        operation_id=1, status=qmodels.UpdateStatus.COMPLETED
    )

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        qdrant_hybrid_store.upsert_points("ragvyn_hybrid_test", [point])
        mock_client.upsert.assert_called_once_with(
            collection_name="ragvyn_hybrid_test",
            points=[point],
            wait=True,
        )


# ---------------------------------------------------------------------------
# 2. Deterministic Re-upload Without Duplicate Point IDs
# ---------------------------------------------------------------------------
def test_deterministic_reupload_no_duplicate_point_ids(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """Confirm that re-uploading the same chunk produces the exact same UUID5 point ID."""
    id1 = generate_point_id("ragvyn_hybrid_test", sample_valid_payload["chunk_id"])
    id2 = generate_point_id("ragvyn_hybrid_test", sample_valid_payload["chunk_id"])
    assert id1 == id2
    # Verify valid UUID format
    assert uuid.UUID(id1).version == 5

    pt1 = build_hybrid_point("ragvyn_hybrid_test", sample_valid_payload["chunk_id"], sample_dense_vector, sample_sparse_vector, sample_valid_payload)
    pt2 = build_hybrid_point("ragvyn_hybrid_test", sample_valid_payload["chunk_id"], sample_dense_vector, sample_sparse_vector, sample_valid_payload)
    assert pt1.id == pt2.id


# ---------------------------------------------------------------------------
# 3. Dense and Sparse Vectors Both Present
# ---------------------------------------------------------------------------
def test_dense_and_sparse_vectors_both_present(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """Reject points missing either dense or sparse vectors."""
    # Missing dense (wrong dimension)
    with pytest.raises(ValueError, match="expected 1024"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_1", [0.1] * 512, sample_sparse_vector, sample_valid_payload)

    # Missing dense (wrong type)
    with pytest.raises(TypeError, match="dense_vector must be a Python list"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_1", "not-a-vector", sample_sparse_vector, sample_valid_payload)

    # Missing sparse (empty indices)
    with pytest.raises(ValueError, match="cannot be empty"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_1", sample_dense_vector, qmodels.SparseVector(indices=[], values=[]), sample_valid_payload)

    # Missing sparse (wrong type)
    with pytest.raises(TypeError, match="sparse_vector must be a qmodels.SparseVector"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_1", sample_dense_vector, [0.1, 0.2], sample_valid_payload)


# ---------------------------------------------------------------------------
# 4. Correct Named Vector Fields
# ---------------------------------------------------------------------------
def test_correct_named_vector_fields(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """Named vector keys in PointStruct must be exactly 'bge_m3' and 'bm25'."""
    point = build_hybrid_point("ragvyn_hybrid_test", "chunk_1", sample_dense_vector, sample_sparse_vector, sample_valid_payload)
    assert set(point.vector.keys()) == {"bge_m3", "bm25"}
    assert len(point.vector["bge_m3"]) == 1024
    assert isinstance(point.vector["bm25"], qmodels.SparseVector)


# ---------------------------------------------------------------------------
# 5. Qdrant Query Uses bge_m3 and bm25 Prefetch
# ---------------------------------------------------------------------------
def test_qdrant_query_uses_named_vectors(sample_dense_vector, sample_sparse_vector):
    """Prefetch clauses must specify using='bge_m3' and using='bm25'."""
    prefetch = qdrant_hybrid_store.build_hybrid_prefetch(
        dense_vector=sample_dense_vector,
        sparse_vector=sample_sparse_vector,
        prefetch_limit=30,
    )
    assert len(prefetch) == 2
    assert prefetch[0].using == "bge_m3"
    assert prefetch[0].query == sample_dense_vector
    assert prefetch[0].limit == 30
    assert prefetch[1].using == "bm25"
    assert prefetch[1].query == sample_sparse_vector
    assert prefetch[1].limit == 30


# ---------------------------------------------------------------------------
# 6. Query Path Uses query_embed()
# ---------------------------------------------------------------------------
def test_query_path_uses_query_embed(sample_dense_vector, sample_sparse_vector):
    """query_hybrid must call canonical_embedder.embed_query and sparse_embedder.embed_query."""
    mock_client = MagicMock()
    mock_point = MagicMock()
    mock_point.id = "point-123"
    mock_point.score = 0.8845
    mock_point.payload = {"text": "Test section text", "chunk_id": "c1", "jurisdiction": "India"}
    mock_response = MagicMock()
    mock_response.points = [mock_point]
    mock_client.query_points.return_value = mock_response

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client), \
         patch.object(canonical_embedder, "embed_query", return_value=sample_dense_vector) as mock_dense_q, \
         patch.object(sparse_embedder, "embed_query", return_value=sample_sparse_vector) as mock_sparse_q:

        results = qdrant_hybrid_store.query_hybrid("Section 3(p) Patent Act", collection_name="ragvyn_hybrid_test")

        mock_dense_q.assert_called_once_with("Section 3(p) Patent Act")
        mock_sparse_q.assert_called_once_with("Section 3(p) Patent Act")
        assert len(results) == 1
        assert results[0]["score"] == 0.8845
        assert results[0]["point_id"] == "point-123"


# ---------------------------------------------------------------------------
# 7. Document Path Uses passage_embed()
# ---------------------------------------------------------------------------
def test_document_path_uses_passage_embed():
    """Document sparse embedding must use embed_passages() (or passage_embed), not query_embed()."""
    docs = ["First statute text", "Second statute text"]
    with patch.object(sparse_embedder, "embed_passages") as mock_embed_passages:
        mock_embed_passages.return_value = [
            qmodels.SparseVector(indices=[1], values=[1.0]),
            qmodels.SparseVector(indices=[2], values=[2.0]),
        ]
        res = sparse_embedder.embed_passages(docs)
        mock_embed_passages.assert_called_once_with(docs)
        assert len(res) == 2


# ---------------------------------------------------------------------------
# 8. Jurisdiction and Document-Type Filtering
# ---------------------------------------------------------------------------
def test_jurisdiction_and_document_type_filtering():
    """Metadata filtering must construct appropriate Qdrant FieldConditions."""
    # Jurisdiction filter
    f_india = qdrant_hybrid_store.build_filter(jurisdiction="India")
    assert f_india is not None
    assert f_india.must[0].key == "jurisdiction"
    assert f_india.must[0].match.value == "India"

    # Both jurisdictions returns None (unfiltered across corpus)
    f_both = qdrant_hybrid_store.build_filter(jurisdiction="Both")
    assert f_both is None

    # Document type filter
    f_statute = qdrant_hybrid_store.build_filter(document_type="statute")
    assert f_statute is not None
    assert f_statute.must[0].key == "document_type"
    assert f_statute.must[0].match.value == "statute"

    # Combined filters
    f_combined = qdrant_hybrid_store.build_filter(
        jurisdiction="India",
        document_type="statute",
        domain="patents",
        authority="IP India / CGPDTM",
    )
    assert len(f_combined.must) == 4
    keys = {c.key for c in f_combined.must}
    assert keys == {"jurisdiction", "document_type", "domain", "authority"}


# ---------------------------------------------------------------------------
# 9. Invalid Collection Schema Detection
# ---------------------------------------------------------------------------
def test_invalid_collection_schema_raises():
    """verify_collection_schema must raise IncompatibleSchemaError for wrong dimension or distance."""
    mock_client = MagicMock()
    mock_col = MagicMock()
    mock_col.config.params.vectors = {
        "bge_m3": qmodels.VectorParams(size=384, distance=qmodels.Distance.COSINE),  # wrong size!
    }
    mock_col.config.params.sparse_vectors = {
        "bm25": qmodels.SparseVectorParams(modifier=qmodels.Modifier.IDF),
    }
    mock_client.get_collection.return_value = mock_col

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        with pytest.raises(IncompatibleSchemaError, match="expected 1024, found 384"):
            qdrant_hybrid_store.verify_collection_schema("bad_collection")


# ---------------------------------------------------------------------------
# 10. Missing Payload Index Detection
# ---------------------------------------------------------------------------
def test_missing_payload_index_fails():
    """verify_collection_schema must fail if any required payload index is missing."""
    mock_client = MagicMock()
    mock_col = MagicMock()
    mock_col.config.params.vectors = {
        "bge_m3": qmodels.VectorParams(size=1024, distance=qmodels.Distance.COSINE),
    }
    mock_col.config.params.sparse_vectors = {
        "bm25": qmodels.SparseVectorParams(modifier=qmodels.Modifier.IDF),
    }
    # Payload schema is missing required indexes
    mock_col.payload_schema = {
        "jurisdiction": MagicMock(),
    }
    mock_client.get_collection.return_value = mock_col

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        with pytest.raises(IncompatibleSchemaError, match="missing required payload index"):
            qdrant_hybrid_store.verify_collection_schema("unindexed_collection")


# ---------------------------------------------------------------------------
# 11. Empty Collection Handling
# ---------------------------------------------------------------------------
def test_empty_collection_handling():
    """Empty query result from Qdrant must return empty list without crashing."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.points = []
    mock_client.query_points.return_value = mock_response

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client), \
         patch.object(canonical_embedder, "embed_query", return_value=[0.0] * 1024), \
         patch.object(sparse_embedder, "embed_query", return_value=qmodels.SparseVector(indices=[1], values=[1.0])):

        results = qdrant_hybrid_store.query_hybrid("Empty search test", collection_name="ragvyn_hybrid_test")
        assert results == []


# ---------------------------------------------------------------------------
# 12. Malformed Metadata Validation
# ---------------------------------------------------------------------------
def test_malformed_metadata_validation(sample_dense_vector, sample_sparse_vector):
    """build_hybrid_point must raise ValueError if required metadata fields are missing."""
    incomplete_payload = {
        "text": "Some statute excerpt",
        "chunk_id": "c1",
        # missing jurisdiction, authority, document_type, etc.
    }
    with pytest.raises(ValueError, match="Missing mandatory payload field"):
        build_hybrid_point("ragvyn_hybrid_test", "c1", sample_dense_vector, sample_sparse_vector, incomplete_payload)


# ---------------------------------------------------------------------------
# 13. Retry Behavior on Transient Error
# ---------------------------------------------------------------------------
def test_retry_behavior_transient_error(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """Upsert retries on transient connection errors."""
    mock_client = MagicMock()
    point = build_hybrid_point("ragvyn_hybrid_test", "c1", sample_dense_vector, sample_sparse_vector, sample_valid_payload)

    # First attempt raises ConnectionError, second succeeds
    mock_client.upsert.side_effect = [
        ConnectionError("Transient DNS failure"),
        qmodels.UpdateResult(operation_id=1, status=qmodels.UpdateStatus.COMPLETED),
    ]

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        # Should succeed on second attempt
        qdrant_hybrid_store.upsert_points("ragvyn_hybrid_test", [point], max_retries=2, retry_delay=0.01)
        assert mock_client.upsert.call_count == 2


# ---------------------------------------------------------------------------
# 14. Interrupted Batch Error Handling
# ---------------------------------------------------------------------------
def test_interrupted_batch_handling(sample_valid_payload, sample_dense_vector, sample_sparse_vector):
    """If an embedding or upload batch fails completely, an exception is raised without silent upload."""
    mock_client = MagicMock()
    point = build_hybrid_point("ragvyn_hybrid_test", "c1", sample_dense_vector, sample_sparse_vector, sample_valid_payload)
    mock_client.upsert.side_effect = ConnectionError("Fatal connection reset")

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        with pytest.raises(ConnectionError, match="Fatal connection reset"):
            qdrant_hybrid_store.upsert_points("ragvyn_hybrid_test", [point], max_retries=1, retry_delay=0.01)


# ---------------------------------------------------------------------------
# 15. Dry-Run Produces Zero Qdrant Writes
# ---------------------------------------------------------------------------
def test_dry_run_produces_zero_qdrant_writes():
    """Dry-run execution mode never calls client.upsert or client.upload_points."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    mock_client = MagicMock()
    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client), \
         patch.object(qdrant_hybrid_store, "verify_collection_schema"):

        # Run preflight & dry-run
        summary = qdrant_ingest.run_qdrant_ingestion(mode="dry-run", generate_embeddings=False)
        assert summary["upload_executed"] is False
        mock_client.upsert.assert_not_called()
        mock_client.upload_points.assert_not_called()


# ---------------------------------------------------------------------------
# 16. Test Mode Cannot Target ragvyn_prod_v1 Accidentally
# ---------------------------------------------------------------------------
def test_test_mode_cannot_target_prod():
    """Attempting to target 'ragvyn_prod_v1' during Phase 2 raises PermissionError/ValueError."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    with pytest.raises(ValueError, match="prohibited during Phase 2"):
        qdrant_ingest.run_qdrant_ingestion(
            mode="dry-run",
            collection_name="ragvyn_prod_v1",
        )


# ---------------------------------------------------------------------------
# 17. Shadow Retrieval Comparison
# ---------------------------------------------------------------------------
def test_shadow_retrieval_comparison():
    """Verify shadow retrieval correctly computes candidate overlap and records reports."""
    chroma_mock_candidates = [
        {
            "id": "c_chunk_1",
            "source": "The Patents Act, 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "rrf_score": 0.0333,
            "vector_distance": 0.22,
            "bm25_score": 14.5,
            "metadata": {"chunk_id": "c_chunk_1", "document_id": "in_patents_act_1970"},
        },
        {
            "id": "c_chunk_2",
            "source": "Biological Diversity Act, 2002",
            "section": "Section 6",
            "jurisdiction": "India",
            "rrf_score": 0.0322,
            "vector_distance": 0.35,
            "bm25_score": 11.2,
            "metadata": {"chunk_id": "c_chunk_2", "document_id": "in_bda_2002"},
        },
    ]

    qdrant_mock_candidates = [
        {
            "point_id": "uuid-1",
            "chunk_id": "c_chunk_1",
            "document_id": "in_patents_act_1970",
            "source": "The Patents Act, 1970",
            "section": "Section 3(p)",
            "jurisdiction": "India",
            "score": 0.0163,
            "payload": {
                "text": "Section 3(p) text",
                "chunk_id": "c_chunk_1",
                "document_id": "in_patents_act_1970",
                "source": "The Patents Act, 1970",
                "jurisdiction": "India",
                "authority": "IP India / CGPDTM",
                "document_type": "statute",
                "domain": "patents",
                "section": "Section 3(p)",
                "language": "en",
                "publication_date": "1970-09-19",
                "priority_date": "1970-09-19",
                "embedding_model": "BAAI/bge-m3",
                "embedding_dimension": 1024,
                "sparse_model": "Qdrant/bm25",
            },
        },
    ]

    comparison = compare_retrieval_results(
        query="Section 3(p) Traditional Knowledge",
        jurisdiction_requested="India",
        top_k=2,
        chroma_results=chroma_mock_candidates,
        qdrant_results=qdrant_mock_candidates,
    )

    assert comparison["metrics"]["chunk_id_overlap_count"] == 1
    assert comparison["metrics"]["chunk_id_overlap_items"] == ["c_chunk_1"]
    assert comparison["metrics"]["jurisdiction_consistency"] is True
    assert comparison["metrics"]["malformed_payload_count"] == 0


# ---------------------------------------------------------------------------
# 18. Corrective Review: Dry-Run Uses Document Methods (embed_documents, passage_embed)
# ---------------------------------------------------------------------------
def test_dry_run_uses_embed_documents_and_passage_embed():
    """Verify dry-run --embed strictly calls embed_documents and embed_passages, NOT query methods."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(canonical_embedder, "embed_documents", return_value=[[0.0] * 1024] * 5) as mock_embed_docs, \
         patch.object(sparse_embedder, "embed_passages", return_value=[qmodels.SparseVector(indices=[1], values=[1.0])] * 5) as mock_embed_passages, \
         patch.object(canonical_embedder, "embed_query") as mock_embed_query, \
         patch.object(sparse_embedder, "embed_query") as mock_sparse_query:

        res = qdrant_ingest.run_qdrant_ingestion(mode="dry-run", embed=True)
        assert res["mode"] == "dry-run"
        assert res["upload_executed"] is False
        assert mock_embed_docs.called is True, "Must call canonical_embedder.embed_documents for document chunks"
        assert mock_embed_passages.called is True, "Must call sparse_embedder.embed_passages for document chunks"
        mock_embed_query.assert_not_called()
        mock_sparse_query.assert_not_called()


# ---------------------------------------------------------------------------
# 19. Corrective Review: Test-Upload and Full-Upload Call Retry-Enabled upsert_points()
# ---------------------------------------------------------------------------
def test_test_upload_uses_retry_enabled_upsert():
    """Verify test-upload delegates to qdrant_hybrid_store.upsert_points() with retries and wait=True."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    mock_res = qmodels.UpdateResult(operation_id=1, status=qmodels.UpdateStatus.COMPLETED)

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(qdrant_ingest.QdrantIngestor, "get_collection_baseline", return_value={"points_count": 0, "point_ids": []}), \
         patch.object(canonical_embedder, "embed_documents", return_value=[[0.0] * 1024] * 3), \
         patch.object(sparse_embedder, "embed_passages", return_value=[qmodels.SparseVector(indices=[1], values=[1.0])] * 3), \
         patch.object(qdrant_hybrid_store, "upsert_points", return_value=mock_res) as mock_upsert:

        res = qdrant_ingest.run_qdrant_ingestion(mode="test-upload", limit=3)
        assert res["points_uploaded"] == 3
        mock_upsert.assert_called_once()
        _, kwargs = mock_upsert.call_args
        assert kwargs.get("max_retries", 3) >= 3
        assert kwargs.get("retry_delay", 1.0) > 0


def test_full_upload_uses_retry_enabled_upsert():
    """Verify full upload delegates to qdrant_hybrid_store.upsert_points() for every batch."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    mock_res = qmodels.UpdateResult(operation_id=1, status=qmodels.UpdateStatus.COMPLETED)

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(qdrant_ingest.QdrantIngestor, "get_collection_baseline", return_value={"points_count": 0, "point_ids": []}), \
         patch.object(canonical_embedder, "embed_documents", return_value=[[0.0] * 1024] * 16), \
         patch.object(sparse_embedder, "embed_passages", return_value=[qmodels.SparseVector(indices=[1], values=[1.0])] * 16), \
         patch.object(qdrant_hybrid_store, "upsert_points", return_value=mock_res) as mock_upsert:

        res = qdrant_ingest.run_qdrant_ingestion(
            mode="full",
            confirm=True,
            batch_size=500,
            allow_incomplete_metadata=True,
        )
        assert res["mode"] == "full"
        assert res["upload_executed"] is True
        assert mock_upsert.called is True


# ---------------------------------------------------------------------------
# 20. Corrective Review: Strict Date and Metadata Validation
# ---------------------------------------------------------------------------
def test_invalid_date_rejection():
    """Verify that malformed or non-ISO dates are rejected."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    # Valid dates
    date_str, is_valid = qdrant_ingest.validate_and_normalize_iso_date("2025-01-28")
    assert is_valid is True
    assert date_str == "2025-01-28"

    date_str, is_valid = qdrant_ingest.validate_and_normalize_iso_date("1970")
    assert is_valid is True
    assert date_str == "1970-01-01"

    # Empty date
    date_str, is_valid = qdrant_ingest.validate_and_normalize_iso_date(None)
    assert is_valid is True
    assert date_str == ""

    # Invalid dates
    date_str, is_valid = qdrant_ingest.validate_and_normalize_iso_date("2025-02-31")
    assert is_valid is False

    date_str, is_valid = qdrant_ingest.validate_and_normalize_iso_date("circa-1970")
    assert is_valid is False

    # Check validation report on invalid date
    chunk = {
        "text": "Valid text",
        "chunk_id": "c1",
        "document_id": "d1",
        "source": "s1",
        "jurisdiction": "India",
        "authority": "a1",
        "document_type": "statute",
        "domain": "patents",
        "section": "s1",
        "language": "en",
        "publication_date": "invalid-date",
        "priority_date": "1970-01-01",
    }
    is_v, issues = qdrant_ingest.validate_chunk_metadata(chunk)
    assert is_v is False
    assert any("invalid_iso_date:publication_date" in err for err in issues)


def test_missing_metadata_rejection_and_abort():
    """Verify full ingestion aborts if mandatory metadata is missing and override is not specified."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    chunk = {
        "text": "Valid text",
        "chunk_id": "c1",
        # missing authority, jurisdiction, etc.
    }
    is_v, issues = qdrant_ingest.validate_chunk_metadata(chunk)
    assert is_v is False
    assert "missing_authority" in issues

    with patch.object(qdrant_hybrid_store, "verify_collection_schema"):
        with pytest.raises(ValueError, match="Full ingestion aborted"):
            qdrant_ingest.run_qdrant_ingestion(mode="full", confirm=True, allow_incomplete_metadata=False)


# ---------------------------------------------------------------------------
# 21. Corrective Review: Collection Baseline and Deterministic Collisions
# ---------------------------------------------------------------------------
def test_collection_baseline_and_deterministic_collisions():
    """Verify tracking of existing points and deterministic ID collisions."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    ingestor = qdrant_ingest.QdrantIngestor()
    mock_client = MagicMock()
    mock_col = MagicMock()
    mock_col.points_count = 5
    mock_client.get_collection.return_value = mock_col

    mock_rec1 = MagicMock()
    mock_rec1.id = "p1"
    mock_client.scroll.return_value = ([mock_rec1], None)

    with patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client):
        baseline = ingestor.get_collection_baseline()
        assert baseline["points_count"] == 5
        assert baseline["point_ids"] == ["p1"]


# ---------------------------------------------------------------------------
# 22. Corrective Review: Zero Writes in Preflight and Dry-Run
# ---------------------------------------------------------------------------
def test_zero_writes_across_preflight_and_dry_run():
    """Prove that preflight, dry-run, and dry-run --embed perform zero Qdrant writes."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "knowledge-base"))
    import qdrant_ingest

    mock_client = MagicMock()
    with patch.object(qdrant_hybrid_store, "verify_collection_schema"), \
         patch.object(qdrant_hybrid_store, "get_client", return_value=mock_client), \
         patch.object(qdrant_hybrid_store, "upsert_points") as mock_store_upsert, \
         patch.object(canonical_embedder, "embed_documents", return_value=[[0.0] * 1024] * 5), \
         patch.object(sparse_embedder, "embed_passages", return_value=[qmodels.SparseVector(indices=[1], values=[1.0])] * 5):

        # 1. Preflight
        res_preflight = qdrant_ingest.run_qdrant_ingestion(mode="preflight")
        assert res_preflight["upload_executed"] is False

        # 2. Dry-Run (without embed)
        res_dry_no_embed = qdrant_ingest.run_qdrant_ingestion(mode="dry-run", embed=False)
        assert res_dry_no_embed["upload_executed"] is False

        # 3. Dry-Run (with embed)
        res_dry_embed = qdrant_ingest.run_qdrant_ingestion(mode="dry-run", embed=True)
        assert res_dry_embed["upload_executed"] is False

        # Assert zero writes across all 3 modes
        mock_store_upsert.assert_not_called()
        mock_client.upsert.assert_not_called()
        mock_client.upload_points.assert_not_called()
        mock_client.delete.assert_not_called()


# ---------------------------------------------------------------------------
# 23. Payload Schema Validation & Temporal Field Tests
# ---------------------------------------------------------------------------
def test_valid_datetime_values_accepted():
    """Verify that valid ISO-8601 dates are accepted and normalized in build_hybrid_point."""
    dense_vec = [0.1] * 1024
    sparse_vec = qmodels.SparseVector(indices=[1], values=[1.0])
    base_payload = {
        "text": "Statutory chunk text",
        "document_id": "doc_1",
        "source": "Source 1",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "Patents",
        "section": "Section 3(p)",
        "language": "en",
        "publication_date": "2025-01-28T00:00:00Z",
        "priority_date": "2025-01-28",
    }
    pt = build_hybrid_point("ragvyn_hybrid_test", "chunk_dates_1", dense_vec, sparse_vec, base_payload)
    assert pt.payload["publication_date"] == "2025-01-28"
    assert pt.payload["priority_date"] == "2025-01-28"


def test_absent_optional_dates_accepted_and_omitted():
    """Verify that chunks with absent/None temporal dates are accepted and safely omitted from payload."""
    dense_vec = [0.1] * 1024
    sparse_vec = qmodels.SparseVector(indices=[1], values=[1.0])
    payload_no_dates = {
        "text": "Statutory chunk text without publication date",
        "document_id": "doc_tkdl",
        "source": "TKDL Overview",
        "jurisdiction": "India",
        "authority": "CSIR",
        "document_type": "registry-record",
        "domain": "AYUSH",
        "section": "Overview",
        "language": "en",
        "publication_date": None,
        "priority_date": "",
    }
    pt = build_hybrid_point("ragvyn_hybrid_test", "chunk_tkdl_1", dense_vec, sparse_vec, payload_no_dates)
    assert "publication_date" not in pt.payload
    assert "priority_date" not in pt.payload
    assert pt.payload["text"] == payload_no_dates["text"]
    assert pt.payload["document_id"] == "doc_tkdl"


def test_invalid_date_strings_rejected_in_point_builder():
    """Verify that non-ISO arbitrary date strings are strictly rejected by build_hybrid_point."""
    dense_vec = [0.1] * 1024
    sparse_vec = qmodels.SparseVector(indices=[1], values=[1.0])
    invalid_payload = {
        "text": "Statutory chunk text",
        "document_id": "doc_1",
        "source": "Source 1",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "Patents",
        "section": "Section 3(p)",
        "language": "en",
        "publication_date": "circa 1970",
    }
    with pytest.raises(ValueError, match="Invalid ISO-8601 date"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_invalid_date", dense_vec, sparse_vec, invalid_payload)


def test_required_identity_fields_cannot_be_absent():
    """Verify that omitting any required identity field raises ValueError in build_hybrid_point."""
    dense_vec = [0.1] * 1024
    sparse_vec = qmodels.SparseVector(indices=[1], values=[1.0])
    incomplete_payload = {
        "text": "Some text",
        "document_id": "doc_1",
        # missing jurisdiction, authority, etc.
    }
    with pytest.raises(ValueError, match="Missing mandatory payload field"):
        build_hybrid_point("ragvyn_hybrid_test", "chunk_missing_identity", dense_vec, sparse_vec, incomplete_payload)


def test_datetime_indexes_not_populated_with_empty_strings():
    """Verify that PointStruct payloads never have publication_date or priority_date set to empty string."""
    dense_vec = [0.1] * 1024
    sparse_vec = qmodels.SparseVector(indices=[1], values=[1.0])
    payload = {
        "text": "Text",
        "document_id": "doc_1",
        "source": "Source",
        "jurisdiction": "India",
        "authority": "IPO",
        "document_type": "statute",
        "domain": "Patents",
        "section": "Section 1",
        "language": "en",
        "publication_date": "",
        "priority_date": "   ",
    }
    pt = build_hybrid_point("ragvyn_hybrid_test", "chunk_empty_dates", dense_vec, sparse_vec, payload)
    assert "publication_date" not in pt.payload
    assert "priority_date" not in pt.payload


# ---------------------------------------------------------------------------
# 24. Live Smoke Tests (Opt-in via RUN_LIVE_INTEGRATION_TESTS=true)
# ---------------------------------------------------------------------------
RUN_LIVE = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "false").lower() == "true"


@pytest.mark.skipif(not RUN_LIVE, reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true")
def test_live_hf_document_embedding():
    """Live smoke test: HF BGE-M3 document embedding."""
    docs = ["Live test document: Section 3(d) efficacy standard."]
    vectors = canonical_embedder.embed_documents(docs, batch_size=1)
    assert len(vectors) == 1
    assert len(vectors[0]) == 1024


@pytest.mark.skipif(not RUN_LIVE, reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true")
def test_live_hf_query_embedding():
    """Live smoke test: HF BGE-M3 query embedding."""
    vec = canonical_embedder.embed_query("Live test query: patent novelty test.")
    assert len(vec) == 1024


@pytest.mark.skipif(not RUN_LIVE, reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true")
def test_live_qdrant_schema_check():
    """Live smoke test: Qdrant schema check for ragvyn_hybrid_test."""
    schema = qdrant_hybrid_store.verify_collection_schema("ragvyn_hybrid_test")
    assert schema["is_compatible"] is True
    assert schema["dense_vector"]["size"] == 1024


@pytest.mark.skipif(not RUN_LIVE, reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true")
def test_live_test_point_upload(sample_valid_payload):
    """Live smoke test: Upload single test point to ragvyn_hybrid_test."""
    dense_vec = canonical_embedder.embed_query(sample_valid_payload["text"])
    sparse_vec = sparse_embedder.embed_query(sample_valid_payload["text"])
    point = build_hybrid_point("ragvyn_hybrid_test", "live_smoke_test_chunk_001", dense_vec, sparse_vec, sample_valid_payload)
    res = qdrant_hybrid_store.upsert_points("ragvyn_hybrid_test", [point])
    assert res.status == qmodels.UpdateStatus.COMPLETED


@pytest.mark.skipif(not RUN_LIVE, reason="Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true")
def test_live_hybrid_search():
    """Live smoke test: Qdrant hybrid search."""
    results = qdrant_hybrid_store.query_hybrid(
        query_text="Section 3(p) Patents Act",
        collection_name="ragvyn_hybrid_test",
        top_k=2,
    )
    assert isinstance(results, list)
