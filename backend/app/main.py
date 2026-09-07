"""
backend/app/main.py
--------------------
FastAPI application entry point for IP-SAKTI Sahayak.

Startup sequence
----------------
1.  Create the FastAPI app with metadata for Swagger UI.
2.  Register CORSMiddleware to allow the React Vite dev server (port 5173).
3.  Mount the /api router (which includes /api/chat).
4.  Expose a GET /health liveness probe.

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
    title="IP-SAKTI Sahayak API",
    description=(
        "Ayurvedic Intellectual Property Assistant — a RAG-powered legal Q&A backend "
        "using ChromaDB, SentenceTransformers, and Google Gemini 1.5 Flash."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

log.info("CORS configured for origins: %s", _ALLOWED_ORIGINS)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(
    chat_router.router,
    prefix="/api",
    tags=["Chat"],
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
    log.info("IP-SAKTI Sahayak API started successfully.")
    log.info("Interactive docs available at:  http://127.0.0.1:8000/docs")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Log graceful shutdown."""
    log.info("IP-SAKTI Sahayak API shutting down.")