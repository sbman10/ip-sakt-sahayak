# backend/app/routers/__init__.py
# Routers package for IP-SAKTI Sahayak.
# Exposes all routers

from app.routers import chat, classify, conversations, auth, uploads, documents, matters, drafts, checklists, experts, analytics, subscription, verdict, roadmap, guardian

__all__ = ["chat", "classify", "conversations", "auth", "uploads", "documents", "matters", "drafts", "checklists", "experts", "analytics", "subscription", "verdict", "roadmap", "guardian"]
