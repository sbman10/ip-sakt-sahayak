from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.chat import router as chat_router

app = FastAPI(
    title="IP-SAKTI Sahayak API",
    description="Development API for the source-cited Ayurveda IP guidance assistant.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(chat_router)


# ADDED: Provide a cheap endpoint for checking that the backend process is alive.
@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Report backend availability without touching legal data or external services."""

    return {"status": "ok", "service": "ip-sakti-api"}

