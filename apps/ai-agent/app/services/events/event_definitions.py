"""
NOVYRA Event System - Core Event Definitions

All system events that trigger gamification, trust updates, and logging.
"""
from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from datetime import datetime


class EventType(str, Enum):
    """Core event types in the NOVYRA system."""
    
    # Learning Events
    DOUBT_CREATED = "DOUBT_CREATED"
    ANSWER_SUBMITTED = "ANSWER_SUBMITTED"
    ANSWER_ACCEPTED = "ANSWER_ACCEPTED"
    ANSWER_UPVOTED = "ANSWER_UPVOTED"
    ANSWER_DOWNVOTED = "ANSWER_DOWNVOTED"
    DOUBT_UPVOTED = "DOUBT_UPVOTED"
    DOUBT_DOWNVOTED = "DOUBT_DOWNVOTED"
    DOUBT_RESOLVED = "DOUBT_RESOLVED"
    
    # Mastery Events
    CONCEPT_ATTEMPTED = "CONCEPT_ATTEMPTED"
    MASTERY_UPDATED = "MASTERY_UPDATED"
    CONCEPT_MASTERED = "CONCEPT_MASTERED"
    PREREQUISITE_CLEARED = "PREREQUISITE_CLEARED"
    
    # Evaluation Events
    RUBRIC_EVALUATED = "RUBRIC_EVALUATED"
    EVALUATION_SUBMITTED = "EVALUATION_SUBMITTED"
    
    # AI Events
    AI_REASONING_COMPLETED = "AI_REASONING_COMPLETED"
    NLI_CHECKED = "NLI_CHECKED"          # Every NLI validation run
    NLI_FLAG_RAISED = "NLI_FLAG_RAISED"
    FACT_CHECK_PASSED = "FACT_CHECK_PASSED"
    FACT_CHECK_FAILED = "FACT_CHECK_FAILED"
    
    # Gamification Events
    XP_AWARDED = "XP_AWARDED"
    ACHIEVEMENT_UNLOCKED = "ACHIEVEMENT_UNLOCKED"
    ACHIEVEMENT_PROGRESS = "ACHIEVEMENT_PROGRESS"
    REPUTATION_CHANGED = "REPUTATION_CHANGED"
    STREAK_UPDATED = "STREAK_UPDATED"
    STREAK_MILESTONE = "STREAK_MILESTONE"
    LEVEL_UP = "LEVEL_UP"
    
    # Trust & Abuse Events
    TRUST_SCORE_UPDATED = "TRUST_SCORE_UPDATED"
    ABUSE_FLAG_CREATED = "ABUSE_FLAG_CREATED"
    ABUSE_CONFIRMED = "ABUSE_CONFIRMED"
    USER_SUSPENDED = "USER_SUSPENDED"
    USER_BANNED = "USER_BANNED"
    
    # System Events
    USER_REGISTERED = "USER_REGISTERED"
    USER_LOGGED_IN = "USER_LOGGED_IN"
    DAILY_LOGIN = "DAILY_LOGIN"


@dataclass
class Event:
    """Base event class for all system events."""
    
    event_type: EventType
    user_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    event_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary for serialization."""
        return {
            "event_type": self.event_type.value,
            "user_id": self.user_id,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
            "event_id": self.event_id
        }


# Specialized Event Classes for Type Safety

@dataclass
class DoubtCreatedEvent(Event):
    """Emitted when a user creates a new doubt."""
    def __init__(self, user_id: str, doubt_id: str, subject: str, tags: list):
        super().__init__(
            event_type=EventType.DOUBT_CREATED,
            user_id=user_id,
            metadata={
                "doubt_id": doubt_id,
                "subject": subject,
                "tags": tags
            }
        )


@dataclass
class AnswerAcceptedEvent(Event):
    """Emitted when an answer is accepted by the doubt author."""
    def __init__(
        self,
        asker_id: str,
        answerer_id: str,
        answer_id: str,
        doubt_id: str,
        concept_id: Optional[str] = None
    ):
        super().__init__(
            event_type=EventType.ANSWER_ACCEPTED,
            user_id=answerer_id,  # Primary user is the answerer
            metadata={
                "asker_id": asker_id,
                "answerer_id": answerer_id,
                "answer_id": answer_id,
                "doubt_id": doubt_id,
                "concept_id": concept_id
            }
        )


@dataclass
class MasteryUpdatedEvent(Event):
    """Emitted when a user's mastery score changes."""
    def __init__(
        self,
        user_id: str,
        concept_id: str,
        old_score: float,
        new_score: float,
        attempt_correct: bool
    ):
        super().__init__(
            event_type=EventType.MASTERY_UPDATED,
            user_id=user_id,
            metadata={
                "concept_id": concept_id,
                "old_score": old_score,
                "new_score": new_score,
                "delta": new_score - old_score,
                "attempt_correct": attempt_correct
            }
        )


@dataclass
class XPAwardedEvent(Event):
    """Emitted when XP is awarded to a user."""
    def __init__(
        self,
        user_id: str,
        xp_amount: int,
        reason: str,
        source_event: str,
        multipliers: Optional[Dict[str, float]] = None
    ):
        super().__init__(
            event_type=EventType.XP_AWARDED,
            user_id=user_id,
            metadata={
                "xp_amount": xp_amount,
                "reason": reason,
                "source_event": source_event,
                "multipliers": multipliers or {}
            }
        )


@dataclass
class AchievementUnlockedEvent(Event):
    """Emitted when a user unlocks an achievement."""
    def __init__(
        self,
        user_id: str,
        achievement_id: str,
        achievement_name: str,
        xp_reward: int
    ):
        super().__init__(
            event_type=EventType.ACHIEVEMENT_UNLOCKED,
            user_id=user_id,
            metadata={
                "achievement_id": achievement_id,
                "achievement_name": achievement_name,
                "xp_reward": xp_reward
            }
        )


@dataclass
class TrustScoreUpdatedEvent(Event):
    """Emitted when a user's trust score is recalculated."""
    def __init__(
        self,
        user_id: str,
        old_score: float,
        new_score: float,
        components: Dict[str, float],
        trigger: str
    ):
        super().__init__(
            event_type=EventType.TRUST_SCORE_UPDATED,
            user_id=user_id,
            metadata={
                "old_score": old_score,
                "new_score": new_score,
                "delta": new_score - old_score,
                "components": components,
                "trigger": trigger
            }
        )


@dataclass
class AbuseFlagCreatedEvent(Event):
    """Emitted when an abuse flag is raised."""
    def __init__(
        self,
        user_id: str,
        flag_type: str,
        severity: int,
        details: Dict[str, Any],
        auto_detected: bool = True
    ):
        super().__init__(
            event_type=EventType.ABUSE_FLAG_CREATED,
            user_id=user_id,
            metadata={
                "flag_type": flag_type,
                "severity": severity,
                "details": details,
                "auto_detected": auto_detected
            }
        )


@dataclass
class StreakUpdatedEvent(Event):
    """Emitted when a user's streak is updated."""
    def __init__(
        self,
        user_id: str,
        current_streak: int,
        longest_streak: int,
        is_milestone: bool = False
    ):
        super().__init__(
            event_type=EventType.STREAK_UPDATED,
            user_id=user_id,
            metadata={
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "is_milestone": is_milestone
            }
        )


# Event Factory for dynamic event creation
def create_event(event_type: str, user_id: str, metadata: Dict[str, Any]) -> Event:
    """Factory function to create events from type string."""
    try:
        event_enum = EventType(event_type)
    except ValueError:
        raise ValueError(f"Unknown event type: {event_type}")
    
    return Event(
        event_type=event_enum,
        user_id=user_id,
        metadata=metadata
    )
