"""
backend/app/routers/matters.py
-------------------------------
Matter Workspace API — save and track IP cases for authenticated users.

Endpoints (all mounted under /api by main.py)
---------------------------------------------
  GET    /api/matters              list matters (paginated, filterable)
  POST   /api/matters              create a matter
  GET    /api/matters/upcoming     matters with upcoming reminder deadlines
  GET    /api/matters/{id}         single matter with full event timeline
  PUT    /api/matters/{id}         update a matter
  DELETE /api/matters/{id}         delete a matter (cascades events)
  POST   /api/matters/{id}/events  add an event / reminder to a matter

Every route is scoped to the authenticated user (require_auth); a user can only
read or mutate their own matters.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import TenantContext, get_tenant_context, require_permission
from app.core.permissions import Permission
from app.models.database import User, get_db
from app.models.matters import MatterWorkspace, MatterEvent
from app.routers.auth import require_auth
from app.services.audit_service import log_admin_action
from app.schemas.matters import (
    MatterCreate,
    MatterDetailResponse,
    MatterEventCreate,
    MatterEventResponse,
    MatterListResponse,
    MatterResponse,
    MatterUpdate,
    UpcomingDeadline,
)

log = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owned_matter(matter_id: str, tenant: TenantContext, db: Session) -> MatterWorkspace:
    """Fetch a matter owned by caller and scoped to active organisation or raise 404."""
    query = db.query(MatterWorkspace).filter(MatterWorkspace.id == matter_id)
    if tenant.organisation_id:
        query = query.filter(
            (MatterWorkspace.organisation_id == tenant.organisation_id)
            | ((MatterWorkspace.organisation_id.is_(None)) & (MatterWorkspace.user_id == tenant.user_id))
        )
    else:
        query = query.filter(MatterWorkspace.user_id == tenant.user_id)

    matter = query.first()
    if not matter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Matter not found"
        )
    if not matter.organisation_id and tenant.organisation_id:
        matter.organisation_id = tenant.organisation_id
        db.commit()
    return matter


def _to_response(matter: MatterWorkspace, event_count: Optional[int] = None) -> MatterResponse:
    """Serialise a Matter to MatterResponse, filling event_count."""
    if event_count is None:
        event_count = len(matter.events) if matter.events is not None else 0
    return MatterResponse(
        id=matter.id,
        user_id=matter.user_id,
        title=matter.title,
        case_type=matter.case_type,
        application_number=matter.application_number,
        filing_date=matter.filing_date,
        status=matter.status,
        notes=matter.notes,
        created_at=matter.created_at,
        updated_at=matter.updated_at,
        event_count=event_count,
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("/matters", response_model=MatterListResponse, tags=["Matter Workspace"])
def list_matters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    case_type: Optional[str] = Query(None, description="Filter by case type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    q: Optional[str] = Query(None, description="Search in title / application number"),
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_READ)),
    db: Session = Depends(get_db),
) -> MatterListResponse:
    """List the current tenant's matters with pagination, filtering and search."""
    query = db.query(MatterWorkspace)
    if tenant.organisation_id:
        query = query.filter(
            (MatterWorkspace.organisation_id == tenant.organisation_id)
            | ((MatterWorkspace.organisation_id.is_(None)) & (MatterWorkspace.user_id == tenant.user_id))
        )
    else:
        query = query.filter(MatterWorkspace.user_id == tenant.user_id)

    if case_type:
        query = query.filter(MatterWorkspace.case_type == case_type)
    if status_filter:
        query = query.filter(MatterWorkspace.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (MatterWorkspace.title.ilike(like)) | (MatterWorkspace.application_number.ilike(like))
        )

    total = query.count()
    matters = (
        query.order_by(MatterWorkspace.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Batch event counts to avoid N+1
    ids = [m.id for m in matters]
    counts: dict[str, int] = {}
    if ids:
        rows = (
            db.query(MatterEvent.matter_id, func.count(MatterEvent.id))
            .filter(MatterEvent.matter_id.in_(ids))
            .group_by(MatterEvent.matter_id)
            .all()
        )
        counts = {mid: c for mid, c in rows}

    items = [_to_response(m, counts.get(m.id, 0)) for m in matters]

    return MatterListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)) if total else 0,
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post(
    "/matters",
    response_model=MatterDetailResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Matter Workspace"],
)
def create_matter(
    payload: MatterCreate,
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_CREATE)),
    db: Session = Depends(get_db),
) -> MatterDetailResponse:
    """Create a new matter for the caller's active organisation and user."""
    matter = MatterWorkspace(
        user_id=tenant.user_id,
        organisation_id=tenant.organisation_id,
        title=payload.title,
        case_type=payload.case_type,
        application_number=payload.application_number,
        filing_date=payload.filing_date,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(matter)
    db.commit()
    db.refresh(matter)
    log.info("Matter created: %s by user %s (org: %s)", matter.id, tenant.user_id, tenant.organisation_id)
    return MatterDetailResponse(**_to_response(matter, 0).model_dump(), events=[])


# ---------------------------------------------------------------------------
# Upcoming deadlines  (declared BEFORE /{matter_id} so it is not shadowed)
# ---------------------------------------------------------------------------

@router.get(
    "/matters/upcoming",
    response_model=list[UpcomingDeadline],
    tags=["Matter Workspace"],
)
def upcoming_deadlines(
    days: int = Query(30, ge=1, le=365, description="Look-ahead window in days"),
    include_overdue: bool = Query(True, description="Include past-due reminders"),
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_READ)),
    db: Session = Depends(get_db),
) -> list[UpcomingDeadline]:
    """Return the user's events whose reminder_date falls within the window."""
    now = datetime.utcnow()
    horizon = now + timedelta(days=days)

    query = (
        db.query(MatterEvent, MatterWorkspace)
        .join(MatterWorkspace, MatterEvent.matter_id == MatterWorkspace.id)
    )
    if tenant.organisation_id:
        query = query.filter(
            (MatterWorkspace.organisation_id == tenant.organisation_id)
            | ((MatterWorkspace.organisation_id.is_(None)) & (MatterWorkspace.user_id == tenant.user_id))
        )
    else:
        query = query.filter(MatterWorkspace.user_id == tenant.user_id)

    query = query.filter(MatterEvent.reminder_date.isnot(None)).filter(MatterEvent.reminder_date <= horizon)
    if not include_overdue:
        query = query.filter(MatterEvent.reminder_date >= now)

    rows = query.order_by(MatterEvent.reminder_date.asc()).all()

    result: list[UpcomingDeadline] = []
    for event, matter in rows:
        days_remaining = (event.reminder_date.date() - now.date()).days
        result.append(
            UpcomingDeadline(
                matter_id=matter.id,
                matter_title=matter.title,
                case_type=matter.case_type,
                status=matter.status,
                event_id=event.id,
                event_type=event.event_type,
                description=event.description,
                reminder_date=event.reminder_date,
                days_remaining=days_remaining,
            )
        )
    return result


# ---------------------------------------------------------------------------
# Single matter (with events)
# ---------------------------------------------------------------------------

@router.get(
    "/matters/{matter_id}",
    response_model=MatterDetailResponse,
    tags=["Matter Workspace"],
)
def get_matter(
    matter_id: str,
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_READ)),
    db: Session = Depends(get_db),
) -> MatterDetailResponse:
    """Fetch a single matter and its full event timeline."""
    matter = _get_owned_matter(matter_id, tenant, db)
    events = [MatterEventResponse.model_validate(e) for e in matter.events]
    return MatterDetailResponse(
        **_to_response(matter, len(events)).model_dump(), events=events
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.put(
    "/matters/{matter_id}",
    response_model=MatterDetailResponse,
    tags=["Matter Workspace"],
)
def update_matter(
    matter_id: str,
    payload: MatterUpdate,
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_UPDATE)),
    db: Session = Depends(get_db),
) -> MatterDetailResponse:
    """Partially update a matter."""
    matter = _get_owned_matter(matter_id, tenant, db)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(matter, field, value)

    db.commit()
    db.refresh(matter)
    log.info("Matter updated: %s by user %s", matter.id, tenant.user_id)

    events = [MatterEventResponse.model_validate(e) for e in matter.events]
    return MatterDetailResponse(
        **_to_response(matter, len(events)).model_dump(), events=events
    )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/matters/{matter_id}", tags=["Matter Workspace"])
def delete_matter(
    matter_id: str,
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_DELETE)),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a matter and all its events."""
    matter = _get_owned_matter(matter_id, tenant, db)
    matter_title = matter.title
    db.delete(matter)
    db.commit()

    # Phase 5: Audit sensitive administrative action
    log_admin_action(
        action=Permission.MATTER_DELETE.value,
        actor_user_id=tenant.user_id,
        organisation_id=tenant.organisation_id,
        details=f"Deleted matter {matter_id} ({matter_title})",
        db=db,
    )

    log.info("Matter deleted: %s by user %s", matter_id, tenant.user_id)
    return {"message": "Matter deleted successfully", "id": matter_id}


# ---------------------------------------------------------------------------
# Add event / reminder
# ---------------------------------------------------------------------------

@router.post(
    "/matters/{matter_id}/events",
    response_model=MatterEventResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Matter Workspace"],
)
def add_event(
    matter_id: str,
    payload: MatterEventCreate,
    tenant: TenantContext = Depends(require_permission(Permission.MATTER_UPDATE)),
    db: Session = Depends(get_db),
) -> MatterEventResponse:
    """Add a timeline event or reminder to a matter."""
    matter = _get_owned_matter(matter_id, tenant, db)

    event = MatterEvent(
        matter_id=matter.id,
        event_type=payload.event_type,
        event_date=payload.event_date,
        description=payload.description,
        reminder_date=payload.reminder_date,
    )
    db.add(event)
    # Touch the parent so updated_at reflects timeline activity
    matter.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    log.info("Event added to matter %s by user %s", matter.id, tenant.user_id)
    return MatterEventResponse.model_validate(event)
