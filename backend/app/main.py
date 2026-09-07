# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# ADDED: Allow your local React app (running on Vite port 5173) to communicate with FastAPI [5, 6]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the strict contract structure React MUST send [2, 6]
class ChatRequest(BaseModel):
    question: str
    jurisdiction: str  # "India" or "International"
    language: str      # "EN", "HI", etc.

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest):
    # This is our mock Phase 1.1 baseline response contract [2]
    # In Phase 3, this will return real AI-grounded answers [12]
    return {
        "answer": f"Backend connected! You asked about: '{payload.question}' under {payload.jurisdiction} jurisdiction.",
        "citations": [
            {
                "source": "Patents Act, 1970",
                "section": "Section 3(p)",
                "text": "Traditional knowledge exceptions."
            }
        ],
        "confidence": "high",
        "disclaimer": "This is an informational prototype, not formal legal advice."
    }