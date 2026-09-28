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

from pydantic import Field, field_validator, model_validator
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
    HF_INFERENCE_PROVIDER: str = "hf-inference"
    HF_EMBEDDING_TIMEOUT: float = 90.0
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

    BM25_INDEX_PATH: str = str(_BASE_DIR / "bm25_index.pkl")

    # API Keys & LLM settings (Multi-Provider Architecture)
    LLM_PRIMARY_PROVIDER: str = "groq"
    LLM_FALLBACK_PROVIDER: str = "groq"

    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    CEREBRAS_API_KEY: str = ""
    CEREBRAS_BASE_URL: str = "https://api.cerebras.ai/v1"
    CEREBRAS_MODEL: str = "gpt-oss-120b"

    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: Union[List[str], str] = []
    GEMINI_MODEL: str = "gemini-3.6-flash"
    PRIMARY_MODEL: str = "openai/gpt-oss-120b"

    GENERATION_MAX_RETRIES: int = 1
    GENERATION_TIMEOUT_SECONDS: float = 30.0

    # Hybrid Search & Reranking Thresholds
    SIMILARITY_THRESHOLD: float = 0.65
    RERANK_SKIP_THRESHOLD: float = 0.25

    # Mode-aware answer length limits (Requirement 4: enhanced for complete answers)
    TOKEN_LIMIT_BRIEF: int = 1500
    TOKEN_LIMIT_STANDARD: int = 4096
    TOKEN_LIMIT_DETAILED: int = 8192

    # Intent Classification & Early Routing (Requirement 5: disabled by default in production)
    INTENT_CLASSIFICATION_ENABLED: bool = False
    INTENT_CLASSIFIER_MODEL: str = "openai/gpt-oss-120b"
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

    # Database URLs (Supabase PostgreSQL)
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres.dvutvnmskqcrvsjtufwm:ShinraBanshouMan2809@"
        "aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
    )

    # Supabase PostgreSQL, Auth & Storage
    SUPABASE_URL: str = "https://dvutvnmskqcrvsjtufwm.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "legal-documents"
    FRONTEND_URL: str = "https://ragvynai.vercel.app"
    TESTING: bool = False
    MOCK_SUPABASE_AUTH: bool = False

    # Additional Qdrant collection names used by specialized features.
    QDRANT_INDIA_COLLECTION: str = "india_statutes"
    QDRANT_INTERNATIONAL_COLLECTION: str = "international_treaties"
    QDRANT_USER_UPLOADS_COLLECTION: str = "user_uploads"

    # CORS
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ragvynai.vercel.app",
        "https://ragvyn.vercel.app",
    ]

    model_config = SettingsConfigDict(
        env_file=tuple(str(p) for p in _ENV_FILE_PATHS if p.exists()) or ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("BM25_INDEX_PATH", mode="after")
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
        val_clean = v.strip().lower()
        if val_clean in {"chroma_bm25", "chroma"}:
            return "qdrant_hybrid"
        if val_clean != "qdrant_hybrid":
            raise ValueError(
                f"Invalid RETRIEVAL_BACKEND: '{v}'. Must be 'qdrant_hybrid'"
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

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]], info) -> List[str]:
        """
        Safely parse ALLOWED_ORIGINS whether passed as JSON array string,
        comma-separated string, single origin string, or List[str].
        """
        default_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://ragvynai.vercel.app",
            "https://ragvyn.vercel.app",
        ]
        if not v:
            return default_origins
        if isinstance(v, str):
            clean_str = v.strip()
            # Handle JSON array format e.g. '["http://localhost:5173", "https://ragvynai.vercel.app"]'
            if clean_str.startswith("[") and clean_str.endswith("]"):
                try:
                    import json
                    parsed = json.loads(clean_str)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            # Handle comma or newline separated strings e.g. 'https://ragvynai.vercel.app,http://localhost:5173'
            origins = [item.strip().strip("'\"") for item in clean_str.replace("\n", ",").split(",") if item.strip()]
            if "*" in origins:
                return ["*"]
            for d in default_origins:
                if d not in origins:
                    origins.append(d)
            return origins
        elif isinstance(v, list):
            origins = [str(item).strip() for item in v if str(item).strip()]
            for d in default_origins:
                if d not in origins:
                    origins.append(d)
            return origins
        return default_origins

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
        allowed = {"groq", "gemini", "cerebras"}
        val_clean = v.strip().lower()
        if val_clean not in allowed:
            raise ValueError(f"Invalid LLM provider: '{v}'. Must be one of: {sorted(allowed)}")
        return val_clean

    @field_validator("HF_INFERENCE_PROVIDER", mode="after")
    @classmethod
    def validate_hf_inference_provider(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if clean != "hf-inference":
            raise ValueError(
                f"Invalid HF_INFERENCE_PROVIDER: '{v}'. Must be exactly 'hf-inference' for Hugging Face free serverless inference."
            )
        return "hf-inference"

    @field_validator("HF_EMBEDDING_MODEL", mode="after")
    @classmethod
    def validate_hf_embedding_model(cls, v: str) -> str:
        clean = (v or "").strip()
        if clean != "BAAI/bge-m3":
            raise ValueError(
                f"Invalid HF_EMBEDDING_MODEL: '{v}'. Dense model must remain 'BAAI/bge-m3'."
            )
        return clean

    @field_validator("EMBEDDING_PROVIDER", mode="after")
    @classmethod
    def validate_embedding_provider(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        allowed = {"hf_inference", "local"}
        if clean not in allowed:
            raise ValueError(
                f"Invalid EMBEDDING_PROVIDER: '{v}'. Allowed providers are: {sorted(allowed)}."
            )
        return clean

    @model_validator(mode="after")
    def validate_production_hf_contract(self) -> Settings:
        env = (self.ENVIRONMENT or "").strip().lower()
        if env == "production":
            if not self.HF_TOKEN or not self.HF_TOKEN.strip():
                raise ValueError("Production environment requires a non-empty HF_TOKEN.")
            if self.HF_EMBEDDING_MODEL != "BAAI/bge-m3":
                raise ValueError("Production requires HF_EMBEDDING_MODEL='BAAI/bge-m3'.")
            if self.HF_INFERENCE_PROVIDER != "hf-inference":
                raise ValueError("Production requires HF_INFERENCE_PROVIDER='hf-inference'.")
        return self

    @property
    def is_groq_configured(self) -> bool:
        """True if Groq API key is set and non-empty."""
        return bool(self.GROQ_API_KEY and self.GROQ_API_KEY.strip())

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
