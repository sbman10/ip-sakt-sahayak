"""
backend/app/routers/organisations.py
------------------------------------
Phase 3: Profiles, Organisations, and RBAC Membership Identity Router.
Provides secure database-backed identity and multi-tenant organisation management:
- Self-service profile retrieval and updates
- Organisation creation with auto-assigned administrator
- Membership isolation with 404-on-unauthorized to prevent tenant enumeration
- Strict RBAC: only organisation_admin or super_admin can manage memberships
- Self-promotion prevention: cannot promote to super_admin without super_admin credentials
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_org_membership,
    get_or_create_profile,
    require_org_permission,
    require_org_role,
    require_super_admin,
)
from app.core.permissions import Permission
from app.services.audit_service import log_admin_action
from app.models.database import (
    Organisation,
    OrganisationMember,
    Profile,
    User,
    get_db,
)
from app.routers.auth import require_auth
from app.schemas.identity import (
    MemberAddRequest,
    MemberRoleUpdate,
    OrganisationCreate,
    OrganisationMemberResponse,
    OrganisationResponse,
    ProfileResponse,
    ProfileUpdate,
    UserIdentityOverview,
)

log = logging.getLogger("app.routers.organisations")
router = APIRouter()


# ---------------------------------------------------------------------------
# Slug Generation Helper
# ---------------------------------------------------------------------------

def generate_org_slug(name: str, db: Session) -> str:
    """Generate a clean, unique URL slug for an organisation."""
    base_slug = re.sub(r"[^\w\-]", "-", name.strip().lower())
    base_slug = re.sub(r"-+", "-", base_slug).strip("-")
    if not base_slug:
        base_slug = "org"

    slug = base_slug
    counter = 1
    while db.query(Organisation).filter(Organisation.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


# ---------------------------------------------------------------------------
# Profile Endpoints
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=UserIdentityOverview, summary="Get current user identity & profile")
def get_user_profile(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> UserIdentityOverview:
    """
    Retrieve current authenticated user's database-backed profile and organisation memberships.
    Provisions a default profile record if one does not yet exist.
    """
    profile = get_or_create_profile(user, db)

    # Fetch active memberships for this user
    memberships = (
        db.query(OrganisationMember)
        .filter(OrganisationMember.user_id == user.id)
        .all()
    )

    org_responses: List[OrganisationResponse] = []
    for m in memberships:
        if m.organisation:
            org_responses.append(
                OrganisationResponse(
                    id=m.organisation.id,
                    name=m.organisation.name,
                    slug=m.organisation.slug,
                    created_by=m.organisation.created_by,
                    created_at=m.organisation.created_at,
                    updated_at=m.organisation.updated_at,
                    my_role=m.role,
                )
            )

    primary_org = org_responses[0] if org_responses else None

    return UserIdentityOverview(
        user_id=user.id,
        email=user.email,
        profile=ProfileResponse.model_validate(profile),
        organisations=org_responses,
        primary_organisation=primary_org,
    )


@router.patch("/profile", response_model=ProfileResponse, summary="Update current user profile")
def update_user_profile(
    payload: ProfileUpdate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Self-service profile update.
    Updates full_name, avatar_url, and preferred_language for the caller only.
    Prevents cross-tenant or cross-user modification.
    """
    profile = get_or_create_profile(user, db)

    if payload.full_name is not None:
        profile.full_name = payload.full_name
        user.full_name = payload.full_name
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url
        user.avatar_url = payload.avatar_url
    if payload.preferred_language is not None:
        profile.preferred_language = payload.preferred_language

    profile.updated_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)
    log.info("Profile updated for user %s", user.id)

    return ProfileResponse.model_validate(profile)


# ---------------------------------------------------------------------------
# Organisation Endpoints
# ---------------------------------------------------------------------------

@router.post("/organisations", response_model=OrganisationResponse, status_code=status.HTTP_201_CREATED, summary="Create a new organisation")
def create_organisation(
    payload: OrganisationCreate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> OrganisationResponse:
    """
    Create a new multi-tenant organisation.
    The creator is automatically enrolled as an 'organisation_admin'.
    """
    # Slug resolution and collision check
    if payload.slug:
        existing = db.query(Organisation).filter(Organisation.slug == payload.slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Organisation slug '{payload.slug}' is already taken",
            )
        slug = payload.slug
    else:
        slug = generate_org_slug(payload.name, db)

    org_id = str(uuid.uuid4())
    org = Organisation(
        id=org_id,
        name=payload.name,
        slug=slug,
        created_by=user.id,
    )
    db.add(org)
    db.flush()

    # Automatically enroll the creator as organisation_admin
    membership = OrganisationMember(
        organisation_id=org_id,
        user_id=user.id,
        role="organisation_admin",
    )
    db.add(membership)

    db.commit()
    db.refresh(org)
    log.info("Organisation '%s' (%s) created by user %s", org.name, org.id, user.id)

    return OrganisationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_by=org.created_by,
        created_at=org.created_at,
        updated_at=org.updated_at,
        my_role="organisation_admin",
    )


@router.get("/organisations/me", response_model=List[OrganisationResponse], summary="List caller's organisations")
def list_my_organisations(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> List[OrganisationResponse]:
    """
    List all organisations the authenticated caller belongs to, with their verified role.
    """
    memberships = (
        db.query(OrganisationMember)
        .filter(OrganisationMember.user_id == user.id)
        .all()
    )

    results: List[OrganisationResponse] = []
    for m in memberships:
        if m.organisation:
            results.append(
                OrganisationResponse(
                    id=m.organisation.id,
                    name=m.organisation.name,
                    slug=m.organisation.slug,
                    created_by=m.organisation.created_by,
                    created_at=m.organisation.created_at,
                    updated_at=m.organisation.updated_at,
                    my_role=m.role,
                )
            )

    return results


@router.get("/organisations/{organisation_id}", response_model=OrganisationResponse, summary="Get organisation details")
def get_organisation_details(
    organisation_id: str = Path(..., description="Target Organisation ID"),
    membership: OrganisationMember = Depends(require_org_permission(Permission.ORG_READ)),
    db: Session = Depends(get_db),
) -> OrganisationResponse:
    """
    Get organisation details. Requires caller to have org:read permission.
    Non-members receive HTTP 404 to avoid leaking tenant existence.
    """
    org = db.query(Organisation).filter(Organisation.id == organisation_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    return OrganisationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_by=org.created_by,
        created_at=org.created_at,
        updated_at=org.updated_at,
        my_role=membership.role,
    )


# ---------------------------------------------------------------------------
# Membership Management Endpoints (RBAC)
# ---------------------------------------------------------------------------

@router.get("/organisations/{organisation_id}/members", response_model=List[OrganisationMemberResponse], summary="List organisation members")
def list_organisation_members(
    organisation_id: str = Path(..., description="Target Organisation ID"),
    membership: OrganisationMember = Depends(require_org_permission(Permission.MEMBER_READ)),
    db: Session = Depends(get_db),
) -> List[OrganisationMemberResponse]:
    """
    List all members in the organisation. Requires active membership (member:read).
    """
    members = (
        db.query(OrganisationMember)
        .filter(OrganisationMember.organisation_id == organisation_id)
        .all()
    )
    return [OrganisationMemberResponse.model_validate(m) for m in members]


@router.post("/organisations/{organisation_id}/members", response_model=OrganisationMemberResponse, status_code=status.HTTP_201_CREATED, summary="Add user to organisation")
def add_organisation_member(
    payload: MemberAddRequest,
    organisation_id: str = Path(..., description="Target Organisation ID"),
    admin_membership: OrganisationMember = Depends(require_org_permission(Permission.MEMBER_CREATE)),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> OrganisationMemberResponse:
    """
    Add an existing user to the organisation.
    Requires member:create permission (organisation_admin or super_admin).
    Only super_admin can assign the 'super_admin' role.
    """
    # Prevent unauthorized privilege escalation
    if payload.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system super administrators can assign the super_admin role",
        )

    # Locate target user by email
    target_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{payload.email}' not found. User must register first.",
        )

    # Check for existing membership
    existing = (
        db.query(OrganisationMember)
        .filter(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == target_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organisation",
        )

    new_member = OrganisationMember(
        organisation_id=organisation_id,
        user_id=target_user.id,
        role=payload.role,
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    # Phase 5: Audit sensitive administrative action
    log_admin_action(
        action=Permission.MEMBER_CREATE.value,
        actor_user_id=current_user.id,
        organisation_id=organisation_id,
        details=f"Added user {target_user.email} ({target_user.id}) with role '{payload.role}'",
        db=db,
    )

    log.info(
        "User %s added to Org %s with role '%s' by %s",
        target_user.id,
        organisation_id,
        payload.role,
        current_user.id,
    )
    return OrganisationMemberResponse.model_validate(new_member)


@router.patch("/organisations/{organisation_id}/members/{user_id}", response_model=OrganisationMemberResponse, summary="Update member role")
def update_organisation_member_role(
    payload: MemberRoleUpdate,
    organisation_id: str = Path(..., description="Target Organisation ID"),
    user_id: str = Path(..., description="Target Member User ID"),
    admin_membership: OrganisationMember = Depends(require_org_permission(Permission.MEMBER_UPDATE_ROLE)),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> OrganisationMemberResponse:
    """
    Update a member's role within an organisation.
    Requires member:update_role permission (organisation_admin or super_admin).
    Prevents self-promotion and locking out the sole administrator.
    """
    if payload.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system super administrators can assign the super_admin role",
        )

    target_member = (
        db.query(OrganisationMember)
        .filter(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == user_id,
        )
        .first()
    )
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation member not found",
        )

    # Demotion protection: ensure at least one organisation_admin remains
    if target_member.role == "organisation_admin" and payload.role != "organisation_admin":
        admin_count = (
            db.query(OrganisationMember)
            .filter(
                OrganisationMember.organisation_id == organisation_id,
                OrganisationMember.role == "organisation_admin",
            )
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the sole organisation administrator. Assign another administrator first.",
            )

    old_role = target_member.role
    target_member.role = payload.role
    db.commit()
    db.refresh(target_member)

    # Phase 5: Audit sensitive administrative action
    log_admin_action(
        action=Permission.MEMBER_UPDATE_ROLE.value,
        actor_user_id=current_user.id,
        organisation_id=organisation_id,
        details=f"Updated user {user_id} role from '{old_role}' to '{payload.role}'",
        db=db,
    )

    log.info(
        "Org %s: Member %s role updated to '%s' by %s",
        organisation_id,
        user_id,
        payload.role,
        current_user.id,
    )
    return OrganisationMemberResponse.model_validate(target_member)


@router.delete("/organisations/{organisation_id}/members/{user_id}", summary="Remove member from organisation")
def remove_organisation_member(
    organisation_id: str = Path(..., description="Target Organisation ID"),
    user_id: str = Path(..., description="Target Member User ID"),
    admin_membership: OrganisationMember = Depends(require_org_permission(Permission.MEMBER_DELETE)),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> dict:
    """
    Remove a member from an organisation.
    Requires member:delete permission (organisation_admin or super_admin).
    Prevents removing the sole organisation administrator.
    """
    target_member = (
        db.query(OrganisationMember)
        .filter(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == user_id,
        )
        .first()
    )
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation member not found",
        )

    if target_member.role == "organisation_admin":
        admin_count = (
            db.query(OrganisationMember)
            .filter(
                OrganisationMember.organisation_id == organisation_id,
                OrganisationMember.role == "organisation_admin",
            )
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the sole organisation administrator.",
            )

    db.delete(target_member)
    db.commit()

    # Phase 5: Audit sensitive administrative action
    log_admin_action(
        action=Permission.MEMBER_DELETE.value,
        actor_user_id=current_user.id,
        organisation_id=organisation_id,
        details=f"Removed user {user_id} (former role: '{target_member.role}')",
        db=db,
    )

    log.info("Org %s: Member %s removed by %s", organisation_id, user_id, current_user.id)
    return {
        "status": "success",
        "message": "Member removed successfully",
        "organisation_id": organisation_id,
        "user_id": user_id,
    }

