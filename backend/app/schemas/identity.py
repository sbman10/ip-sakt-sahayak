"""
backend/app/schemas/identity.py
---------------------------------
Pydantic v2 schemas for Phase 3 Profiles, Organisations, and RBAC Membership Identity.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


RoleType = Literal["user", "organisation_admin", "reviewer", "super_admin"]
VALID_ROLES = {"user", "organisation_admin", "reviewer", "super_admin"}


class ProfileResponse(BaseModel):
    """Public profile data transfer object."""
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_language: str = "en"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    """Payload for self-service profile update."""
    full_name: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=500)
    preferred_language: Optional[str] = Field(None, max_length=20)

    @field_validator("full_name")
    @classmethod
    def sanitize_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            return cleaned or None
        return v

    @field_validator("preferred_language")
    @classmethod
    def sanitize_language(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip().lower()
            return cleaned or "en"
        return v


class OrganisationCreate(BaseModel):
    """Payload to create a new organization."""
    name: str = Field(..., min_length=2, max_length=255, description="Institutional name")
    slug: Optional[str] = Field(None, min_length=2, max_length=100, description="URL-friendly identifier")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Organisation name must be at least 2 characters")
        return cleaned

    @field_validator("slug")
    @classmethod
    def sanitize_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            slug_clean = re.sub(r"[^\w\-]", "-", v.strip().lower())
            slug_clean = re.sub(r"-+", "-", slug_clean).strip("-")
            return slug_clean
        return None


class OrganisationResponse(BaseModel):
    """Organisation details with caller membership role."""
    id: str
    name: str
    slug: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    my_role: Optional[str] = Field(None, description="Caller's verified role in this organisation")

    model_config = {"from_attributes": True}


class OrganisationMemberResponse(BaseModel):
    """Organisation membership with user details."""
    organisation_id: str
    user_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberAddRequest(BaseModel):
    """Payload to invite or add a user to an organisation."""
    email: str = Field(..., description="Email of existing user")
    role: RoleType = Field("user", description="Membership role")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if "@" not in cleaned or "." not in cleaned:
            raise ValueError("Valid email address required")
        return cleaned


class MemberRoleUpdate(BaseModel):
    """Payload to change an organisation member's role."""
    role: RoleType = Field(..., description="New role to assign")


class UserIdentityOverview(BaseModel):
    """Comprehensive user identity including profile and memberships."""
    user_id: str
    email: str
    profile: ProfileResponse
    organisations: List[OrganisationResponse] = []
    primary_organisation: Optional[OrganisationResponse] = None
