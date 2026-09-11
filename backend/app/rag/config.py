"""
backend/app/rag/config.py
--------------------------
Typed configuration for the RAG pipeline, loaded from environment variables
and the backend/.env file.

All RAG-related settings are centralised here so that no module needs to
parse os.environ directly.  The singleton is created once via get_settings()
and reused everywhere.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field


# ---------------------------------------------------------------------------
# Ensure .env is loaded before BaseSettings reads os.environ
# ---------------------------------------------------------------------------
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
if _ENV_PATH.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_ENV_PATH, override=False)


class RAGSettings(BaseSettings):
    """Typed settings for the RAG pipeline — sourced from environment."""

    # Gemini
    gemini_api_key: str = Field(
        default="",
        description="Google Gemini API key (required for answer generation).",
    )
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        description="Gemini model name.",
    )

    # Embedding model
    rag_embedding_model: str = Field(
        default="BAAI/bge-small-en-v1.5",
        description="HuggingFace model ID for the bi-encoder embedding model.",
    )

    # ChromaDB
    rag_chroma_path: str = Field(
        default="../corpus/chroma",
        description=(
            "Path to the persistent ChromaDB directory, relative to backend/ "
            "or absolute."
        ),
    )
    rag_collection_name: str = Field(
        default="ip_sakti_documents",
        description="ChromaDB collection name for all ingested documents.",
    )

    # Retrieval
    rag_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of top chunks to retrieve from ChromaDB.",
    )
    rag_min_relevance_score: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description=(
            "Minimum cosine distance threshold.  Chunks with distance above "
            "this value are considered irrelevant.  Lower = stricter."
        ),
    )

    # Chunking
    rag_chunk_size: int = Field(
        default=500,
        ge=50,
        description="Sliding-window size in words for chunk generation.",
    )
    rag_chunk_overlap: int = Field(
        default=50,
        ge=0,
        description="Overlap in words between consecutive chunks.",
    )

    # -----------------------------------------------------------------------
    # Computed helpers
    # -----------------------------------------------------------------------

    def resolved_chroma_path(self) -> Path:
        """Return the ChromaDB path resolved relative to the backend/ dir."""
        raw = Path(self.rag_chroma_path)
        if raw.is_absolute():
            return raw
        # Resolve relative to backend/
        backend_dir = Path(__file__).parent.parent.parent
        return (backend_dir / raw).resolve()

    model_config = {
        "env_prefix": "",          # no prefix — keys match env var names
        "case_sensitive": False,
        "extra": "ignore",         # ignore env vars not declared here
    }


@lru_cache(maxsize=1)
def get_settings() -> RAGSettings:
    """Return the singleton RAGSettings instance (cached after first call)."""
    return RAGSettings()
