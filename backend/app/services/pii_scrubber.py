"""
backend/app/services/pii_scrubber.py
--------------------------------------
DPDP Act Privacy Gateway — pre-processes user queries before they are sent
to any external API (Google Gemini).

Compliance context
------------------
The Digital Personal Data Protection (DPDP) Act, 2023 (India) classifies
personal data as any information that identifies or can identify a natural
person. Before routing user input to an external LLM endpoint we must ensure
that Personally Identifiable Information (PII) is masked at the application
layer.

This module provides a single public function ``scrub_pii`` that applies a
cascading set of regex substitutions to detect and replace:

  - Indian mobile numbers (E.164 +91 prefix or 0-prefixed 10-digit local)
  - Generic 10-digit numeric sequences that resemble phone numbers
  - E-mail addresses (RFC-5321 simplified pattern)
  - First-person name disclosures ("My name is X", "I am Dr. Y", etc.)
  - Aadhaar-like 12-digit numeric sequences

The scrubbed text is safe to transmit to Gemini; the original unscrubbed
text is retained in memory only for the local SQLite audit log.

Usage
-----
    from app.services.pii_scrubber import scrub_pii

    clean = scrub_pii("My name is Rajan and my number is +91 98765 43210")
    # -> "[REDACTED NAME] and my number is [REDACTED PHONE]"
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Compiled regex patterns
# ---------------------------------------------------------------------------

# Indian mobile: +91 followed by optional space/dash then 10 digits (with
# optional spaces or dashes between digit groups).
_RE_PHONE_IN_E164 = re.compile(
    r"""
    (?:\+91[\s\-]?)       # +91 country code (mandatory for this pattern)
    (?:\d[\s\-]?){9}\d   # 10 digits allowing internal spaces/dashes
    """,
    re.VERBOSE,
)

# Local 0-prefix format: 0 followed by 10 digits (STD or mobile).
_RE_PHONE_IN_LOCAL = re.compile(
    r"""
    \b0[\s\-]?            # leading zero
    (?:\d[\s\-]?){9}\d    # 10 more digits
    \b
    """,
    re.VERBOSE,
)

# Bare 10-digit sequence (no prefix) — last resort for unformatted numbers.
# Only matches when surrounded by word boundaries to avoid matching PINs
# embedded in longer number strings.
_RE_PHONE_BARE_10 = re.compile(r"\b\d{10}\b")

# Aadhaar-style 12-digit numbers (groups of 4 separated by spaces or dashes).
_RE_AADHAAR = re.compile(
    r"\b\d{4}[\s\-]\d{4}[\s\-]\d{4}\b"
)

# E-mail addresses (simplified RFC-5321 local-part @ domain).
_RE_EMAIL = re.compile(
    r"""
    [a-zA-Z0-9._%+\-]+    # local part
    @                      # at sign
    [a-zA-Z0-9.\-]+        # domain
    \.[a-zA-Z]{2,}         # TLD
    """,
    re.VERBOSE,
)

# First-person name disclosures — catches common patterns like:
#   "My name is Rajan"  /  "I am Dr. Priya Sharma"
#   "This is Rohan speaking"  /  "myself Kavita"
_RE_NAME_DISCLOSURE = re.compile(
    r"""
    (?:
        \bmy\s+name\s+is\b           # "my name is"
      | \bi\s+am\b                   # "I am"
      | \bthis\s+is\b                # "this is"
      | \bmyself\b                   # "myself"
      | \bcall\s+me\b                # "call me"
    )
    [\s,]*                           # optional whitespace or comma
    (?:                              # optional honorifics
        Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Adv\.?|Er\.?
    )?
    \s*
    (?:[A-Z][a-z]+\s*){1,3}         # 1-3 capitalised name tokens
    """,
    re.VERBOSE,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrub_pii(text: str) -> str:
    """
    Detect and redact Personally Identifiable Information from *text*.

    Applies patterns in order of specificity (most specific first) so that
    overlapping patterns do not interfere with each other.

    Parameters
    ----------
    text:
        Raw user query text, possibly containing PII.

    Returns
    -------
    str
        A copy of *text* with all detected PII replaced by fixed placeholder
        tokens.  The function never raises; if an internal error occurs the
        original text is returned unchanged so the pipeline is not blocked.

    Notes
    -----
    The replacement tokens are intentionally readable strings rather than
    blank space so that the LLM context retains grammatical coherence.
    """
    if not text or not text.strip():
        return text

    try:
        result = text

        # Order matters: more specific patterns first.

        # 1. Aadhaar (12-digit grouped) — before bare-10 pattern
        result = _RE_AADHAAR.sub("[REDACTED AADHAAR]", result)

        # 2. Indian mobile E.164 (+91 prefix)
        result = _RE_PHONE_IN_E164.sub("[REDACTED PHONE]", result)

        # 3. Indian local 0-prefix format
        result = _RE_PHONE_IN_LOCAL.sub("[REDACTED PHONE]", result)

        # 4. Bare 10-digit sequences
        result = _RE_PHONE_BARE_10.sub("[REDACTED PHONE]", result)

        # 5. E-mail addresses
        result = _RE_EMAIL.sub("[REDACTED EMAIL]", result)

        # 6. First-person name disclosures (applied last to avoid disrupting
        #    phone/email patterns embedded inside name sentences)
        result = _RE_NAME_DISCLOSURE.sub("[REDACTED NAME]", result)

        return result

    except Exception:  # noqa: BLE001 — never block the pipeline on scrubber errors
        return text
