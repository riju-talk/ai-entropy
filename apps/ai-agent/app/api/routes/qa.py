"""
Q&A endpoint — backed by NOVYRA Reasoning Engine (no LangChain)

Legacy path kept at /api/qa so the frontend proxy continues to work.
Internally delegates to reasoning_service which calls Gemini directly.

Response includes a `cognitive_trace` block so the frontend CognitiveTraceCard
can render real data instead of mock values.
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, model_validator
import logging
import time
import math

from app.services import reasoning_service

logger = logging.getLogger(__name__)
router = APIRouter()


class QAInput(BaseModel):
    # Primary field
    question: str = Field(default="", description="User question")
    # Aliases sent by the Next.js proxy
    user_prompt: Optional[str] = None
    system_prompt: Optional[str] = None

    userId: Optional[str] = None
    language: Optional[str] = "en"
    collection_name: Optional[str] = "default"
    conversation_history: Optional[List[Dict[str, Any]]] = None

    @model_validator(mode="after")
    def resolve_question(self) -> "QAInput":
        """Accept user_prompt as alias for question (sent by Next.js proxy)."""
        if not self.question and self.user_prompt:
            self.question = self.user_prompt
        return self


@router.get("/greeting")
async def get_greeting():
    return {"greeting": "Hi! I'm NOVYRA ⚡ — your adaptive AI tutor. Ask me anything!"}


@router.get("/health")
async def qa_health():
    return {"status": "healthy", "backend": "NOVYRA Reasoning Engine (Gemini)"}


@router.post("/", summary="Ask a question (legacy /api/qa)")
async def post_qa(payload: QAInput):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    t0 = time.time()
    try:
        result = await reasoning_service.reason(
            question=payload.question.strip(),
            user_id=payload.userId,
            language=payload.language or "en",
            include_hints=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.exception("QA reasoning failed")
        raise HTTPException(status_code=500, detail="Reasoning engine error")

    inference_ms = round((time.time() - t0) * 1000)

    # Pull cognitive trace fields from metadata (set by reasoning engine)
    meta = result.metadata or {}
    intent_detected: str = meta.get("intent_detected", "Learning")
    difficulty_level: int = int(meta.get("difficulty_level") or 5)

    # Normalise difficulty to 0-1 scale (Gemini returns 1-10)
    difficulty_norm = round(min(1.0, max(0.0, difficulty_level / 10.0)), 2)

    # Estimate mastery_impact (1-5 XP) from confidence score
    mastery_impact = max(1, min(5, math.ceil(result.confidence_score * 5)))

    return {
        # ── Primary answer ──────────────────────────────────────────────────
        "answer": result.final_solution,
        "concept": result.concept,
        "prerequisites": result.prerequisites,
        "stepwise_reasoning": result.stepwise_reasoning,
        "hint_ladder": result.hint_ladder,
        "confidence_score": result.confidence_score,
        "related_concepts": result.related_concepts,
        "sources": [],
        "mode": "reasoning_engine",
        "follow_up_questions": result.related_concepts[:3],

        # ── Cognitive trace (consumed by CognitiveTraceCard) ─────────────
        "cognitive_trace": {
            "intent": intent_detected,
            "concept": result.concept,
            "difficulty": difficulty_norm,
            "mastery_impact": mastery_impact,
            "language": result.language,
            "inference_ms": inference_ms,
            "reasoning_layers": 7,
        },
    }
