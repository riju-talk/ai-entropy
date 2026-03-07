"""
Q&A endpoint — backed by Entropy Agentic RAG Pipeline

Pipeline:  Pinecone RAG → 7-layer AI Brain → NLI judge (Layer 7) → trust scoring (Layer 8)
Optional:  Internet research (Bing) when no Pinecone results are found and BING_API_KEY is set.

Response includes a `cognitive_trace` block so the frontend CognitiveTraceCard
can render real data instead of mock values.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, model_validator
import logging
import time
import math

from app.services import reasoning_service
from app.services.agentic_rag_service import agentic_rag_service
from app.services.mastery_service import track_qa_interaction, compute_user_metrics

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
    return {"greeting": "Hi! I'm Entropy AI ⚡ — your adaptive AI tutor. Ask me anything!"}


@router.get("/health")
async def qa_health():
    return {"status": "healthy", "backend": "Entropy Reasoning Engine (Bedrock Claude)"}


@router.post("/", summary="Ask a question (legacy /api/qa)")
async def post_qa(payload: QAInput, background_tasks: BackgroundTasks):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    t0 = time.time()

    # ── Agentic pipeline (primary path) ───────────────────────────────────
    if agentic_rag_service:
        try:
            result_dict = await agentic_rag_service.process_question(
                question=payload.question.strip(),
                collection_name=payload.collection_name or "default",
                user_id=payload.userId,
                language=payload.language or "en",
                include_hints=True,
                system_prompt=payload.system_prompt,
                conversation_history=payload.conversation_history,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        except Exception:
            logger.exception("Agentic QA pipeline failed")
            raise HTTPException(status_code=500, detail="Reasoning engine error")

        inference_ms = round((time.time() - t0) * 1000)
        intent_detected: str = result_dict.get("intent_detected", "Learning")
        difficulty_level: int = int(result_dict.get("difficulty_level") or 5)
        difficulty_norm = round(min(1.0, max(0.0, difficulty_level / 10.0)), 2)
        confidence = float(result_dict.get("confidence_score") or 0.8)
        mastery_impact = max(1, min(5, math.ceil(confidence * 5)))

        # Normalize concept to English (guard against non-English LLM output)
        _raw_concept: str = result_dict.get("concept", "")
        try:
            from app.services import multilingual_service as _ml
            import asyncio
            detected_concept: str = await _ml.normalize_concept_to_english(_raw_concept) or _raw_concept
        except Exception:
            detected_concept = _raw_concept

        # Fire-and-forget: persist mastery for this QA interaction
        if payload.userId and detected_concept:
            background_tasks.add_task(
                track_qa_interaction, payload.userId, detected_concept, confidence, "chat"
            )

        # Compute metrics algorithmically (never LLM-guessed)
        metrics: dict = {}
        if payload.userId:
            try:
                m = await compute_user_metrics(payload.userId, current_difficulty=difficulty_norm)
                metrics = {
                    "cognitive_load":   m.cognitive_load,
                    "volatility":       m.volatility,
                    "consistency":      m.consistency,
                    "exam_readiness":   m.exam_readiness,
                    "domain_coverage":  m.domain_coverage,
                }
            except Exception:
                pass

        return {
            # ── Primary answer ─────────────────────────────────────────────
            "answer":            result_dict.get("answer", ""),
            "concept":           detected_concept,
            "prerequisites":     result_dict.get("prerequisites", []),
            "stepwise_reasoning": result_dict.get("stepwise_reasoning", []),
            "hint_ladder":       result_dict.get("hint_ladder", []),
            "confidence_score":  confidence,
            "related_concepts":  result_dict.get("related_concepts", []),
            "sources":           result_dict.get("sources", []),
            "mode":              result_dict.get("mode", "reasoning_engine"),
            "follow_up_questions": (result_dict.get("related_concepts") or [])[:3],
            # ── NLI verdict (Layer 7) ──────────────────────────────────────
            "nli_verdict":       result_dict.get("nli_verdict"),
            "nli_confidence":    result_dict.get("nli_confidence"),
            "nli_flags":         int(result_dict.get("nli_flags") or 0),
            # ── Cognitive trace (CognitiveTraceCard) ──────────────────────
            "cognitive_trace": {
                "intent":          intent_detected,
                "concept":         result_dict.get("concept", ""),
                "difficulty":      difficulty_norm,
                "mastery_impact":  mastery_impact,
                "language":        result_dict.get("language") or payload.language or "en",
                "inference_ms":    inference_ms,
                "reasoning_layers": 7,
                # Algorithmic metrics
                **metrics,
                # Normalised sources for citation panel
                "sources": result_dict.get("sources", []),
            },
        }

    # ── Fallback: plain reasoning service (if agentic service failed to init) ──
    try:
        result = await reasoning_service.reason(
            question=payload.question.strip(),
            user_id=payload.userId,
            language=payload.language or "en",
            include_hints=True,
            system_prompt=payload.system_prompt,
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
        # ── NLI verdict (Layer 7 — populated inside reasoning engine) ──────
        "nli_verdict":    meta.get("nli_verdict"),
        "nli_confidence": meta.get("nli_confidence"),
        "nli_flags":      int(meta.get("nli_flags") or 0),
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
