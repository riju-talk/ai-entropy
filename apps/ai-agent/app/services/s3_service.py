"""
NOVYRA S3 Document Service
==========================
Handles document upload, presigned URL generation, and retrieval.

Bucket layout:
  documents/{user_id}/{filename}          ← uploaded originals
  processed/{user_id}/{doc_id}.txt        ← extracted text (for RAG)
"""

from __future__ import annotations

import logging
import mimetypes
import os
import uuid
from datetime import datetime
from functools import lru_cache
from typing import BinaryIO, Dict, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

AWS_REGION       = os.getenv("AWS_REGION",       "ap-northeast-1")
S3_BUCKET_NAME   = os.getenv("S3_BUCKET_NAME",   "novyra-documents")
PRESIGN_EXPIRY   = int(os.getenv("S3_PRESIGN_EXPIRY_SECS", "3600"))  # 1 hour


# ── client singleton ──────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_s3() -> Any:  # type: ignore[name-defined]
    import boto3  # local import to keep linter happy in non-AWS env
    cfg = Config(region_name=AWS_REGION, retries={"max_attempts": 3})
    return boto3.client("s3", config=cfg)


def _s3():
    return _get_s3()


# ─────────────────────────────────────────────────────────────────────────────
# S3Service
# ─────────────────────────────────────────────────────────────────────────────

class S3Service:
    """
    Thin facade over S3:
      - upload_file
      - upload_fileobj  (for FastAPI UploadFile)
      - get_presigned_url
      - get_presigned_upload_url
      - delete_file
      - file_exists
      - store_processed_text  (for RAG ingestion pipeline)
      - get_processed_text
    """

    def __init__(self, bucket: str = S3_BUCKET_NAME):
        self.bucket = bucket

    # ── Upload ────────────────────────────────────────────────────────────────

    def upload_file(
        self,
        local_path: str,
        s3_key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """Upload a local file. Returns the S3 key."""
        ct = content_type or mimetypes.guess_type(local_path)[0] or "application/octet-stream"
        extra: Dict = {"ContentType": ct}
        if metadata:
            extra["Metadata"] = metadata
        _s3().upload_file(local_path, self.bucket, s3_key, ExtraArgs=extra)
        logger.info("Uploaded %s → s3://%s/%s", local_path, self.bucket, s3_key)
        return s3_key

    def upload_fileobj(
        self,
        file_obj: BinaryIO,
        filename: str,
        user_id: str,
        content_type: Optional[str] = None,
        doc_id: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Upload a file-like object (e.g. FastAPI UploadFile.file).
        Returns a dict with s3_key, doc_id, bucket, url.
        """
        doc_id  = doc_id or str(uuid.uuid4())
        ts      = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        ext     = os.path.splitext(filename)[1] or ""
        s3_key  = f"documents/{user_id}/{ts}-{doc_id}{ext}"
        ct      = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

        _s3().upload_fileobj(
            file_obj,
            self.bucket,
            s3_key,
            ExtraArgs={
                "ContentType": ct,
                "Metadata": {"user_id": user_id, "doc_id": doc_id, "original_name": filename},
            },
        )
        logger.info("Uploaded fileobj → s3://%s/%s", self.bucket, s3_key)
        url = self.get_presigned_url(s3_key)
        return {"s3_key": s3_key, "doc_id": doc_id, "bucket": self.bucket, "url": url}

    # ── Presigned URLs ────────────────────────────────────────────────────────

    def get_presigned_url(self, s3_key: str, expiry: int = PRESIGN_EXPIRY) -> str:
        """Generate a presigned GET URL for download."""
        url = _s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": s3_key},
            ExpiresIn=expiry,
        )
        logger.debug("Presigned GET: %s (expires %ds)", s3_key, expiry)
        return url

    def get_presigned_upload_url(
        self,
        s3_key: str,
        content_type: str = "application/octet-stream",
        expiry: int = PRESIGN_EXPIRY,
    ) -> str:
        """Generate a presigned PUT URL for direct browser upload."""
        url = _s3().generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": s3_key, "ContentType": content_type},
            ExpiresIn=expiry,
        )
        logger.debug("Presigned PUT: %s (expires %ds)", s3_key, expiry)
        return url

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def delete_file(self, s3_key: str) -> bool:
        """Delete a file. Returns True on success."""
        try:
            _s3().delete_object(Bucket=self.bucket, Key=s3_key)
            logger.info("Deleted s3://%s/%s", self.bucket, s3_key)
            return True
        except ClientError as exc:
            logger.error("Failed to delete %s: %s", s3_key, exc)
            return False

    def file_exists(self, s3_key: str) -> bool:
        """Check whether an object exists."""
        try:
            _s3().head_object(Bucket=self.bucket, Key=s3_key)
            return True
        except ClientError:
            return False

    # ── RAG Processed Text ───────────────────────────────────────────────────

    def store_processed_text(self, user_id: str, doc_id: str, text: str) -> str:
        """
        Store extracted plain text for a document.
        Called after PDF/DOCX parsing, before embedding.
        Returns the S3 key.
        """
        s3_key = f"processed/{user_id}/{doc_id}.txt"
        _s3().put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=text.encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )
        logger.info("Stored processed text → s3://%s/%s", self.bucket, s3_key)
        return s3_key

    def get_processed_text(self, user_id: str, doc_id: str) -> Optional[str]:
        """Retrieve extracted text for a document, or None if not found."""
        s3_key = f"processed/{user_id}/{doc_id}.txt"
        try:
            obj = _s3().get_object(Bucket=self.bucket, Key=s3_key)
            return obj["Body"].read().decode("utf-8")
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise


# ─────────────────────────────────────────────────────────────────────────────
# Singleton accessor
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_s3_service() -> S3Service:
    return S3Service()
