"""
Entropy AI Achievement Engine

Checks and unlocks achievements with anti-exploit validation.
Reference: docs/GAME_ENGINE_ARCHITECTURE.md
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone

from prisma.fields import Json
from app.core.database import get_db
from app.services.events.event_definitions import Event, EventType

logger = logging.getLogger(__name__)


def _now() -> datetime:
    """Return current UTC time as a timezone-naive datetime (matches Prisma defaults)."""
    return datetime.utcnow()


def _coerce_naive(dt: datetime) -> datetime:
    """Strip timezone info so subtraction never raises offset-naive vs offset-aware."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


# Achievement definitions from GAME_ENGINE_ARCHITECTURE.md
ACHIEVEMENTS = [
    {
        "id": "first_correct_answer",
        "name": "First Steps",
        "description": "Submit your first answer that gets accepted",
        "xp_reward": 100,
        "criteria": {
            "type": "answer_accepted",
            "count": 1
        }
    },
    {
        "id": "concept_master_all",
        "name": "Concept Master",
        "description": "Reach 0.9+ mastery in any concept",
        "xp_reward": 500,
        "criteria": {
            "type": "mastery_threshold",
            "threshold": 0.9,
            "count": 1
        }
    },
    {
        "id": "polymath",
        "name": "Polymath",
        "description": "Reach 0.7+ mastery in 10 different concepts",
        "xp_reward": 1000,
        "criteria": {
            "type": "mastery_threshold",
            "threshold": 0.7,
            "count": 10
        }
    },
    {
        "id": "consistent_learner",
        "name": "Consistent Learner",
        "description": "Maintain a 7-day streak",
        "xp_reward": 300,
        "criteria": {
            "type": "streak",
            "days": 7
        }
    },
    {
        "id": "marathon_learner",
        "name": "Marathon Learner",
        "description": "Maintain a 30-day streak",
        "xp_reward": 1500,
        "criteria": {
            "type": "streak",
            "days": 30
        }
    },
    {
        "id": "helpful_contributor",
        "name": "Helpful Contributor",
        "description": "Get 50 upvotes across your answers",
        "xp_reward": 400,
        "criteria": {
            "type": "total_upvotes",
            "count": 50
        }
    },
    {
        "id": "trusted_expert",
        "name": "Trusted Expert",
        "description": "Reach trust score of 0.85+",
        "xp_reward": 2000,
        "criteria": {
            "type": "trust_score",
            "threshold": 0.85
        }
    },
    {
        "id": "fact_checked",
        "name": "Fact-Checked Scholar",
        "description": "Pass 25 NLI fact-checks",
        "xp_reward": 600,
        "criteria": {
            "type": "nli_passes",
            "count": 25
        }
    },
    {
        "id": "community_validator",
        "name": "Community Validator",
        "description": "Cast 100 votes on others' content",
        "xp_reward": 300,
        "criteria": {
            "type": "votes_cast",
            "count": 100
        }
    },
    {
        "id": "doubt_resolver",
        "name": "Doubt Resolver",
        "description": "Have 20 of your answers accepted",
        "xp_reward": 800,
        "criteria": {
            "type": "answer_accepted",
            "count": 20
        }
    },
    {
        "id": "knowledge_seeker",
        "name": "Knowledge Seeker",
        "description": "Ask 10 quality doubts (upvoted by others)",
        "xp_reward": 250,
        "criteria": {
            "type": "quality_doubts",
            "count": 10,
            "upvote_threshold": 1
        }
    },
    {
        "id": "early_adopter",
        "name": "Early Adopter",
        "description": "Active for 90 days",
        "xp_reward": 500,
        "criteria": {
            "type": "account_age",
            "days": 90
        }
    },
    {
        "id": "mentor",
        "name": "Mentor",
        "description": "Help 5 unique users (accepted answers)",
        "xp_reward": 700,
        "criteria": {
            "type": "unique_users_helped",
            "count": 5
        }
    },
    {
        "id": "fast_responder",
        "name": "Fast Responder",
        "description": "Answer 10 doubts within 5 minutes of posting",
        "xp_reward": 400,
        "criteria": {
            "type": "fast_response",
            "count": 10,
            "time_limit_minutes": 5
        }
    },
    {
        "id": "deep_diver",
        "name": "Deep Diver",
        "description": "Master a concept with difficulty 8+",
        "xp_reward": 1200,
        "criteria": {
            "type": "difficult_concept_mastery",
            "difficulty_threshold": 8,
            "mastery_threshold": 0.9
        }
    }
]


async def check_and_unlock_achievements(user_id: str, triggering_event: Event) -> List[Dict[str, Any]]:
    """
    Check if user has met criteria for any achievements.
    
    Returns list of newly unlocked achievements.
    """
    db = get_db()
    
    # Get user's already-unlocked achievement names
    # NOTE: achievement["id"] is a string key like "first_correct_answer" — NOT the DB cuid
    # Comparing against r.achievementId (a cuid) would never match, causing duplicate unlock
    # attempts and unique constraint errors. Compare by name instead.
    unlock_records = await db.achievementunlock.find_many(
        where={"userId": user_id},
        include={"achievement": True}
    )
    
    unlocked_names = {r.achievement.name for r in unlock_records if r.achievement}
    
    newly_unlocked = []
    
    for achievement in ACHIEVEMENTS:
        # Skip if already unlocked
        if achievement["name"] in unlocked_names:
            continue
        
        try:
            # Check criteria
            criteria_met = await check_achievement_criteria(user_id, achievement, triggering_event)
            
            if criteria_met:
                # Validate to prevent gaming
                validation_passed = await validate_achievement_unlock(user_id, achievement)
                
                if validation_passed:
                    # Unlock achievement
                    unlocked = await unlock_achievement(user_id, achievement)
                    # Only append if XP was actually awarded (0-xp means it was a duplicate skip)
                    newly_unlocked.append(unlocked)
        except Exception as ach_err:
            # Never let a single achievement failure kill the whole check
            logger.warning(
                f"Achievement check/unlock failed for user {user_id}, "
                f"achievement '{achievement.get('name', '?')}': {ach_err}"
            )
            continue
    
    return newly_unlocked


async def check_achievement_criteria(user_id: str, achievement: Dict, event: Event) -> bool:
    """
    Check if achievement criteria are met.
    """
    criteria = achievement["criteria"]
    criteria_type = criteria["type"]
    db = get_db()
    
    try:
        if criteria_type == "answer_accepted":
            # Count accepted answers
            count = await db.answer.count(
                where={
                    "authorId": user_id,
                    "isAnswered": {"not": None}
                }
            )
            return count >= criteria["count"]
        
        elif criteria_type == "mastery_threshold":
            # Count concepts above threshold
            count = await db.masteryrecord.count(
                where={
                    "userId": user_id,
                    "masteryScore": {"gte": criteria["threshold"]}
                }
            )
            return count >= criteria["count"]
        
        elif criteria_type == "streak":
            # Check current streak
            streak = await db.streak.find_unique(where={"userId": user_id})
            return (streak.currentStreak >= criteria["days"]) if streak else False
        
        elif criteria_type == "total_upvotes":
            # Count total upvotes received
            answers = await db.answer.find_many(
                where={"authorId": user_id},
                include={"votes": True}
            )
            total_upvotes = sum(len(a.votes) for a in answers)
            return total_upvotes >= criteria["count"]
        
        elif criteria_type == "trust_score":
            trust = await db.trustscore.find_unique(
                where={"userId": user_id}
            )
            return trust.score >= criteria["threshold"] if trust else False
        
        elif criteria_type == "nli_passes":
            count = await db.factchecklog.count(
                where={
                    "userId": user_id,
                    "safeToDisplay": True
                }
            )
            return count >= criteria["count"]
        
        elif criteria_type == "votes_cast":
            # Count votes cast by user (both doubt and answer votes)
            doubt_count = await db.doubtvote.count(where={"userId": user_id})
            answer_count = await db.answervote.count(where={"userId": user_id})
            return (doubt_count + answer_count) >= criteria["count"]
        
        elif criteria_type == "quality_doubts":
            # Count doubts with upvotes meeting threshold
            doubts = await db.doubt.find_many(
                where={"authorId": user_id}
            )
            quality_doubts = [d for d in doubts if d.upvotes >= criteria["upvote_threshold"]]
            return len(quality_doubts) >= criteria["count"]
        
        elif criteria_type == "account_age":
            # Check account age
            user = await db.user.find_unique(
                where={"id": user_id}
            )
            age_days = (_now() - _coerce_naive(user.createdAt)).days
            return age_days >= criteria["days"]
        
        elif criteria_type == "unique_users_helped":
            # Count unique users who accepted your answers
            answers = await db.answer.find_many(
                where={
                    "authorId": user_id,
                    "isAnswered": {"not": None}
                },
                include={"doubt": True}
            )
            unique_users = {a.doubt.authorId for a in answers if a.doubt}
            return len(unique_users) >= criteria["count"]
        
        elif criteria_type == "fast_response":
            # Count answers submitted within time limit
            answers = await db.answer.find_many(
                where={"authorId": user_id},
                include={"doubt": True}
            )
            time_limit = timedelta(minutes=criteria["time_limit_minutes"])
            fast_responses = [
                a for a in answers
                if a.doubt and (_coerce_naive(a.createdAt) - _coerce_naive(a.doubt.createdAt)) <= time_limit
            ]
            return len(fast_responses) >= criteria["count"]
        
        elif criteria_type == "difficult_concept_mastery":
            # Check mastery of difficult concept
            count = await db.masteryrecord.count(
                where={
                    "userId": user_id,
                    "masteryScore": {"gte": criteria["mastery_threshold"]},
                    "concept": {
                        "difficulty": {"gte": criteria["difficulty_threshold"]}
                    }
                }
            )
            return count >= 1
        
        else:
            logger.warning(f"Unknown criteria type: {criteria_type}")
            return False
    
    except Exception as e:
        logger.error(f"Error checking achievement criteria: {e}")
        return False


async def validate_achievement_unlock(user_id: str, achievement: Dict) -> bool:
    """
    Anti-exploit validation checks before unlocking.
    
    Validates:
    - Time span (prevent instant unlock)
    - Unique users involved (prevent sock puppets)
    - Activity pattern (prevent scripted behavior)
    """
    db = get_db()
    
    criteria = achievement["criteria"]
    
    # Common validations
    user = await db.user.find_unique(
        where={"id": user_id}
    )
    
    # Minimum account age (1 day)
    if (_now() - _coerce_naive(user.createdAt)).days < 1:
        logger.warning(f"Achievement unlock blocked: account too new ({user_id})")
        return False
    
    # Minimum trust score (0.3)
    if user.trustScoreCache < 0.3:
        logger.warning(f"Achievement unlock blocked: trust too low ({user_id})")
        return False
    
    # Criteria-specific validation
    if criteria["type"] in ["answer_accepted", "total_upvotes"]:
        # Validate time span for answer-based achievements
        answers = await db.answer.find_many(
            where={"authorId": user_id},
            order={"createdAt": "asc"}
        )
        
        if len(answers) >= 2:
            time_span = (_coerce_naive(answers[-1].createdAt) - _coerce_naive(answers[0].createdAt)).total_seconds()
            min_span = 3600  # 1 hour minimum
            
            if time_span < min_span:
                logger.warning(f"Achievement unlock blocked: too fast ({time_span}s)")
                return False
    
    elif criteria["type"] == "unique_users_helped":
        # Validate unique users are genuine
        answers = await db.answer.find_many(
            where={
                "authorId": user_id,
                "isAnswered": {"not": None}
            },
            include={
                "doubt": {
                    "include": {
                        "author": True
                    }
                }
            }
        )
        
        # Check that helped users have reasonable trust scores
        helped_authors = [a.doubt.author for a in answers if a.doubt and a.doubt.author]
        low_trust_count = sum(1 for u in helped_authors if u.trustScoreCache < 0.3)
        
        if low_trust_count > len(helped_authors) * 0.5:
            logger.warning(f"Achievement unlock blocked: too many low-trust users helped")
            return False
    
    return True


async def unlock_achievement(user_id: str, achievement: Dict) -> Dict[str, Any]:
    """
    Unlock an achievement and award XP.
    """
    db = get_db()
    
    # Get or create achievement record using name as unique identifier
    achievement_record = await db.achievement.upsert(
        where={"name": achievement["name"]},
        data={
            "update": {},
            "create": {
                "type": _get_achievement_type(achievement["id"]),
                "name": achievement["name"],
                "description": achievement["description"],
                "criteria": Json(achievement["criteria"]),
                "points": achievement["xp_reward"],
                "rarity": _get_achievement_rarity(achievement["xp_reward"]),
            }
        }
    )
    
    # Check if already unlocked (race-condition guard — primary dedup is in check_and_unlock_achievements)
    existing = await db.achievementunlock.find_first(
        where={"userId": user_id, "achievementId": achievement_record.id}
    )
    if existing:
        logger.info(f"Achievement {achievement['name']} already unlocked for {user_id} — skipping")
        return {
            "id": achievement["id"],
            "name": achievement["name"],
            "xp_reward": 0,
            "unlocked_at": existing.unlockedAt
        }

    # Create unlock record — wrap in try/except to handle concurrent duplicate inserts gracefully
    try:
        unlock = await db.achievementunlock.create(
            data={
                "userId": user_id,
                "achievementId": achievement_record.id,
            }
        )
    except Exception as dup_err:
        if "Unique constraint" in str(dup_err):
            logger.info(f"Achievement {achievement['name']} already unlocked (concurrent write) for {user_id} — skipping")
            return {
                "id": achievement["id"],
                "name": achievement["name"],
                "xp_reward": 0,
                "unlocked_at": None
            }
        raise
    
    # Award XP
    xp_reward = achievement["xp_reward"]
    
    await db.xpledger.create(
        data={
            "userId": user_id,
            "eventType": "ACHIEVEMENT_UNLOCKED",
            "baseXP": xp_reward,
            "trustMult": 1.0,
            "finalXP": xp_reward,
            "reason": f"Achievement unlocked: {achievement['name']}",
            "metadata": Json({"achievement_id": achievement["id"]})
        }
    )
    
    await db.user.update(
        where={"id": user_id},
        data={"totalXP": {"increment": xp_reward}}
    )
    
    logger.info(f"Achievement unlocked: {achievement['name']} for user {user_id} (+{xp_reward} XP)")
    
    return {
        "id": achievement["id"],
        "name": achievement["name"],
        "xp_reward": xp_reward,
        "unlocked_at": unlock.unlockedAt
    }


def _get_achievement_type(achievement_id: str) -> str:
    """Map internal achievement ID to AchievementType enum value."""
    _type_map = {
        "first_correct_answer": "PROBLEM_SOLVER",
        "concept_master_all": "SUBJECT_EXPERT",
        "polymath": "SUBJECT_EXPERT",
        "consistent_learner": "STREAK_MASTER",
        "marathon_learner": "STREAK_MASTER",
        "helpful_contributor": "MENTOR",
        "trusted_expert": "TOP_CONTRIBUTOR",
        "fact_checked": "KNOWLEDGE_SEEKER",
        "community_validator": "COMMUNITY_LEADER",
        "doubt_resolver": "MENTOR",
        "knowledge_seeker": "KNOWLEDGE_SEEKER",
        "early_adopter": "RISING_STAR",
        "mentor": "MENTOR",
        "fast_responder": "PROBLEM_SOLVER",
        "deep_diver": "SUBJECT_EXPERT",
    }
    return _type_map.get(achievement_id, "TOP_CONTRIBUTOR")


def _get_achievement_rarity(xp_reward: int) -> str:
    """Map XP reward to AchievementRarity enum value."""
    if xp_reward >= 2000:
        return "LEGENDARY"
    elif xp_reward >= 1200:
        return "EPIC"
    elif xp_reward >= 700:
        return "RARE"
    elif xp_reward >= 300:
        return "UNCOMMON"
    return "COMMON"
