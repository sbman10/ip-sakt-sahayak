"""
backend/app/routers/documents.py
----------------------------------
User document ingestion router for IP-SAKTI Sahayak.

Unlike ``uploads.py`` (which stores raw files for chat / matter context), this
router turns a user-supplied PDF into a *searchable* knowledge source:

    1.  Accept a PDF (max 10MB) via multipart upload.
    2.  Persist it to ``corpus/data/uploads/`` (same corpus tree the offline
        ingest pipeline uses).
    3.  Extract page text with PyMuPDF (fitz).
    4.  Chunk with a 500-word sliding window / 50-word overlap — identical to
        ``corpus/parser.py`` so retrieval behaviour matches the base corpus.
    5.  Embed each chunk with the local BAAI/bge-m3 bi-encoder and upsert
        into a dedicated ChromaDB ``user_uploads`` collection, scoped per user
        via chunk metadata + id prefix.

Endpoints (mounted under /api/documents by main.py)
----------------------------------------------------
  POST   /api/documents/upload      ingest a PDF, return document_id + chunk_count
  GET    /api/documents             list the current user's ingested documents
  DELETE /api/documents/{id}        remove a document (file + ChromaDB chunks + row)

Every route is scoped to the authenticated user (require_auth).
"""

from __future__ import annotations

import json
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import UploadedDocument, User, get_db
from app.routers.auth import require_auth

# ---------------------------------------------------------------------------
# Third-party imports with clear startup guards
# ---------------------------------------------------------------------------
try:
    import pymupdf as fitz
except ImportError:  # pragma: no cover
    fitz = None  # type: ignore

try:
    import chromadb
except ImportError:  # pragma: no cover
    chromadb = None  # type: ignore

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None  # type: ignore

log = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
#   __file__      = backend/app/routers/documents.py
#   .parents[3]   = project root (backend/app/routers -> app -> backend -> root)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_KB_ROOT = _PROJECT_ROOT / "knowledge-base"
UPLOAD_DIR = _KB_ROOT / "uploads"
CHROMA_DB_PATH = settings.CHROMA_DB_DIR

EMBEDDING_MODEL_NAME = settings.EMBEDDING_MODEL_NAME
USER_UPLOADS_COLLECTION = "user_uploads"

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_WINDOW = 500                 # words per chunk (matches knowledge-base/parser.py)
CHUNK_OVERLAP = 50                 # word overlap (matches knowledge-base/parser.py)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Lazy singletons — heavy objects initialised once on first ingest request
# ---------------------------------------------------------------------------
_embedding_model: "SentenceTransformer | None" = None
_chroma_client: Any = None


def _get_embedding_model() -> "SentenceTransformer":
    global _embedding_model
    if _embedding_model is None:
        if SentenceTransformer is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="sentence-transformers not installed on the server.",
            )
        log.info("Loading embedding model '%s' for user uploads...", EMBEDDING_MODEL_NAME)
        _embedding_model = SentenceTransformer(
            EMBEDDING_MODEL_NAME,
        )
    return _embedding_model


def _get_chroma_collection():
    global _chroma_client
    if chromadb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="chromadb not installed on the server.",
        )
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    return _chroma_client.get_or_create_collection(
        name=USER_UPLOADS_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DocumentIngestResponse(BaseModel):
    """Returned after a successful PDF ingest."""
    document_id: str
    original_filename: str
    file_size: int
    chunk_count: int
    processing_status: str
    message: str


class UploadedDocumentOut(BaseModel):
    """A user's ingested document as shown in the documents list."""
    id: str
    original_filename: str
    file_type: str
    file_size: int
    chunk_count: int
    is_processed: bool
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# PDF parsing / chunking — mirrors corpus/parser.py
# ---------------------------------------------------------------------------

def _extract_pages(pdf_path: Path) -> List[Dict[str, Any]]:
    """Extract non-empty page text (1-indexed) from a PDF via PyMuPDF."""
    pages: List[Dict[str, Any]] = []
    doc = fitz.open(str(pdf_path))
    try:
        for idx in range(len(doc)):
            text = doc[idx].get_text("text").replace("\x00", "").strip()
            if text:
                pages.append({"page": idx + 1, "text": text})
    finally:
        doc.close()
    return pages


def _chunk_pages(
    pages: List[Dict[str, Any]],
    source_title: str,
    window: int = CHUNK_WINDOW,
    overlap: int = CHUNK_OVERLAP,
) -> List[Dict[str, str]]:
    """Sliding-window chunker identical to corpus/parser.py (500 / 50)."""
    if not pages:
        return []

    word_tokens: List[Tuple[str, int]] = []
    for p in pages:
        for token in p["text"].split():
            word_tokens.append((token, p["page"]))

    total = len(word_tokens)
    if total == 0:
        return []

    step = max(1, window - overlap)
    chunks: List[Dict[str, str]] = []

    for start in range(0, total, step):
        end = min(start + window, total)
        window_slice = word_tokens[start:end]
        if not window_slice:
            break

        start_page = window_slice[0][1]
        end_page = window_slice[-1][1]
        section = (
            f"Page {start_page}"
            if start_page == end_page
            else f"Pages {start_page}-{end_page}"
        )

        chunks.append({
            "source_title": source_title,
            "section": section,
            "text": " ".join(t[0] for t in window_slice),
        })

        if end >= total:
            break

    return chunks


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=DocumentIngestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Documents"],
)
async def upload_and_ingest_document(
    file: UploadFile = File(...),
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> DocumentIngestResponse:
    """
    Upload a PDF, parse + chunk it, and index the chunks into the
    ``user_uploads`` ChromaDB collection for retrieval.

    - Only ``.pdf`` accepted.
    - Max size 10MB.
    """
    if fitz is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PyMuPDF (fitz) not installed on the server.",
        )

    original_name = file.filename or "document.pdf"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext != "pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted.",
        )

    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    document_id = str(uuid.uuid4())

    # Persist to knowledge-base/uploads/ with a collision-proof, user-scoped name
    stored_filename = f"{user.id}_{document_id}.pdf"
    storage_path = UPLOAD_DIR / stored_filename
    try:
        with open(storage_path, "wb") as fh:
            fh.write(content)
    except Exception as exc:  # pragma: no cover
        log.error("Failed to persist uploaded PDF: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save the uploaded file.",
        )

    # Create the DB row up-front so a failed ingest is still visible/removable
    doc = UploadedDocument(
        id=document_id,
        user_id=user.id,
        filename=stored_filename,
        original_filename=original_name,
        file_type="pdf",
        file_size=file_size,
        storage_path=str(storage_path),
        chunk_count=0,
        is_processed=False,
        processing_status="processing",
    )
    db.add(doc)
    db.commit()

    # Parse + chunk + embed + upsert
    try:
        source_title = Path(original_name).stem.replace("_", " ").strip() or "Uploaded Document"
        pages = _extract_pages(storage_path)
        chunks = _chunk_pages(pages, source_title)

        if not chunks:
            doc.processing_status = "failed"
            doc.is_processed = False
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No extractable text found in the PDF. Scanned/image-only "
                    "PDFs are not supported (OCR required)."
                ),
            )

        collection = _get_chroma_collection()
        model = _get_embedding_model()

        texts = [c["text"] for c in chunks]
        embeddings = model.encode(
            texts,
            batch_size=8,
            show_progress_bar=False,
            normalize_embeddings=True,
        ).tolist()

        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "source": c["source_title"],
                "section": c["section"],
                "user_id": user.id,
                "document_id": document_id,
                "original_filename": original_name,
            }
            for c in chunks
        ]

        batch = 100
        for i in range(0, len(ids), batch):
            j = min(i + batch, len(ids))
            collection.upsert(
                ids=ids[i:j],
                documents=texts[i:j],
                metadatas=metadatas[i:j],
                embeddings=embeddings[i:j],
            )

        doc.chunk_count = len(chunks)
        doc.is_processed = True
        doc.processing_status = "completed"
        doc.metadata_json = json.dumps({"pages": len(pages), "collection": USER_UPLOADS_COLLECTION})
        db.commit()

        log.info(
            "Ingested document %s (%d chunks) for user %s",
            document_id, len(chunks), user.email,
        )

    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        log.error("Ingest failed for document %s: %s", document_id, exc)
        doc.processing_status = "failed"
        doc.is_processed = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process the document.",
        )

    return DocumentIngestResponse(
        document_id=document_id,
        original_filename=original_name,
        file_size=file_size,
        chunk_count=doc.chunk_count,
        processing_status=doc.processing_status,
        message=f"Document ingested successfully ({doc.chunk_count} chunks indexed).",
    )


@router.get("", response_model=list[UploadedDocumentOut], tags=["Documents"], operation_id="list_rag_documents")
def list_documents(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> list[UploadedDocumentOut]:
    """List the current user's ingested documents, newest first."""
    docs = (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.user_id == user.id,
            UploadedDocument.file_type == "pdf",
        )
        .order_by(UploadedDocument.created_at.desc())
        .all()
    )
    return [UploadedDocumentOut.model_validate(d) for d in docs]


@router.delete("/{document_id}", tags=["Documents"], operation_id="delete_rag_document")
def delete_document(
    document_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> dict:
    """Delete an ingested document: its ChromaDB chunks, the file, and the row."""
    doc = (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.id == document_id,
            UploadedDocument.user_id == user.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    # Remove chunks from ChromaDB (scoped to this document + user)
    try:
        collection = _get_chroma_collection()
        collection.delete(where={"document_id": document_id})
    except HTTPException:
        # ChromaDB unavailable — still allow file/row cleanup below
        log.warning("ChromaDB unavailable during delete of %s", document_id)
    except Exception as exc:  # pragma: no cover
        log.warning("Failed to delete ChromaDB chunks for %s: %s", document_id, exc)

    # Remove file from disk
    try:
        if doc.storage_path and os.path.exists(doc.storage_path):
            os.remove(doc.storage_path)
    except Exception as exc:  # pragma: no cover
        log.warning("Failed to delete file for %s: %s", document_id, exc)

    db.delete(doc)
    db.commit()
    log.info("Deleted document %s for user %s", document_id, user.email)

    return {"message": "Document deleted successfully", "id": document_id}
