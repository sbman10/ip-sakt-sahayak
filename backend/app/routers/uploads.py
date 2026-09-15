"""
backend/app/routers/uploads.py
-------------------------------
File upload router for IP-SAKTI Sahayak.
Handles document uploads for chat context and matter workspace.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import UploadedDocument, User, get_db
from app.routers.auth import get_current_user, require_auth

log = logging.getLogger(__name__)
router = APIRouter()

# Upload directory configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

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


class DocumentOut(BaseModel):
    """Document info response."""
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    is_processed: bool
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True


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
            detail=f"File type '.{ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS.keys())}"
        )
    
    return ext, ALLOWED_EXTENSIONS[ext]


async def save_upload_file(file: UploadFile, user_id: str) -> tuple[str, str, int]:
    """Save uploaded file and return (stored_filename, storage_path, file_size)."""
    # Generate unique filename
    ext = get_file_extension(file.filename or "unknown")
    unique_filename = f"{user_id}_{uuid.uuid4().hex[:8]}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{ext}"
    
    # Create user subdirectory
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(exist_ok=True)
    
    file_path = user_dir / unique_filename
    
    # Read and save file
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    return unique_filename, str(file_path), file_size


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = None,
    matter_id: Optional[str] = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> UploadResponse:
    """
    Upload a document for chat context or matter workspace.
    
    Supported file types:
    - PDF (.pdf)
    - Word (.docx, .doc)
    - Text (.txt)
    - Images (.png, .jpg, .jpeg)
    
    Max file size: 10MB
    """
    # Validate file
    ext, content_type = validate_file(file)
    
    # Save file
    try:
        stored_filename, storage_path, file_size = await save_upload_file(file, user.id)
    except Exception as e:
        log.error("File upload failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file"
        )
    
    # Create database record
    doc = UploadedDocument(
        user_id=user.id,
        conversation_id=conversation_id,
        matter_id=matter_id,
        filename=stored_filename,
        original_filename=file.filename or "unknown",
        file_type=ext,
        file_size=file_size,
        storage_path=storage_path,
        processing_status="pending",
    )
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    log.info("File uploaded: %s by user %s", stored_filename, user.email)
    
    return UploadResponse(
        id=doc.id,
        filename=stored_filename,
        original_filename=file.filename or "unknown",
        file_type=ext,
        file_size=file_size,
        message="File uploaded successfully"
    )


@router.get("/uploads", response_model=list[DocumentOut], tags=["Document Uploads"], operation_id="list_user_uploads")
def list_user_uploads(
    conversation_id: Optional[str] = None,
    matter_id: Optional[str] = None,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
) -> DocumentOut:
    """Get a specific uploaded document's info."""
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return DocumentOut.model_validate(doc)


@router.delete("/uploads/{document_id}", tags=["Document Uploads"], operation_id="delete_user_upload")
def delete_user_upload(
    document_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> dict:
    """Delete an uploaded document."""
    doc = db.query(UploadedDocument).filter(
        UploadedDocument.id == document_id,
        UploadedDocument.user_id == user.id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file from disk
    try:
        if os.path.exists(doc.storage_path):
            os.remove(doc.storage_path)
    except Exception as e:
        log.warning("Failed to delete file from disk: %s", str(e))
    
    # Delete database record
    db.delete(doc)
    db.commit()
    
    log.info("Document deleted: %s by user %s", document_id, user.email)
    
    return {"message": "Document deleted successfully", "id": document_id}
