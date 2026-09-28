"""
backend/app/routers/patentability.py
------------------------------------
Phase 11 & 12: Patentability and Prior-Art Assessment API Router.
Endpoints:
- POST /api/patentability/assess : Execute structured evidence-grounded assessment
- GET /api/patentability/assessment/{id} : Retrieve assessment by ID
- GET /api/patentability/assessments : List past assessments
- POST /api/patentability/upload : Upload supporting documents with security & prompt-injection sanitization
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import TenantContext, get_optional_tenant_context
from app.core.permissions import Permission, check_permission_or_raise
from app.models.database import PatentabilityAssessmentRecord, get_db
from app.schemas.patentability import (
    AssessmentStatus,
    AssessmentSummaryItem,
    PatentabilityAssessmentRequest,
    PatentabilityReport,
    UploadedDocReference,
)
from app.services.patentability.orchestrator import patentability_orchestrator
from app.services.patentability.vector_store import unified_vector_store

log = logging.getLogger("app.routers.patentability")

router = APIRouter(prefix="/patentability", tags=["Patentability & Prior-Art Assessment"])

# Prompt injection sanitizer patterns
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior)\s+directions",
    r"you\s+are\s+now\s+a",
    r"system\s+prompt",
    r"bypass\s+(all\s+)?guardrails",
    r"treat\s+as\s+verified",
]


def sanitize_untrusted_text(text: str) -> str:
    """Sanitizes text from user uploads to defuse prompt-injection instructions."""
    sanitized = text
    for pat in PROMPT_INJECTION_PATTERNS:
        sanitized = re.sub(pat, "[SANITIZED_INSTRUCTION]", sanitized, flags=re.IGNORECASE)
    return sanitized


@router.post(
    "/assess",
    response_model=PatentabilityReport,
    summary="Execute Patentability & Prior-Art Assessment",
    description="Performs preliminary statutory and prior-art assessment using Indian Patents Act and TKDL corpus.",
)
async def assess_patentability(
    request: PatentabilityAssessmentRequest,
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    db: Session = Depends(get_db),
) -> PatentabilityReport:
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.PATENTABILITY_RUN)
    try:
        report = await patentability_orchestrator.execute_assessment(request)

        # Persist to database
        try:
            record = PatentabilityAssessmentRecord(
                id=report.assessment_id,
                matter_id=request.matter_id,
                user_id=tenant.user_id if tenant else None,
                organisation_id=tenant.organisation_id if tenant else None,
                title=request.title,
                jurisdiction=request.jurisdiction,
                status=report.status.value,
                result_category=report.result_category.value,
                request_json=request.model_dump_json(),
                report_json=report.model_dump_json(),
                markdown_report=report.markdown_report,
            )
            db.add(record)
            db.commit()
        except Exception as db_err:
            log.warning("Database persistence error for assessment: %s", db_err)

        return report

    except Exception as e:
        log.error("Patentability assessment failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Patentability assessment could not be completed: {str(e)}",
        )


@router.get(
    "/assessment/{assessment_id}",
    response_model=PatentabilityReport,
    summary="Get Patentability Assessment by ID",
)
def get_assessment(
    assessment_id: str,
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    db: Session = Depends(get_db),
) -> PatentabilityReport:
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.PATENTABILITY_READ)
    query = db.query(PatentabilityAssessmentRecord).filter(PatentabilityAssessmentRecord.id == assessment_id)
    if tenant and tenant.organisation_id:
        query = query.filter(
            (PatentabilityAssessmentRecord.organisation_id == tenant.organisation_id)
            | (PatentabilityAssessmentRecord.organisation_id.is_(None))
        )
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Assessment not found")

    data = json.loads(record.report_json)
    return PatentabilityReport(**data)


@router.get(
    "/assessments",
    response_model=List[AssessmentSummaryItem],
    summary="List past assessments",
)
def list_assessments(
    limit: int = 20,
    tenant: Optional[TenantContext] = Depends(get_optional_tenant_context),
    db: Session = Depends(get_db),
) -> List[AssessmentSummaryItem]:
    if tenant and tenant.user.role != "super_admin":
        check_permission_or_raise(tenant.role, Permission.PATENTABILITY_READ)
    query = db.query(PatentabilityAssessmentRecord)
    if tenant and tenant.organisation_id:
        query = query.filter(
            (PatentabilityAssessmentRecord.organisation_id == tenant.organisation_id)
            | (PatentabilityAssessmentRecord.organisation_id.is_(None))
        )

    records = (
        query
        .order_by(PatentabilityAssessmentRecord.created_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for r in records:
        items.append(
            AssessmentSummaryItem(
                id=r.id,
                title=r.title,
                created_at=r.created_at.isoformat() if r.created_at else "",
                status=r.status,
                result_category=r.result_category,
                jurisdiction=r.jurisdiction,
            )
        )
    return items


@router.post(
    "/upload",
    response_model=UploadedDocReference,
    summary="Upload supporting experimental data or prior-art PDF",
)
async def upload_supporting_document(
    file: UploadFile = File(...),
    doc_category: str = Form("experimental_report"),
    description: Optional[str] = Form(None),
) -> UploadedDocReference:
    """
    Safely receives an uploaded file, extracts and sanitizes text against prompt injections,
    and indexes it in the vector store under user-upload classification.
    """
    doc_id = f"UPL-{uuid.uuid4().hex[:8]}"
    content_bytes = await file.read()

    # Extract text from plain text or basic strings
    raw_text = ""
    try:
        raw_text = content_bytes.decode("utf-8", errors="ignore")
    except Exception:
        raw_text = f"Binary file upload: {file.filename}"

    # Sanitize against prompt injection
    clean_text = sanitize_untrusted_text(raw_text[:4000])

    # Index in vector store as user-uploaded supporting reference
    try:
        unified_vector_store.index_chunk(
            chunk_id=f"DOC-{doc_id}",
            document_id=doc_id,
            title=f"User Upload: {file.filename}",
            document_type="user_upload",
            text=clean_text,
            authority="Applicant Supporting Data",
            jurisdiction="India",
            source_access_type="user_upload",
        )
    except Exception as e:
        log.warning("Could not index uploaded document: %s", e)

    return UploadedDocReference(
        document_id=doc_id,
        filename=file.filename or "uploaded_file",
        file_type="pdf" if file.filename and file.filename.endswith(".pdf") else "txt",
        doc_category=doc_category,
        description=description,
    )
