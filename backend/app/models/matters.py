"""
backend/app/models/matters.py
-------------------------------
Matter Workspace models for IP-SAKTI Sahayak.

Lets a user save and track IP cases (matters) and their events / reminders.

Tables
------
- matter_workspace : one IP case per row (patent / trademark / copyright / gi)
- matter_events    : timeline events + reminders belonging to a matter

These reuse the shared declarative ``Base`` from ``app.models.database`` so
``init_db()`` picks them up and creates the tables on startup. Distinct table
names avoid colliding with the legacy ``matters`` table already defined in
database.py.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.database import Base


class MatterWorkspace(Base):
    """A single IP case tracked in the Matter Workspace."""

    __tablename__ = "matter_workspace"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    case_type = Column(
        Enum("patent", "trademark", "copyright", "gi", name="matter_case_type"),
        nullable=False,
    )
    application_number = Column(String(100), nullable=True)
    filing_date = Column(DateTime, nullable=True)
    status = Column(
        Enum(
            "draft",
            "filed",
            "examination",
            "granted",
            "rejected",
            name="matter_case_status",
        ),
        default="draft",
        nullable=False,
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    events = relationship(
        "MatterEvent",
        back_populates="matter_workspace",
        cascade="all, delete-orphan",
        order_by="MatterEvent.event_date",
    )


class MatterEvent(Base):
    """A timeline event or reminder attached to a matter."""

    __tablename__ = "matter_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    matter_id = Column(
        String(36),
        ForeignKey("matter_workspace.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(50), nullable=False)  # e.g. filing, office_action, deadline, note
    event_date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    reminder_date = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    matter_workspace = relationship("MatterWorkspace", back_populates="events")
