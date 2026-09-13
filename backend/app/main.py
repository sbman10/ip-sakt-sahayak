"""
backend/app/main.py
--------------------
FastAPI application entry point for IP-SAKTI Sahayak.

Startup sequence
----------------
1.  Create the FastAPI app with full OpenAPI metadata.
2.  Register CORSMiddleware to allow the React Vite dev server (port 5173).
3.  Mount the /api router for chat (POST /api/chat).
4.  Mount the /api router for classification (POST /api/classify).
5.  Expose GET /health liveness probe.

Running the server
------------------
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat as chat_router
from app.routers import classify as classify_router
from app.routers import conversations as conversations_router
from app.routers import auth as auth_router
from app.routers import uploads as uploads_router
from app.routers import documents as documents_router
from app.routers import matters as matters_router
from app.routers import drafts as drafts_router
from app.routers import checklists as checklists_router
from app.routers import experts as experts_router
from app.routers import analytics as analytics_router
from app.routers import subscription as subscription_router
from app.models.database import init_db
from app.models import matters as _matters_models  # noqa: F401  (register tables)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="IP-SAKTI Sahayak Backend API",
    description=(
        "Ayurvedic Intellectual Property Assistant — a RAG-powered legal Q&A backend "
        "supporting Ministry of AYUSH Problem Statement 26045. "
        "Uses ChromaDB vector search, SentenceTransformers (local), and "
        "Google Gemini 1.5 Flash for grounded, citation-backed answers. "
        "DPDP Act compliant: all queries are PII-scrubbed before external API calls "
        "and audit-logged to a local SQLite database."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "IP-SAKTI Sahayak Team",
        "url": "https://github.com/sbman10/ip-sakt-sahayak",
    },
    license_info={
        "name": "Ministry of AYUSH — Problem Statement 26045",
    },
)

# ---------------------------------------------------------------------------
# CORS — allow the React Vite development server on port 5173
# ---------------------------------------------------------------------------
_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

log.info("CORS configured for origins: %s", _ALLOWED_ORIGINS)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(
    chat_router.router,
    prefix="/api",
    tags=["Chat — RAG Pipeline"],
)

app.include_router(
    classify_router.router,
    prefix="/api",
    tags=["Classify — Formulation Wizard"],
)

app.include_router(
    conversations_router.router,
    prefix="/api",
    tags=["Conversations & Sessions"],
)

app.include_router(
    auth_router.router,
    prefix="/api/auth",
    tags=["Authentication"],
)

app.include_router(
    uploads_router.router,
    prefix="/api",
    tags=["Document Uploads"],
)

app.include_router(
    documents_router.router,
    prefix="/api/documents",
    tags=["Documents — RAG Ingestion"],
)

app.include_router(
    matters_router.router,
    prefix="/api",
    tags=["Matter Workspace"],
)

app.include_router(
    drafts_router.router,
    prefix="/api",
    tags=["Drafts — Document Generation"],
)

app.include_router(
    checklists_router.router,
    tags=["Checklists — Filing Process"],
)

app.include_router(
    experts_router.router,
    tags=["Experts — Consultation"],
)

app.include_router(
    analytics_router.router,
    tags=["Analytics Dashboard"],
)

app.include_router(
    subscription_router.router,
    tags=["Subscription & Pricing"],
)

# ---------------------------------------------------------------------------
# Liveness / readiness probe
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
    description="Returns HTTP 200 with {status: ok} when the server is running.",
)
def health_check() -> dict[str, str]:
    """Lightweight health-check endpoint — no heavy dependencies queried."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Startup / shutdown event logging
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup() -> None:
    """Log startup confirmation so the operator knows the app is live."""
    init_db()  # Initialize SQLAlchemy tables
    log.info("IP-SAKTI Sahayak API started successfully.")
    log.info("Database initialized: ip_sakti.db")
    log.info("Swagger UI available at:  http://127.0.0.1:8000/docs")
    log.info("ReDoc available at:       http://127.0.0.1:8000/redoc")
    log.info("Health check at:          http://127.0.0.1:8000/health")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Log graceful shutdown."""
    log.info("IP-SAKTI Sahayak API shutting down gracefully.")
