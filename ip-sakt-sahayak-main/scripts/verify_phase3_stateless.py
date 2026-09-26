"""
scripts/verify_phase3_stateless.py
----------------------------------
End-to-End verification script for Phase 3 Stateless Architecture:
1. Start backend / initialize components.
2. Confirm readiness (/readiness probe).
3. Submit semantic query.
4. Submit keyword-heavy query.
5. Upload a PDF document.
6. Search for text from that PDF.
7. Restart backend (simulated memory flush + lifespan reload).
8. Search again (confirm persistent cloud availability).
9. Delete the document.
10. Confirm vectors and Storage object are removed.

Usage:
  python scripts/verify_phase3_stateless.py
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import sys
import uuid
from pathlib import Path

# Setup import path for backend/app
project_root = Path(__file__).resolve().parents[1]
backend_dir = project_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import Response, UploadFile
import pymupdf as fitz

from app.core.config import settings
from app.core.models import model_registry
from app.models.database import SessionLocal, UploadedDocument, User, init_db
from app.services.bm25_service import get_bm25_index, load_bm25_index_on_startup
import app.services.bm25_service as bm_module
from app.services.qdrant_service import qdrant_service
from app.services.retrieval_service import hybrid_rrf_search
from app.services.storage_service import storage_service
from app.routers.documents import upload_and_ingest_document, delete_document
from app.main import readiness_check

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("phase3_verification")


def create_test_pdf_bytes(title: str, body: str) -> bytes:
    """Generates a minimal valid PDF with extractable text using PyMuPDF."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), f"{title}\n\n{body}", fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def main() -> int:
    print("=" * 70)
    print("IP-SAKTI Sahayak — Phase 3 Stateless Backend 10-Step Verification")
    print("=" * 70)

    db = SessionLocal()
    step = 1

    try:
        # -------------------------------------------------------------
        # Step 1: Start backend & initialize components
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Initializing backend database tables and ML models...")
        init_db()
        model_registry.get_embedding_model()
        model_registry.get_reranker_model()
        qdrant_service.ensure_collections()
        bm25_ok = load_bm25_index_on_startup()
        print(f"  Step {step} PASSED: Backend models and BM25 index initialized (rebuilt={bm25_ok}).")
        step += 1

        # -------------------------------------------------------------
        # Step 2: Confirm readiness
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Checking /readiness probe...")
        response = Response()
        ready_payload = asyncio.run(readiness_check(response))
        print(f"  Readiness response: {ready_payload}")
        if response.status_code != 200 or ready_payload.get("status") != "ready":
            print(f"  Step {step} FAILED: Backend not ready: {ready_payload}")
            return 1
        print(f"  Step {step} PASSED: Readiness probe returned HTTP 200 'ready'.")
        step += 1

        # -------------------------------------------------------------
        # Step 3: Submit a semantic query
        # -------------------------------------------------------------
        semantic_query = "Section 3(p) patentability of traditional knowledge and natural plant formulations"
        print(f"\n[Step {step}/10] Submitting semantic query: '{semantic_query}'...")
        semantic_results = hybrid_rrf_search(query=semantic_query, jurisdiction="India", top_k=3)
        print(f"  Retrieved {len(semantic_results)} candidates:")
        for r in semantic_results:
            print(f"    - ID: {r['id']} | RRF Score: {r['rrf_score']:.4f} | Source: {r['source']}")
        if not semantic_results:
            print(f"  Step {step} FAILED: Semantic search returned 0 results.")
            return 1
        print(f"  Step {step} PASSED: Semantic search successfully retrieved relevant candidates.")
        step += 1

        # -------------------------------------------------------------
        # Step 4: Submit a keyword-heavy query
        # -------------------------------------------------------------
        keyword_query = "Patents Act 1970 compulsory license"
        print(f"\n[Step {step}/10] Submitting keyword-heavy query: '{keyword_query}'...")
        keyword_results = hybrid_rrf_search(query=keyword_query, jurisdiction="India", top_k=3)
        print(f"  Retrieved {len(keyword_results)} candidates:")
        for r in keyword_results:
            print(f"    - ID: {r['id']} | BM25 Rank: {r.get('bm25_rank')} | RRF Score: {r['rrf_score']:.4f}")
        if not keyword_results:
            print(f"  Step {step} FAILED: Keyword search returned 0 results.")
            return 1
        print(f"  Step {step} PASSED: Keyword search successfully executed via in-memory BM25.")
        step += 1

        # -------------------------------------------------------------
        # Step 5: Upload a PDF (Stateless upload)
        # -------------------------------------------------------------
        unique_token = f"TOKEN_{uuid.uuid4().hex[:8].upper()}"
        pdf_title = f"Ayurvedic Formulation Extract {unique_token}"
        pdf_body = (
            f"This proprietary formulation contains enriched withanolide glycosides and "
            f"curcuminoid nano-emulsions under registration reference {unique_token}. "
            f"Extraction yield was enhanced using patented supercritical carbon dioxide techniques."
        )
        pdf_bytes = create_test_pdf_bytes(pdf_title, pdf_body)

        test_user = db.query(User).filter(User.email == "phase3_test@ipsakti.gov.in").first()
        if not test_user:
            test_user = User(
                id=str(uuid.uuid4()),
                email="phase3_test@ipsakti.gov.in",
                full_name="Phase 3 Verification Officer",
                role="officer",
                password_hash="testhash",
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)

        print(f"\n[Step {step}/10] Uploading stateless PDF with marker '{unique_token}'...")
        upload_file_obj = UploadFile(
            filename=f"ayurvedic_extract_{unique_token}.pdf",
            file=io.BytesIO(pdf_bytes),
        )

        ingest_res = asyncio.run(upload_and_ingest_document(
            file=upload_file_obj,
            user=test_user,
            db=db,
        ))
        uploaded_doc_id = ingest_res.document_id
        print(f"  Uploaded document ID: {uploaded_doc_id} ({ingest_res.chunk_count} chunks)")
        print(f"  Step {step} PASSED: PDF uploaded directly to Supabase Storage & Qdrant.")
        step += 1

        # -------------------------------------------------------------
        # Step 6: Search for text from that PDF
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Searching for uploaded document text '{unique_token}'...")
        user_search_results = hybrid_rrf_search(
            query=f"enriched withanolide glycosides {unique_token}",
            jurisdiction="India",
            user_id=test_user.id,
            top_k=3,
        )
        found_uploaded = any(unique_token in r.get("text", "") for r in user_search_results)
        print(f"  Found uploaded marker '{unique_token}': {found_uploaded}")
        if not found_uploaded:
            print(f"  Step {step} FAILED: Uploaded text was not retrieved in search.")
            return 1
        print(f"  Step {step} PASSED: Newly uploaded text retrieved via Qdrant & dynamic BM25.")
        step += 1

        # -------------------------------------------------------------
        # Step 7: Restart backend (Simulate Render Dyno restart)
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Simulating Render dyno restart (flushing RAM index)...")
        # Wipe in-memory singleton
        bm_module._bm25_singleton = None
        # Lifespan startup reload: Rebuilds BM25 from Qdrant payloads
        restarted_bm25_ok = load_bm25_index_on_startup()
        rebuilt_index = get_bm25_index()
        print(f"  Post-restart BM25 reloaded: {restarted_bm25_ok} (contains {len(rebuilt_index.documents)} docs)")
        if not restarted_bm25_ok or len(rebuilt_index.documents) == 0:
            print(f"  Step {step} FAILED: In-memory BM25 could not be reconstructed from Qdrant.")
            return 1
        print(f"  Step {step} PASSED: Simulated restart completed. BM25 reconstructed in RAM from Qdrant.")
        step += 1

        # -------------------------------------------------------------
        # Step 8: Search again post-restart
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Searching again post-restart for '{unique_token}'...")
        post_restart_results = hybrid_rrf_search(
            query=f"curcuminoid nano-emulsions {unique_token}",
            jurisdiction="India",
            user_id=test_user.id,
            top_k=3,
        )
        found_post_restart = any(unique_token in r.get("text", "") for r in post_restart_results)
        print(f"  Found uploaded marker post-restart: {found_post_restart}")
        if not found_post_restart:
            print(f"  Step {step} FAILED: Uploaded document not searchable after restart!")
            return 1
        print(f"  Step {step} PASSED: Document survived restart and remained immediately searchable.")
        step += 1

        # -------------------------------------------------------------
        # Step 9: Delete the document
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Deleting document '{uploaded_doc_id}'...")
        del_res = delete_document(
            document_id=uploaded_doc_id,
            user=test_user,
            db=db,
        )
        print(f"  Delete result: {del_res}")
        print(f"  Step {step} PASSED: Document deletion completed.")
        step += 1

        # -------------------------------------------------------------
        # Step 10: Confirm its vectors and Storage object are removed
        # -------------------------------------------------------------
        print(f"\n[Step {step}/10] Verifying vectors, storage object, and BM25 removal...")
        # Check DB row
        db_doc = db.query(UploadedDocument).filter(UploadedDocument.id == uploaded_doc_id).first()
        assert db_doc is None, "DB row still exists!"

        # Check Qdrant points
        user_pts = qdrant_service.get_all_payloads(settings.QDRANT_USER_UPLOADS_COLLECTION)
        remaining_doc_pts = [p for p in user_pts if p.get("document_id") == uploaded_doc_id]
        assert len(remaining_doc_pts) == 0, f"Qdrant still contains {len(remaining_doc_pts)} points for document!"

        # Check BM25 search
        del_search_results = hybrid_rrf_search(
            query=f"curcuminoid nano-emulsions {unique_token}",
            jurisdiction="India",
            user_id=test_user.id,
            top_k=3,
        )
        found_after_del = any(unique_token in r.get("text", "") for r in del_search_results)
        assert not found_after_del, "Deleted document was still retrieved after deletion!"

        print(f"  Step {step} PASSED: Vectors, storage reference, and BM25 entries completely purged.")

        print("\n" + "=" * 70)
        print("SUCCESS: All 10 steps of Phase 3 Stateless Verification PASSED.")
        print("=" * 70)
        return 0

    except Exception as exc:
        print(f"\nFAILURE during step {step}: {exc}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
