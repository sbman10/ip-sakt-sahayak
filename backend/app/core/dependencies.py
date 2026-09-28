"""
backend/app/core/dependencies.py
----------------------------------
Reusable typed FastAPI dependencies for Phase 3:
- Authentication & Profile verification
- Organisation membership isolation
- Role-based access control (RBAC)
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Callable, List, Optional, Union
from fastapi import Depends, Header, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.permissions import Permission, check_permission_or_raise, has_permission
from app.models.database import (
    Organisation,
    OrganisationMember,
    Profile,
    User,
    get_db,
)
from app.core.supabase_auth import require_auth, get_current_user

log = logging.getLogger("app.core.dependencies")


@dataclass
class TenantContext:
    """
    Immutable security context representing the authenticated user,
    their verified active organisation, and membership role.
    """
    user: User
    organisation: Organisation
    membership: OrganisationMember

    @property
    def user_id(self) -> str:
        return self.user.id

    @property
    def organisation_id(self) -> str:
        return self.organisation.id

    @property
    def role(self) -> str:
        return self.membership.role


def get_or_create_personal_organisation(user: User, db: Session) -> OrganisationMember:
    """
    Ensures that every user belongs to at least one valid organisation by resolving
    their first active membership or auto-provisioning a personal organisation.
    """
    membership = (
        db.query(OrganisationMember)
        .filter(OrganisationMember.user_id == user.id)
        .first()
    )
    if membership and membership.organisation:
        return membership

    # Auto-provision a default Personal Workspace for this user
    org_id = str(uuid.uuid4())
    org_name = f"{user.full_name or user.email.split('@')[0]} Workspace"
    clean_slug = f"workspace-{user.id[:8].lower()}"

    counter = 1
    slug = clean_slug
    while db.query(Organisation).filter(Organisation.slug == slug).first():
        slug = f"{clean_slug}-{counter}"
        counter += 1

    org = Organisation(
        id=org_id,
        name=org_name,
        slug=slug,
        created_by=user.id,
    )
    db.add(org)
    db.flush()

    membership = OrganisationMember(
        organisation_id=org_id,
        user_id=user.id,
        role="organisation_admin",
    )
    db.add(membership)

    try:
        db.commit()
        db.refresh(membership)
        log.info("Auto-provisioned personal workspace '%s' (%s) for user %s", org_name, org_id, user.id)
    except Exception:
        db.rollback()
        membership = (
            db.query(OrganisationMember)
            .filter(OrganisationMember.user_id == user.id)
            .first()
        )

    return membership


def get_tenant_context(
    x_organisation_id: Optional[str] = Header(None, alias="X-Organisation-ID"),
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> TenantContext:
    """
    Resolves the caller's active organisation membership server-side.
    Enforces that:
    1. If X-Organisation-ID is provided, caller MUST be an active member in organisation_members.
       If not, raises 403 Forbidden (preventing cross-tenant access).
    2. If X-Organisation-ID is omitted:
       - Uses caller's first active organisation membership or auto-provisions a personal workspace.
    3. Guarantees that every protected operation has an immutable, verified (user_id, organisation_id).
    4. Client-provided ownership fields in request bodies or query params are completely ignored.
    """
    if x_organisation_id and x_organisation_id.strip():
        clean_org_id = x_organisation_id.strip()

        # Check membership
        membership = (
            db.query(OrganisationMember)
            .filter(
                OrganisationMember.organisation_id == clean_org_id,
                OrganisationMember.user_id == user.id,
            )
            .first()
        )

        if not membership:
            # Super admin inspection bypass
            if user.role == "super_admin":
                org = db.query(Organisation).filter(Organisation.id == clean_org_id).first()
                if not org:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found")
                return TenantContext(
                    user=user,
                    organisation=org,
                    membership=OrganisationMember(organisation_id=clean_org_id, user_id=user.id, role="super_admin"),
                )

            log.warning("Security: User %s attempted unauthorized access to Org %s", user.id, clean_org_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not an active member of the requested organisation",
            )

        return TenantContext(user=user, organisation=membership.organisation, membership=membership)

    # No specific organisation requested — resolve primary or personal workspace
    membership = get_or_create_personal_organisation(user, db)
    return TenantContext(user=user, organisation=membership.organisation, membership=membership)


def get_optional_tenant_context(
    x_organisation_id: Optional[str] = Header(None, alias="X-Organisation-ID"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Optional[TenantContext]:
    """Optional tenant context for backwards compatibility with anonymous callers."""
    if not current_user:
        return None
    return get_tenant_context(x_organisation_id=x_organisation_id, user=current_user, db=db)



def get_or_create_profile(user: User, db: Session) -> Profile:
    """
    Retrieves or auto-provisions a database Profile record for the authenticated user.
    Ensures safe database-backed identity without depending on frontend input.
    """
    profile = db.query(Profile).filter(Profile.id == user.id).first()
    if not profile:
        profile = Profile(
            id=user.id,
            full_name=user.full_name or user.email.split("@")[0],
            avatar_url=user.avatar_url,
            preferred_language="en",
        )
        db.add(profile)
        try:
            db.commit()
            db.refresh(profile)
            log.info("Provisioned database Profile for user %s", user.id)
        except Exception:
            db.rollback()
            profile = db.query(Profile).filter(Profile.id == user.id).first()

    return profile


def get_current_org_membership(
    organisation_id: str = Path(..., description="Target Organisation ID"),
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
) -> OrganisationMember:
    """
    Validates that the authenticated user is an active member of the specified organization.
    Prevents cross-tenant access and returns the verified OrganisationMember model.
    """
    # System super_admin can inspect any organization
    if user.role == "super_admin":
        membership = (
            db.query(OrganisationMember)
            .filter(
                OrganisationMember.organisation_id == organisation_id,
                OrganisationMember.user_id == user.id,
            )
            .first()
        )
        if not membership:
            # Synthetic member view for super_admin
            return OrganisationMember(
                organisation_id=organisation_id,
                user_id=user.id,
                role="super_admin",
            )
        return membership

    membership = (
        db.query(OrganisationMember)
        .filter(
            OrganisationMember.organisation_id == organisation_id,
            OrganisationMember.user_id == user.id,
        )
        .first()
    )

    if not membership:
        log.warning("Security: User %s attempted unauthorized access to Org %s", user.id, organisation_id)
        # Return 404 to avoid leaking existence of organisations to non-members
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found or membership required",
        )

    return membership


def require_org_role(*allowed_roles: str) -> Callable:
    """
    Dependency factory verifying that the user holds an approved role within the target organization.
    Raises 403 Forbidden if user is a member but lacks sufficient privileges.
    """
    def dependency(
        membership: OrganisationMember = Depends(get_current_org_membership),
        user: User = Depends(require_auth),
    ) -> OrganisationMember:
        if user.role == "super_admin":
            return membership

        if membership.role not in allowed_roles:
            log.warning(
                "RBAC Denied: User %s with role '%s' attempted action requiring %s in Org %s",
                user.id,
                membership.role,
                allowed_roles,
                membership.organisation_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {', '.join(allowed_roles)}",
            )
        return membership

    return dependency


def require_super_admin(
    user: User = Depends(require_auth),
) -> User:
    """
    Dependency verifying system-level super_admin privilege.
    """
    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super administrator privilege required",
        )
    return user


def require_permission(permission: Union[Permission, str]) -> Callable[..., TenantContext]:
    """
    Dependency factory verifying that the authenticated user's active organisation
    role (or system super_admin status) grants the requested permission.
    Raises 401 if unauthenticated (via get_tenant_context -> require_auth).
    Raises 403 if authenticated but lacking the required permission.
    Returns the verified TenantContext.
    """
    def dependency(
        tenant: TenantContext = Depends(get_tenant_context),
    ) -> TenantContext:
        if tenant.user.role == "super_admin":
            return tenant

        check_permission_or_raise(tenant.role, permission)
        return tenant

    return dependency


def require_org_permission(permission: Union[Permission, str]) -> Callable[..., OrganisationMember]:
    """
    Dependency factory verifying that the caller holds the requested permission
    within the specific organisation identified in the URL path.
    Raises 401 if unauthenticated.
    Raises 404 if caller is not an active member (preventing tenant enumeration).
    Raises 403 if caller is an active member but lacks the required permission.
    Returns the verified OrganisationMember.
    """
    def dependency(
        membership: OrganisationMember = Depends(get_current_org_membership),
        user: User = Depends(require_auth),
    ) -> OrganisationMember:
        if user.role == "super_admin":
            return membership

        check_permission_or_raise(membership.role, permission)
        return membership

    return dependency

