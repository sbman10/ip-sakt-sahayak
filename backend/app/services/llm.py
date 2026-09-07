"""
backend/app/services/llm.py
----------------------------
Secure interface to Google Gemini 1.5 Flash for IP-SAKTI Sahayak.

Responsibilities
----------------
- Load the GEMINI_API_KEY from the local .env file via python-dotenv.
- Hold a singleton Gemini GenerativeModel instance (thread-safe for
  concurrent FastAPI requests because google-generativeai is stateless
  at the model-object level).
- Expose a single public function ``generate_answer`` that accepts a
  user question and a list of pre-ranked context chunks, then returns
  the model's grounded text response.

Environment
-----------
Create ``backend/.env`` with::

    GEMINI_API_KEY=<your-key>

Dependencies
------------
    pip install google-generativeai python-dotenv
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Third-party imports with friendly startup errors
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("ERROR: python-dotenv is not installed. Run:  pip install python-dotenv")

try:
    import google.generativeai as genai
    from google.generativeai.types import GenerationConfig
except ImportError:
    sys.exit(
        "ERROR: google-generativeai is not installed. "
        "Run:  pip install google-generativeai"
    )

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------
# Walk upward from this file to find the .env in the backend/ directory,
# so the service works regardless of which directory the server is launched from.
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not _API_KEY:
    raise EnvironmentError(
        f"GEMINI_API_KEY is not set. "
        f"Add it to {_ENV_PATH} or to your shell environment."
    )

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
_MODEL_NAME = "gemini-1.5-flash"

_SYSTEM_PROMPT = """\
You are IP-SAKTI Sahayak, an authoritative legal guide for Ayurvedic Intellectual Property.
You must answer the user's question using ONLY the retrieved source passages provided below.

Rules you MUST follow at all times:
- If the retrieved context contains the answer, explain it in simple, clear language and \
list the exact sections and sources you are drawing from.
- If the retrieved context is missing information, does not match, or does not provide \
enough evidence to answer reliably, state clearly and humbly: \
"I cannot find an authoritative source in our legal registers to safely answer this."
- Do NOT make up statutory sections, acts, rules, or case references. Never hallucinate.
- Keep your tone professional, calm, and trustworthy.
- Do NOT speculate beyond the provided passages.
- If a concept appears in multiple passages, synthesise them coherently.
"""

_GENERATION_CONFIG = GenerationConfig(
    temperature=0.1,      # near-deterministic for legal Q&A
    top_p=0.95,
    top_k=40,
    max_output_tokens=1024,
)

# ---------------------------------------------------------------------------
# Singleton model initialisation
# ---------------------------------------------------------------------------
def _initialise_model() -> genai.GenerativeModel:
    """
    Configure the Gemini SDK and return a GenerativeModel instance.

    Called once at module load time. The returned object is stateless
    and safe to share across concurrent requests.
    """
    genai.configure(api_key=_API_KEY)
    model = genai.GenerativeModel(
        model_name=_MODEL_NAME,
        system_instruction=_SYSTEM_PROMPT,
        generation_config=_GENERATION_CONFIG,
    )
    log.info("Gemini model '%s' initialised successfully.", _MODEL_NAME)
    return model


_MODEL: genai.GenerativeModel = _initialise_model()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_answer(question: str, context_chunks: list[str]) -> str:
    """
    Query Gemini 1.5 Flash with a grounded prompt and return the answer text.

    The retrieved context chunks are embedded verbatim inside the prompt so
    Gemini has no licence to invent information not present in the passages.

    Parameters
    ----------
    question:
        The user's original legal question (already validated by the schema).
    context_chunks:
        Ordered list of top-ranked text passages retrieved from ChromaDB.
        Typically the top 3 chunks after re-ranking.

    Returns
    -------
    str
        The raw text response from Gemini.

    Raises
    ------
    RuntimeError
        If the Gemini API call fails (network error, quota exceeded, etc.).
        The caller should catch this and return a graceful API error response.
    """
    if not context_chunks:
        log.warning("generate_answer called with no context chunks — abstaining.")
        return (
            "I cannot find an authoritative source in our verified legal registers "
            "to answer this safely."
        )

    # Build the numbered passage block
    passages_block = "\n\n".join(
        f"[Passage {i + 1}]\n{chunk.strip()}"
        for i, chunk in enumerate(context_chunks)
    )

    user_prompt = (
        f"--- RETRIEVED LEGAL PASSAGES ---\n"
        f"{passages_block}\n"
        f"--- END OF PASSAGES ---\n\n"
        f"User Question: {question}\n\n"
        f"Please answer the question based ONLY on the passages above."
    )

    log.debug(
        "Sending prompt to Gemini (%d chars, %d passages).",
        len(user_prompt),
        len(context_chunks),
    )

    try:
        response = _MODEL.generate_content(user_prompt)
        answer_text: str = response.text.strip()
        log.info(
            "Gemini responded successfully (%d chars).", len(answer_text)
        )
        return answer_text

    except Exception as exc:  # noqa: BLE001
        log.error("Gemini API call failed: %s", exc, exc_info=True)
        raise RuntimeError(
            f"Failed to get a response from the Gemini API: {exc}"
        ) from exc
