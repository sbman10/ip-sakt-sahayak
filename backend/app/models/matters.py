"""
backend/app/models/matters.py
-------------------------------
Matter Workspace models for IP-SAKTI Sahayak.
Re-exports MatterWorkspace and MatterEvent from the authoritative
app.models.database module to maintain single-Base consistency.
"""

from __future__ import annotations

from app.models.database import Base, MatterEvent, MatterWorkspace

__all__ = ["Base", "MatterWorkspace", "MatterEvent"]
