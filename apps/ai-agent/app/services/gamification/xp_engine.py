"""
NOVYRA XP Engine

Calculates XP with anti-exploit multipliers.
Reference: docs/GAME_ENGINE_ARCHITECTURE.md

XP Formula:
XP = base_xp × trust_multiplier × time_decay × fact_check_multiplier × difficulty_multiplier
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class XPCalculation:
    """Result of XP calculation with breakdown."""
    base_xp: int
    trust_mult: float
    time_decay: float
    fact_check_mult: float
    difficulty_mult: float
    final_xp: int
    reason: str


# Base XP values for different activities
BASE_XP_VALUES = {
    "ANSWER_ACCEPTED": 100,
    "MASTERY_GAIN": 50,
    "DOUBT_UPVOTED": 10,
    "ANSWER_UPVOTED": 5,
    "CONCEPT_ATTEMPTED": 20,
    "CONCEPT_COMPLETED": 75,
    "ACHIEVEMENT_UNLOCKED": 0,  # Variable per achievement
    "STREAK_MILESTONE": 50,
    "HELPFUL_VOTE": 3,
    "QUALITY_DOUBT": 25
}


async def calculate_xp(
    user_id: str,
    event_type: str,
    metadata: Optional[Dict[str, Any]] = None
) -> XPCalculation:
    """
    Calculate XP for an event with all multipliers applied.
    
    Args:
        user_id: User earning XP
        event_type: Type of event (ANSWER_ACCEPTED, MASTERY_GAIN, etc.)
        metadata: Additional context (concept_id, difficulty, fact_check_result, etc.)
    
    Returns:
        XPCalculation with full breakdown
    """
    metadata = metadata or {}
    
    # Get base XP
    base_xp = metadata.get("base_xp") or BASE_XP_VALUES.get(event_type, 0)
    
    if base_xp == 0:
        logger.warning(f"Unknown event type for XP calculation: {event_type}")
        return XPCalculation(
            base_xp=0,
            trust_mult=0,
            time_decay=0,
            fact_check_mult=0,
            difficulty_mult=0,
            final_xp=0,
            reason="Unknown event type"
        )
    
    # Calculate multipliers
    trust_mult = await calculate_trust_multiplier(user_id)
    time_decay = calculate_time_decay(metadata.get("content_age_days"))
    fact_check_mult = calculate_fact_check_multiplier(metadata.get("fact_check_result"))
    difficulty_mult = calculate_difficulty_multiplier(metadata.get("difficulty"))
    
    # Apply formula
    final_xp = int(base_xp * trust_mult * time_decay * fact_check_mult * difficulty_mult)
    
    return XPCalculation(
        base_xp=base_xp,
        trust_mult=trust_mult,
        time_decay=time_decay,
        fact_check_mult=fact_check_mult,
        difficulty_mult=difficulty_mult,
        final_xp=final_xp,
        reason=metadata.get("reason", event_type)
    )


async def calculate_trust_multiplier(user_id: str) -> float:
    """
    Trust multiplier: 0.5× to 1.5×
    
    Based on user's cached trust score.
    Low trust users earn reduced XP.
    """
    db = get_db()
    
    user = await db.user.find_unique({
        "where": {"id": user_id},
        "select": {"trustScoreCache": True}
    })
    
    if not user:
        return 0.5  # Default for new users
    
    trust_score = user.trustScoreCache or 0.5
    
    # Map trust score [0-1] to multiplier [0.5-1.5]
    # Formula: 0.5 + trust_score
    multiplier = 0.5 + trust_score
    
    return max(0.5, min(1.5, multiplier))


def calculate_time_decay(content_age_days: Optional[int]) -> float:
    """
    Time decay multiplier: 1.0× (fresh) to 0.5× (old)
    
    Encourages answering recent doubts, not farming old content.
    Applied only to answers.
    """
    if content_age_days is None:
        return 1.0  # No decay for non-answer events
    
    # Decay after 7 days
    if content_age_days <= 7:
        return 1.0
    elif content_age_days <= 30:
        # Linear decay from 1.0 to 0.7 over days 7-30
        return 1.0 - (content_age_days - 7) * 0.013
    else:
        return 0.5  # Cap at 0.5× for very old content


def calculate_fact_check_multiplier(fact_check_result: Optional[str]) -> float:
    """
    Fact-check multiplier: 1.5× (passed) to 0.3× (failed)
    
    Rewards factually correct content.
    """
    if fact_check_result is None:
        return 1.0  # No fact-check performed
    
    if fact_check_result == "PASS":
        return 1.5
    elif fact_check_result == "UNCERTAIN":
        return 1.0
    elif fact_check_result == "FLAG":
        return 0.3  # Significant penalty
    else:
        return 1.0


def calculate_difficulty_multiplier(difficulty: Optional[int]) -> float:
    """
    Difficulty multiplier: 1.0× to 1.5×
    
    Rewards mastering harder concepts.
    Applied only to mastery events.
    """
    if difficulty is None:
        return 1.0  # No difficulty context
    
    # Map difficulty [1-10] to multiplier [1.0-1.5]
    # Formula: 1.0 + (difficulty / 10) * 0.5
    multiplier = 1.0 + (difficulty / 10) * 0.5
    
    return max(1.0, min(1.5, multiplier))


async def award_xp(
    user_id: str,
    event_type: str,
    metadata: Optional[Dict[str, Any]] = None
) -> int:
    """
    Calculate and award XP for an event.
    
    Creates ledger entry and updates user's total XP.
    
    Returns:
        Final XP amount awarded
    """
    calculation = await calculate_xp(user_id, event_type, metadata)
    
    if calculation.final_xp <= 0:
        return 0
    
    db = get_db()
    
    # Create XP ledger entry
    await db.xp_ledger.create({
        "data": {
            "userId": user_id,
            "eventType": event_type,
            "conceptId": metadata.get("concept_id"),
            "baseXP": calculation.base_xp,
            "trustMult": calculation.trust_mult,
            "timeDecay": calculation.time_decay,
            "factCheckMult": calculation.fact_check_mult,
            "difficultyMult": calculation.difficulty_mult,
            "finalXP": calculation.final_xp,
            "reason": calculation.reason,
            "metadata": metadata or {}
        }
    })
    
    # Update user's total XP
    await db.user.update({
        "where": {"id": user_id},
        "data": {"totalXP": {"increment": calculation.final_xp}}
    })
    
    logger.info(
        f"Awarded {calculation.final_xp} XP to user {user_id} "
        f"(base={calculation.base_xp}, trust={calculation.trust_mult:.2f})"
    )
    
    return calculation.final_xp


async def get_xp_breakdown(user_id: str, days: int = 7) -> Dict[str, Any]:
    """
    Get breakdown of XP earned over last N days.
    
    Returns:
        Dict with total XP and breakdown by event type
    """
    db = get_db()
    
    since = datetime.now() - timedelta(days=days)
    
    ledger_entries = await db.xp_ledger.find_many({
        "where": {
            "userId": user_id,
            "timestamp": {"gte": since}
        }
    })
    
    total_xp = sum(entry.finalXP for entry in ledger_entries)
    
    # Group by event type
    by_event_type: Dict[str, int] = {}
    for entry in ledger_entries:
        event_type = entry.eventType
        by_event_type[event_type] = by_event_type.get(event_type, 0) + entry.finalXP
    
    return {
        "total_xp": total_xp,
        "days": days,
        "by_event_type": by_event_type,
        "entry_count": len(ledger_entries)
    }


async def validate_xp_authenticity(user_id: str) -> bool:
    """
    Validate that XP earnings are genuine.
    
    Detects:
    - Rapid XP farming
    - Abnormal XP rates
    - Suspicious patterns
    """
    db = get_db()
    
    # Get last 24h of XP
    since = datetime.now() - timedelta(hours=24)
    
    ledger_entries = await db.xp_ledger.find_many({
        "where": {
            "userId": user_id,
            "timestamp": {"gte": since}
        },
        "orderBy": {"timestamp": "asc"}
    })
    
    if not ledger_entries:
        return True
    
    total_xp_24h = sum(entry.finalXP for entry in ledger_entries)
    
    # Pattern 1: Abnormally high XP in 24h (>5000 XP)
    if total_xp_24h > 5000:
        logger.warning(f"Suspicious XP rate for user {user_id}: {total_xp_24h} XP in 24h")
        return False
    
    # Pattern 2: Too many identical XP awards in short time
    if len(ledger_entries) > 50:
        # Check for farming pattern
        event_types = [entry.eventType for entry in ledger_entries]
        most_common = max(set(event_types), key=event_types.count)
        count = event_types.count(most_common)
        
        if count > 30:  # Same event 30+ times in 24h
            logger.warning(f"Suspicious XP pattern for user {user_id}: {most_common} × {count}")
            return False
    
    return True


logger.info("XP engine initialized")
