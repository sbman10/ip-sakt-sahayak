from typing import Literal

from pydantic import BaseModel, Field


# ADDED: Request shape keeps jurisdiction and language attached to every future retrieval request.
class ChatRequest(BaseModel):
    """Validate the user question before any future legal retrieval work."""

    question: str = Field(min_length=1, max_length=4000)
    jurisdiction: Literal["india", "international"] = "india"
    language: Literal["en", "hi", "kn", "bn", "ta", "te"] = "en"


# ADDED: Response shape gives the UI stable fields for answers, evidence and safety messaging.
class Citation(BaseModel):
    """Represent one source card without claiming that a source was retrieved yet."""

    title: str
    url: str


# ADDED: Stable chat response contract allows retrieval and LLM layers to be added later.
class ChatResponse(BaseModel):
    """Return an honest development response with the fields the final UI needs."""

    answer: str
    citations: list[Citation] = []
    confidence: Literal["high", "medium", "low", "unavailable"] = "unavailable"
    disclaimer: str
    jurisdiction: Literal["india", "international"]
    language: Literal["en", "hi", "kn", "bn", "ta", "te"]

