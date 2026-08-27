from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


# ADDED: Return a transparent placeholder until the verified corpus and RAG pipeline exist.
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Echo the request context so the frontend/backend data flow can be tested safely."""

    jurisdiction_name = "India" if request.jurisdiction == "india" else "International"
    return ChatResponse(
        answer=(
            f"Development response received for the {jurisdiction_name} jurisdiction. "
            "The verified document corpus and citation-grounded RAG pipeline will be "
            "connected in a later milestone."
        ),
        citations=[],
        confidence="unavailable",
        disclaimer="This prototype provides information only, not legal advice.",
        jurisdiction=request.jurisdiction,
        language=request.language,
    )

