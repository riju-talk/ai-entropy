"""
NOVYRA Event Handlers - Core Event Processing Logic

Handlers that respond to system events and trigger appropriate actions.
"""
import logging
from typing import Dict, Any

from app.services.events.event_definitions import (
    Event,
    EventType,
    AnswerAcceptedEvent,
    MasteryUpdatedEvent,
    XPAwardedEvent
)
from app.services.events.event_bus import event_handler, emit_event
from app.core.database import get_db

logger = logging.getLogger(__name__)


# ============================================================
# XP Award Handlers
# ============================================================

@event_handler(EventType.ANSWER_ACCEPTED)
async def award_xp_for_accepted_answer(event: Event):
    """Award XP when an answer is accepted."""
    answerer_id = event.metadata.get("answerer_id")
    concept_id = event.metadata.get("concept_id")
    
    if not answerer_id:
        return
    
    # Get user's trust score
    trust_score = await get_user_trust_score(answerer_id)
    
    # Calculate XP with multipliers
    base_xp = 100
    trust_mult = 0.5 + trust_score  # 0.5-1.5×
    fact_check_mult = 1.0  # TODO: Get from fact-check data
    
    final_xp = int(base_xp * trust_mult * fact_check_mult)
    
    # Create XP ledger entry
    db = get_db()
    await db.xp_ledger.create({
        "data": {
            "userId": answerer_id,
            "eventType": "ANSWER_ACCEPTED",
            "conceptId": concept_id,
            "baseXP": base_xp,
            "trustMult": trust_mult,
            "factCheckMult": fact_check_mult,
            "timeDecay": 1.0,
            "finalXP": final_xp,
            "reason": "Answer accepted",
            "metadata": event.metadata
        }
    })
    
    # Update user's total XP
    await db.user.update({
        "where": {"id": answerer_id},
        "data": {"totalXP": {"increment": final_xp}}
    })
    
    # Emit XP awarded event
    await emit_event(XPAwardedEvent(
        user_id=answerer_id,
        xp_amount=final_xp,
        reason="Answer accepted",
        source_event="ANSWER_ACCEPTED",
        multipliers={"trust": trust_mult, "fact_check": fact_check_mult}
    ))
    
    logger.info(f"Awarded {final_xp} XP to user {answerer_id} for accepted answer")


@event_handler(EventType.MASTERY_UPDATED)
async def award_xp_for_mastery_gain(event: Event):
    """Award XP when mastery score increases significantly."""
    user_id = event.user_id
    delta = event.metadata.get("delta", 0)
    concept_id = event.metadata.get("concept_id")
    
    # Only award for significant gains (>0.05)
    if delta < 0.05:
        return
    
    # Get concept difficulty
    db = get_db()
    concept = await db.concept.find_unique({"where": {"id": concept_id}})
    
    if not concept:
        return
    
    difficulty = concept.difficulty
    
    # Calculate XP
    base_xp = 50
    mastery_mult = 1.0 + (difficulty / 10) * 0.5  # 1.0-1.5×
    trust_score = await get_user_trust_score(user_id)
    trust_mult = 0.5 + trust_score
    
    final_xp = int(base_xp * mastery_mult * trust_mult)
    
    # Create ledger entry
    await db.xp_ledger.create({
        "data": {
            "userId": user_id,
            "eventType": "MASTERY_GAIN",
            "conceptId": concept_id,
            "baseXP": base_xp,
            "masteryMult": mastery_mult,
            "trustMult": trust_mult,
            "timeDecay": 1.0,
            "finalXP": final_xp,
            "reason": f"Mastery gain (+{delta:.2f})",
            "metadata": event.metadata
        }
    })
    
    # Update total XP
    await db.user.update({
        "where": {"id": user_id},
        "data": {"totalXP": {"increment": final_xp}}
    })
    
    logger.info(f"Awarded {final_xp} XP to user {user_id} for mastery gain")


@event_handler(EventType.ANSWER_UPVOTED)
async def award_xp_for_upvote(event: Event):
    """Award small XP for upvoted answers."""
    answerer_id = event.metadata.get("answerer_id")
    voter_trust = event.metadata.get("voter_trust", 0.5)
    
    if not answerer_id:
        return
    
    base_xp = 5
    final_xp = int(base_xp * voter_trust)  # Weight by voter's trust
    
    db = get_db()
    await db.xp_ledger.create({
        "data": {
            "userId": answerer_id,
            "eventType": "ANSWER_UPVOTED",
            "baseXP": base_xp,
            "trustMult": voter_trust,
            "finalXP": final_xp,
            "reason": "Answer upvoted",
            "metadata": event.metadata
        }
    })
    
    await db.user.update({
        "where": {"id": answerer_id},
        "data": {"totalXP": {"increment": final_xp}}
    })


# ============================================================
# Reputation Handlers
# ============================================================

@event_handler(EventType.ANSWER_ACCEPTED)
async def update_reputation_for_accepted_answer(event: Event):
    """Increase reputation when answer is accepted."""
    answerer_id = event.metadata.get("answerer_id")
    
    if not answerer_id:
        return
    
    reputation_change = 15
    
    db = get_db()
    
    # Create reputation ledger entry
    await db.reputation_ledger.create({
        "data": {
            "userId": answerer_id,
            "eventType": "ANSWER_ACCEPTED",
            "change": reputation_change,
            "reason": "Answer accepted",
            "sourceId": event.metadata.get("answer_id")
        }
    })
    
    # Update user reputation
    await db.user.update({
        "where": {"id": answerer_id},
        "data": {
            "reputation": {"increment": reputation_change},
            "totalReputation": {"increment": reputation_change}
        }
    })
    
    logger.info(f"Increased reputation of user {answerer_id} by {reputation_change}")


@event_handler(EventType.ANSWER_DOWNVOTED)
async def decrease_reputation_for_downvote(event: Event):
    """Decrease reputation when answer is downvoted."""
    answerer_id = event.metadata.get("answerer_id")
    voter_trust = event.metadata.get("voter_trust", 0.5)
    
    if not answerer_id:
        return
    
    base_change = -2
    weighted_change = int(base_change * voter_trust)
    
    db = get_db()
    
    await db.reputation_ledger.create({
        "data": {
            "userId": answerer_id,
            "eventType": "ANSWER_DOWNVOTED",
            "change": weighted_change,
            "reason": "Answer downvoted",
            "voterTrust": voter_trust,
            "sourceId": event.metadata.get("answer_id")
        }
    })
    
    # Update reputation (can go negative)
    await db.user.update({
        "where": {"id": answerer_id},
        "data": {"reputation": {"increment": weighted_change}}
    })


# ============================================================
# Trust Score Handlers
# ============================================================

@event_handler(
    EventType.ANSWER_ACCEPTED,
    EventType.ANSWER_UPVOTED,
    EventType.MASTERY_UPDATED,
    EventType.ABUSE_FLAG_CREATED
)
async def recalculate_trust_score(event: Event):
    """Recalculate user's trust score after significant events."""
    from app.services.ai_brain.trust_scorer import calculate_trust_score
    
    user_id = event.user_id
    
    try:
        # Calculate new trust score
        trust_result = await calculate_trust_score(user_id)
        
        # Update database
        db = get_db()
        
        # Upsert trust score
        await db.trust_score.upsert({
            "where": {"userId": user_id},
            "update": {
                "score": trust_result.score,
                "masteryReliability": trust_result.components.mastery_reliability,
                "nliTrackRecord": trust_result.components.nli_track_record,
                "communityValidation": trust_result.components.community_validation,
                "accountAgeTrust": trust_result.components.account_age_trust,
                "interactionEntropy": trust_result.components.interaction_entropy,
                "votePatternScore": trust_result.components.vote_pattern_score,
                "similarityFlags": trust_result.components.similarity_flags,
                "abuseFlags": trust_result.components.abuse_flags,
                "ipClusteringRisk": trust_result.components.ip_clustering_risk,
                "lastUpdated": event.timestamp
            },
            "create": {
                "userId": user_id,
                "score": trust_result.score,
                "masteryReliability": trust_result.components.mastery_reliability,
                "nliTrackRecord": trust_result.components.nli_track_record,
                "communityValidation": trust_result.components.community_validation,
                "accountAgeTrust": trust_result.components.account_age_trust,
                "interactionEntropy": trust_result.components.interaction_entropy,
                "votePatternScore": trust_result.components.vote_pattern_score
            }
        })
        
        # Update cached score on user
        await db.user.update({
            "where": {"id": user_id},
            "data": {"trustScoreCache": trust_result.score}
        })
        
        logger.info(f"Updated trust score for user {user_id}: {trust_result.score:.3f}")
        
    except Exception as e:
        logger.error(f"Failed to recalculate trust score for user {user_id}: {e}")


# ============================================================
# Achievement Handlers
# ============================================================

@event_handler(
    EventType.ANSWER_ACCEPTED,
    EventType.MASTERY_UPDATED,
    EventType.STREAK_UPDATED
)
async def check_achievements(event: Event):
    """Check if user has unlocked any achievements after significant events."""
    from app.services.gamification.achievement_engine import check_and_unlock_achievements
    
    user_id = event.user_id
    
    try:
        unlocked = await check_and_unlock_achievements(user_id, event)
        
        if unlocked:
            logger.info(f"User {user_id} unlocked {len(unlocked)} achievements")
            
            # Emit achievement unlocked events
            for achievement in unlocked:
                from app.services.events.event_definitions import AchievementUnlockedEvent
                await emit_event(AchievementUnlockedEvent(
                    user_id=user_id,
                    achievement_id=achievement["id"],
                    achievement_name=achievement["name"],
                    xp_reward=achievement["xp_reward"]
                ))
    
    except Exception as e:
        logger.error(f"Failed to check achievements for user {user_id}: {e}")


# ============================================================
# Streak Handlers
# ============================================================

@event_handler(
    EventType.CONCEPT_ATTEMPTED,
    EventType.ANSWER_SUBMITTED,
    EventType.DOUBT_CREATED
)
async def update_streak(event: Event):
    """Update user's streak when they perform meaningful actions."""
    from app.services.gamification.streak_manager import update_user_streak
    
    user_id = event.user_id
    
    try:
        streak_result = await update_user_streak(user_id)
        
        if streak_result.milestone_reached:
            # Emit streak milestone event
            from app.services.events.event_definitions import StreakUpdatedEvent
            await emit_event(StreakUpdatedEvent(
                user_id=user_id,
                current_streak=streak_result.current_streak,
                longest_streak=streak_result.longest_streak,
                is_milestone=True
            ))
            
            logger.info(f"User {user_id} reached streak milestone: {streak_result.current_streak} days")
    
    except Exception as e:
        logger.error(f"Failed to update streak for user {user_id}: {e}")


# ============================================================
# Helper Functions
# ============================================================

async def get_user_trust_score(user_id: str) -> float:
    """Get user's cached trust score."""
    db = get_db()
    try:
        user = await db.user.find_unique({
            "where": {"id": user_id},
            "select": {"trustScoreCache": True}
        })
        return user.trustScoreCache if user else 0.5
    except:
        return 0.5  # Default neutral trust


# Initialize all handlers on module import
logger.info("Event handlers initialized")
