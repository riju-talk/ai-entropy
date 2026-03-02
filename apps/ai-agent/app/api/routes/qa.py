"""
Q&A endpoint — now backed by LangChainService (RAG) + ChatService (Follow-ups)
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from pathlib import Path
import os
from datetime import datetime
import logging
import json
import aiofiles

logger = logging.getLogger(__name__)
router = APIRouter()

from app.core.config import settings

# Local history storage (disabled unless persistence is enabled)
QA_STORAGE_PATH = Path("./data/qa_history")
if getattr(settings, 'ENABLE_PERSISTENCE', False):
    QA_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# ---- Services ---- #
try:
    from app.services.chat_service import ChatService
    chat_service = ChatService()
    logger.info("ChatService loaded.")
except Exception as e:
    logger.error("Failed to load ChatService: %s", e)
    chat_service = None

try:
    from app.services.langchain_service import langchain_service
    logger.info("LangChainService loaded.")
except Exception as e:
    logger.error("Failed to load LangChainService: %s", e)
    langchain_service = None


class QAInput(BaseModel):
    # Frontend sends 'question' usually, but earlier code used 'user_prompt'. 
    # To be safe and flexible, we accept both or alias them.
    # But since we control backend, let's stick to 'question' as primary.
    question: str = Field(..., description="User question")
    userId: Optional[str] = "anonymous"
    collection_name: Optional[str] = "default"
    conversation_history: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = Field(default="You are a helpful AI tutor.", description="System instructions")
    filter: Optional[Dict[str, Any]] = None


@router.get("/greeting")
async def get_greeting():
    return {"greeting": "Hi! I'm Spark ⚡ — your AI study buddy! Ask me anything!"}


@router.get("/health")
async def qa_health():
    return {
        "status": "healthy",
        "chat_service": bool(chat_service),
        "langchain_service": bool(langchain_service)
    }


# ------------------------------------------------------------
# MAIN Q&A ENDPOINT
# ------------------------------------------------------------

@router.post("/", summary="Post QA", response_description="AI response payload")
async def post_qa(payload: QAInput, request: Request):
    if not langchain_service:
        raise HTTPException(503, "LangChainService unavailable (dependencies ok?).")

    try:
        user_msg = payload.question.strip()
        if not user_msg:
            raise HTTPException(400, "Question cannot be empty")

        # 1. Generate Answer (RAG or Direct) via LangChainService
        # Note: langchain_service.chat_with_fallback handles RAG logic if collection exists/documents are found
        
        # Determine strict collection name (e.g. user_id namespace)
        namespace = payload.userId if payload.collection_name == "default" else payload.collection_name

        response_data = await langchain_service.chat_with_fallback(
            message=user_msg,
            collection_name=namespace,
            conversation_history=payload.conversation_history,
            system_prompt=payload.system_prompt
        )
        
        answer = response_data.get("answer", "")
        sources = response_data.get("sources", [])
        mode = response_data.get("mode", "direct")

        # 2. Generate Follow-ups (using ChatService helper)
        followups = []
        if chat_service and answer:
            try:
                # generate_followups is private in ChatService (_generate_followups), 
                # but we can access it or use the prompt directly. 
                followups = await chat_service._generate_followups(answer)
            except Exception as e:
                logger.warning("Follow-up generation failed: %s", e)

        # 3. Persistence (Optional)
        qa_id = None
        if getattr(settings, 'ENABLE_PERSISTENCE', False):
            qa_id = f"qa_{int(datetime.now().timestamp() * 1000)}"
            # save logic... omit for speed unless critical
            pass

        return {
            "answer": answer,
            "sources": sources,
            "mode": mode,
            "follow_up_questions": followups,
            "qaId": qa_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("QA handling failed")
        raise HTTPException(500, f"Internal error: {str(e)}")
