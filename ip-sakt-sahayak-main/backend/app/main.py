"""
backend/app/main.py
--------------------
FastAPI application entry point for IP-SAKTI Sahayak.
Implements modern lifespan context management, preloading of heavy ML models,
BM25 index initialization, liveness and readiness probes, CORS middleware,
global exception handling, and API router registration.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
import traceback
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

# UPDATED: Disable huggingface_hub symlink warning on Windows environments
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.core.config import settings
from app.core.models import model_registry
from app.models.database import engine, init_db
from app.models import matters as _matters_models  # noqa: F401  (register tables)

# Ensure AuditLog table is registered with Base.metadata
from app.models.db import Base as AuditBase, AuditLog  # noqa: F401

# BM25 preloading
from app.services.bm25_service import load_bm25_index_on_startup

# Routers
from app.routers import (
    analytics as analytics_router,
    auth as auth_router,
    chat as chat_router,
    checklists as checklists_router,
    classify as classify_router,
    conversations as conversations_router,
    documents as documents_router,
    drafts as drafts_router,
    experts as experts_router,
    matters as matters_router,
    subscription as subscription_router,
    uploads as uploads_router,
    verdict as verdict_router,
    roadmap as roadmap_router,
    guardian as guardian_router,
    patentability as patentability_router,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("app.main")


# ---------------------------------------------------------------------------
# Lifespan Event Management
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    #Used try block here
    # try:
    #     logger.info("Warming up sparse embedder...")

    #     sparse_embedder.embed_query("warmup")

    #     logger.info("Sparse embedder warm-up complete")

    # except Exception as exc:
    #     logger.warning(
    #         "Sparse embedder warm-up failed: %s",
    #         exc,
    #     )

    # yield
    """
    Application lifespan context manager:
    - Startup: initializes database tables, preloads BM25 index,
      and preloads heavy ML models in worker thread.
    - Shutdown: cleans up model references and closes database connection pools.
    """
    pid = os.getpid()
    log.info("[PID %s] Starting %s in %s mode...", pid, settings.PROJECT_NAME, settings.ENVIRONMENT)

    # 1. Initialize SQLAlchemy database schema (both database.py and db.py bases)
    try:
        init_db()
        AuditBase.metadata.create_all(bind=engine)
        log.info("[PID %s] Database tables initialized successfully.", pid)
    except Exception as e:
        log.error("[PID %s] Database initialization error: %s", pid, e, exc_info=True)

    # 2. Rebuild the legacy in-process BM25 index only when the legacy
    # Chroma/BM25 backend is active. Qdrant-native hybrid retrieval already
    # performs sparse BM25 search inside Qdrant and must not make extra
    # startup calls to the old separate collections.
    if settings.RETRIEVAL_BACKEND == "chroma_bm25":
        try:
            bm25_loaded = load_bm25_index_on_startup()
            if bm25_loaded:
                log.info("[PID %s] In-memory BM25 index reconstructed successfully from Qdrant.", pid)
            else:
                log.warning("[PID %s] BM25 index empty at startup. Chunks will be indexed as documents are added.", pid)
        except Exception as e:
            log.warning("[PID %s] BM25 index reconstruction warning: %s", pid, e)
    else:
        log.info("[PID %s] Skipping legacy BM25 rebuild; Qdrant native sparse retrieval is active.", pid)

    # 3. Preload SentenceTransformer and CrossEncoder asynchronously
    try:
        log.info("[PID %s] Preloading ML models...", pid)
        await asyncio.to_thread(
            model_registry.load_models,
            settings.EMBEDDING_MODEL_NAME,
        )
        # 4. Preload and warm up FastEmbed sparse BM25 tokenizer
        try:
            from app.services.sparse_embedding_service import sparse_embedder
            await asyncio.to_thread(sparse_embedder.embed_query, "Ayurvedic patent inquiry")
            log.info("[PID %s] FastEmbed BM25 sparse tokenizer preloaded and warmed up.", pid)
        except Exception as e:
            log.warning("[PID %s] FastEmbed BM25 warmup note: %s", pid, e)
    except Exception as e:
        log.error("[PID %s] Failed model preloading during startup: %s", pid, e, exc_info=True)

    log.info("[PID %s] Startup sequence completed. Application ready to accept requests.", pid)
    log.info("Swagger UI:  http://127.0.0.1:8000/docs")
    log.info("ReDoc:       http://127.0.0.1:8000/redoc")
    log.info("Liveness:    http://127.0.0.1:8000/health")
    log.info("Readiness:   http://127.0.0.1:8000/readiness")

    yield

    # Shutdown sequence
    log.info("[PID %s] Initiating graceful shutdown...", pid)
    try:
        model_registry.unload_models()
    except Exception as e:
        log.warning("[PID %s] Error during model unloading: %s", pid, e)

    try:
        engine.dispose()
        log.info("[PID %s] Database connection pool disposed.", pid)
    except Exception as e:
        log.warning("[PID %s] Error disposing database engine: %s", pid, e)

    log.info("[PID %s] Application shutdown complete.", pid)


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=f"{settings.PROJECT_NAME} Backend API",
    description=(
        "Ayurvedic Intellectual Property Assistant - a high-performance RAG-powered legal Q&A backend "
        "supporting Ministry of AYUSH Problem Statement 26045. "
        "Features Qdrant hybrid retrieval with a safe Chroma/BM25 fallback and "
        "Gemini grounded citations with composite confidence scoring."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "IP-SAKTI Sahayak Team",
        "url": "https://github.com/sbman10/ip-sakt-sahayak",
    },
    license_info={
        "name": "Ministry of AYUSH - Problem Statement 26045",
    },
)

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)
log.info("CORS configured for origins: %s", settings.ALLOWED_ORIGINS)


# ---------------------------------------------------------------------------
# Global Exception Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catches all unhandled exceptions and returns structured JSON error payloads
    instead of crashing with unformatted 500 errors.
    """
    log.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if settings.ENVIRONMENT == "development" else "An unexpected error occurred.",
            "path": str(request.url.path),
            "disclaimer": "This is an informational prototype, not formal legal advice.",
        },
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "Not Found",
            "detail": f"Endpoint {request.url.path} does not exist.",
            "path": str(request.url.path),
        },
    )


@app.exception_handler(422)
async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": str(exc),
            "path": str(request.url.path),
        },
    )


# ---------------------------------------------------------------------------
# Static Assets & Health & Readiness Probes
# ---------------------------------------------------------------------------
_FAVICON_PATH = Path(__file__).resolve().parents[2] / "frontend" / "public" / "favicon.svg"


@app.get("/", tags=["Health"], summary="Service status")
def service_status() -> dict[str, Any]:
    """Human-friendly status endpoint; the API is not a frontend host."""
    return {
        "service": settings.PROJECT_NAME,
        "status": "alive",
        "retrieval_backend": settings.RETRIEVAL_BACKEND,
        "qdrant_collection": settings.QDRANT_PRODUCTION_COLLECTION,
        "docs": "/docs",
        "health": "/health",
        "readiness": "/readiness",
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    """Serve the application favicon or return 204 to prevent browser 404 logs."""
    if _FAVICON_PATH.exists():
        return FileResponse(_FAVICON_PATH, media_type="image/svg+xml")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness Probe",
    description="Returns HTTP 200 with status 'alive' immediately without dependency queries.",
)
def health_check() -> dict[str, str]:
    """Lightweight instant liveness probe."""
    return {"status": "alive"}


@app.get(
    "/api/health/llm",
    tags=["Health"],
    summary="Safe LLM Provider Diagnostics",
    description="Reports configured primary/fallback providers, availability, and model names without exposing keys.",
)
def llm_health_check() -> dict[str, Any]:
    from app.services.llm import get_llm_diagnostics
    return get_llm_diagnostics()


@app.get("/health/llm", include_in_schema=False)
def llm_health_check_alias() -> dict[str, Any]:
    from app.services.llm import get_llm_diagnostics
    return get_llm_diagnostics()


@app.get(
    "/readiness",
    tags=["Health"],
    summary="Readiness Probe",
    description="Configuration-aware readiness probe for active backend and retrieval topology.",
)
async def readiness_check(response: Response) -> dict[str, Any]:
    """
    Readiness probe validating only the subsystems required for the active configuration.
    For default chroma_bm25 startup:
      - Validates database connectivity
      - Validates HF dense embedding configuration (without preloading local model)
      - Validates ChromaDB & BM25 index
      - Does NOT require local BGE-M3 model object, CrossEncoder model object, or Qdrant Cloud.
    For Qdrant canary or qdrant_hybrid startup:
      - Additionally validates Qdrant URL and API key
      - Validates the configured production collection exists, has the hybrid schema, and is green.
    """
    checks: dict[str, Any] = {}
    is_ready = True

    # 1. Database connectivity
    db_ok = False
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        log.warning("Readiness probe database check warning: %s", e)
        db_ok = False
    checks["database"] = db_ok
    if not db_ok:
        is_ready = False

    # 2. Dense embeddings configuration
    hf_configured = bool(settings.HF_TOKEN and settings.HF_EMBEDDING_MODEL)
    checks["hf_embedding_configured"] = hf_configured
    if not hf_configured:
        is_ready = False

    if settings.ENABLE_LOCAL_BGE_PRELOAD:
        local_bge_ok = bool(model_registry._embedding_model is not None)
        checks["local_bge_m3"] = local_bge_ok
        if not local_bge_ok:
            is_ready = False
    else:
        checks["local_bge_m3"] = "disabled"

    # 3. CrossEncoder reranker
    if settings.ENABLE_CROSS_ENCODER:
        ce_ok = bool(model_registry._reranker_model is not None)
        checks["cross_encoder"] = ce_ok
        if not ce_ok:
            is_ready = False
    else:
        checks["cross_encoder"] = "disabled"

    # 4. Retrieval Subsystem Readiness
    is_canary = settings.QDRANT_CANARY_ENABLED and settings.QDRANT_TRAFFIC_PERCENT > 0
    is_qdrant_active = (settings.RETRIEVAL_BACKEND == "qdrant_hybrid") or is_canary

    if is_qdrant_active:
        # Active Qdrant or Canary mode: must verify Qdrant config and collection status
        qdrant_configured = bool(settings.QDRANT_URL and settings.QDRANT_API_KEY)
        checks["qdrant_configured"] = qdrant_configured
        if not qdrant_configured:
            is_ready = False
            checks["qdrant_collection"] = False
        else:
            try:
                from app.services.qdrant_hybrid_store import qdrant_hybrid_store
                col_name = settings.QDRANT_PRODUCTION_COLLECTION
                schema = qdrant_hybrid_store.verify_collection_schema(col_name)
                q_status = {
                    "exists": True,
                    "green": str(schema.get("status", "")).lower() == "green",
                    "schema_valid": bool(schema.get("is_compatible")),
                    "points_count": schema.get("points_count"),
                    "collection": col_name,
                }
                checks["qdrant_collection"] = q_status
                if not (q_status["exists"] and q_status["green"] and q_status["schema_valid"]):
                    is_ready = False
            except Exception as e:
                log.warning("Readiness probe Qdrant verification failed: %s", e)
                checks["qdrant_collection"] = {"exists": False, "green": False, "error": str(e)}
                is_ready = False
    else:
        # Default startup (chroma_bm25, canary disabled)
        # Does NOT require Qdrant production retrieval
        checks["qdrant"] = "not_required"
        chroma_ok = False
        try:
            import chromadb
            client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
            client.heartbeat()
            chroma_ok = True
        except Exception as e:
            log.warning("Readiness probe ChromaDB check warning: %s", e)
            chroma_ok = False
        checks["chroma_bm25"] = chroma_ok
        if not chroma_ok:
            is_ready = False

    # 5. LLM Provider Topology
    from app.services.llm import get_llm_diagnostics
    llm_diag = get_llm_diagnostics()
    checks["llm_providers"] = llm_diag
    # If neither provider is available, mark readiness as not ready
    if not (llm_diag["cerebras_key_present"] or llm_diag["gemini_key_present"]):
        checks["llm_configured"] = False
    else:
        checks["llm_configured"] = True

    if is_ready:
        return {
            "status": "ready",
            "backend": settings.RETRIEVAL_BACKEND,
            "canary_enabled": settings.QDRANT_CANARY_ENABLED,
            "checks": checks,
        }

    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "degraded",
        "backend": settings.RETRIEVAL_BACKEND,
        "canary_enabled": settings.QDRANT_CANARY_ENABLED,
        "checks": checks,
    }



# ---------------------------------------------------------------------------
# Routers Registration
# ---------------------------------------------------------------------------
app.include_router(chat_router.router, prefix="/api", tags=["Chat - RAG Pipeline"])
app.include_router(patentability_router.router, prefix="/api", tags=["Patentability & Prior-Art Assessment"])
app.include_router(verdict_router.router, prefix="/api", tags=["Verdict Engine - Biopiracy Shield"])
app.include_router(roadmap_router.router, prefix="/api", tags=["IP Journey Roadmap"])
app.include_router(guardian_router.router, prefix="/api", tags=["Dual-Use Guardian"])
app.include_router(classify_router.router, prefix="/api", tags=["Classify - Formulation Wizard"])
app.include_router(conversations_router.router, prefix="/api", tags=["Conversations & Sessions"])
app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(uploads_router.router, prefix="/api", tags=["Document Uploads"])
app.include_router(documents_router.router, prefix="/api/documents", tags=["Documents - RAG Ingestion"])
app.include_router(matters_router.router, prefix="/api", tags=["Matter Workspace"])
app.include_router(drafts_router.router, prefix="/api", tags=["Drafts - Document Generation"])
app.include_router(checklists_router.router, tags=["Checklists - Filing Process"])
app.include_router(experts_router.router, tags=["Experts - Consultation"])
app.include_router(analytics_router.router, tags=["Analytics Dashboard"])
app.include_router(subscription_router.router, tags=["Subscription & Pricing"])
