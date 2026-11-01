"""
Document storage on Supabase Storage (free tier), via its REST API.

Object layout (inside the bucket):
  documents/{user_id}/{timestamp}-{uuid}{ext}   original upload
  processed/{user_id}/{doc_id}.txt              extracted text

The method names and returned keys (`s3_key`) match the API contract the
frontend already uses, so the web app does not need to change.
"""

from __future__ import annotations

import logging
import mimetypes
import os
import uuid
from datetime import datetime
from functools import lru_cache
from typing import BinaryIO, Dict, Optional
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SIGNED_URL_EXPIRY_SECS = 3600
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


class StorageService:
    def __init__(self, base_url: str, service_key: str, bucket: str):
        self.bucket = bucket
        self._api = base_url.rstrip("/") + "/storage/v1"
        self._headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    # -- helpers -----------------------------------------------------------------

    def _object_url(self, key: str) -> str:
        return f"{self._api}/object/{self.bucket}/{quote(key)}"

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        headers = {**self._headers, **kwargs.pop("headers", {})}
        with httpx.Client(timeout=_TIMEOUT) as client:
            return client.request(method, url, headers=headers, **kwargs)

    # -- upload ------------------------------------------------------------------

    def _put(self, key: str, data: bytes, content_type: str) -> None:
        resp = self._request(
            "POST", self._object_url(key), content=data,
            headers={"Content-Type": content_type, "x-upsert": "true"},
        )
        resp.raise_for_status()

    def upload_fileobj(
        self,
        file_obj: BinaryIO,
        filename: str,
        user_id: str,
        content_type: Optional[str] = None,
    ) -> Dict[str, str]:
        """Store an uploaded file; returns {s3_key, doc_id, bucket, url}."""
        doc_id = str(uuid.uuid4())
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        key = f"documents/{user_id}/{ts}-{doc_id}{os.path.splitext(filename)[1]}"
        ctype = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self._put(key, file_obj.read(), ctype)
        return {"s3_key": key, "doc_id": doc_id, "bucket": self.bucket, "url": key}

    def store_processed_text(self, user_id: str, doc_id: str, text: str) -> str:
        key = f"processed/{user_id}/{doc_id}.txt"
        self._put(key, text.encode("utf-8"), "text/plain; charset=utf-8")
        return key

    def get_processed_text(self, user_id: str, doc_id: str) -> Optional[str]:
        resp = self._request("GET", self._object_url(f"processed/{user_id}/{doc_id}.txt"))
        return resp.text if resp.status_code == 200 else None

    # -- signed URLs ---------------------------------------------------------------

    def get_presigned_url(self, key: str, expiry: int = SIGNED_URL_EXPIRY_SECS) -> str:
        """Time-limited download URL."""
        resp = self._request(
            "POST", f"{self._api}/object/sign/{self.bucket}/{quote(key)}",
            json={"expiresIn": expiry},
        )
        resp.raise_for_status()
        return self._api + resp.json()["signedURL"]

    def get_presigned_upload_url(self, key: str, content_type: str = "application/octet-stream") -> str:
        """URL the browser can PUT a file to directly."""
        resp = self._request("POST", f"{self._api}/object/upload/sign/{self.bucket}/{quote(key)}")
        resp.raise_for_status()
        return self._api + resp.json()["url"]

    # -- management ----------------------------------------------------------------

    def delete_file(self, key: str) -> bool:
        resp = self._request("DELETE", self._object_url(key))
        return resp.status_code == 200

    def file_exists(self, key: str) -> bool:
        resp = self._request("GET", f"{self._api}/object/info/{self.bucket}/{quote(key)}")
        return resp.status_code == 200


def storage_configured() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    if not storage_configured():
        raise RuntimeError("Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY).")
    return StorageService(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, settings.STORAGE_BUCKET)
