"""
backend/app/templates
----------------------
Deterministic document-template renderers for the Draft Generation feature.

Each module exposes a single ``render(req) -> tuple[list[DraftSection], meta]``
style builder that turns a validated ``DraftRequest`` into an ordered list of
``DraftSection`` objects plus document metadata. No ML, no external calls —
fully reproducible legal-document scaffolding with realistic placeholder
language.
"""
