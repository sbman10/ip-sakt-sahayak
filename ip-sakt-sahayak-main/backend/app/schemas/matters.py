"""
backend/app/schemas/matters.py
-------------------------------
Pydantic v2 schemas for the Matter Workspace API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

CaseType = Literal["patent", "trademark", "copyright", "gi"]
CaseStatus = Literal["draft", "filed", "examination", "granted", "rejected"]


# ---------------------------------------------------------------------------
# Matter Event schemas
# ---------------------------------------------------------------------------

class MatterEventCreate(BaseModel):
    """Payload to add a timeline event / reminder to a matter."""

    event_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Event category, e.g. filing, office_action, deadline, note.",
        examples=["office_action"],
    )
    event_date: Optional[datetime] = Field(
        None, description="When the event happened / is scheduled."
    )
    description: Optional[str] = Field(
        None, max_length=4000, description="Free-text description of the event."
    )
    reminder_date: Optional[datetime] = Field(
        None, description="Optional reminder / deadline date for this event."
    )


class MatterEventResponse(BaseModel):
    """A timeline event as returned by the API."""

    id: int
    matter_id: str
    event_type: str
    event_date: Optional[datetime] = None
    description: Optional[str] = None
    reminder_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Matter schemas
# ---------------------------------------------------------------------------

class MatterCreate(BaseModel):
    """Payload to create a new matter."""

    title: str = Field(..., min_length=1, max_length=255, examples=["Ashwagandha Extract Process"])
    case_type: CaseType = Field(..., description="patent | trademark | copyright | gi")
    application_number: Optional[str] = Field(None, max_length=100)
    filing_date: Optional[datetime] = None
    status: CaseStatus = Field(default="draft")
    notes: Optional[str] = Field(None, max_length=8000)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title must not be blank")
        return v.strip()


class MatterUpdate(BaseModel):
    """Partial-update payload for a matter. All fields optional."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    case_type: Optional[CaseType] = None
    application_number: Optional[str] = Field(None, max_length=100)
    filing_date: Optional[datetime] = None
    status: Optional[CaseStatus] = None
    notes: Optional[str] = Field(None, max_length=8000)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("title must not be blank")
        return v.strip() if v is not None else v


class MatterResponse(BaseModel):
    """A matter without its events (used in list views)."""

    id: str
    user_id: str
    title: str
    case_type: CaseType
    application_number: Optional[str] = None
    filing_date: Optional[datetime] = None
    status: CaseStatus
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    event_count: int = 0

    model_config = {"from_attributes": True}


class MatterDetailResponse(MatterResponse):
    """A matter WITH its full event timeline (used in detail view)."""

    events: list[MatterEventResponse] = Field(default_factory=list)


class MatterListResponse(BaseModel):
    """Paginated list of matters."""

    items: list[MatterResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UpcomingDeadline(BaseModel):
    """A matter surfaced because one of its events has an upcoming reminder."""

    matter_id: str
    matter_title: str
    case_type: CaseType
    status: CaseStatus
    event_id: int
    event_type: str
    description: Optional[str] = None
    reminder_date: datetime
    days_remaining: int
