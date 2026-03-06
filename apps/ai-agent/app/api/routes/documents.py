"""
Document upload  →  S3  →  extract text  →  chunk  →  embed  →  Pinecone

Supported file types
--------------------
  .pdf          — pypdf  (text)
  .txt          — UTF-8 decode
  .docx         — python-docx
  .pptx         — python-pptx  (all slides)
  .png          — Bedrock Claude 3 vision  (OCR + description)
  .jpg / .jpeg  — Bedrock Claude 3 vision  (OCR + description)

S3 layout
---------
  documents/{user_id}/{timestamp}-{uuid}{ext}   ← original file
  processed/{user_id}/{doc_id}.txt              ← extracted text (stored after embedding)
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from pathlib import Path
import logging
import io

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE        = 20 * 1024 * 1024   # 20 MB
MAX_FILES_PER_UPLOAD = 10

ALLOWED_EXT = {".pdf", ".txt", ".docx", ".pptx", ".png", ".jpg", ".jpeg"}

# Map image extension → MIME type used by Claude vision
_IMAGE_MIME = {
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
}


# ── Service accessors ─────────────────────────────────────────────────────────

def _get_langchain_service():
    from app.services.langchain_service import langchain_service
    if langchain_service is None:
        raise HTTPException(503, detail="Embedding service unavailable. Check PINECONE_API_KEY.")
    return langchain_service


def _get_s3():
    """Return the S3Service singleton, or None if S3 is not configured."""
    if not settings.S3_BUCKET_NAME:
        return None
    try:
        from app.services.s3_service import get_s3_service
        return get_s3_service()
    except Exception as exc:
        logger.warning("S3 service unavailable: %s — uploads will not be backed up", exc)
        return None


# ── Text extractors ───────────────────────────────────────────────────────────

def _extract_pdf(content: bytes) -> str:
    """Extract text from a PDF using pypdf (already in requirements)."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def _extract_docx(content: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    import docx
    doc = docx.Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    # Also pull text from tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                paragraphs.append(row_text)
    return "\n".join(paragraphs)


def _extract_pptx(content: bytes) -> str:
    """Extract text from all slides of a PPTX file using python-pptx."""
    from pptx import Presentation
    prs = Presentation(io.BytesIO(content))
    parts = []
    for i, slide in enumerate(prs.slides, 1):
        slide_lines = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_lines.append(shape.text.strip())
        if slide_lines:
            parts.append(f"[Slide {i}]\n" + "\n".join(slide_lines))
    return "\n\n".join(parts)


def _extract_image(content: bytes, media_type: str) -> str:
    """OCR / describe an image using Bedrock Claude 3 vision."""
    from app.services.bedrock_service import get_bedrock_service
    svc = get_bedrock_service()
    return svc.describe_image_bytes(content, media_type)


def _extract_text(content: bytes, filename: str) -> str:
    """Dispatch to the correct extractor based on file extension."""
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(content)
    elif suffix == ".txt":
        return content.decode("utf-8", errors="ignore")
    elif suffix == ".docx":
        return _extract_docx(content)
    elif suffix == ".pptx":
        return _extract_pptx(content)
    elif suffix in _IMAGE_MIME:
        return _extract_image(content, _IMAGE_MIME[suffix])

    # Fallback — try UTF-8
    return content.decode(errors="ignore")


# ── Route handlers ────────────────────────────────────────────────────────────

@router.get("/")
async def list_documents():
    """Return Pinecone index stats — document count per namespace."""
    try:
        svc = _get_langchain_service()
        index = svc.pc.Index(svc.index_name)
        stats = index.describe_index_stats()
        namespaces    = stats.get("namespaces", {}) if isinstance(stats, dict) else {}
        total_vectors = stats.get("total_vector_count", 0) if isinstance(stats, dict) else 0
        return {
            "status":        "ok",
            "index":         svc.index_name,
            "total_vectors": total_vectors,
            "namespaces":    list(namespaces.keys()),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to describe Pinecone index: %s", exc)
        return {"status": "unavailable", "error": str(exc)}


@router.post("/upload")
async def upload_documents(
    files:   Optional[List[UploadFile]] = File(None),
    user_id: Optional[str]             = Form(None),
):
    """
    Upload one or more files  →  S3 (backup)  →  extract text  →  embed  →  Pinecone.

    Returns
    -------
    JSON with count, namespace, s3_uploads list, and any per-file errors.
    """
    if not settings.ENABLE_PERSISTENCE:
        raise HTTPException(403, detail="Document upload is disabled (ENABLE_PERSISTENCE=false).")

    if not files:
        raise HTTPException(400, "No files uploaded.")

    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(400, f"Maximum {MAX_FILES_PER_UPLOAD} files per upload.")

    try:
        from langchain_core.documents import Document as LCDocument
    except ImportError:
        raise HTTPException(503, "LangChain core not installed.")

    lc_svc    = _get_langchain_service()
    s3_svc    = _get_s3()
    namespace = user_id or "anonymous"

    embedded_count: int        = 0
    s3_uploads:     List[dict] = []
    errors:         List[str]  = []

    for f in files:
        if not f.filename:
            continue

        suffix = Path(f.filename).suffix.lower()
        if suffix not in ALLOWED_EXT:
            raise HTTPException(
                400,
                f"Unsupported file type '{suffix}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXT))}",
            )

        try:
            content = await f.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(400, f"'{f.filename}' exceeds 20 MB limit.")

            # ── Step 1: back up raw bytes to S3 ──────────────────────────────
            s3_info: dict = {}
            if s3_svc:
                try:
                    s3_info = s3_svc.upload_fileobj(
                        file_obj     = io.BytesIO(content),
                        filename     = f.filename,
                        user_id      = namespace,
                        content_type = f.content_type or "application/octet-stream",
                    )
                    s3_uploads.append(s3_info)
                    logger.info(
                        "[S3] %s → s3://%s/%s",
                        f.filename, s3_info.get("bucket"), s3_info.get("s3_key"),
                    )
                except Exception as s3_exc:
                    logger.warning(
                        "[S3] Upload failed for '%s': %s  (processing continues)",
                        f.filename, s3_exc,
                    )

            # ── Step 2: extract plain text ────────────────────────────────────
            text = _extract_text(content, f.filename)
            if not text.strip():
                logger.warning("[UPLOAD] No text extracted from '%s' — skipping", f.filename)
                continue

            # ── Step 3: store extracted text back to S3 (processed/ prefix) ──
            if s3_svc and s3_info.get("doc_id"):
                try:
                    s3_svc.store_processed_text(namespace, s3_info["doc_id"], text)
                except Exception as exc:
                    logger.warning("[S3] Could not store processed text: %s", exc)

            # ── Step 4: build LangChain Document ─────────────────────────────
            meta = {
                "source":       f.filename,
                "user_id":      namespace,
                "content_type": f.content_type or "unknown",
                "file_type":    suffix.lstrip("."),
            }
            if s3_info.get("s3_key"):
                meta["s3_key"]    = s3_info["s3_key"]
                meta["s3_bucket"] = s3_info.get("bucket", "")

            doc = LCDocument(page_content=text, metadata=meta)

            # ── Step 5: chunk + upsert to Pinecone ───────────────────────────
            chunks = lc_svc.split_documents([doc])
            logger.info(
                "[UPLOAD] '%s' → %d chunks → Pinecone namespace='%s'",
                f.filename, len(chunks), namespace,
            )
            await lc_svc.upsert_documents(chunks, collection_name=namespace)
            embedded_count += 1

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("[UPLOAD] Failed to process '%s': %s", f.filename, exc)
            errors.append(f"{f.filename}: {exc!s}")

    if errors and embedded_count == 0:
        raise HTTPException(500, f"All uploads failed: {'; '.join(errors)}")

    return {
        "count":      embedded_count,
        "namespace":  namespace,
        "message":    f"Successfully embedded {embedded_count} document(s).",
        "s3_uploads": s3_uploads,
        "errors":     errors,
    }

