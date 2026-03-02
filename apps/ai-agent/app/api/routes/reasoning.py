"""
NOVYRA — Reasoning Engine API Routes
POST /api/reasoning/ask
"""
from fastapi import APIRouter, HTTPException
import logging

from google.genai.errors import ClientError
from app.schemas.reasoning import ReasoningRequest, ReasoningResponse
from app.services import reasoning_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ask", response_model=ReasoningResponse, summary="Structured AI reasoning")
async def ask(request: ReasoningRequest) -> ReasoningResponse:
    """
    Submit a student question and receive a structured, step-by-step explanation.

    - Detects language automatically; reasoning is done in English internally
    - Enriches the prompt with Knowledge Graph context if user_id is provided
    - Returns JSON with prerequisites, stepwise breakdown, hint ladder, and confidence score
    """
    try:
        return await reasoning_service.reason(
            question=request.question,
            user_id=request.user_id,
            language=request.language,
            include_hints=request.include_hints,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ClientError as exc:
        msg = str(exc)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            logger.warning("Gemini quota hit: %s", msg[:120])
            raise HTTPException(status_code=503, detail="AI service quota exceeded. Please try again in a few minutes.")
        logger.exception("Gemini API error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service error")
    except Exception as exc:
        # Unwrap RetryError to expose the real cause
        cause = getattr(exc, '__cause__', None) or getattr(exc, 'last_attempt', None)
        if cause and hasattr(cause, 'exception'):
            inner = cause.exception()
            if isinstance(inner, ClientError) and "429" in str(inner):
                raise HTTPException(status_code=503, detail="AI service quota exceeded. Please try again in a few minutes.")
        logger.exception("Reasoning failed: %s", exc)
        raise HTTPException(status_code=500, detail="Reasoning engine error")
