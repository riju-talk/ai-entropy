"""
Bus topics and their handlers (these replace the SQS-triggered Lambda workers).

Topics
------
  mastery.update       {user_id, concept, correct, confidence, event_type}
  gamification.event   {user_id, event_type, metadata}

Handlers may be delivered more than once (retries, outbox replay) and must be safe to repeat.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from app.bus.bus import MessageBus

logger = logging.getLogger(__name__)

TOPIC_MASTERY = "mastery.update"
TOPIC_GAMIFICATION = "gamification.event"

_STREAK_EVENTS = {"ANSWER_ACCEPTED", "QUESTION_ASKED", "DAILY_LOGIN", "MASTERY_UPDATED"}


async def handle_mastery_update(body: Dict[str, Any]) -> None:
    from app.services.mastery_service import track_qa_interaction

    await track_qa_interaction(
        user_id=body["user_id"],
        concept=body["concept"],
        confidence_score=float(body.get("confidence", 0.8)),
        event_type=body.get("event_type", "chat"),
    )
    logger.info("Mastery updated: user=%s concept=%s", body["user_id"], body["concept"])


async def handle_gamification_event(body: Dict[str, Any]) -> None:
    from app.services.events.event_definitions import Event, EventType
    from app.services.gamification.achievement_engine import check_and_unlock_achievements
    from app.services.gamification.streak_manager import update_user_streak
    from app.services.gamification.xp_engine import award_xp

    user_id = body["user_id"]
    event_type = body.get("event_type", "XP_AWARDED").upper()
    metadata = body.get("metadata", {})

    await award_xp(user_id, event_type, metadata)
    if event_type in _STREAK_EVENTS:
        await update_user_streak(user_id)

    try:
        ai_event_type = EventType(event_type)
    except ValueError:
        ai_event_type = EventType.XP_AWARDED
    await check_and_unlock_achievements(user_id, Event(event_type=ai_event_type, user_id=user_id, metadata=metadata))
    logger.info("Gamification processed: user=%s event=%s", user_id, event_type)


def register_handlers(bus: MessageBus) -> None:
    bus.subscribe(TOPIC_MASTERY, handle_mastery_update, workers=2)
    bus.subscribe(TOPIC_GAMIFICATION, handle_gamification_event, workers=1)
