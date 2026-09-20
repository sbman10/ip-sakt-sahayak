"""
backend/app/routers/uploads.py
-------------------------------
File upload router for IP-SAKTI Sahayak.
Handles document uploads for chat context and matter workspace using Supabase Storage.
Stores object keys (users/{user_id}/{document_id}/{filename}) rather than local OS paths.
"""

from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.models.database import UploadedDocument, User, get_db
from app.routers.auth import require_auth
from app.services.storage_service import build_storage_key, storage_service

log = logging.getLogger(__name__)
router = APIRouter()

# Allowed file types
ALLOWED_EXTENSIONS = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "txt": "text/plain",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    """File upload response."""
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    message: str
    storage_path: Optional[str] = None


class DocumentOut(BaseModel):
    """Document info response."""
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    storage_path: Optional[str] = None
    is_processed: bool
    processing_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SignedUrlResponse(BaseModel):
    """Signed URL response for client download."""
    id: str
    filename: str
    signed_url: str
    expires_in: int


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def validate_file(file: UploadFile) -> tuple[str, str]:
    """Validate uploaded file. Returns (extension, content_type)."""
    ext = get_file_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '.{ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS.keys())}",
        )
    return ext, ALLOWED_EXTENSIONS[ext]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = None,
    matter_id: Optional[str] = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Upload a document for chat context or matter workspace to Supabase Storage.
    Stores object key `users/{user_id}/{document_id}/{filename}` in database records.
    """
    ext, content_type = validate_file(file)

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    doc_id = str(uuid.uuid4())
    stored_filename = f"{user.id}_{uuid.uuid4().hex[:8]}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{ext}"

    # Build Supabase Storage object key
    storage_key = build_storage_key(user.id, doc_id, file.filename or "upload.pdf")

    try:
        storage_service.upload_file(
            object_key=storage_key,
            file_bytes=content,
            content_type=content_type,
        )
    except Exception as exc:
        log.error("Storage upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist file in storage service",
        )

    # Create database record storing object key (NOT local filesystem OS path)
    doc = UploadedDocument(
        id=doc_id,
        user_id=user.id,
        conversation_id=conversation_id,
        matter_id=matter_id,
        filename=stored_filename,
        original_filename=file.filename or "unknown",
        file_type=ext,
        file_size=file_size,
        storage_path=storage_key,
        bucket_name=storage_service.default_bucket,
        processing_status="pending",
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    log.info("File uploaded: %s (key: %s) by user %s", stored_filename, storage_key, user.email)

    return UploadResponse(
        id=doc.id,
        filename=stored_filename,
        original_filename=file.filename or "unknown",
        file_type=ext,
        file_size=file_size,
        message="File uploaded successfully",
        storage_path=doc.storage_path,
    )


@router.get("/uploads", response_model=list[DocumentOut], tags=["Document Uploads"], operation_id="list_user_uploads")
def list_user_uploads(
    conversation_id: Optional[str] = None,
    matter_id: Optional[str] = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    """
    List uploaded raw documents for the current user.
    Optionally filter by conversation or matter.
    """
    query = db.query(UploadedDocument).filter(UploadedDocument.user_id == user.id)

    if conversation_id:
        query = query.filter(UploadedDocument.conversation_id == conversation_id)
    if matter_id:
        query = query.filter(UploadedDocument.matter_id == matter_id)

    docs = query.order_by(UploadedDocument.created_at.desc()).all()
    return [DocumentOut.model_validate(d) for d in docs]


@router.get("/uploads/{document_id}", response_model=DocumentOut, tags=["Document Uploads"], operation_id="get_user_upload")
def get_user_upload(
    document_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> DocumentOut:
    """Get a specific uploaded document's metadata."""
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return DocumentOut.model_validate(doc)


@router.get("/uploads/{document_id}/url", response_model=SignedUrlResponse, tags=["Document Uploads"], operation_id="get_upload_signed_url")
def get_upload_signed_url(
    document_id: str,
    expires_in: int = 3600,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> SignedUrlResponse:
    """
    Generate a secure, time-limited presigned download URL for private documents.
    Does not expose service-role keys to the client.
    """
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    try:
        signed_url = storage_service.get_signed_url(doc.storage_path, expires_in=expires_in)
    except Exception as exc:
        log.error("Failed to generate signed URL for document %s: %s", document_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document download link",
        )

    return SignedUrlResponse(
        id=doc.id,
        filename=doc.original_filename,
        signed_url=signed_url,
        expires_in=expires_in,
    )


@router.get("/uploads/{document_id}/download", tags=["Document Uploads"], operation_id="download_user_upload")
def download_user_upload(
    document_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Stream raw file bytes to client via server-side storage proxy."""
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    try:
        data = storage_service.download_file(doc.storage_path)
    except Exception as exc:
        log.error("Failed to download file %s: %s", doc.storage_path, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content unavailable",
        )

    content_type = ALLOWED_EXTENSIONS.get(doc.file_type, "application/octet-stream")
    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.original_filename}"'},
    )


@router.delete("/uploads/{document_id}", tags=["Document Uploads"], operation_id="delete_user_upload")
def delete_user_upload(
    document_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> dict:
    """Delete an uploaded document from Supabase Storage and database."""
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # 1. Delete from Supabase Storage / fallback storage
    try:
        storage_service.delete_file(doc.storage_path)
    except Exception as exc:
        log.warning("Storage service deletion error for %s: %s", doc.storage_path, exc)

    # 2. Also clean up legacy filesystem path if it was stored as local path
    try:
        if os.path.exists(doc.storage_path):
            os.remove(doc.storage_path)
    except Exception as exc:
        log.warning("Legacy file cleanup error: %s", exc)

    # 3. Delete database record
    db.delete(doc)
    db.commit()

    log.info("Document deleted: %s by user %s", document_id, user.email)
    return {"message": "Document deleted successfully", "id": document_id}
