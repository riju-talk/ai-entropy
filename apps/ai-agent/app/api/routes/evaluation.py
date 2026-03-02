"""
NOVYRA — Rubric Evaluation API Routes
POST /api/evaluation/evaluate
"""
from fastapi import APIRouter, HTTPException
import logging

from app.schemas.evaluation import EvaluationRequest, EvaluationResponse
from app.services import rubric_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/evaluate", response_model=EvaluationResponse, summary="Rubric-aware evaluation")
async def evaluate(request: EvaluationRequest) -> EvaluationResponse:
    """
    Evaluate a student submission against a weighted rubric.

    - Criterion-level scoring with per-criterion feedback
    - Weighted total computed deterministically (not by LLM arithmetic)
    - Returns grade label and an actionable improvement plan
    """
    try:
        return await rubric_service.evaluate(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Evaluation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Evaluation engine error")
