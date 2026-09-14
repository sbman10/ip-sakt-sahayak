"""
backend/app/services/pii_scrubber.py
--------------------------------------
DPDP Act Privacy Gateway -- pre-processes user queries before they are sent
to any external API (Google Gemini).

Compliance context
------------------
The Digital Personal Data Protection (DPDP) Act, 2023 (India) classifies
personal data as any information that identifies or can identify a natural
person. Before routing user input to an external LLM endpoint we must ensure
that Personally Identifiable Information (PII) is masked at the application
layer.

This module provides:
  - ``PIIScrubber`` class with individual scrubbing methods
  - ``scrub_pii`` convenience function (backward-compatible public API)

PII categories handled:
  - Indian mobile numbers (E.164 +91 prefix or 0-prefixed 10-digit local)
  - Generic 10-digit numeric sequences that resemble phone numbers
  - E-mail addresses (RFC-5321 simplified pattern)
  - First-person name disclosures ("My name is X", "I am Dr. Y", etc.)
  - Aadhaar-like 12-digit numeric sequences

Usage
-----
    from app.services.pii_scrubber import scrub_pii, pii_scrubber

    clean = scrub_pii("My name is Rajan and my number is +91 98765 43210")
    # -> "[REDACTED NAME] and my number is [REDACTED PHONE]"

    # Or via class instance:
    clean = pii_scrubber.scrub_query("Email me at rajan@example.com")
    # -> "Email me at [REDACTED EMAIL]"
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
    re.VERBOSE | re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# PIIScrubber Class (Prompt 19 specification)
# ---------------------------------------------------------------------------

class PIIScrubber:
    """
    DPDP-compliant PII scrubbing engine with individual, composable
    scrubbing methods for phone numbers, emails, identities, and Aadhaar.

    Each scrubbing method can be called individually for targeted redaction,
    or use ``scrub_query()`` for full cascading sanitization.
    """

    def scrub_phone_numbers(self, text: str) -> str:
        """
        Detects and replaces Indian phone formats (+91, 0-prefix 10-digit
        numbers, and bare 10-digit sequences) with [REDACTED PHONE].

        >>> PIIScrubber().scrub_phone_numbers("Call +91 98765 43210")
        'Call [REDACTED PHONE]'

        >>> PIIScrubber().scrub_phone_numbers("Dial 09876543210 now")
        'Dial [REDACTED PHONE] now'
        """
        if not text:
            return text
        result = _RE_PHONE_IN_E164.sub("[REDACTED PHONE]", text)
        result = _RE_PHONE_IN_LOCAL.sub("[REDACTED PHONE]", result)
        result = _RE_PHONE_BARE_10.sub("[REDACTED PHONE]", result)
        return result

    def scrub_emails(self, text: str) -> str:
        """
        Replaces email addresses with [REDACTED EMAIL].

        >>> PIIScrubber().scrub_emails("Write to rajan@ayush.gov.in")
        'Write to [REDACTED EMAIL]'
        """
        if not text:
            return text
        return _RE_EMAIL.sub("[REDACTED EMAIL]", text)

    def scrub_identities(self, text: str) -> str:
        """
        Detects common personal identity disclosures (e.g. "My name is ...",
        "I am Dr. ...") and replaces them with [REDACTED NAME].

        >>> PIIScrubber().scrub_identities("My name is Priya Sharma")
        '[REDACTED NAME]'
        """
        if not text:
            return text
        return _RE_NAME_DISCLOSURE.sub("[REDACTED NAME]", text)

    def scrub_aadhaar(self, text: str) -> str:
        """
        Detects Aadhaar-style 12-digit numbers (4-4-4 format) and replaces
        them with [REDACTED AADHAAR].

        >>> PIIScrubber().scrub_aadhaar("Aadhaar: 1234 5678 9012")
        'Aadhaar: [REDACTED AADHAAR]'
        """
        if not text:
            return text
        return _RE_AADHAAR.sub("[REDACTED AADHAAR]", text)

    def scrub_query(self, text: str) -> str:
        """
        Executes all scrubbing rules sequentially and returns the sanitized
        text string. Order matters: more specific patterns are applied first.

        >>> PIIScrubber().scrub_query("My name is Rajan, email rajan@test.com, phone +91 98765 43210")
        '[REDACTED NAME], email [REDACTED EMAIL], phone [REDACTED PHONE]'
        """
        if not text or not text.strip():
            return text

        try:
            result = text
            result = self.scrub_aadhaar(result)
            result = self.scrub_phone_numbers(result)
            result = self.scrub_emails(result)
            result = self.scrub_identities(result)
            return result
        except Exception:  # noqa: BLE001 — never block the pipeline on scrubber errors
            return text


# ---------------------------------------------------------------------------
# Global singleton and backward-compatible public API
# ---------------------------------------------------------------------------
pii_scrubber = PIIScrubber()


def scrub_pii(text: str) -> str:
    """
    Detect and redact Personally Identifiable Information from *text*.

    This is the backward-compatible convenience function wrapping
    ``PIIScrubber.scrub_query()``.

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
    """
    return pii_scrubber.scrub_query(text)
