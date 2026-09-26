"""
backend/app/core/gemini_pool.py
-------------------------------
Gemini API Key Pool Manager & Retry Handler for IP-SAKTI Sahayak.
Tracks per-key health, cooldowns, failure counts, and provides
tenacity-powered exponential backoff retries with automatic key rotation.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional, TypeVar

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings

log = logging.getLogger("app.core.gemini_pool")

T = TypeVar("T")


class ResourceExhaustedError(Exception):
    """Raised when all API keys are in cooldown and no fallback is available."""
    pass


class TransientAPIError(Exception):
    """Wrapper for transient HTTP errors (429, 5xx) that should be retried."""

    def __init__(self, message: str, status_code: int = 429, key: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.key = key


class GeminiKeyPool:
    """
    Thread-safe API Key Pool Manager with per-key health tracking,
    automatic cooldown management, and least-recently-used selection.
    """

    def __init__(self, cooldown_429: float = 60.0, cooldown_5xx: float = 30.0) -> None:
        self._cooldown_429 = cooldown_429
        self._cooldown_5xx = cooldown_5xx
        self._lock = threading.Lock()

        # Parse keys from config/environment
        raw_keys = settings.get_gemini_keys()
        self._key_states: Dict[str, Dict[str, Any]] = {}
        for key in raw_keys:
            self._key_states[key] = {
                "key": key,
                "failures": 0,
                "cooldown_until": 0.0,
                "last_used": 0.0,
            }

        if not self._key_states:
            log.warning("GeminiKeyPool initialised with zero API keys.")

    @property
    def pool_size(self) -> int:
        return len(self._key_states)

    def get_available_key(self) -> str:
        """
        Selects the least-recently-used key whose cooldown has expired.
        Raises ResourceExhaustedError if every key is in cooldown.
        """
        with self._lock:
            now = time.time()
            available: List[Dict[str, Any]] = []

            for state in self._key_states.values():
                if now >= state["cooldown_until"]:
                    available.append(state)

            if not available:
                # All keys in cooldown — check if there is at least one key
                if self._key_states:
                    # Pick the one with the earliest cooldown expiry
                    earliest = min(
                        self._key_states.values(),
                        key=lambda s: s["cooldown_until"],
                    )
                    log.warning(
                        "All %d keys in cooldown. Force-selecting earliest expiry (%.1fs remaining).",
                        len(self._key_states),
                        earliest["cooldown_until"] - now,
                    )
                    earliest["last_used"] = now
                    return earliest["key"]
                raise ResourceExhaustedError(
                    "No Gemini API keys configured or all keys exhausted."
                )

            # Select least-recently-used among available keys
            chosen = min(available, key=lambda s: s["last_used"])
            chosen["last_used"] = now
            return chosen["key"]

    def mark_key_failed(self, key: str, status_code: int = 429) -> None:
        """
        Increments failure count and sets temporary cooldown period.
        429 → 60s cooldown, 5xx → 30s cooldown.
        """
        with self._lock:
            state = self._key_states.get(key)
            if state is None:
                log.warning("Attempted to mark unknown key as failed: ...%s", key[-6:])
                return

            state["failures"] += 1
            cooldown_secs = self._cooldown_429 if status_code == 429 else self._cooldown_5xx
            state["cooldown_until"] = time.time() + cooldown_secs

            log.warning(
                "Key ...%s marked failed (status=%d, failures=%d, cooldown=%.0fs)",
                key[-6:] if len(key) >= 6 else key,
                status_code,
                state["failures"],
                cooldown_secs,
            )

    def mark_key_success(self, key: str) -> None:
        """Resets failure count for a key after successful use."""
        with self._lock:
            state = self._key_states.get(key)
            if state:
                state["failures"] = 0
                state["cooldown_until"] = 0.0

    def get_key_health_report(self) -> List[Dict[str, Any]]:
        """Returns a snapshot of all key health states for diagnostics."""
        with self._lock:
            now = time.time()
            report = []
            for state in self._key_states.values():
                report.append({
                    "key_suffix": "..." + state["key"][-6:] if len(state["key"]) >= 6 else state["key"],
                    "failures": state["failures"],
                    "in_cooldown": now < state["cooldown_until"],
                    "cooldown_remaining_s": max(0.0, state["cooldown_until"] - now),
                })
            return report


async def execute_with_retry_and_fallback(
    func: Callable[..., T],
    *args: Any,
    **kwargs: Any,
) -> T:
    """
    Async wrapper that executes a callable with tenacity-powered retries,
    automatic key rotation on transient errors, and exponential backoff.

    The callable receives a 'api_key' keyword argument with a fresh key
    on each attempt.

    Parameters
    ----------
    func : Callable
        The function to execute (sync or async). Must accept 'api_key' kwarg.
    *args, **kwargs
        Positional and keyword arguments forwarded to func.

    Returns
    -------
    T
        The return value of func on success.

    Raises
    ------
    ResourceExhaustedError
        If all keys are exhausted and retries are depleted.
    """
    max_attempts = 3
    last_exception: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        try:
            api_key = gemini_key_pool.get_available_key()
            kwargs["api_key"] = api_key

            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = await asyncio.to_thread(func, *args, **kwargs)

            gemini_key_pool.mark_key_success(api_key)
            return result

        except Exception as e:
            last_exception = e
            err_msg = str(e).lower()

            # Detect transient errors
            if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                status_code = 429
            elif "500" in err_msg or "503" in err_msg or "502" in err_msg:
                status_code = 500
            else:
                # Non-transient error — don't retry
                log.error("Non-transient Gemini error (attempt %d/%d): %s", attempt, max_attempts, e)
                raise

            current_key = kwargs.get("api_key", "")
            gemini_key_pool.mark_key_failed(current_key, status_code=status_code)

            if attempt < max_attempts:
                wait_time = min(10, 2 ** attempt)
                log.warning(
                    "Transient error (attempt %d/%d, status=%d). Retrying in %.1fs with fresh key...",
                    attempt,
                    max_attempts,
                    status_code,
                    wait_time,
                )
                await asyncio.sleep(wait_time)
            else:
                log.error("All %d retry attempts exhausted. Last error: %s", max_attempts, e)

    raise last_exception or ResourceExhaustedError("All retry attempts exhausted.")


# Global singleton instance
gemini_key_pool = GeminiKeyPool()
