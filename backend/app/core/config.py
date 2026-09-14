"""
backend/app/core/config.py
--------------------------
Centralized application settings and environment variable management
using Pydantic Settings (Pydantic v2).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Determine base directories
_BASE_DIR = Path(__file__).resolve().parent.parent.parent  # Points to /backend
_ENV_FILE_PATHS = [
    _BASE_DIR / ".env",
    Path(".env"),
    Path("./backend/.env"),
]


class Settings(BaseSettings):
    """
    Enterprise configuration management for IP-SAKTI Sahayak.
    """

    PROJECT_NAME: str = "IP-SAKTI Sahayak"
    ENVIRONMENT: str = "development"
    CHROMA_DB_DIR: str = str(_BASE_DIR / "chroma_db")
    BM25_INDEX_PATH: str = str(_BASE_DIR / "bm25_index.pkl")

    # API Keys & LLM settings
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: Union[List[str], str] = []
    PRIMARY_MODEL: str = "gemini-3.6-flash"

    # Hybrid Search & Reranking Thresholds
    SIMILARITY_THRESHOLD: float = 0.65
    RERANK_SKIP_THRESHOLD: float = 0.25

    # Auth & Security
    JWT_SECRET_KEY: str = "ip-sakti-sahayak-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # Database URLs
    DATABASE_URL: str = "sqlite:///./ip_sakti.db"
    AUDIT_DB_PATH: str = str(_BASE_DIR / "audit.db")

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=tuple(str(p) for p in _ENV_FILE_PATHS if p.exists()) or ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("GEMINI_API_KEYS", mode="before")
    @classmethod
    def parse_gemini_api_keys(cls, v: Union[str, List[str]], info) -> List[str]:
        """
        Parse comma-separated strings or fallback to GEMINI_API_KEY if list is empty.
        """
        keys: List[str] = []
        if isinstance(v, str):
            if v.strip():
                keys = [k.strip() for k in v.split(",") if k.strip()]
        elif isinstance(v, list):
            keys = [str(k).strip() for k in v if str(k).strip()]

        return keys

    def get_gemini_keys(self) -> List[str]:
        """Return the list of all available Gemini API keys."""
        keys = list(self.GEMINI_API_KEYS) if isinstance(self.GEMINI_API_KEYS, list) else []
        if not keys and self.GEMINI_API_KEY:
            keys.append(self.GEMINI_API_KEY.strip())
        return keys


# Global singleton instance
settings = Settings()
