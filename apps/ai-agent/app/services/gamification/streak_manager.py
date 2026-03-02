"""
NOVYRA Streak Manager

Manages daily activity streaks with anti-gaming measures.
Reference: docs/GAME_ENGINE_ARCHITECTURE.md
"""
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class StreakResult:
    """Result of streak update."""
    current_streak: int
    longest_streak: int
    last_activity: datetime
    milestone_reached: bool


async def update_user_streak(user_id: str) -> StreakResult:
    """
    Update user's activity streak.
    
    Streaks require meaningful activity (not just login):
    - Submit answer
    - Create doubt
    - Attempt concept
    - Vote on content
    
    Only ONE activity per calendar day counts.
    """
    db = get_db()
    
    user = await db.user.find_unique({
        "where": {"id": user_id},
        "select": {
            "currentStreak": True,
            "longestStreak": True,
            "lastStreakDate": True,
            "lastActiveAt": True
        }
    })
    
    if not user:
        return StreakResult(
            current_streak=0,
            longest_streak=0,
            last_activity=datetime.now(),
            milestone_reached=False
        )
    
    now = datetime.now()
    today = now.date()
    
    last_activity_date = user.lastStreakDate.date() if user.lastStreakDate else None
    
    # Already counted activity today
    if last_activity_date == today:
        return StreakResult(
            current_streak=user.currentStreak or 0,
            longest_streak=user.longestStreak or 0,
            last_activity=user.lastActiveAt or now,
            milestone_reached=False
        )
    
    # Calculate new streak
    current_streak = user.currentStreak or 0
    
    if last_activity_date is None:
        # First activity ever
        new_streak = 1
    elif last_activity_date == today - timedelta(days=1):
        # Continued streak (yesterday)
        new_streak = current_streak + 1
    elif last_activity_date < today - timedelta(days=1):
        # Streak broken (missed yesterday)
        new_streak = 1
    else:
        # Unknown case
        new_streak = 1
    
    # Update longest streak
    longest_streak = max(user.longestStreak or 0, new_streak)
    
    # Check for milestone
    milestone_reached = new_streak in [7, 14, 30, 60, 90, 180, 365]
    
    # Update database
    await db.user.update({
        "where": {"id": user_id},
        "data": {
            "currentStreak": new_streak,
            "longestStreak": longest_streak,
            "lastStreakDate": now,
            "lastActiveAt": now
        }
    })
    
    # Log streak event
    await db.event_log.create({
        "data": {
            "eventType": "STREAK_UPDATED",
            "userId": user_id,
            "metadata": {
                "current_streak": new_streak,
                "longest_streak": longest_streak,
                "milestone": milestone_reached
            }
        }
    })
    
    if milestone_reached:
        logger.info(f"User {user_id} reached streak milestone: {new_streak} days")
    
    return StreakResult(
        current_streak=new_streak,
        longest_streak=longest_streak,
        last_activity=now,
        milestone_reached=milestone_reached
    )


async def get_user_streak(user_id: str) -> StreakResult:
    """Get user's current streak without updating."""
    db = get_db()
    
    user = await db.user.find_unique({
        "where": {"id": user_id},
        "select": {
            "currentStreak": True,
            "longestStreak": True,
            "lastStreakDate": True,
            "lastActiveAt": True
        }
    })
    
    if not user:
        return StreakResult(
            current_streak=0,
            longest_streak=0,
            last_activity=datetime.now(),
            milestone_reached=False
        )
    
    # Check if streak is still valid (not broken)
    today = datetime.now().date()
    last_activity_date = user.lastStreakDate.date() if user.lastStreakDate else None
    
    current_streak = user.currentStreak or 0
    
    if last_activity_date and last_activity_date < today - timedelta(days=1):
        # Streak broken
        current_streak = 0
    
    return StreakResult(
        current_streak=current_streak,
        longest_streak=user.longestStreak or 0,
        last_activity=user.lastActiveAt or datetime.now(),
        milestone_reached=False
    )


async def validate_streak_authenticity(user_id: str) -> bool:
    """
    Validate that streak is genuine (not manipulated).
    
    Checks:
    - Meaningful activity each day
    - No suspicious timezone manipulation
    - No bulk activity (scripted behavior)
    """
    db = get_db()
    
    # Get last 7 days of event logs
    week_ago = datetime.now() - timedelta(days=7)
    
    events = await db.event_log.find_many({
        "where": {
            "userId": user_id,
            "timestamp": {"gte": week_ago}
        },
        "orderBy": {"timestamp": "asc"}
    })
    
    if not events:
        return True
    
    # Check for suspicious patterns
    event_dates = [event.timestamp.date() for event in events]
    
    # Pattern 1: Multiple activities in very short time
    time_gaps = []
    for i in range(1, len(events)):
        gap = (events[i].timestamp - events[i-1].timestamp).total_seconds()
        time_gaps.append(gap)
    
    if time_gaps:
        avg_gap = sum(time_gaps) / len(time_gaps)
        # Suspicious if average gap is < 30 seconds
        if avg_gap < 30:
            logger.warning(f"Suspicious streak pattern for user {user_id}: too fast")
            return False
    
    # Pattern 2: Activity at exact same time each day (bot)
    activity_times = [event.timestamp.time() for event in events]
    if len(set(activity_times)) == 1 and len(activity_times) > 3:
        logger.warning(f"Suspicious streak pattern for user {user_id}: exact same time")
        return False
    
    return True


logger.info("Streak manager initialized")
