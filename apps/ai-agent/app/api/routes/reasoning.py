"""
Entropy AI â€” Reasoning Engine API Routes
POST /api/reasoning/ask
"""
from fastapi import APIRouter, HTTPException
import logging

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
            system_prompt=request.system_prompt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Reasoning failed: %s", exc)
        raise HTTPException(status_code=500, detail="Reasoning engine error")
