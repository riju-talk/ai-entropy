"""
Document upload → chunk → embed to Pinecone → return count.
GET /api/documents        → list documents (metadata only, from Pinecone index stats)
POST /api/documents/upload → upload + embed documents
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.core.config import settings
from typing import Optional, List
from pathlib import Path
import logging

from langchain_core.documents import Document

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024       # 10 MB
ALLOWED_EXT = {".pdf", ".txt", ".md", ".doc", ".docx"}
MAX_FILES_PER_UPLOAD = 10


def _get_langchain_service():
    """Lazily fetch the langchain_service singleton; raises 503 if unavailable."""
    from app.services.langchain_service import langchain_service
    if langchain_service is None:
        raise HTTPException(
            503,
            detail=(
                "Document embedding service is unavailable. "
                "Check PINECONE_API_KEY and GOOGLE_API_KEY in .env."
            ),
        )
    return langchain_service


def _is_allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXT


async def _read_file_content(file: UploadFile) -> str:
    """Convert uploaded file bytes to plain text."""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large: {file.filename} (max 10 MB)")

    suffix = Path(file.filename or "").suffix.lower()

    if suffix == ".pdf":
        try:
            from langchain_community.document_loaders import PyPDFLoader
            import tempfile, os

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                loader = PyPDFLoader(tmp_path)
                docs = loader.load()
                return "\n".join([d.page_content for d in docs])
            finally:
                os.unlink(tmp_path)
        except Exception as exc:
            logger.warning("PyPDFLoader failed (%s); falling back to raw decode", exc)
            return content.decode(errors="ignore")

    elif suffix in (".txt", ".md"):
        return content.decode("utf-8", errors="ignore")

    elif suffix in (".doc", ".docx"):
        try:
            import docx2txt, tempfile, os

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                return docx2txt.process(tmp_path) or ""
            finally:
                os.unlink(tmp_path)
        except Exception as exc:
            logger.warning("docx2txt failed (%s); falling back to raw decode", exc)
            return content.decode(errors="ignore")

    # Generic fallback
    return content.decode(errors="ignore")


@router.get("/")
async def list_documents():
    """
    Return document count / index stats from Pinecone.
    Used by the Next.js proxy GET /api/ai-agent/documents.
    """
    try:
        svc = _get_langchain_service()
        # Describe index to get total vector count
        index = svc.pc.Index(svc.index_name)
        stats = index.describe_index_stats()
        namespaces = stats.get("namespaces", {}) if isinstance(stats, dict) else {}
        total_vectors = stats.get("total_vector_count", 0) if isinstance(stats, dict) else 0
        return {
            "status": "ok",
            "index": svc.index_name,
            "total_vectors": total_vectors,
            "namespaces": list(namespaces.keys()),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to describe Pinecone index: %s", exc)
        return {"status": "unavailable", "error": str(exc)}


@router.post("/upload")
async def upload_documents(
    files: Optional[List[UploadFile]] = File(None),
    user_id: Optional[str] = Form(None),
):
    """
    Upload documents → chunk → embed to Pinecone.

    - Checks ENABLE_PERSISTENCE setting (default True)
    - Falls back gracefully if LangChain service is unavailable
    - Returns number of successfully embedded documents
    """
    if not settings.ENABLE_PERSISTENCE:
        raise HTTPException(
            403,
            detail="Document upload is disabled in this deployment (ENABLE_PERSISTENCE=false).",
        )

    svc = _get_langchain_service()

    if not files or len(files) == 0:
        raise HTTPException(400, "No files uploaded.")

    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(400, f"Maximum {MAX_FILES_PER_UPLOAD} files per upload.")

    logger.info("[UPLOAD] Received %d file(s) from user=%s", len(files), user_id or "anonymous")

    namespace = user_id if user_id else "anonymous"
    embedded_count = 0
    errors: List[str] = []

    for f in files:
        if not f.filename:
            continue
        if not _is_allowed_file(f.filename):
            raise HTTPException(400, f"Unsupported file type: {f.filename}. Allowed: {', '.join(ALLOWED_EXT)}")

        try:
            text = await _read_file_content(f)
            if not text.strip():
                logger.warning("[UPLOAD] Skipping empty file: %s", f.filename)
                continue

            # Build LangChain Document
            doc = Document(
                page_content=text,
                metadata={
                    "source": f.filename,
                    "user_id": namespace,
                    "content_type": f.content_type or "unknown",
                },
            )

            # Chunk and upsert
            chunks = svc.split_documents([doc])
            logger.info("[UPLOAD] %s → %d chunks → namespace=%s", f.filename, len(chunks), namespace)
            await svc.upsert_documents(chunks, collection_name=namespace)
            embedded_count += 1

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("[UPLOAD] Failed to embed %s: %s", f.filename, exc)
            errors.append(f"{f.filename}: {str(exc)}")

    if errors and embedded_count == 0:
        raise HTTPException(500, f"All uploads failed: {'; '.join(errors)}")

    logger.info("[UPLOAD] Embedded %d/%d document(s)", embedded_count, len(files))

    return {
        "count": embedded_count,
        "namespace": namespace,
        "message": f"Successfully embedded {embedded_count} document(s) to vector store.",
        "errors": errors,
    }

