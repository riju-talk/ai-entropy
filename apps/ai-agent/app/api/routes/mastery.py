"""
Entropy AI - Mastery Tracking API Routes
POST /api/mastery/attempt
GET  /api/mastery/profile/{user_id}
GET  /api/mastery/cognitive-stats/{user_id}
GET  /api/mastery/review-queue/{user_id}
POST /api/mastery/study-plan
"""
from fastapi import APIRouter, HTTPException
from typing import Any, Dict
import logging

from app.schemas.mastery import (
    MasteryUpdateRequest,
    MasteryUpdateResponse,
    MasteryProfileResponse,
)
from app.services import mastery_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/attempt", response_model=MasteryUpdateResponse, summary="Record attempt & update mastery")
async def record_attempt(request: MasteryUpdateRequest) -> MasteryUpdateResponse:
    """
    Record a student attempt on a concept and return the updated mastery state.
    Mastery = (correct_attempts / total_attempts) * confidence_weight.
    """
    try:
        return await mastery_service.update_mastery(request)
    except Exception as exc:
        logger.exception("Mastery update failed: %s", exc)
        raise HTTPException(status_code=500, detail="Mastery engine error")


@router.get("/profile/{user_id}", response_model=MasteryProfileResponse, summary="Get mastery profile")
async def get_profile(user_id: str) -> MasteryProfileResponse:
    """
    Return the full mastery profile for a user:
    per-concept mastery scores, weak/strong concepts, overall progress.
    """
    try:
        return await mastery_service.get_mastery_profile(user_id)
    except Exception as exc:
        logger.exception("Profile fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Mastery profile error")


@router.get("/cognitive-stats/{user_id}", summary="Get derived cognitive stats for the Cognitive Studio UI")
async def get_cognitive_stats(user_id: str):
    """
    Returns all stats needed by the Cognitive Studio panel:
    mastery radar data, volatility, cognitive load, exam readiness,
    recall, reasoning, speed, accuracy.
    """
    try:
        profile = await mastery_service.get_mastery_profile(user_id)
        concepts = profile.concepts
        total = len(concepts)

        overall_progress = profile.overall_progress
        exam_readiness = round(overall_progress * 100)

        weak_ratio = len(profile.weak_concepts) / total if total else 0.0
        volatility = round(weak_ratio * 100)

        low_conf = sum(1 for c in concepts if c.confidence_weight < 0.7)
        cognitive_load = round((low_conf / total) * 100) if total else 0

        recall = round((len(profile.strong_concepts) / total) * 100) if total else 0
        reasoning = max(20, round((1 - weak_ratio) * 100)) if total else 0

        avg_conf = sum(c.confidence_weight for c in concepts) / total if total else 0.0
        speed = round(avg_conf * 100)

        total_attempts = sum(c.total_attempts for c in concepts)
        correct_attempts = sum(c.correct_attempts for c in concepts)
        accuracy = round((correct_attempts / total_attempts) * 100) if total_attempts else 0

        # Radar data: top-5 concepts by mastery score
        radar = sorted(concepts, key=lambda c: c.mastery_score, reverse=True)[:5]
        radar_data = [
            {
                "concept": c.concept,
                "mastery": round(c.mastery_score * 100),
                "attempts": c.total_attempts,
            }
            for c in radar
        ]

        return {
            "user_id": user_id,
            "overall_progress": overall_progress,
            "exam_readiness": exam_readiness,
            "volatility": volatility,
            "cognitive_load": cognitive_load,
            "recall": recall,
            "reasoning": reasoning,
            "speed": speed,
            "accuracy": accuracy,
            "radar_data": radar_data,
            "weak_concepts": profile.weak_concepts,
            "strong_concepts": profile.strong_concepts,
            "total_concepts": total,
        }
    except Exception as exc:
        logger.exception("Cognitive stats fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Cognitive stats error")


@router.get("/review-queue/{user_id}", summary="Spaced repetition: concepts due for review")
async def get_review_queue(user_id: str):
    """
    Returns concepts due for spaced repetition using a simplified SM-2 schedule.
    Higher mastery → longer review gap (up to 14 days for mastered concepts).
    Concepts overdue by more than one full interval are marked 'critical'.
    """
    try:
        queue = await mastery_service.get_review_queue(user_id)
        return {
            "user_id": user_id,
            "due_count": len(queue),
            "critical_count": sum(1 for q in queue if q["urgency"] == "critical"),
            "queue": queue,
        }
    except Exception as exc:
        logger.exception("Review queue failed: %s", exc)
        raise HTTPException(status_code=500, detail="Review queue error")


@router.post("/study-plan", summary="Generate AI-powered personalised study plan")
async def create_study_plan(body: Dict[str, Any]):
    """
    Generate a day-by-day study plan tailored to the user's mastery profile,
    knowledge-graph prerequisite paths, and spaced-repetition review schedule.

    Body: { "user_id": str, "goal": str, "days": int (default 7) }
    """
    user_id: str = body.get("user_id", "")
    goal: str = body.get("goal", "Master the subject")
    days: int = max(1, min(30, int(body.get("days", 7))))
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    try:
        plan = await mastery_service.generate_study_plan(user_id, goal, days)
        return plan
    except Exception as exc:
        logger.exception("Study plan generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Study plan error")
