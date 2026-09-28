"""
backend/app/core/permissions.py
---------------------------------
Central Permission Registry for IP-SAKTI Sahayak (Phase 5: RBAC & Permissions).
Defines discrete system and tenant permissions and binds them to standard roles:
- super_admin: System-wide omnipotent access.
- organisation_admin: Complete administrative authority within their organisation.
- reviewer: Legal & IP reviewer privileges (read/create/update cases, run patentability, view audit).
- user: Standard member (chat, matter creation, document uploads, read org info).
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Dict, Set, Union

from fastapi import HTTPException, status

log = logging.getLogger("app.core.permissions")


class Permission(str, Enum):
    """
    Granular action permissions enforced across API routes and service layers.
    """
    # Organisation management
    ORG_READ = "org:read"
    ORG_UPDATE = "org:update"
    ORG_DELETE = "org:delete"

    # Member management
    MEMBER_READ = "member:read"
    MEMBER_CREATE = "member:create"
    MEMBER_UPDATE_ROLE = "member:update_role"
    MEMBER_DELETE = "member:delete"

    # Document management
    DOCUMENT_READ = "document:read"
    DOCUMENT_CREATE = "document:create"
    DOCUMENT_DELETE = "document:delete"

    # Conversation & chat
    CONVERSATION_READ = "conversation:read"
    CONVERSATION_CREATE = "conversation:create"
    CONVERSATION_UPDATE = "conversation:update"
    CONVERSATION_DELETE = "conversation:delete"
    CHAT_QUERY = "chat:query"

    # Matter Workspace (IP Cases)
    MATTER_READ = "matter:read"
    MATTER_CREATE = "matter:create"
    MATTER_UPDATE = "matter:update"
    MATTER_DELETE = "matter:delete"

    # Patentability & Prior-Art Assessments
    PATENTABILITY_RUN = "patentability:run"
    PATENTABILITY_READ = "patentability:read"

    # Audit & telemetry
    AUDIT_READ = "audit:read"


# Comprehensive set of all system permissions
ALL_PERMISSIONS: Set[Permission] = set(Permission)

# Role to Permission Registry mapping
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    "super_admin": ALL_PERMISSIONS,

    "organisation_admin": {
        Permission.ORG_READ,
        Permission.ORG_UPDATE,
        Permission.ORG_DELETE,
        Permission.MEMBER_READ,
        Permission.MEMBER_CREATE,
        Permission.MEMBER_UPDATE_ROLE,
        Permission.MEMBER_DELETE,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_CREATE,
        Permission.DOCUMENT_DELETE,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.CHAT_QUERY,
        Permission.MATTER_READ,
        Permission.MATTER_CREATE,
        Permission.MATTER_UPDATE,
        Permission.MATTER_DELETE,
        Permission.PATENTABILITY_RUN,
        Permission.PATENTABILITY_READ,
        Permission.AUDIT_READ,
    },

    "reviewer": {
        Permission.ORG_READ,
        Permission.MEMBER_READ,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_CREATE,
        Permission.DOCUMENT_DELETE,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.CHAT_QUERY,
        Permission.MATTER_READ,
        Permission.MATTER_CREATE,
        Permission.MATTER_UPDATE,
        Permission.PATENTABILITY_RUN,
        Permission.PATENTABILITY_READ,
        Permission.AUDIT_READ,
    },

    "user": {
        Permission.ORG_READ,
        Permission.MEMBER_READ,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_CREATE,
        Permission.CONVERSATION_READ,
        Permission.CONVERSATION_CREATE,
        Permission.CONVERSATION_UPDATE,
        Permission.CONVERSATION_DELETE,
        Permission.CHAT_QUERY,
        Permission.MATTER_READ,
        Permission.MATTER_CREATE,
        Permission.MATTER_UPDATE,
        Permission.PATENTABILITY_RUN,
        Permission.PATENTABILITY_READ,
    },
}


def has_permission(role: str, permission: Union[Permission, str]) -> bool:
    """
    Check if a given role is granted the requested permission.
    Returns True if role has permission, otherwise False.
    """
    if isinstance(permission, str):
        try:
            permission = Permission(permission)
        except ValueError:
            log.warning("Unknown permission string checked: %s", permission)
            return False

    granted = ROLE_PERMISSIONS.get(role, set())
    return permission in granted


def get_role_permissions(role: str) -> Set[str]:
    """Return all string permission codes granted to a given role."""
    return {p.value for p in ROLE_PERMISSIONS.get(role, set())}


def check_permission_or_raise(role: str, permission: Union[Permission, str]) -> None:
    """
    Validates role against permission; raises HTTP 403 Forbidden on failure.
    Includes permission code and permitted roles for backward compatibility.
    """
    if isinstance(permission, str):
        try:
            permission = Permission(permission)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unknown permission: '{permission}'",
            )

    perm_val = permission.value
    if not has_permission(role, permission):
        valid_roles = [r for r, perms in ROLE_PERMISSIONS.items() if permission in perms and r != "super_admin"]
        roles_hint = f" (requires one of roles: {', '.join(valid_roles)})" if valid_roles else ""
        log.warning("RBAC Forbidden: Role '%s' denied permission '%s'", role, perm_val)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permission: '{perm_val}' required{roles_hint}",
        )

