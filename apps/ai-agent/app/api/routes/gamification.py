"""
NOVYRA Gamification API Routes

Endpoints for leaderboards, achievements, XP tracking, and streaks.
"""
import logging
from typing import Optional
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
    reputation: int
    trust_score: float
    trust_tier: str
    current_streak: int
    longest_streak: int
    achievements_unlocked: int
    total_achievements: int


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
        ledger_entries = await db.xp_ledger.find_many({
            "where": {"userId": user_id},
            "orderBy": {"timestamp": "desc"},
            "skip": offset,
            "take": limit
        })
        
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
        users = await db.user.find_many({
            "orderBy": {"totalXP": "desc"},
            "skip": offset,
            "take": limit,
            "select": {
                "id": True,
                "name": True,
                "totalXP": True,
                "reputation": True,
                "trustScoreCache": True
            }
        })
        
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
        users = await db.user.find_many({
            "orderBy": {"reputation": "desc"},
            "skip": offset,
            "take": limit,
            "select": {
                "id": True,
                "name": True,
                "totalXP": True,
                "reputation": True,
                "trustScoreCache": True
            }
        })
        
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
        
        # Get user's achievement progress
        progress_records = await db.achievement_progress.find_many({
            "where": {"userId": user_id},
            "include": {"achievement": True}
        })
        
        # Map achievement IDs to progress
        progress_map = {
            p.achievement.key: p
            for p in progress_records
            if hasattr(p, 'achievement') and p.achievement
        }
        
        achievements = []
        for achievement in ACHIEVEMENTS:
            progress = progress_map.get(achievement["id"])
            
            achievements.append(AchievementResponse(
                id=achievement["id"],
                name=achievement["name"],
                description=achievement["description"],
                xp_reward=achievement["xp_reward"],
                unlocked=progress is not None and progress.unlockedAt is not None,
                unlocked_at=progress.unlockedAt if progress else None,
                progress=progress.progress if progress else 0
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
        user = await db.user.find_unique({
            "where": {"id": user_id},
            "select": {
                "totalXP": True,
                "reputation": True,
                "trustScoreCache": True,
                "currentStreak": True,
                "longestStreak": True
            }
        })
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get trust tier
        trust_result = await calculate_trust_score(user_id)
        
        # Count unlocked achievements
        unlocked_count = await db.achievement_progress.count({
            "where": {
                "userId": user_id,
                "unlockedAt": {"not": None}
            }
        })
        
        return UserStatsResponse(
            user_id=user_id,
            total_xp=user.totalXP or 0,
            reputation=user.reputation or 0,
            trust_score=user.trustScoreCache or 0.5,
            trust_tier=trust_result.tier,
            current_streak=user.currentStreak or 0,
            longest_streak=user.longestStreak or 0,
            achievements_unlocked=unlocked_count,
            total_achievements=len(ACHIEVEMENTS)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch stats for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user stats")


logger.info("Gamification API routes registered")
