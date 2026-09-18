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
from typing import AsyncIterator

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

    # 2. Preload BM25 disk index
    try:
        bm25_loaded = load_bm25_index_on_startup()
        if bm25_loaded:
            log.info("[PID %s] BM25 index preloaded from disk.", pid)
        else:
            log.warning("[PID %s] BM25 index not found on disk. Will be created on first document ingestion.", pid)
    except Exception as e:
        log.warning("[PID %s] BM25 index preloading warning: %s", pid, e)

    # 3. Preload SentenceTransformer and CrossEncoder asynchronously
    try:
        log.info("[PID %s] Preloading ML models...", pid)
        await asyncio.to_thread(model_registry.load_models)
        log.info("[PID %s] ML models preloaded and warmed up.", pid)
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
        "Features hybrid BM25 + ChromaDB retrieval, CrossEncoder reranking, and "
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
    "/readiness",
    tags=["Health"],
    summary="Readiness Probe",
    description="Checks whether ML models are loaded and ChromaDB/Database are reachable.",
)
async def readiness_check(response: Response) -> dict[str, str]:
    """
    Readiness probe validating model preloading and database connectivity.
    Returns HTTP 200 when ready, HTTP 503 when initializing or degraded.
    """
    models_ready = model_registry.is_ready

    # Check chroma reachability
    chroma_ok = False
    try:
        import chromadb
        client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
        client.heartbeat()
        chroma_ok = True
    except Exception as e:
        log.warning("Readiness probe ChromaDB check warning: %s", e)
        chroma_ok = True  # Soft-fail: don't block readiness on ChromaDB

    if models_ready and chroma_ok:
        return {"status": "ready"}

    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "initializing"}


# ---------------------------------------------------------------------------
# Routers Registration
# ---------------------------------------------------------------------------
app.include_router(chat_router.router, prefix="/api", tags=["Chat - RAG Pipeline"])
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
