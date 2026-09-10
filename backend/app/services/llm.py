"""
backend/app/services/llm.py
----------------------------
Secure interface to Google Gemini for IP-SAKTI Sahayak.

SDK: google-genai (new, replaces deprecated google-generativeai)
Model: configured with GEMINI_MODEL; defaults to gemini-2.5-flash

Responsibilities
----------------
- Load the GEMINI_API_KEY from backend/.env via python-dotenv.
- Hold a singleton google.genai Client (thread-safe, stateless per call).
- Expose generate_grounded_answer() (primary) and generate_answer() (alias).

Environment
-----------
backend/.env must contain:
    GEMINI_API_KEY=<your-key>
Optional:
    GEMINI_MODEL=gemini-2.5-flash

Dependencies
------------
    pip install google-genai python-dotenv
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Third-party imports
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("ERROR: python-dotenv not installed. Run: pip install python-dotenv")

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    sys.exit(
        "ERROR: google-genai not installed. Run: pip install google-genai"
    )

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------
#   __file__  = backend/app/services/llm.py  ->  backend/ is 3 levels up
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not _API_KEY:
    raise EnvironmentError(
        f"GEMINI_API_KEY is not set. Add it to {_ENV_PATH} or your shell environment."
    )

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
if not _MODEL_NAME:
    _MODEL_NAME = "gemini-2.5-flash"

_SYSTEM_PROMPT = (
    "You are IP-SAKTI Sahayak, an authoritative legal guide for Ayurvedic "
    "Intellectual Property. "
    "You must answer the user question using ONLY the retrieved source passages provided below.\n\n"
    "Rules you MUST follow at all times:\n"
    "- If the retrieved context contains the answer, explain it in simple, direct language "
    "and mention the exact legal acts, schedules, or treaties retrieved.\n"
    "- If the retrieved context is missing information, does not match, or does not provide "
    "enough evidence to answer reliably, state clearly and humbly: "
    "'I cannot find an authoritative source in our legal registers to safely answer this.'\n"
    "- Do NOT make up statutory sections, acts, rules, or case references. Never hallucinate.\n"
    "- Keep your tone professional, calm, and trustworthy.\n"
    "- Do NOT speculate beyond the provided passages.\n"
    "- If a concept appears in multiple passages, synthesise them coherently."
)

# ---------------------------------------------------------------------------
# Singleton client (initialised once at module load)
# ---------------------------------------------------------------------------
def _init_client() -> genai.Client:
    client = genai.Client(api_key=_API_KEY)
    log.info("google-genai Client initialised. Model: %s", _MODEL_NAME)
    return client

_CLIENT: genai.Client = _init_client()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_grounded_answer(question: str, context_chunks: list[str]) -> str:
    """
    Query Gemini with a grounded prompt and return the answer text.

    Parameters
    ----------
    question:
        The user original legal question (already validated by the schema).
    context_chunks:
        Ordered list of top-ranked text passages from ChromaDB (top 3).

    Returns
    -------
    str
        Clean text response from Gemini.

    Raises
    ------
    RuntimeError
        If the Gemini API call fails. The caller catches this and returns 500.
    """
    if not context_chunks:
        log.warning("generate_grounded_answer called with no context chunks.")
        return (
            "I cannot find an authoritative source in our verified legal registers "
            "to answer this safely."
        )

    passages_block = "\n\n".join(
        f"[Passage {i + 1}]\n{chunk.strip()}"
        for i, chunk in enumerate(context_chunks)
    )

    user_prompt = (
        "--- RETRIEVED LEGAL PASSAGES ---\n"
        f"{passages_block}\n"
        "--- END OF PASSAGES ---\n\n"
        f"User Question: {question}\n\n"
        "Please answer the question based ONLY on the passages above."
    )

    log.debug("Sending prompt to Gemini (%d chars, %d passages).", len(user_prompt), len(context_chunks))

    try:
        response = _CLIENT.models.generate_content(
            model=_MODEL_NAME,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.1,
                top_p=0.95,
                max_output_tokens=1024,
            ),
        )
        answer_text: str = response.text.strip()
        log.info("Gemini responded (%d chars).", len(answer_text))
        return answer_text

    except Exception as exc:  # noqa: BLE001
        log.error("Gemini API call failed: %s", exc, exc_info=True)
        raise RuntimeError(f"Failed to get a response from the Gemini API: {exc}") from exc


# Backward-compatible alias
generate_answer = generate_grounded_answer
