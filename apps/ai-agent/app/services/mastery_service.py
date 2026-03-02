"""
NOVYRA — Mastery Tracking Engine

Mastery formula:
    mastery = (correct_attempts / total_attempts) * confidence_weight

Confidence weight is reduced by:
    - High hint usage
    - High reattempt frequency
    - Time decay (if last_seen > DECAY_DAYS)

After every update:
    - Neo4j MASTERED_BY edge is updated
    - Personalised nudge generated if mastery < STRUGGLE_THRESHOLD
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.llm import generate_json
from app.core.prompts import MASTERY_HINT_SYSTEM, MASTERY_HINT_PROMPT
from app.schemas.mastery import (
    MasteryUpdateRequest,
    MasteryUpdateResponse,
    MasteryRecord,
    MasteryProfileResponse,
)
from app.services import knowledge_graph_service as kg

logger = logging.getLogger(__name__)

# In-memory store for MVP — swap with PostgreSQL in production
# Key: (user_id, concept) → MasteryRecord
_store: Dict[tuple, MasteryRecord] = {}

DECAY_DAYS = 7
STRUGGLE_THRESHOLD = 0.4
MASTERED_THRESHOLD = 0.8


def _get_record(user_id: str, concept: str) -> MasteryRecord:
    key = (user_id, concept)
    if key not in _store:
        _store[key] = MasteryRecord(user_id=user_id, concept=concept)
    return _store[key]


def _compute_confidence_weight(record: MasteryRecord, hints_used: int) -> float:
    """Reduce confidence based on hint dependency and time decay."""
    weight = 1.0

    # Penalise heavy hint usage
    if hints_used > 0:
        weight -= min(0.3, hints_used * 0.1)

    # Time decay
    if record.last_seen:
        days_since = (datetime.now(timezone.utc) - record.last_seen).days
        if days_since > DECAY_DAYS:
            decay = min(0.3, (days_since - DECAY_DAYS) * 0.02)
            weight -= decay

    return max(0.1, weight)


async def update_mastery(req: MasteryUpdateRequest) -> MasteryUpdateResponse:
    """Process one attempt and return updated mastery state."""
    record = _get_record(req.user_id, req.concept)
    previous_score = record.mastery_score

    # Update attempt counters
    record.total_attempts += 1
    if req.is_correct:
        record.correct_attempts += 1

    # Recompute confidence weight
    record.confidence_weight = _compute_confidence_weight(record, req.hints_used)

    # Recompute mastery
    if record.total_attempts > 0:
        raw_ratio = record.correct_attempts / record.total_attempts
        record.mastery_score = round(raw_ratio * record.confidence_weight, 4)

    record.last_seen = datetime.now(timezone.utc)
    _store[(req.user_id, req.concept)] = record

    # Persist to Neo4j
    try:
        await kg.record_mastery(req.user_id, req.concept, record.mastery_score)
    except Exception as exc:
        logger.warning("Neo4j mastery persist failed: %s", exc)

    delta = round(record.mastery_score - previous_score, 4)
    status = _status(record.mastery_score, delta)

    # Generate nudge if struggling
    nudge: Optional[str] = None
    if record.mastery_score < STRUGGLE_THRESHOLD:
        nudge = await _generate_nudge(record)

    return MasteryUpdateResponse(
        user_id=req.user_id,
        concept=req.concept,
        mastery_score=record.mastery_score,
        delta=delta,
        status=status,
        nudge=nudge,
    )


def _status(score: float, delta: float) -> str:
    if score >= MASTERED_THRESHOLD:
        return "mastered"
    if delta > 0:
        return "improving"
    return "struggling"


async def _generate_nudge(record: MasteryRecord) -> str:
    """Use Gemini to craft a personalised study nudge."""
    try:
        weak = await kg.get_user_weak_nodes(record.user_id)
        prompt = MASTERY_HINT_PROMPT.format(
            concept=record.concept,
            mastery_score=record.mastery_score,
            weak_concepts=", ".join(weak[:5]) or "none identified",
            attempt_summary=(
                f"{record.correct_attempts} correct out of {record.total_attempts} attempts"
            ),
        )
        result = await generate_json(prompt, system_prompt=MASTERY_HINT_SYSTEM)
        return result.get("message", "")
    except Exception as exc:
        logger.warning("Nudge generation failed: %s", exc)
        return "Keep practising — consistency is key!"


def get_mastery_profile(user_id: str) -> MasteryProfileResponse:
    """Return full mastery profile for a user."""
    records = [r for (uid, _), r in _store.items() if uid == user_id]

    weak = [r.concept for r in records if r.mastery_score < STRUGGLE_THRESHOLD]
    strong = [r.concept for r in records if r.mastery_score >= MASTERED_THRESHOLD]
    overall = (
        sum(r.mastery_score for r in records) / len(records) if records else 0.0
    )

    return MasteryProfileResponse(
        user_id=user_id,
        concepts=records,
        weak_concepts=weak,
        strong_concepts=strong,
        overall_progress=round(overall, 4),
    )
