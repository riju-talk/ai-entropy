"""
Document upload → immediate embeddings → return count
No vector store, no chunking, no persistence.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.core.config import settings
from typing import Optional, List
from pathlib import Path
import uuid
import logging

from langchain_core.documents import Document
from app.services.langchain_service import langchain_service  # uses your Gemini embeddings

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("./data/uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024      # 10 MB
ALLOWED_EXT = {".pdf", ".txt", ".doc", ".docx"}
MAX_FILES_PER_UPLOAD = 10


def _ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def _is_allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXT


async def _read_file_content(file: UploadFile) -> str:
    """Convert file to text. Minimal fallback loaders."""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large: {file.filename}")

    suffix = Path(file.filename).suffix.lower()

    if suffix == ".pdf":
        try:
            from langchain_community.document_loaders import PyPDFLoader
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            loader = PyPDFLoader(tmp_path)
            docs = loader.load()
            return "\n".join([d.page_content for d in docs])
        except Exception:
            logger.warning("PDF loader failed; falling back to raw text")
            return content.decode(errors="ignore")

    elif suffix in (".txt", ".md"):
        return content.decode("utf-8", errors="ignore")

    elif suffix in (".doc", ".docx"):
        try:
            import docx2txt
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            return docx2txt.process(tmp_path) or ""
        except Exception:
            logger.warning("docx loader failed; fallback text used")
            return content.decode(errors="ignore")

    # fallback for unknown extensions
    return content.decode(errors="ignore")


@router.post("/upload")
async def upload_documents(
    files: Optional[List[UploadFile]] = File(None),
    user_id: Optional[str] = Form(None),
):
    """
    Upload documents → convert directly to embeddings → return only count.
    No vector store. No persistence.
    """
    # Reject uploads when persistence is disabled (no data directory / no storage)
    if not getattr(settings, 'ENABLE_PERSISTENCE', False):
        raise HTTPException(403, "Document upload is disabled in this deployment (persistence disabled).")

    try:
        if not files or len(files) == 0:
            raise HTTPException(400, "No files uploaded")

        if len(files) > MAX_FILES_PER_UPLOAD:
            raise HTTPException(400, f"Maximum {MAX_FILES_PER_UPLOAD} files allowed")

        logger.info("[UPLOAD] Received %d files for embedding", len(files))

        embedded_count = 0

        # process one-by-one
        for f in files:
            if not _is_allowed_file(f.filename):
                raise HTTPException(400, f"Unsupported file type: {f.filename}")

            text = await _read_file_content(f)

            if not text.strip():
                logger.warning("Skipping empty file: %s", f.filename)
                continue

            # --- 🔥 CHUNK & UPSERT TO PINECONE HERE ---
            try:
                # 1. Create Document object
                doc = Document(page_content=text, metadata={"source": f.filename, "user_id": user_id or "anonymous"})
                
                # 2. Split chunks
                chunks = langchain_service.split_documents([doc])
                
                # 3. Upsert to Pinecone - Use user_id as namespace (or specialized collection name)
                # If user_id is provided, we use it as the namespace to isolate user data
                namespace = user_id if user_id else "anonymous"
                
                await langchain_service.upsert_documents(chunks, collection_name=namespace)
                
                embedded_count += 1
            except Exception as e:
                logger.error("Embedding/Upsert failed for %s: %s", f.filename, e)
                raise HTTPException(500, f"Embedding failed for file {f.filename}: {str(e)}")

        logger.info("[UPLOAD] Successfully embedded %d documents", embedded_count)

        return {
            "count": embedded_count,
            "message": f"Successfully embedded {embedded_count} document(s) to cloud storage"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected upload error: %s", e)
        raise HTTPException(500, "Internal server error during document upload")
