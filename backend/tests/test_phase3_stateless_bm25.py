"""
backend/tests/test_phase3_stateless_bm25.py
-------------------------------------------
Unit and integration tests for Phase 3: Stateless Backend Architecture,
in-memory BM25 reconstruction from Qdrant payloads, dynamic user upload indexing,
user isolation scoping, deletion lifecycle, and simulated restart resilience.
"""

from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch
import pytest

from app.core.config import settings
from app.services.bm25_service import PersistedBM25Index, get_bm25_index, load_bm25_index_on_startup
from app.services.qdrant_service import QdrantService


class TestQdrantPayloadScrolling:
    def test_qdrant_get_all_payloads(self):
        """Verify get_all_payloads scrolls points and extracts payloads without vectors."""
        mock_client = MagicMock()
        
        # Simulate 2 scroll batches
        pt1 = MagicMock()
        pt1.id = "p-1"
        pt1.payload = {"original_id": "STATUTE-01", "text": "Ayurvedic formulation text", "jurisdiction": "India"}
        
        pt2 = MagicMock()
        pt2.id = "p-2"
        pt2.payload = {"original_id": "TREATY-01", "text": "Nagoya treaty text", "jurisdiction": "International"}

        mock_client.scroll.side_effect = [
            ([pt1], "cursor-2"),
            ([pt2], None),
        ]

        svc = QdrantService(url=None, api_key=None)
        svc._client = mock_client

        payloads = svc.get_all_payloads("test_col", batch_size=1)
        assert len(payloads) == 2
        assert payloads[0]["original_id"] == "STATUTE-01"
        assert payloads[1]["original_id"] == "TREATY-01"
        assert mock_client.scroll.call_count == 2


class TestInMemoryBM25Reconstruction:
    @pytest.fixture
    def fresh_bm25(self):
        """Returns a clean PersistedBM25Index instance."""
        return PersistedBM25Index()

    def test_rebuild_from_qdrant_in_memory(self, fresh_bm25):
        """Verify BM25 index is constructed in RAM from Qdrant payloads with zero disk writing."""
        mock_svc = MagicMock()
        mock_svc.get_all_payloads.side_effect = [
            [
                {"id": "c1", "text": "Section 3p prohibits patenting traditional knowledge", "jurisdiction": "India"},
                {"id": "c2", "text": "Section 3d requires enhancement of therapeutic efficacy", "jurisdiction": "India"},
            ],
            [
                {"id": "c3", "text": "Nagoya protocol governs access and benefit sharing", "jurisdiction": "International"},
            ],
            [],
        ]

        success = fresh_bm25.rebuild_from_qdrant(q_service=mock_svc)
        assert success is True
        assert fresh_bm25.is_loaded is True
        assert len(fresh_bm25.documents) == 3

        # Test search
        results = fresh_bm25.search(query="traditional knowledge section 3p", top_k=2)
        assert len(results) > 0
        assert results[0]["id"] == "c1"
        assert results[0]["bm25_score"] > 0.0

    def test_bm25_jurisdiction_scoping(self, fresh_bm25):
        """Verify lexical search strictly respects legal jurisdiction filters."""
        mock_svc = MagicMock()
        mock_svc.get_all_payloads.side_effect = [
            [{"id": "ind-1", "text": "Biological diversity authority approval in India", "jurisdiction": "India"}],
            [{"id": "int-1", "text": "Convention on biological diversity Nagoya", "jurisdiction": "International"}],
            [],
        ]

        fresh_bm25.rebuild_from_qdrant(q_service=mock_svc)

        # India query should not retrieve international treaty
        india_hits = fresh_bm25.search("biological diversity", jurisdiction="India")
        assert len(india_hits) == 1
        assert india_hits[0]["id"] == "ind-1"

        # International query should retrieve international treaty
        intl_hits = fresh_bm25.search("biological diversity", jurisdiction="International")
        assert len(intl_hits) == 1
        assert intl_hits[0]["id"] == "int-1"

        # 'Both' query retrieves both
        both_hits = fresh_bm25.search("biological diversity", jurisdiction="Both")
        assert len(both_hits) == 2


class TestDynamicUserUploadBM25Lifecycle:
    @pytest.fixture
    def active_bm25(self):
        idx = PersistedBM25Index()
        statutes = [
            {"id": "base-1", "text": "The Patents Act 1970 Section 3p", "jurisdiction": "India"},
        ]
        corpus_tokens = [idx._tokenize(s["text"]) for s in statutes]
        from rank_bm25 import BM25Okapi
        idx.bm25 = BM25Okapi(corpus_tokens)
        if hasattr(idx.bm25, "idf"):
            idx.bm25.idf = {k: max(v, 0.25) for k, v in idx.bm25.idf.items()}
        idx.documents = list(statutes)
        idx.is_loaded = True
        return idx

    def test_add_chunks_and_user_isolation(self, active_bm25):
        """Verify uploaded document chunks are indexed in RAM and scoped to the user."""
        doc_id = str(uuid.uuid4())
        user_a = "user-alice"
        user_b = "user-bob"

        upload_chunks = [
            {
                "id": f"{doc_id}_0",
                "document_id": doc_id,
                "user_id": user_a,
                "text": "Proprietary Ashwagandha extraction formula with 98% withanolides",
                "jurisdiction": "User Document",
            },
        ]

        # Dynamically add chunks to in-memory BM25
        active_bm25.add_chunks(upload_chunks)
        assert len(active_bm25.documents) == 2

        # User Alice searches for her proprietary extraction -> Finds it
        alice_hits = active_bm25.search(
            query="Ashwagandha withanolides formula",
            user_id=user_a,
        )
        assert len(alice_hits) > 0
        assert alice_hits[0]["id"] == f"{doc_id}_0"

        # User Bob searches for the same text -> Must NOT find Alice's document (tenant isolation)
        bob_hits = active_bm25.search(
            query="Ashwagandha withanolides formula",
            user_id=user_b,
        )
        assert len(bob_hits) == 0

        # Anonymous query (no user_id) -> Must NOT return private user document
        anon_hits = active_bm25.search(
            query="Ashwagandha withanolides formula",
            user_id=None,
        )
        assert len(anon_hits) == 0

    def test_remove_by_document_id(self, active_bm25):
        """Verify removing a document removes its chunks and refreshes BM25Okapi."""
        doc_id = str(uuid.uuid4())
        chunks = [
            {"id": f"{doc_id}_0", "document_id": doc_id, "user_id": "u1", "text": "UniqueHerbQZX"},
            {"id": f"{doc_id}_1", "document_id": doc_id, "user_id": "u1", "text": "UniqueHerbQZX section 2"},
        ]
        active_bm25.add_chunks(chunks)
        assert len(active_bm25.documents) == 3

        # Confirm searchable
        hits_before = active_bm25.search("UniqueHerbQZX", user_id="u1")
        assert len(hits_before) == 2

        # Remove by document_id
        removed = active_bm25.remove_by_document_id(doc_id)
        assert removed == 2
        assert len(active_bm25.documents) == 1

        # Confirm no longer searchable
        hits_after = active_bm25.search("UniqueHerbQZX", user_id="u1")
        assert len(hits_after) == 0


class TestSimulatedRestartResilience:
    def test_simulated_render_restart(self):
        """
        Simulates a Render dyno restart:
        1. Process memory is wiped.
        2. Lifespan startup triggers rebuild_from_qdrant.
        3. Document chunks from Qdrant payloads are reconstituted in RAM.
        """
        import app.services.bm25_service as bm_mod
        
        # 1. Wipe global singleton
        bm_mod._bm25_singleton = None

        # 2. Mock Qdrant containing persisted points from before the restart
        mock_svc = MagicMock()
        mock_svc.get_all_payloads.side_effect = [
            [{"id": "stat-1", "text": "Statutory Ayurveda corpus chunk", "jurisdiction": "India"}],
            [],
            [{"id": "doc-chunk-1", "document_id": "doc-99", "user_id": "u1", "text": "Surviving user upload text", "jurisdiction": "User Document"}],
        ]

        with patch("app.services.qdrant_service.qdrant_service", mock_svc):
            # 3. Lifespan startup call
            success = load_bm25_index_on_startup()
            assert success is True

            reconstructed_index = get_bm25_index()
            assert reconstructed_index.is_loaded is True
            assert len(reconstructed_index.documents) == 2

            # 4. Search surviving user upload
            hits = reconstructed_index.search("Surviving user upload", user_id="u1")
            assert len(hits) == 1
            assert hits[0]["id"] == "doc-chunk-1"


class TestStatelessErrorHandling:
    def test_storage_service_failure_handling(self):
        """Simulate Supabase Storage network failure during upload."""
        from app.services.storage_service import SupabaseStorageService

        bad_svc = SupabaseStorageService(
            supabase_url="https://invalid-nonexistent-subdomain.supabase.co",
            supabase_key="bad-key",
        )
        with pytest.raises(Exception):
            bad_svc.upload_file("test/key.pdf", b"data", "application/pdf")

    def test_bm25_empty_qdrant_graceful_fallback(self):
        """If Qdrant returns 0 documents and no disk pkl exists, BM25 stays cleanly initialized."""
        idx = PersistedBM25Index()
        mock_svc = MagicMock()
        mock_svc.get_all_payloads.return_value = []

        with patch("os.path.exists", return_value=False):
            res = idx.rebuild_from_qdrant(q_service=mock_svc)
            assert res is False
            assert idx.search("query") == []
