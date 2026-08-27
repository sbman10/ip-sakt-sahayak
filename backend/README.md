# IP-SAKTI Sahayak backend

This is the first backend milestone. It provides a safe, non-AI API contract so the React frontend can be tested against a real Python server.

## Run locally

From this `backend` directory:

```text
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open:

- Health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

There is deliberately no database, document corpus, LLM, or RAG logic here yet.

