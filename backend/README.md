# IP-SAKTI Sahayak backend

This backend serves the FastAPI API and the grounded Gemini response pipeline used by the React frontend.

## Run locally

From this `backend` directory:

```text
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Before starting the server, create `backend/.env` with:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
EMBEDDING_MODEL_NAME=BAAI/bge-m3
CHROMA_DB_DIR=./chroma_db_bge_m3
```

Keep `.env` private. It is excluded by `backend/.gitignore`. The API key is loaded only by the backend; do not put it in the React frontend.

Then open:

- Health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

The chat endpoint uses the local ChromaDB corpus first and calls Gemini only when a sufficiently relevant source passage is retrieved. If retrieval confidence is too low, the API intentionally returns a safe abstention instead of calling the model.
