"""
NOVYRA Anti-Abuse - Vote Analyzer

Detects vote manipulation patterns (vote rings, coordinated voting).
Reference: docs/TRUST_AND_ABUSE_MODEL.md
"""
import logging
from typing import List, Set, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class VotePattern:
    """Detected voting pattern."""
    pattern_type: str  # "MUTUAL_VOTING", "VOTE_RING", "COORDINATED"
    users_involved: List[str]
    confidence: float
    evidence: Dict


@dataclass
class VoteAnalysisReport:
    """Vote manipulation detection report."""
    is_suspicious: bool
    patterns: List[VotePattern]
    risk_score: float  # 0.0 to 1.0
    recommendation: str  # "ALLOW", "WARN", "INVESTIGATE"


# Thresholds
MUTUAL_VOTE_THRESHOLD = 0.8  # % of votes that are mutual
VOTE_RING_MIN_SIZE = 3  # Minimum users in a ring
COORDINATED_TIME_WINDOW = 60  # seconds for coordinated voting


async def get_user_voting_history(
    user_id: str,
    lookback_days: int = 30
) -> List[Dict]:
    """
    Get user's voting history.
    
    Args:
        user_id: User ID
        lookback_days: Days to look back
    
    Returns:
        List of vote records
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Get votes from VoteGraph table
        votes = await db.vote_graph.find_many({
            "where": {
                "voterId": user_id,
                "createdAt": {"gte": since}
            },
            "orderBy": {"createdAt": "desc"}
        })
        
        return [
            {
                "voter_id": v.voterId,
                "target_user_id": v.targetUserId,
                "vote_type": v.voteType,
                "content_id": v.contentId,
                "content_type": v.contentType,
                "created_at": v.createdAt
            }
            for v in votes
        ]
    
    except Exception as e:
        logger.error(f"Failed to get voting history: {e}")
        return []


async def detect_mutual_voting(
    user_id: str,
    lookback_days: int = 30
) -> Optional[VotePattern]:
    """
    Detect mutual voting patterns (A upvotes B, B upvotes A).
    
    Args:
        user_id: User to analyze
        lookback_days: Days to look back
    
    Returns:
        VotePattern if detected, None otherwise
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Get votes BY this user
        votes_by = await db.vote_graph.find_many({
            "where": {
                "voterId": user_id,
                "voteType": "UPVOTE",
                "createdAt": {"gte": since}
            }
        })
        
        # Get votes FOR this user
        votes_for = await db.vote_graph.find_many({
            "where": {
                "targetUserId": user_id,
                "voteType": "UPVOTE",
                "createdAt": {"gte": since}
            }
        })
        
        # Count mutual votes
        voted_for = set(v.targetUserId for v in votes_by)
        voted_by = set(v.voterId for v in votes_for)
        
        mutual = voted_for.intersection(voted_by)
        
        if not voted_for:
            return None
        
        mutual_ratio = len(mutual) / len(voted_for)
        
        if mutual_ratio >= MUTUAL_VOTE_THRESHOLD and len(mutual) >= 3:
            return VotePattern(
                pattern_type="MUTUAL_VOTING",
                users_involved=[user_id] + list(mutual),
                confidence=mutual_ratio,
                evidence={
                    "mutual_count": len(mutual),
                    "total_voted_for": len(voted_for),
                    "mutual_ratio": mutual_ratio,
                    "mutual_users": list(mutual)
                }
            )
        
        return None
    
    except Exception as e:
        logger.error(f"Mutual voting detection failed: {e}")
        return None


async def detect_vote_ring(
    user_id: str,
    lookback_days: int = 30
) -> Optional[VotePattern]:
    """
    Detect vote rings (A→B→C→A circular voting).
    
    Uses graph traversal to find cycles.
    
    Args:
        user_id: User to analyze
        lookback_days: Days to look back
    
    Returns:
        VotePattern if ring detected, None otherwise
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Build voting graph
        votes = await db.vote_graph.find_many({
            "where": {
                "voteType": "UPVOTE",
                "createdAt": {"gte": since}
            }
        })
        
        # Adjacency list: voter → targets
        graph = defaultdict(set)
        for v in votes:
            graph[v.voterId].add(v.targetUserId)
        
        # DFS to find cycles involving user_id
        def find_cycle(start: str, current: str, path: List[str], visited: Set[str]) -> Optional[List[str]]:
            if current in visited:
                if current == start and len(path) >= VOTE_RING_MIN_SIZE:
                    return path + [current]
                return None
            
            if len(path) > 10:  # Max cycle length
                return None
            
            visited.add(current)
            
            for neighbor in graph.get(current, []):
                cycle = find_cycle(start, neighbor, path + [current], visited.copy())
                if cycle:
                    return cycle
            
            return None
        
        cycle = find_cycle(user_id, user_id, [], set())
        
        if cycle:
            return VotePattern(
                pattern_type="VOTE_RING",
                users_involved=cycle,
                confidence=0.9,
                evidence={
                    "cycle": cycle,
                    "ring_size": len(set(cycle)) - 1
                }
            )
        
        return None
    
    except Exception as e:
        logger.error(f"Vote ring detection failed: {e}")
        return None


async def detect_coordinated_voting(
    content_id: str,
    content_type: str,
    lookback_minutes: int = 5
) -> Optional[VotePattern]:
    """
    Detect coordinated voting (multiple users voting within short time).
    
    Args:
        content_id: Content to analyze
        content_type: Type of content
        lookback_minutes: Time window for coordination
    
    Returns:
        VotePattern if coordinated voting detected
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(minutes=lookback_minutes)
        
        # Get recent votes on this content
        votes = await db.vote_graph.find_many({
            "where": {
                "contentId": content_id,
                "contentType": content_type,
                "voteType": "UPVOTE",
                "createdAt": {"gte": since}
            },
            "orderBy": {"createdAt": "asc"}
        })
        
        if len(votes) < 3:
            return None
        
        # Check if votes came in rapid succession
        timestamps = [v.createdAt for v in votes]
        time_diffs = [
            (timestamps[i+1] - timestamps[i]).total_seconds()
            for i in range(len(timestamps) - 1)
        ]
        
        avg_diff = sum(time_diffs) / len(time_diffs)
        
        # Rapid succession indicates coordination
        if avg_diff < COORDINATED_TIME_WINDOW and len(votes) >= 3:
            return VotePattern(
                pattern_type="COORDINATED",
                users_involved=[v.voterId for v in votes],
                confidence=min(0.95, 1.0 - (avg_diff / COORDINATED_TIME_WINDOW)),
                evidence={
                    "vote_count": len(votes),
                    "avg_time_diff": avg_diff,
                    "voters": [v.voterId for v in votes]
                }
            )
        
        return None
    
    except Exception as e:
        logger.error(f"Coordinated voting detection failed: {e}")
        return None


async def analyze_user_voting(
    user_id: str,
    lookback_days: int = 30
) -> VoteAnalysisReport:
    """
    Analyze user's voting patterns for manipulation.
    
    Main entry point for vote analysis.
    
    Args:
        user_id: User to analyze
        lookback_days: Days to look back
    
    Returns:
        VoteAnalysisReport with detected patterns
    """
    logger.info(f"Analyzing voting patterns for user {user_id}")
    
    patterns = []
    
    # Detect mutual voting
    mutual = await detect_mutual_voting(user_id, lookback_days)
    if mutual:
        patterns.append(mutual)
    
    # Detect vote rings
    ring = await detect_vote_ring(user_id, lookback_days)
    if ring:
        patterns.append(ring)
    
    # Compute risk score
    risk_score = 0.0
    for pattern in patterns:
        if pattern.pattern_type == "MUTUAL_VOTING":
            risk_score += pattern.confidence * 0.3
        elif pattern.pattern_type == "VOTE_RING":
            risk_score += 0.7
        elif pattern.pattern_type == "COORDINATED":
            risk_score += 0.5
    
    risk_score = min(1.0, risk_score)
    
    # Determine recommendation
    is_suspicious = len(patterns) > 0
    
    if risk_score >= 0.7:
        recommendation = "INVESTIGATE"
    elif risk_score >= 0.4:
        recommendation = "WARN"
    else:
        recommendation = "ALLOW"
    
    logger.info(f"Vote analysis complete: risk_score={risk_score:.2f}, patterns={len(patterns)}")
    
    return VoteAnalysisReport(
        is_suspicious=is_suspicious,
        patterns=patterns,
        risk_score=risk_score,
        recommendation=recommendation
    )


async def analyze_content_voting(
    content_id: str,
    content_type: str
) -> VoteAnalysisReport:
    """
    Analyze voting on specific content.
    
    Args:
        content_id: Content ID
        content_type: Type of content
    
    Returns:
        VoteAnalysisReport
    """
    logger.info(f"Analyzing voting on {content_type} {content_id}")
    
    patterns = []
    
    # Detect coordinated voting
    coordinated = await detect_coordinated_voting(content_id, content_type)
    if coordinated:
        patterns.append(coordinated)
    
    # Compute risk score
    risk_score = 0.5 if coordinated else 0.0
    
    is_suspicious = len(patterns) > 0
    recommendation = "WARN" if is_suspicious else "ALLOW"
    
    return VoteAnalysisReport(
        is_suspicious=is_suspicious,
        patterns=patterns,
        risk_score=risk_score,
        recommendation=recommendation
    )


async def flag_vote_manipulation(user_id: str, report: VoteAnalysisReport) -> None:
    """
    Flag user for vote manipulation.
    
    Args:
        user_id: User ID
        report: Vote analysis report
    """
    try:
        db = get_db()
        
        # Determine severity
        if report.risk_score >= 0.7:
            severity = "HIGH"
        elif report.risk_score >= 0.4:
            severity = "MEDIUM"
        else:
            severity = "LOW"
        
        await db.abuse_flag.create({
            "data": {
                "userId": user_id,
                "flagType": "VOTE_MANIPULATION",
                "severity": severity,
                "details": {
                    "risk_score": report.risk_score,
                    "patterns": [
                        {
                            "type": p.pattern_type,
                            "confidence": p.confidence,
                            "evidence": p.evidence
                        }
                        for p in report.patterns
                    ],
                    "recommendation": report.recommendation
                },
                "autoModerated": report.recommendation == "INVESTIGATE"
            }
        })
        
        logger.warning(f"Flagged user {user_id} for vote manipulation (risk: {report.risk_score:.2f})")
    
    except Exception as e:
        logger.error(f"Failed to flag vote manipulation: {e}")


logger.info("Vote analyzer initialized")
