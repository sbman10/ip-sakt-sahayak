"""
backend/app/services/key_manager.py
-----------------------------------
Thread-safe API Key Pool Manager for Google Gemini with automatic rotation,
exponential backoff, and health tracking across multiple keys.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Dict, List, Optional

from app.core.config import settings

log = logging.getLogger("app.services.key_manager")


class GeminiKeyManager:
    """
    Manages a pool of Gemini API keys with round-robin rotation,
    rate-limit cooling periods, and failover support.
    """

    def __init__(self, cooldown_seconds: float = 60.0) -> None:
        self.cooldown_seconds = cooldown_seconds
        self._keys: List[str] = settings.get_gemini_keys()
        self._current_index: int = 0
        self._lock = threading.Lock()
        # Key -> unix timestamp until which key is cooled down
        self._cooldowns: Dict[str, float] = {}

    def refresh_keys(self) -> None:
        """Reload keys from settings."""
        with self._lock:
            self._keys = settings.get_gemini_keys()

    def get_active_key(self) -> str:
        """
        Retrieves the next available healthy Gemini API key from the pool.
        """
        with self._lock:
            if not self._keys:
                # Fallback to single GEMINI_API_KEY from settings/env
                if settings.GEMINI_API_KEY:
                    return settings.GEMINI_API_KEY
                raise RuntimeError("No Gemini API keys configured in settings or .env")

            now = time.time()
            total_keys = len(self._keys)

            # Look for a non-cooling key starting from current index
            for offset in range(total_keys):
                idx = (self._current_index + offset) % total_keys
                candidate = self._keys[idx]
                cooldown_until = self._cooldowns.get(candidate, 0.0)

                if now >= cooldown_until:
                    self._current_index = (idx + 1) % total_keys
                    return candidate

            # If all keys are in cooldown, pick the one with earliest cooldown expiry
            earliest_key = min(self._keys, key=lambda k: self._cooldowns.get(k, 0.0))
            log.warning("All Gemini API keys are in cooldown. Reusing earliest expiring key.")
            return earliest_key

    def mark_rate_limited(self, key: str) -> None:
        """
        Marks an API key as rate-limited (HTTP 429 / Quota Exhausted)
        and places it in cooldown.
        """
        with self._lock:
            cooldown_expiry = time.time() + self.cooldown_seconds
            self._cooldowns[key] = cooldown_expiry
            log.warning("Gemini API key placed in cooldown for %.0f seconds: ...%s", self.cooldown_seconds, key[-6:] if len(key) >= 6 else key)


# Global singleton instance
key_manager = GeminiKeyManager()
