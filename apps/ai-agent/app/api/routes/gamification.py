"""
Entropy AI Gamification API Routes

Endpoints for leaderboards, achievements, XP tracking, and streaks.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.services.gamification.xp_engine import (
    award_xp,
    get_xp_breakdown,
    calculate_xp
)
from app.services.gamification.achievement_engine import (
    check_and_unlock_achievements
)
from app.services.gamification.streak_manager import (
    get_user_streak,
    update_user_streak
)
from app.services.ai_brain.trust_scorer import calculate_trust_score
from app.services.events.event_definitions import Event, EventType

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Response Models
# ============================================================

class XPBreakdownResponse(BaseModel):
    total_xp: int
    days: int
    by_event_type: dict
    entry_count: int


class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    total_xp: int
    reputation: int
    trust_score: float
    rank: int


class AchievementResponse(BaseModel):
    id: str
    name: str
    description: str
    xp_reward: int
    unlocked: bool
    unlocked_at: Optional[datetime] = None
    progress: Optional[int] = None


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity: datetime
    milestone_reached: bool


class TrustScoreResponse(BaseModel):
    score: float
    tier: str
    components: dict


class UserStatsResponse(BaseModel):
    user_id: str
    total_xp: int
    level: int
    tier: str
    reputation: int
    trust_score: float
    trust_tier: str
    current_streak: int
    longest_streak: int
    achievements_unlocked: int
    total_achievements: int


class GamificationEventRequest(BaseModel):
    user_id: str
    event_type: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class GamificationEventResponse(BaseModel):
    xp_awarded: int
    new_total_xp: int
    level: int
    tier: str
    streak_updated: bool
    milestone_reached: bool
    achievements_unlocked: List[str]


# ============================================================
# Level Calculation
# ============================================================

_XP_BASE = 100
_XP_MULTIPLIER = 1.5

_TIER_MAP = [
    (0, "INITIATE"),
    (5, "CONTRIBUTOR"),
    (15, "AUTHORITY"),
    (30, "LUMINARY"),
    (50, "SAGE"),
]


def _xp_for_level(level: int) -> int:
    if level <= 1:
        return 0
    return int(_XP_BASE * (_XP_MULTIPLIER ** (level - 2)))


def calculate_level(total_xp: int) -> int:
    level = 1
    while True:
        next_xp = _xp_for_level(level + 1)
        if total_xp < next_xp:
            break
        level += 1
    return level


def get_tier(level: int) -> str:
    tier = "INITIATE"
    for threshold, name in _TIER_MAP:
        if level >= threshold:
            tier = name
    return tier


# ============================================================
# Unified Gamification Event Endpoint
# ============================================================

# Event types that are considered "meaningful activity" for streak updates
_STREAK_QUALIFYING_EVENTS = {
    "ANSWER_ACCEPTED", "ANSWER_SUBMITTED", "DOUBT_CREATED", "DOUBT_RESOLVED",
    "VOTE_CAST", "CONCEPT_ATTEMPTED", "CONCEPT_COMPLETED", "MASTERY_GAIN",
    "MASTERY_UPDATED", "QUALITY_DOUBT", "HELPFUL_VOTE", "DAILY_LOGIN",
}


@router.post("/event", response_model=GamificationEventResponse)
async def process_gamification_event(request: GamificationEventRequest):
    """
    Unified gamification event handler.

    Awards smart XP (with trust/NLI/difficulty multipliers), updates streak,
    and checks/unlocks achievements — all in a single atomic call.

    This is the ONLY entry point for XP awards. Next.js routes must call this
    instead of writing directly to the database.
    """
    user_id = request.user_id
    event_type = request.event_type.upper()
    metadata = request.metadata or {}

    try:
        # 1. Award XP (writes to xp_ledger + increments user.totalXP)
        xp_awarded = await award_xp(user_id, event_type, metadata)

        # 2. Fetch updated user totalXP for level calculation
        db = get_db()
        user = await db.user.find_unique(where={"id": user_id})
        new_total_xp = user.totalXP if user else 0

        level = calculate_level(new_total_xp)
        tier = get_tier(level)

        # 3. Update streak for qualifying events
        streak_updated = False
        milestone_reached = False
        if event_type in _STREAK_QUALIFYING_EVENTS:
            streak_result = await update_user_streak(user_id)
            streak_updated = True
            milestone_reached = streak_result.milestone_reached

        # 4. Build a minimal Event object and check achievements
        # Wrapped in its own try/except so a bad achievement check never kills the XP award
        achievement_names = []
        try:
            try:
                ai_event_type = EventType(event_type)
            except ValueError:
                ai_event_type = EventType.XP_AWARDED  # Fallback for unknown types

            triggering_event = Event(
                event_type=ai_event_type,
                user_id=user_id,
                metadata=metadata
            )
            newly_unlocked = await check_and_unlock_achievements(user_id, triggering_event)
            achievement_names = [a["name"] for a in newly_unlocked] if newly_unlocked else []
        except Exception as ach_err:
            logger.warning(f"Achievement check failed (non-fatal) for user {user_id}, event {event_type}: {ach_err}")

        return GamificationEventResponse(
            xp_awarded=xp_awarded,
            new_total_xp=new_total_xp,
            level=level,
            tier=tier,
            streak_updated=streak_updated,
            milestone_reached=milestone_reached,
            achievements_unlocked=achievement_names
        )

    except Exception as e:
        logger.error(f"Gamification event failed for user {user_id}, event {event_type}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process gamification event")


# ============================================================
# XP Endpoints
# ============================================================

@router.get("/xp/{user_id}", response_model=XPBreakdownResponse)
async def get_user_xp_breakdown(
    user_id: str,
    days: int = Query(7, ge=1, le=365, description="Number of days to analyze")
):
    """
    Get breakdown of XP earned by a user over last N days.
    
    Shows total XP and breakdown by event type.
    """
    try:
        breakdown = await get_xp_breakdown(user_id, days)
        return breakdown
    except Exception as e:
        logger.error(f"Failed to get XP breakdown for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch XP breakdown")


@router.get("/xp/ledger/{user_id}")
async def get_user_xp_ledger(
    user_id: str,
    limit: int = Query(50, ge=1, le=500, description="Number of entries"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get detailed XP ledger for a user (audit trail).
    
    Shows every XP transaction with full multiplier breakdown.
    """
    try:
        db = get_db()
        ledger_entries = await db.xpledger.find_many(
            where={"userId": user_id},
            order_by={"createdAt": "desc"},
            skip=offset,
            take=limit
        )
        
        return {
            "user_id": user_id,
            "entries": ledger_entries,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Failed to get XP ledger for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch XP ledger")


# ============================================================
# Leaderboard Endpoints
# ============================================================

@router.get("/leaderboard/xp", response_model=list[LeaderboardEntry])
async def get_xp_leaderboard(
    limit: int = Query(50, ge=1, le=100, description="Number of users"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get XP leaderboard (top users by total XP).
    """
    try:
        db = get_db()
        users = await db.user.find_many(
            order={"totalXP": "desc"},
            skip=offset,
            take=limit,
        )

        leaderboard = [
            LeaderboardEntry(
                user_id=user.id,
                username=user.name or "Anonymous",
                total_xp=user.totalXP or 0,
                reputation=user.reputation or 0,
                trust_score=user.trustScoreCache or 0.5,
                rank=offset + i + 1
            )
            for i, user in enumerate(users)
        ]

        return leaderboard
    except Exception as e:
        logger.error(f"Failed to fetch XP leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")


@router.get("/leaderboard/reputation", response_model=list[LeaderboardEntry])
async def get_reputation_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get reputation leaderboard (top users by reputation).
    """
    try:
        db = get_db()
        users = await db.user.find_many(
            order={"reputation": "desc"},
            skip=offset,
            take=limit,
        )
        
        leaderboard = [
            LeaderboardEntry(
                user_id=user.id,
                username=user.name or "Anonymous",
                total_xp=user.totalXP or 0,
                reputation=user.reputation or 0,
                trust_score=user.trustScoreCache or 0.5,
                rank=offset + i + 1
            )
            for i, user in enumerate(users)
        ]
        
        return leaderboard
    except Exception as e:
        logger.error(f"Failed to fetch reputation leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")


# ============================================================
# Achievement Endpoints
# ============================================================

@router.get("/achievements/{user_id}", response_model=list[AchievementResponse])
async def get_user_achievements(user_id: str):
    """
    Get all achievements with user's unlock status.
    """
    try:
        from app.services.gamification.achievement_engine import ACHIEVEMENTS
        
        db = get_db()
        
        # Get user's unlocked achievements
        unlock_records = await db.achievementunlock.find_many(
            where={"userId": user_id},
            include={"achievement": True}
        )
        
        # Map achievement name to unlock record
        unlocked_by_name = {
            r.achievement.name: r
            for r in unlock_records
            if r.achievement
        }
        
        achievements = []
        for achievement in ACHIEVEMENTS:
            unlock = unlocked_by_name.get(achievement["name"])
            
            achievements.append(AchievementResponse(
                id=achievement["id"],
                name=achievement["name"],
                description=achievement["description"],
                xp_reward=achievement["xp_reward"],
                unlocked=unlock is not None,
                unlocked_at=unlock.unlockedAt if unlock else None,
                progress=100 if unlock else 0
            ))
        
        return achievements
    except Exception as e:
        logger.error(f"Failed to fetch achievements for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch achievements")


# ============================================================
# Streak Endpoints
# ============================================================

@router.get("/streak/{user_id}", response_model=StreakResponse)
async def get_streak(user_id: str):
    """
    Get user's current streak status.
    """
    try:
        streak = await get_user_streak(user_id)
        return streak
    except Exception as e:
        logger.error(f"Failed to fetch streak for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch streak")


# ============================================================
# Trust Score Endpoints
# ============================================================

@router.get("/trust/{user_id}", response_model=TrustScoreResponse)
async def get_trust_score(user_id: str):
    """
    Get user's comprehensive trust score with component breakdown.
    """
    try:
        trust_result = await calculate_trust_score(user_id)
        
        return TrustScoreResponse(
            score=trust_result.score,
            tier=trust_result.tier,
            components={
                "mastery_reliability": trust_result.components.mastery_reliability,
                "nli_track_record": trust_result.components.nli_track_record,
                "community_validation": trust_result.components.community_validation,
                "account_age_trust": trust_result.components.account_age_trust,
                "interaction_entropy": trust_result.components.interaction_entropy,
                "vote_pattern_score": trust_result.components.vote_pattern_score,
                "similarity_flags": trust_result.components.similarity_flags,
                "abuse_flags": trust_result.components.abuse_flags,
                "ip_clustering_risk": trust_result.components.ip_clustering_risk
            }
        )
    except Exception as e:
        logger.error(f"Failed to calculate trust score for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate trust score")


# ============================================================
# User Stats (Combined)
# ============================================================

@router.get("/stats/{user_id}", response_model=UserStatsResponse)
async def get_user_stats(user_id: str):
    """
    Get comprehensive gamification stats for a user.
    
    Combines XP, reputation, trust, streaks, and achievements.
    """
    try:
        from app.services.gamification.achievement_engine import ACHIEVEMENTS
        
        db = get_db()

        # Get user data
        user = await db.user.find_unique(where={"id": user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get trust tier
        trust_result = await calculate_trust_score(user_id)
        
        # Get streak data from Streak model
        streak = await db.streak.find_unique(where={"userId": user_id})
        current_streak = streak.currentStreak if streak else 0
        longest_streak = streak.longestStreak if streak else 0
        
        # Count unlocked achievements
        unlocked_count = await db.achievementunlock.count(
            where={"userId": user_id}
        )
        
        return UserStatsResponse(
            user_id=user_id,
            total_xp=user.totalXP or 0,
            level=calculate_level(user.totalXP or 0),
            tier=get_tier(calculate_level(user.totalXP or 0)),
            reputation=user.reputation or 0,
            trust_score=user.trustScoreCache or 0.5,
            trust_tier=trust_result.tier,
            current_streak=current_streak,
            longest_streak=longest_streak,
            achievements_unlocked=unlocked_count,
            total_achievements=len(ACHIEVEMENTS)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch stats for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user stats")


logger.info("Gamification API routes registered")
