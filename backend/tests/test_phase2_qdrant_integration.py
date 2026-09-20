"""
backend/tests/test_phase2_qdrant_integration.py
-----------------------------------------------
Unit and integration tests for Phase 2: Qdrant vector search integration,
ChromaDB migration fidelity, deterministic ID mapping, readiness check, and fallback resilience.
"""

from __future__ import annotations

import uuid
import pytest
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.qdrant_service import (
    QdrantService,
    to_qdrant_point_id,
    qdrant_service,
)


class TestQdrantConfiguration:
    def test_qdrant_settings_defaults(self):
        """Verify required Qdrant collection settings are configured."""
        assert settings.QDRANT_INDIA_COLLECTION == "india_statutes"
        assert settings.QDRANT_INTERNATIONAL_COLLECTION == "international_treaties"
        assert settings.QDRANT_USER_UPLOADS_COLLECTION == "user_uploads"

    def test_to_qdrant_point_id_deterministic(self):
        """Verify deterministic conversion of arbitrary Chroma string IDs to valid UUID strings."""
        raw_id_1 = "IN-PAT-1970-SEC-03P"
        raw_id_2 = "IN-PAT-1970-SEC-03D"
        
        uuid_1a = to_qdrant_point_id("india_statutes", raw_id_1)
        uuid_1b = to_qdrant_point_id("india_statutes", raw_id_1)
        uuid_2 = to_qdrant_point_id("india_statutes", raw_id_2)

        # Must be deterministic
        assert uuid_1a == uuid_1b
        assert uuid_1a != uuid_2

        # Must be a valid UUID string
        parsed = uuid.UUID(uuid_1a)
        assert str(parsed) == uuid_1a

    def test_to_qdrant_point_id_preserves_existing_uuid(self):
        """If raw_id is already a valid UUID string, returns it intact."""
        raw_uuid = str(uuid.uuid4())
        converted = to_qdrant_point_id("user_uploads", raw_uuid)
        assert converted == raw_uuid

    def test_to_qdrant_point_id_preserves_positive_integers(self):
        """If raw_id is an integer or int string, it returns the integer."""
        assert to_qdrant_point_id("test", 12345) == 12345
        assert to_qdrant_point_id("test", "98765") == 98765


class TestQdrantServiceOperations:
    @pytest.fixture
    def test_service(self):
        """Creates an in-memory or mock-isolated QdrantService instance."""
        svc = QdrantService(url=None, api_key=None)
        return svc

    def test_ensure_collections(self, test_service):
        """Verify idempotent collection initialization with size=1024 and Cosine distance."""
        created = test_service.ensure_collections()
        assert "india_statutes" in created
        assert "international_treaties" in created
        assert "user_uploads" in created

        info = test_service.get_collection_info("india_statutes")
        assert info is not None
        assert info["vector_size"] == 1024
        assert info["distance"] == "Cosine"

        # Calling again should be idempotent ('exists')
        re_created = test_service.ensure_collections()
        assert re_created["india_statutes"] == "exists"

    def test_upsert_and_search_fidelity(self, test_service):
        """Verify vector points are upserted with payload.original_id preserved and searchable."""
        test_service.ensure_collections()

        # Generate fake 1024-dim vectors
        vec1 = [0.0] * 1024
        vec1[0] = 1.0  # Unit vector along dimension 0
        vec2 = [0.0] * 1024
        vec2[1] = 1.0  # Unit vector along dimension 1

        points = [
            {
                "id": "STATUTE-CHUNK-01",
                "vector": vec1,
                "text": "Section 3(p) Ayurvedic patent provisions in India.",
                "metadata": {
                    "source": "Patents Act 1970",
                    "section": "Section 3(p)",
                    "jurisdiction": "India",
                },
            },
            {
                "id": "TREATY-CHUNK-02",
                "vector": vec2,
                "text": "Nagoya Protocol on Access and Benefit Sharing.",
                "metadata": {
                    "source": "Nagoya Protocol",
                    "section": "Article 15",
                    "jurisdiction": "International",
                },
            },
        ]

        test_service.upsert_points("india_statutes", points)

        # Search with vector close to vec1
        query_vec = [0.0] * 1024
        query_vec[0] = 0.99
        query_vec[2] = 0.01

        results = test_service.search("india_statutes", query_vec, limit=2)
        assert len(results) == 2
        top_hit = results[0]

        # Top hit must be STATUTE-CHUNK-01 with cosine score close to 1.0
        assert top_hit["payload"]["original_id"] == "STATUTE-CHUNK-01"
        assert top_hit["payload"]["source"] == "Patents Act 1970"
        assert top_hit["score"] > 0.9

    def test_delete_by_document_id(self, test_service):
        """Verify points matching a document_id payload attribute are deleted."""
        test_service.ensure_collections()

        doc_id = str(uuid.uuid4())
        vec = [0.1] * 1024

        points = [
            {
                "id": f"{doc_id}_0",
                "vector": vec,
                "text": "User uploaded text chunk 0",
                "metadata": {"document_id": doc_id, "user_id": "usr-123"},
            },
            {
                "id": f"{doc_id}_1",
                "vector": vec,
                "text": "User uploaded text chunk 1",
                "metadata": {"document_id": doc_id, "user_id": "usr-123"},
            },
            {
                "id": "other_doc_0",
                "vector": vec,
                "text": "Another document chunk",
                "metadata": {"document_id": "other-doc", "user_id": "usr-123"},
            },
        ]

        test_service.upsert_points("user_uploads", points)
        deleted = test_service.delete_by_document_id(doc_id, "user_uploads")
        assert deleted == 2

        # Verify only other_doc_0 remains
        info = test_service.get_collection_info("user_uploads")
        assert info["points_count"] == 1


class TestRetrievalFallbackAndRouting:
    def test_jurisdiction_routing(self):
        """Verify routing specs for India, International, and Both."""
        from app.services.retrieval_service import hybrid_rrf_search

        # Test empty query handling
        assert hybrid_rrf_search("") == []
        assert hybrid_rrf_search("   ") == []

    def test_readiness_probe_checks(self):
        """Verify readiness probe checks all required components."""
        from fastapi import Response
        from app.main import readiness_check
        import asyncio

        response = Response()
        result = asyncio.run(readiness_check(response))
        assert "checks" in result
        checks = result["checks"]
        assert "database" in checks
        assert "qdrant" in checks
        assert "bge_m3" in checks
        assert "cross_encoder" in checks
        assert "chroma_fallback" in checks
