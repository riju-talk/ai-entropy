"""
Lambda worker — Mastery + XP update (async, SQS-triggered)

Consumed from the entropy-mastery-queue SQS queue.
Runs completely off the critical QA response path — the student gets
their answer immediately; mastery updates happen here asynchronously.

SQS message body (JSON):
  {
    "user_id": str,
    "concept": str,
    "correct": bool,
    "confidence": float,
    "event_type": "chat" | "quiz" | "exam" | "practice"
  }
"""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


async def _process_record(body: dict) -> None:
    from app.services.mastery_service import track_qa_interaction
    await track_qa_interaction(
        user_id=body["user_id"],
        concept=body["concept"],
        correct=body.get("correct", True),
        confidence=float(body.get("confidence", 0.8)),
        event_type=body.get("event_type", "chat"),
    )
    logger.info(
        "Mastery updated: user=%s concept=%s event=%s",
        body["user_id"], body["concept"], body.get("event_type"),
    )


async def _run(event: dict) -> None:
    records = event.get("Records", [])
    tasks = [_process_record(json.loads(r["body"])) for r in records]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r, res in zip(records, results):
        if isinstance(res, Exception):
            logger.error("Mastery record failed for %s: %s", r.get("messageId"), res)


def handler(event: dict, context) -> dict:
    """Lambda entry-point (SQS trigger, batch size 10)."""
    asyncio.run(_run(event))
    return {"statusCode": 200}
