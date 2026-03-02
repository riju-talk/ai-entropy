"""
NOVYRA — Mastery Tracking API Routes
POST /api/mastery/attempt
GET  /api/mastery/profile/{user_id}
"""
from fastapi import APIRouter, HTTPException
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

    Mastery formula:
        mastery = (correct_attempts / total_attempts) * confidence_weight

    Confidence weight decreases with hint dependency and inactivity decay.
    Returns a personalised nudge when mastery is below 40%.
    """
    try:
        return await mastery_service.update_mastery(request)
    except Exception as exc:
        logger.exception("Mastery update failed: %s", exc)
        raise HTTPException(status_code=500, detail="Mastery engine error")


@router.get("/profile/{user_id}", response_model=MasteryProfileResponse, summary="Get mastery profile")
async def get_profile(user_id: str) -> MasteryProfileResponse:
    """
    Return the full mastery profile for a user including:
    - Per-concept mastery scores
    - Weak and strong concepts
    - Overall progress (0-1)
    """
    try:
        return mastery_service.get_mastery_profile(user_id)
    except Exception as exc:
        logger.exception("Profile fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Mastery profile error")
