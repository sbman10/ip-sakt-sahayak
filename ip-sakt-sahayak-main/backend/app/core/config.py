"""
backend/app/core/config.py
--------------------------
Centralized application settings and environment variable management
using Pydantic Settings (Pydantic v2).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Union

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
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-m3"
    EMBEDDING_PROVIDER: str = "hf_inference"
    HF_TOKEN: str = ""
    HF_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    HF_INFERENCE_PROVIDER: str = "auto"
    HF_EMBEDDING_TIMEOUT: float = 60.0
    HF_EMBEDDING_NORMALIZE: bool = True
    LOCAL_BGE_FALLBACK: bool = False
    ENABLE_LOCAL_BGE_PRELOAD: bool = False
    ENABLE_CROSS_ENCODER: bool = True

    # Qdrant Cloud settings
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    # Default to the verified production hybrid collection. Local experiments
    # should override this explicitly in an ignored backend/.env file.
    QDRANT_COLLECTION: str = "ragvyn_prod_v2"
    QDRANT_SHADOW_RETRIEVAL: bool = False
    QDRANT_SHADOW_COLLECTION: str = "ragvyn_prod_v1"
    QDRANT_SHADOW_TIMEOUT_SECONDS: float = 3.0
    QDRANT_SHADOW_SAMPLE_RATE: float = 1.0
    QDRANT_SHADOW_MAX_FAILURES: int = 3

    # Retrieval Backend Routing & Safe Fallback (Phase 5B)
    RETRIEVAL_BACKEND: str = "qdrant_hybrid"
    # Official production corpus currently deployed in Qdrant Cloud.
    QDRANT_PRODUCTION_COLLECTION: str = "ragvyn_prod_v2"
    QDRANT_FALLBACK_ENABLED: bool = True
    QDRANT_REQUEST_TIMEOUT_SECONDS: float = 15.0
    # Qdrant RRF scores are rank-fusion scores, not cosine distances.
    QDRANT_RRF_MIN_SCORE: float = 0.01

    # Controlled Canary Rollout Settings (Phase 5D)
    QDRANT_CANARY_ENABLED: bool = False
    QDRANT_TRAFFIC_PERCENT: int = 0

    CHROMA_DB_DIR: str = str(_BASE_DIR / "chroma_db")
    BM25_INDEX_PATH: str = str(_BASE_DIR / "bm25_index.pkl")

    # API Keys & LLM settings (Dual-Provider Architecture)
    LLM_PRIMARY_PROVIDER: str = "gemini"
    LLM_FALLBACK_PROVIDER: str = "cerebras"

    CEREBRAS_API_KEY: str = ""
    CEREBRAS_BASE_URL: str = "https://api.cerebras.ai/v1"
    CEREBRAS_MODEL: str = "gpt-oss-120b"

    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: Union[List[str], str] = []
    GEMINI_MODEL: str = "gemini-3.6-flash"
    PRIMARY_MODEL: str = "gemini-3.6-flash"

    GENERATION_MAX_RETRIES: int = 1
    GENERATION_TIMEOUT_SECONDS: float = 60.0

    # Hybrid Search & Reranking Thresholds
    SIMILARITY_THRESHOLD: float = 0.65
    RERANK_SKIP_THRESHOLD: float = 0.25

    # Mode-aware answer length limits (Requirement 4: enhanced for complete answers)
    TOKEN_LIMIT_BRIEF: int = 1500
    TOKEN_LIMIT_STANDARD: int = 4096
    TOKEN_LIMIT_DETAILED: int = 8192

    # Intent Classification & Early Routing (Requirement 5: disabled by default in production)
    INTENT_CLASSIFICATION_ENABLED: bool = False
    INTENT_CLASSIFIER_MODEL: str = "gemini-3.6-flash"
    INTENT_CLASSIFIER_TIMEOUT_SECONDS: float = 3.0
    INTENT_CONFIDENCE_THRESHOLD: float = 0.60

    # Auth & Security
    JWT_SECRET_KEY: str = "ip-sakti-sahayak-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    def get_mode_token_limit(self, answer_mode: Optional[str] = None) -> int:
        """Returns max output token limit based on the requested answer mode."""
        mode = (answer_mode or "standard").strip().lower()
        if mode == "brief":
            return self.TOKEN_LIMIT_BRIEF
        if mode == "detailed":
            return self.TOKEN_LIMIT_DETAILED
        return self.TOKEN_LIMIT_STANDARD

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    # Production callback for the deployed Render API. Local development can
    # override this in the ignored backend/.env file.
    GOOGLE_REDIRECT_URI: str = "https://ragvyn.onrender.com/api/auth/google/callback"

    # Database URLs
    DATABASE_URL: str = "sqlite:///./ip_sakti.db"
    AUDIT_DB_PATH: str = str(_BASE_DIR / "audit.db")

    # Supabase PostgreSQL & Storage
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "legal-documents"

    # Additional Qdrant collection names used by specialized features.
    QDRANT_INDIA_COLLECTION: str = "india_statutes"
    QDRANT_INTERNATIONAL_COLLECTION: str = "international_treaties"
    QDRANT_USER_UPLOADS_COLLECTION: str = "user_uploads"

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

    @field_validator("CHROMA_DB_DIR", "BM25_INDEX_PATH", mode="after")
    @classmethod
    def resolve_paths(cls, v: str) -> str:
        p = Path(v)
        if not p.is_absolute():
            p = (_BASE_DIR / v).resolve()
        return str(p)

    @field_validator("QDRANT_SHADOW_COLLECTION", mode="after")
    @classmethod
    def validate_shadow_collection(cls, v: str) -> str:
        prohibited = {"ragvyn_hybrid_test", "ragvyn_hybrid_test_v2"}
        val_clean = v.strip().lower()
        if val_clean in prohibited or "test" in val_clean:
            raise ValueError(
                f"Prohibited collection: '{v}' is a test collection and cannot be used for production shadow validation. "
                "Production shadow retrieval must target a verified non-test collection."
            )
        return v.strip()

    @field_validator("RETRIEVAL_BACKEND", mode="after")
    @classmethod
    def validate_retrieval_backend(cls, v: str) -> str:
        allowed = {"chroma_bm25", "qdrant_hybrid"}
        val_clean = v.strip().lower()
        if val_clean not in allowed:
            raise ValueError(
                f"Invalid RETRIEVAL_BACKEND: '{v}'. Must be one of: {sorted(allowed)}"
            )
        return val_clean

    @field_validator("QDRANT_PRODUCTION_COLLECTION", mode="after")
    @classmethod
    def validate_production_collection(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("QDRANT_PRODUCTION_COLLECTION must be explicitly configured and non-empty.")
        return v.strip()


    @field_validator("QDRANT_TRAFFIC_PERCENT", mode="after")
    @classmethod
    def validate_canary_traffic_percent(cls, v: int) -> int:
        if not isinstance(v, int) or v < 0 or v > 100:
            raise ValueError(
                f"Invalid QDRANT_TRAFFIC_PERCENT: '{v}'. Must be an integer between 0 and 100."
            )
        return v

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

    @field_validator("LLM_PRIMARY_PROVIDER", "LLM_FALLBACK_PROVIDER", mode="after")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        allowed = {"gemini", "cerebras"}
        val_clean = v.strip().lower()
        if val_clean not in allowed:
            raise ValueError(f"Invalid LLM provider: '{v}'. Must be one of: {sorted(allowed)}")
        return val_clean

    @property
    def is_cerebras_configured(self) -> bool:
        """True if Cerebras API key is set and non-empty."""
        return bool(self.CEREBRAS_API_KEY and self.CEREBRAS_API_KEY.strip())

    @property
    def is_gemini_configured(self) -> bool:
        """True if at least one Gemini API key is configured."""
        return bool(self.GEMINI_API_KEY or self.get_gemini_keys())

    def get_gemini_keys(self) -> List[str]:
        """Return the list of all available Gemini API keys."""
        keys = list(self.GEMINI_API_KEYS) if isinstance(self.GEMINI_API_KEYS, list) else []
        if not keys and self.GEMINI_API_KEY:
            keys.append(self.GEMINI_API_KEY.strip())
        return keys


# Global singleton instance
settings = Settings()
