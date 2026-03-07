"""
Lambda worker — Gamification event (async, SQS-triggered)

Consumed from the entropy-gamification-queue SQS queue.
Isolated so a gamification crash NEVER causes a 500 on the QA endpoint.

SQS message body (JSON):
  {
    "user_id": str,
    "event_type": str,          e.g. "ANSWER_ACCEPTED", "DAILY_LOGIN"
    "metadata": dict            optional extra fields
  }
"""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


async def _process_record(body: dict) -> None:
    from app.core.database import get_db
    from app.services.gamification.xp_engine import award_xp, calculate_xp
    from app.services.gamification.achievement_engine import check_and_unlock_achievements
    from app.services.gamification.streak_manager import update_user_streak
    from app.services.events.event_definitions import Event, EventType

    user_id = body["user_id"]
    event_type = body.get("event_type", "XP_AWARDED").upper()
    metadata = body.get("metadata", {})

    # 1. Award XP
    await award_xp(user_id, event_type, metadata)

    # 2. Update streak for qualifying events
    _STREAK_EVENTS = {"ANSWER_ACCEPTED", "QUESTION_ASKED", "DAILY_LOGIN", "MASTERY_UPDATED"}
    if event_type in _STREAK_EVENTS:
        await update_user_streak(user_id)

    # 3. Check achievements
    try:
        ai_event_type = EventType(event_type)
    except ValueError:
        ai_event_type = EventType.XP_AWARDED

    triggering_event = Event(event_type=ai_event_type, user_id=user_id, metadata=metadata)
    await check_and_unlock_achievements(user_id, triggering_event)

    logger.info("Gamification processed: user=%s event=%s", user_id, event_type)


async def _run(event: dict) -> None:
    records = event.get("Records", [])
    for r in records:
        try:
            body = json.loads(r["body"])
            await _process_record(body)
        except Exception as exc:
            logger.error("Gamification record failed %s: %s", r.get("messageId"), exc)
            # Don't re-raise — acknowledge the message to avoid infinite retry loops


def handler(event: dict, context) -> dict:
    """Lambda entry-point (SQS trigger, batch size 10)."""
    asyncio.run(_run(event))
    return {"statusCode": 200}
