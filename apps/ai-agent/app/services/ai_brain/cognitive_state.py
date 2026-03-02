"""
NOVYRA AI Brain - Layer 4: Cognitive State

Retrieves and models user's current cognitive/mastery state.
Reference: docs/AI_BRAIN_ARCHITECTURE.md Layer 4
"""
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class MasteryState:
    """User's mastery for a specific concept."""
    concept_id: str
    concept_name: str
    mastery_score: float  # 0.0-1.0
    attempts: int
    last_attempt: Optional[datetime]
    trend: str  # "improving", "declining", "stable"


@dataclass
class CognitiveState:
    """Complete cognitive/learning state for a user."""
    user_id: str
    overall_mastery: float  # Average across all concepts
    active_concepts: List[MasteryState]  # Recently practiced
    mastered_concepts: List[MasteryState]  # Score >= 0.7
    struggling_concepts: List[MasteryState]  # Score < 0.3
    recommended_next: List[str]  # Concept IDs to practice
    learning_velocity: float  # Concepts mastered per week
    last_activity: Optional[datetime]


async def get_concept_mastery(
    user_id: str,
    concept_id: str
) -> Optional[MasteryState]:
    """
    Get user's mastery for a specific concept.
    
    Args:
        user_id: User ID
        concept_id: Concept ID
    
    Returns:
        MasteryState or None if never attempted
    """
    try:
        db = get_db()
        
        # Get mastery record
        mastery = await db.mastery_record.find_first({
            "where": {
                "userId": user_id,
                "conceptId": concept_id
            },
            "include": {
                "concept": True
            },
            "orderBy": {
                "lastAttempt": "desc"
            }
        })
        
        if not mastery:
            return None
        
        # Calculate trend
        trend = "stable"
        if mastery.attempts >= 3:
            # Simple trend: compare last 2 attempts
            history = await db.mastery_record.find_many({
                "where": {
                    "userId": user_id,
                    "conceptId": concept_id
                },
                "orderBy": {
                    "lastAttempt": "desc"
                },
                "take": 2
            })
            
            if len(history) == 2:
                if history[0].masteryScore > history[1].masteryScore + 0.05:
                    trend = "improving"
                elif history[0].masteryScore < history[1].masteryScore - 0.05:
                    trend = "declining"
        
        return MasteryState(
            concept_id=concept_id,
            concept_name=mastery.concept.name if mastery.concept else "Unknown",
            mastery_score=mastery.masteryScore,
            attempts=mastery.attempts,
            last_attempt=mastery.lastAttempt,
            trend=trend
        )
    
    except Exception as e:
        logger.error(f"Failed to get mastery for user {user_id}, concept {concept_id}: {e}")
        return None


async def get_all_mastery(user_id: str) -> List[MasteryState]:
    """
    Get all concept masteries for a user.
    
    Args:
        user_id: User ID
    
    Returns:
        List of MasteryState objects
    """
    try:
        db = get_db()
        
        records = await db.mastery_record.find_many({
            "where": {"userId": user_id},
            "include": {"concept": True},
            "orderBy": {"lastAttempt": "desc"}
        })
        
        masteries = []
        for record in records:
            # Calculate trend (simplified)
            trend = "stable"
            if record.attempts >= 2:
                if record.masteryScore >= 0.7:
                    trend = "stable"  # Already mastered
                elif record.attempts <= 3:
                    trend = "improving"  # Early attempts
            
            masteries.append(MasteryState(
                concept_id=record.conceptId,
                concept_name=record.concept.name if record.concept else "Unknown",
                mastery_score=record.masteryScore,
                attempts=record.attempts,
                last_attempt=record.lastAttempt,
                trend=trend
            ))
        
        return masteries
    
    except Exception as e:
        logger.error(f"Failed to get all mastery for user {user_id}: {e}")
        return []


async def compute_cognitive_state(user_id: str) -> CognitiveState:
    """
    Compute complete cognitive state for a user.
    
    Analyzes all mastery records to understand user's learning state.
    
    Args:
        user_id: User ID
    
    Returns:
        CognitiveState with comprehensive learning profile
    """
    try:
        db = get_db()
        
        # Get user data
        user = await db.user.find_unique({
            "where": {"id": user_id},
            "select": {"lastActiveAt": True}
        })
        
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Get all mastery records
        all_mastery = await get_all_mastery(user_id)
        
        if not all_mastery:
            return CognitiveState(
                user_id=user_id,
                overall_mastery=0.0,
                active_concepts=[],
                mastered_concepts=[],
                struggling_concepts=[],
                recommended_next=[],
                learning_velocity=0.0,
                last_activity=user.lastActiveAt
            )
        
        # Categorize concepts
        mastered = [m for m in all_mastery if m.mastery_score >= 0.7]
        struggling = [m for m in all_mastery if m.mastery_score < 0.3 and m.attempts >= 2]
        
        # Active concepts: attempted in last 7 days
        week_ago = datetime.now() - timedelta(days=7)
        active = [
            m for m in all_mastery
            if m.last_attempt and m.last_attempt >= week_ago
        ]
        
        # Calculate overall mastery
        overall = sum(m.mastery_score for m in all_mastery) / len(all_mastery)
        
        # Calculate learning velocity (concepts mastered per week)
        month_ago = datetime.now() - timedelta(days=30)
        recent_masteries = [
            m for m in mastered
            if m.last_attempt and m.last_attempt >= month_ago
        ]
        learning_velocity = len(recent_masteries) / 4.0  # Per week
        
        # Recommend next concepts
        recommended = await get_recommended_concepts(user_id, all_mastery)
        
        return CognitiveState(
            user_id=user_id,
            overall_mastery=overall,
            active_concepts=active[:10],  # Top 10 recent
            mastered_concepts=mastered,
            struggling_concepts=struggling[:5],  # Top 5 struggles
            recommended_next=recommended[:5],
            learning_velocity=learning_velocity,
            last_activity=user.lastActiveAt
        )
    
    except Exception as e:
        logger.error(f"Failed to compute cognitive state for user {user_id}: {e}")
        return CognitiveState(
            user_id=user_id,
            overall_mastery=0.0,
            active_concepts=[],
            mastered_concepts=[],
            struggling_concepts=[],
            recommended_next=[],
            learning_velocity=0.0,
            last_activity=None
        )


async def get_recommended_concepts(
    user_id: str,
    current_mastery: List[MasteryState]
) -> List[str]:
    """
    Get recommended concepts for user to practice next.
    
    Logic:
    1. Prerequisites of partially mastered concepts
    2. Next concepts in learning path
    3. Related concepts to mastered ones
    
    Args:
        user_id: User ID
        current_mastery: User's current mastery states
    
    Returns:
        List of concept IDs to recommend
    """
    try:
        from app.services.ai_brain.graph_traversal import traverse_prerequisites, find_dependent_concepts
        
        mastered_ids = {m.concept_id for m in current_mastery if m.mastery_score >= 0.7}
        partial_ids = [m.concept_id for m in current_mastery if 0.3 <= m.mastery_score < 0.7]
        
        recommendations = []
        
        # Strategy 1: Prerequisites of partially mastered concepts
        for concept_id in partial_ids[:3]:  # Top 3 partial
            prereqs = await traverse_prerequisites(concept_id, user_id, max_depth=1)
            for prereq in prereqs:
                if prereq["id"] not in mastered_ids and not prereq.get("mastered"):
                    recommendations.append(prereq["id"])
        
        # Strategy 2: Next concepts after mastered ones
        for concept_id in list(mastered_ids)[:5]:  # Top 5 mastered
            dependents = await find_dependent_concepts(concept_id, max_results=2)
            for dep in dependents:
                if dep["id"] not in mastered_ids:
                    recommendations.append(dep["id"])
        
        # Remove duplicates, preserve order
        seen = set()
        unique_recommendations = []
        for cid in recommendations:
            if cid not in seen:
                seen.add(cid)
                unique_recommendations.append(cid)
        
        return unique_recommendations
    
    except Exception as e:
        logger.error(f"Failed to get recommended concepts: {e}")
        return []


async def should_provide_hints(cognitive_state: CognitiveState, concept_id: str) -> bool:
    """
    Determine if user needs hints for a concept based on cognitive state.
    
    Args:
        cognitive_state: User's cognitive state
        concept_id: Concept being attempted
    
    Returns:
        True if hints should be provided
    """
    # Find mastery for this concept
    concept_mastery = next(
        (m for m in cognitive_state.active_concepts + cognitive_state.mastered_concepts
         if m.concept_id == concept_id),
        None
    )
    
    if not concept_mastery:
        # First attempt - provide hints
        return True
    
    if concept_mastery.mastery_score < 0.5:
        # Struggling - definitely provide hints
        return True
    
    if concept_mastery.mastery_score >= 0.8:
        # Already mastered - minimal hints
        return False
    
    # Medium mastery - provide moderate hints
    return True


logger.info("Cognitive state module initialized")
