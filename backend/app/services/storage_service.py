"""
backend/app/services/storage_service.py
-----------------------------------------
Supabase Storage Service for IP-SAKTI Sahayak.
Provides server-side private file management using the Supabase Python SDK.

Key features:
- Private bucket 'legal-documents' management.
- Object key format: users/{user_id}/{document_id}/{filename}.
- Upload, download, delete, and time-limited signed URL generation.
- Never exposes Supabase service-role keys to frontend.
- Fallback local filesystem adapter for offline local dev and unit testing.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

from app.core.config import settings

log = logging.getLogger("app.services.storage_service")

# Default bucket name
DEFAULT_BUCKET = "legal-documents"


def build_storage_key(
    user_id: str,
    document_id: str,
    filename: str,
    organisation_id: Optional[str] = None,
) -> str:
    """
    Generates a secure, sanitized Supabase storage object key.
    Format:
      organisations/{organisation_id}/users/{user_id}/documents/{document_id}/{filename}
    Fallback (legacy):
      users/{user_id}/{document_id}/{filename}

    Prevents directory traversal and characters that might break S3/Supabase pathing.
    """
    clean_user = re.sub(r"[^\w\-]", "", str(user_id).strip())
    clean_doc = re.sub(r"[^\w\-]", "", str(document_id).strip())

    # Extract basename and sanitize
    raw_name = Path(filename).name
    clean_filename = re.sub(r"[^\w\.\-]", "_", raw_name)
    if not clean_filename or clean_filename.startswith("."):
        clean_filename = f"file_{clean_filename}" if clean_filename else "document.pdf"

    if organisation_id and str(organisation_id).strip():
        clean_org = re.sub(r"[^\w\-]", "", str(organisation_id).strip())
        return f"organisations/{clean_org}/users/{clean_user}/documents/{clean_doc}/{clean_filename}"

    return f"users/{clean_user}/{clean_doc}/{clean_filename}"



class SupabaseStorageService:
    """
    Server-side storage client managing documents in Supabase Storage.
    Supports graceful fallback to local storage if credentials are not configured.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        default_bucket: Optional[str] = None,
    ) -> None:
        self.url = (supabase_url or settings.SUPABASE_URL or "").strip()
        self.key = (supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        self.default_bucket = (
            default_bucket
            or settings.SUPABASE_STORAGE_BUCKET
            or DEFAULT_BUCKET
        )
        self._client = None
        self._is_cloud = bool(self.url and self.key)

        if self._is_cloud:
            try:
                from supabase import create_client
                self._client = create_client(self.url, self.key)
                log.info("Supabase storage client initialized for bucket '%s'.", self.default_bucket)
            except Exception as exc:
                log.warning("Failed to initialize Supabase client (%s). Falling back to local storage.", exc)
                self._client = None
                self._is_cloud = False
        else:
            log.info("Supabase credentials not configured. Using local filesystem storage adapter.")

    @property
    def is_cloud(self) -> bool:
        """Returns True if connected to Supabase Cloud, False if using local fallback."""
        return self._is_cloud and self._client is not None

    def ensure_bucket_exists(self, bucket: Optional[str] = None) -> bool:
        """Ensures the target private bucket exists in Supabase Storage."""
        target_bucket = bucket or self.default_bucket
        if not self.is_cloud:
            return True

        try:
            # Check if bucket exists
            buckets = self._client.storage.list_buckets()
            bucket_names = [b.name for b in buckets] if buckets else []
            if target_bucket not in bucket_names:
                self._client.storage.create_bucket(
                    target_bucket,
                    options={"public": False},
                )
                log.info("Created private Supabase bucket: %s", target_bucket)
            return True
        except Exception as exc:
            log.warning("Could not verify or create bucket '%s': %s", target_bucket, exc)
            return False

    def upload_file(
        self,
        object_key: str,
        file_bytes: bytes,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None,
    ) -> str:
        """
        Uploads a file to Supabase Storage and returns the object key.

        Parameters
        ----------
        object_key : str
            The key to store the file under (e.g. users/{user_id}/{document_id}/{filename}).
        file_bytes : bytes
            Raw binary content of the file.
        content_type : str
            MIME type of the file.
        bucket : Optional[str]
            Target bucket name (defaults to self.default_bucket).

        Returns
        -------
        str
            The object key stored.
        """
        target_bucket = bucket or self.default_bucket

        if self.is_cloud:
            try:
                # Use storage from Supabase
                storage_bucket = self._client.storage.from_(target_bucket)
                # Upload with upsert
                storage_bucket.upload(
                    path=object_key,
                    file=file_bytes,
                    file_options={"content-type": content_type, "upsert": "true"},
                )
                log.info("Uploaded object to Supabase [%s]: %s", target_bucket, object_key)
                return object_key
            except Exception as exc:
                log.error("Failed to upload object to Supabase [%s/%s]: %s", target_bucket, object_key, exc)
                raise RuntimeError(f"Supabase storage upload failed: {exc}") from exc
        else:
            # Local fallback storage
            local_path = Path("uploads") / object_key
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as fh:
                fh.write(file_bytes)
            log.info("Stored file locally at fallback path: %s", local_path)
            return object_key

    def get_signed_url(
        self,
        object_key: str,
        expires_in: int = 3600,
        bucket: Optional[str] = None,
    ) -> str:
        """
        Generates a secure, time-limited presigned download URL for a private object.
        """
        target_bucket = bucket or self.default_bucket

        if self.is_cloud:
            try:
                storage_bucket = self._client.storage.from_(target_bucket)
                res = storage_bucket.create_signed_url(object_key, expires_in=expires_in)
                if isinstance(res, dict) and "signedURL" in res:
                    return res["signedURL"]
                if hasattr(res, "signed_url"):
                    return res.signed_url
                if isinstance(res, str):
                    return res
                # Fallback to string extraction
                return str(res.get("signedURL", res.get("signedUrl", "")))
            except Exception as exc:
                log.error("Failed to generate signed URL for [%s/%s]: %s", target_bucket, object_key, exc)
                raise RuntimeError(f"Failed to generate signed URL: {exc}") from exc
        else:
            # Local fallback link
            return f"/api/uploads/raw/{object_key}"

    def download_file(
        self,
        object_key: str,
        bucket: Optional[str] = None,
    ) -> bytes:
        """
        Downloads the raw file bytes from Supabase Storage.
        """
        target_bucket = bucket or self.default_bucket

        if self.is_cloud:
            try:
                storage_bucket = self._client.storage.from_(target_bucket)
                data = storage_bucket.download(object_key)
                return data
            except Exception as exc:
                log.error("Failed to download object from Supabase [%s/%s]: %s", target_bucket, object_key, exc)
                raise RuntimeError(f"Supabase storage download failed: {exc}") from exc
        else:
            local_path = Path("uploads") / object_key
            if not local_path.exists():
                raise FileNotFoundError(f"Local fallback file not found: {local_path}")
            with open(local_path, "rb") as fh:
                return fh.read()

    def delete_file(
        self,
        object_key: str,
        bucket: Optional[str] = None,
    ) -> bool:
        """
        Deletes a file object from Supabase Storage.
        """
        target_bucket = bucket or self.default_bucket

        if self.is_cloud:
            try:
                storage_bucket = self._client.storage.from_(target_bucket)
                storage_bucket.remove([object_key])
                log.info("Deleted object from Supabase [%s]: %s", target_bucket, object_key)
                return True
            except Exception as exc:
                log.warning("Failed to delete object from Supabase [%s/%s]: %s", target_bucket, object_key, exc)
                return False
        else:
            # Local fallback
            local_path = Path("uploads") / object_key
            if local_path.exists():
                try:
                    local_path.unlink()
                    return True
                except Exception as exc:
                    log.warning("Failed to delete local fallback file: %s", exc)
                    return False
            return True


# Global singleton instance
storage_service = SupabaseStorageService()
