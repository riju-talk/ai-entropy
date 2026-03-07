"""
Entropy AI - Mastery Tracking Engine

Mastery formula:
    mastery = (correct_attempts / total_attempts) * confidence_weight

Confidence weight is reduced by:
    - High hint usage
    - Time decay (if last_seen > DECAY_DAYS)

After every update:
    - Neo4j MASTERED_BY edge is updated
    - Personalised nudge generated if mastery < STRUGGLE_THRESHOLD
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

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

DECAY_DAYS = 7
STRUGGLE_THRESHOLD = 0.4
MASTERED_THRESHOLD = 0.8
# Bayesian smoothing: prevents instant 100% on the first correct answer.
# First correct: 1/(1+3)*1.0 = 25%. Ten correct of ten: 10/13*1.0 ≈ 77%.
PRIOR_ATTEMPTS = 3


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_db_safe():
    """Return Prisma client or None without raising."""
    try:
        from app.core.database import get_db
        return get_db()
    except RuntimeError:
        return None


async def _ensure_concept(db, concept_name: str) -> str:
    """Find or create a Concept row by name; return its id."""
    record = await db.concept.find_first(where={"name": concept_name})
    if record:
        return record.id
    created = await db.concept.create(data={"name": concept_name})
    return created.id


def _compute_confidence_weight(
    current_weight: float,
    last_seen: Optional[datetime],
    hints_used: int,
) -> float:
    """Reduce confidence based on hint dependency and time decay."""
    weight = current_weight

    if hints_used > 0:
        weight -= min(0.3, hints_used * 0.1)

    if last_seen:
        ls = last_seen.replace(tzinfo=timezone.utc) if last_seen.tzinfo is None else last_seen
        days_since = (datetime.now(timezone.utc) - ls).days
        if days_since > DECAY_DAYS:
            decay = min(0.3, (days_since - DECAY_DAYS) * 0.02)
            weight -= decay

    return round(max(0.1, weight), 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def update_mastery(req: MasteryUpdateRequest) -> MasteryUpdateResponse:
    """Process one attempt and return updated mastery state (persisted to DB)."""
    # Always persist concepts in English so Cognitive Studio displays are readable.
    try:
        from app.services import multilingual_service as _ml
        english_concept = await _ml.normalize_concept_to_english(req.concept)
        if english_concept and english_concept != req.concept:
            req = req.model_copy(update={"concept": english_concept})
    except Exception as _e:
        logger.debug("Concept normalisation skipped: %s", _e)

    db = _get_db_safe()
    if db is None:
        logger.warning("DB unavailable; mastery not persisted for user %s", req.user_id)
        return MasteryUpdateResponse(
            user_id=req.user_id,
            concept=req.concept,
            mastery_score=0.0,
            delta=0.0,
            status="unknown",
            nudge=None,
        )

    try:
        concept_id = await _ensure_concept(db, req.concept)

        existing = await db.masteryrecord.find_first(
            where={"userId": req.user_id, "conceptId": concept_id}
        )

        if existing:
            previous_score = existing.masteryScore
            total = existing.totalAttempts + 1
            correct = existing.correctAttempts + (1 if req.is_correct else 0)
            new_conf = _compute_confidence_weight(
                existing.confidenceWeight, existing.lastSeen, req.hints_used
            )
            new_mastery = round((correct / (total + PRIOR_ATTEMPTS)) * new_conf, 4)

            await db.masteryrecord.update(
                where={"id": existing.id},
                data={
                    "totalAttempts": total,
                    "correctAttempts": correct,
                    "masteryScore": new_mastery,
                    "confidenceWeight": new_conf,
                    "lastSeen": datetime.now(timezone.utc),
                },
            )
        else:
            previous_score = 0.0
            total = 1
            correct = 1 if req.is_correct else 0
            new_conf = _compute_confidence_weight(1.0, None, req.hints_used)
            new_mastery = round((correct / (total + PRIOR_ATTEMPTS)) * new_conf, 4)

            await db.masteryrecord.create(
                data={
                    "userId": req.user_id,
                    "conceptId": concept_id,
                    "totalAttempts": total,
                    "correctAttempts": correct,
                    "masteryScore": new_mastery,
                    "confidenceWeight": new_conf,
                    "lastSeen": datetime.now(timezone.utc),
                }
            )

        # Persist to Neo4j (best-effort)
        try:
            await kg.record_mastery(req.user_id, req.concept, new_mastery)
        except Exception as exc:
            logger.warning("Neo4j mastery persist failed: %s", exc)

        delta = round(new_mastery - previous_score, 4)
        status = _status(new_mastery, delta)

        nudge: Optional[str] = None
        if new_mastery < STRUGGLE_THRESHOLD:
            nudge = await _generate_nudge(req.user_id, req.concept, new_mastery, total, correct)

        return MasteryUpdateResponse(
            user_id=req.user_id,
            concept=req.concept,
            mastery_score=new_mastery,
            delta=delta,
            status=status,
            nudge=nudge,
        )

    except Exception as exc:
        logger.exception("update_mastery DB error: %s", exc)
        return MasteryUpdateResponse(
            user_id=req.user_id,
            concept=req.concept,
            mastery_score=0.0,
            delta=0.0,
            status="error",
            nudge=None,
        )


async def track_qa_interaction(
    user_id: str,
    concept: str,
    confidence_score: float,
) -> None:
    """
    Auto-record a lightweight mastery interaction from a QA session.
    Called as a background task after each successful QA response.
    - confidence >= 0.7 -> counts as a correct interaction
    - confidence < 0.7  -> counts as incorrect (concept not yet solid)
    """
    if not user_id or not concept:
        return
    # Normalize concept to English before persisting
    try:
        from app.services import multilingual_service as _ml
        concept = await _ml.normalize_concept_to_english(concept)
    except Exception:
        pass
    req = MasteryUpdateRequest(
        user_id=user_id,
        concept=concept,
        is_correct=confidence_score >= 0.7,
        hints_used=0,
    )
    try:
        await update_mastery(req)
        logger.debug(
            "Auto-mastery tracked: user=%s concept=%s conf=%.2f",
            user_id, concept, confidence_score,
        )
    except Exception as exc:
        logger.warning("track_qa_interaction failed: %s", exc)


async def get_mastery_profile(user_id: str) -> MasteryProfileResponse:
    """Return full mastery profile for a user from DB."""
    db = _get_db_safe()
    if db is None:
        return MasteryProfileResponse(
            user_id=user_id,
            concepts=[],
            weak_concepts=[],
            strong_concepts=[],
            overall_progress=0.0,
        )

    try:
        rows = await db.masteryrecord.find_many(
            where={"userId": user_id},
            include={"concept": True},
            order={"updatedAt": "desc"},
        )

        records = []
        for row in rows:
            concept_name = row.concept.name if row.concept else row.conceptId
            records.append(MasteryRecord(
                user_id=user_id,
                concept=concept_name,
                total_attempts=row.totalAttempts,
                correct_attempts=row.correctAttempts,
                mastery_score=row.masteryScore,
                confidence_weight=row.confidenceWeight,
                last_seen=row.lastSeen,
            ))

        weak = [r.concept for r in records if r.mastery_score < STRUGGLE_THRESHOLD]
        strong = [r.concept for r in records if r.mastery_score >= MASTERED_THRESHOLD]
        overall = sum(r.mastery_score for r in records) / len(records) if records else 0.0

        return MasteryProfileResponse(
            user_id=user_id,
            concepts=records,
            weak_concepts=weak,
            strong_concepts=strong,
            overall_progress=round(overall, 4),
        )

    except Exception as exc:
        logger.exception("get_mastery_profile DB error: %s", exc)
        return MasteryProfileResponse(
            user_id=user_id,
            concepts=[],
            weak_concepts=[],
            strong_concepts=[],
            overall_progress=0.0,
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _status(score: float, delta: float) -> str:
    if score >= MASTERED_THRESHOLD:
        return "mastered"
    if delta > 0:
        return "improving"
    return "struggling"


async def _generate_nudge(
    user_id: str, concept: str, mastery_score: float, total: int, correct: int
) -> str:
    """Use LLM to craft a personalised study nudge."""
    try:
        weak = await kg.get_user_weak_nodes(user_id)
        prompt = MASTERY_HINT_PROMPT.format(
            concept=concept,
            mastery_score=mastery_score,
            weak_concepts=", ".join(weak[:5]) or "none identified",
            attempt_summary=f"{correct} correct out of {total} attempts",
        )
        result = await generate_json(prompt, system_prompt=MASTERY_HINT_SYSTEM)
        return result.get("message", "")
    except Exception as exc:
        logger.warning("Nudge generation failed: %s", exc)
        return "Keep practising - consistency is key!"


# ---------------------------------------------------------------------------
# Spaced repetition
# ---------------------------------------------------------------------------

# SM-2 simplified: mastery → review interval in days
_REVIEW_INTERVALS: list[tuple[float, int]] = [
    (0.85, 14),   # mastered       → fortnight
    (0.70,  7),   # proficient     → weekly
    (0.50,  3),   # halfway        → every 3 days
    (0.00,  1),   # struggling     → daily reinforcement
]


def _review_interval_days(mastery_score: float) -> int:
    for threshold, days in _REVIEW_INTERVALS:
        if mastery_score >= threshold:
            return days
    return 1


async def get_review_queue(user_id: str) -> list[dict]:
    """
    Return concepts due for spaced repetition review, ordered by urgency.

    Uses a simplified SM-2 schedule keyed to mastery score — higher mastery
    extends the review gap (up to 14 days for mastered concepts).
    """
    profile = await get_mastery_profile(user_id)
    now = datetime.now(timezone.utc)
    due: list[dict] = []

    for c in profile.concepts:
        if not c.last_seen:
            continue
        interval = _review_interval_days(c.mastery_score)
        last_utc = (
            c.last_seen.replace(tzinfo=timezone.utc)
            if c.last_seen.tzinfo is None
            else c.last_seen
        )
        days_since = (now - last_utc).days

        if days_since >= interval:
            overdue_by = days_since - interval
            due.append({
                "concept": c.concept,
                "mastery": round(c.mastery_score * 100),
                "days_since": days_since,
                "interval_days": interval,
                "overdue_days": overdue_by,
                "urgency": "critical" if overdue_by >= interval else "due",
                "suggested_prompt": (
                    f"Quick review: can you explain {c.concept} in your own words?"
                ),
            })

    # Sort: most overdue first, then lowest mastery first
    due.sort(key=lambda x: (-x["overdue_days"], x["mastery"]))
    return due[:10]


# ---------------------------------------------------------------------------
# AI-powered study plan
# ---------------------------------------------------------------------------

async def generate_study_plan(user_id: str, goal: str, days: int = 7) -> dict:
    """
    Generate a day-by-day personalised study plan using the user's mastery
    profile + knowledge-graph prerequisite paths + an LLM call.
    """
    profile = await get_mastery_profile(user_id)

    # Build prerequisite context for weak concepts
    path_context: list[str] = []
    for concept in profile.weak_concepts[:4]:
        try:
            path = await kg.get_recommended_path(user_id, concept)
            if path and len(path) > 1:
                path_context.append(
                    f"To master '{concept}' learn in order: {' → '.join(path)}"
                )
        except Exception:
            pass

    # Spaced repetition items to weave in
    review_queue = await get_review_queue(user_id)
    review_due = [r["concept"] for r in review_queue[:3]]

    prompt = f"""
Goal: {goal}
Days available: {days}
Current overall mastery: {round(profile.overall_progress * 100)}%
Weak concepts (need most focus): {', '.join(profile.weak_concepts[:5]) or 'none yet - start fresh'}
Strong concepts (quick reviews OK): {', '.join(profile.strong_concepts[:4]) or 'none yet'}
Prerequisite learning paths: {'; '.join(path_context) or 'not analyzed yet'}
Concepts due for spaced review: {', '.join(review_due) or 'none overdue'}

Generate a precise, day-by-day study plan as JSON matching this schema exactly:
{{
  "title": "short catchy title",
  "goal": "{goal}",
  "daily_plan": [
    {{
      "day": 1,
      "concept_focus": "main concept to study (specific, not vague)",
      "review_concepts": ["concept due for spaced review today"],
      "tasks": ["specific hands-on task 1", "specific task 2 (max 3 tasks)"],
      "estimated_minutes": 45,
      "milestone": "what you can DO after today (outcome-focused)"
    }}
  ],
  "success_metrics": ["measurable metric 1", "measurable metric 2"],
  "final_outcome": "what the student will be able to do on day {days}"
}}
Ensure all {days} days are included. Keep tasks specific and actionable, not generic advice.
"""
    try:
        result = await generate_json(
            prompt,
            system_prompt=(
                "You are an expert adaptive learning coach. Generate highly specific, "
                "outcome-focused study plans. Each task must be actionable (e.g., "
                "'Solve 3 integration problems using chain rule', not 'study calculus'). "
                "Weave spaced-repetition reviews into later days naturally."
            ),
        )
        return result
    except Exception as exc:
        logger.warning("generate_study_plan LLM call failed: %s", exc)
        return {
            "title": f"{days}-Day Plan: {goal}",
            "goal": goal,
            "daily_plan": [],
            "error": "AI generation failed — try again",
            "fallback_focus": profile.weak_concepts[:3],
        }
