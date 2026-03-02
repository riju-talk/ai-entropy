"""
NOVYRA Anti-Abuse - IP Clustering Detector

Detects sock puppet accounts through IP/device clustering.
Reference: docs/TRUST_AND_ABUSE_MODEL.md
"""
import logging
from typing import List, Set, Dict, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class IPCluster:
    """Detected IP cluster."""
    shared_ip: str
    shared_ip_hash: str
    users: List[str]
    interaction_count: int  # Interactions between users
    confidence: float


@dataclass
class ClusteringReport:
    """IP clustering detection report."""
    is_suspicious: bool
    clusters: List[IPCluster]
    risk_score: float
    recommendation: str  # "ALLOW", "WARN", "INVESTIGATE"


# Thresholds
MIN_CLUSTER_SIZE = 2  # Minimum users sharing IP
INTERACTION_THRESHOLD = 5  # Suspicious interaction count
IP_REUSE_DAYS = 7  # Days to consider for IP reuse


def hash_ip(ip_address: str) -> str:
    """
    Hash IP address for privacy.
    
    Args:
        ip_address: Raw IP address
    
    Returns:
        SHA256 hash of IP
    """
    return hashlib.sha256(ip_address.encode()).hexdigest()


async def log_user_activity(
    user_id: str,
    ip_address: str,
    user_agent: str,
    activity_type: str
) -> None:
    """
    Log user activity with IP/device info.
    
    Args:
        user_id: User ID
        ip_address: IP address
        user_agent: Browser user agent
        activity_type: Type of activity
    """
    try:
        db = get_db()
        
        ip_hash = hash_ip(ip_address)
        
        # Store in moderation log (dual-purpose)
        await db.moderation_log.create({
            "data": {
                "moderatorId": "system",
                "targetUserId": user_id,
                "action": "ACTIVITY_LOG",
                "reason": activity_type,
                "details": {
                    "ip_hash": ip_hash,
                    "user_agent": user_agent,
                    "activity_type": activity_type
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to log user activity: {e}")


async def get_users_by_ip(
    ip_hash: str,
    lookback_days: int = IP_REUSE_DAYS
) -> List[str]:
    """
    Get users who used a specific IP.
    
    Args:
        ip_hash: Hashed IP address
        lookback_days: Days to look back
    
    Returns:
        List of user IDs
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        logs = await db.moderation_log.find_many({
            "where": {
                "action": "ACTIVITY_LOG",
                "createdAt": {"gte": since}
            }
        })
        
        users = set()
        for log in logs:
            if log.details.get("ip_hash") == ip_hash:
                users.add(log.targetUserId)
        
        return list(users)
    
    except Exception as e:
        logger.error(f"Failed to get users by IP: {e}")
        return []


async def get_user_ips(
    user_id: str,
    lookback_days: int = IP_REUSE_DAYS
) -> Set[str]:
    """
    Get IPs used by a user.
    
    Args:
        user_id: User ID
        lookback_days: Days to look back
    
    Returns:
        Set of IP hashes
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        logs = await db.moderation_log.find_many({
            "where": {
                "action": "ACTIVITY_LOG",
                "targetUserId": user_id,
                "createdAt": {"gte": since}
            }
        })
        
        ips = set()
        for log in logs:
            ip_hash = log.details.get("ip_hash")
            if ip_hash:
                ips.add(ip_hash)
        
        return ips
    
    except Exception as e:
        logger.error(f"Failed to get user IPs: {e}")
        return set()


async def count_interactions(
    user1_id: str,
    user2_id: str,
    lookback_days: int = 30
) -> int:
    """
    Count interactions between two users.
    
    Includes votes, comments, answers to each other's doubts.
    
    Args:
        user1_id: First user
        user2_id: Second user
        lookback_days: Days to look back
    
    Returns:
        Interaction count
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Count votes between users
        votes_1_to_2 = await db.vote_graph.count({
            "where": {
                "voterId": user1_id,
                "targetUserId": user2_id,
                "createdAt": {"gte": since}
            }
        })
        
        votes_2_to_1 = await db.vote_graph.count({
            "where": {
                "voterId": user2_id,
                "targetUserId": user1_id,
                "createdAt": {"gte": since}
            }
        })
        
        # Count comments (simplified - would need to join tables)
        # For now, just use votes as proxy
        
        return votes_1_to_2 + votes_2_to_1
    
    except Exception as e:
        logger.error(f"Failed to count interactions: {e}")
        return 0


async def detect_ip_clusters(
    user_id: Optional[str] = None,
    lookback_days: int = IP_REUSE_DAYS
) -> List[IPCluster]:
    """
    Detect clusters of users sharing IPs.
    
    Args:
        user_id: Optional specific user to analyze
        lookback_days: Days to look back
    
    Returns:
        List of detected clusters
    """
    try:
        db = get_db()
        
        since = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Get all activity logs
        logs = await db.moderation_log.find_many({
            "where": {
                "action": "ACTIVITY_LOG",
                "createdAt": {"gte": since}
            }
        })
        
        # Map IP -> users
        ip_to_users = defaultdict(set)
        for log in logs:
            ip_hash = log.details.get("ip_hash")
            if ip_hash:
                ip_to_users[ip_hash].add(log.targetUserId)
        
        # Find clusters
        clusters = []
        
        for ip_hash, users in ip_to_users.items():
            if len(users) < MIN_CLUSTER_SIZE:
                continue
            
            # Filter if specific user requested
            if user_id and user_id not in users:
                continue
            
            # Count interactions within cluster
            interaction_count = 0
            users_list = list(users)
            
            for i in range(len(users_list)):
                for j in range(i + 1, len(users_list)):
                    interaction_count += await count_interactions(
                        users_list[i],
                        users_list[j],
                        lookback_days
                    )
            
            # Compute confidence based on cluster size and interactions
            confidence = min(1.0, (len(users) - 1) * 0.2 + interaction_count * 0.1)
            
            clusters.append(IPCluster(
                shared_ip="[REDACTED]",  # Privacy: don't expose actual IP
                shared_ip_hash=ip_hash,
                users=users_list,
                interaction_count=interaction_count,
                confidence=confidence
            ))
        
        # Sort by confidence (descending)
        clusters.sort(key=lambda c: c.confidence, reverse=True)
        
        return clusters
    
    except Exception as e:
        logger.error(f"IP clustering detection failed: {e}")
        return []


async def analyze_sock_puppets(
    user_id: str,
    lookback_days: int = IP_REUSE_DAYS
) -> ClusteringReport:
    """
    Analyze user for sock puppet behavior.
    
    Main entry point for IP clustering detection.
    
    Args:
        user_id: User to analyze
        lookback_days: Days to look back
    
    Returns:
        ClusteringReport with detected clusters
    """
    logger.info(f"Analyzing sock puppets for user {user_id}")
    
    # Detect clusters involving this user
    clusters = await detect_ip_clusters(user_id, lookback_days)
    
    # Compute risk score
    risk_score = 0.0
    
    for cluster in clusters:
        # More users = higher risk
        cluster_risk = (len(cluster.users) - 1) * 0.15
        
        # Interactions increase risk
        if cluster.interaction_count >= INTERACTION_THRESHOLD:
            cluster_risk += 0.4
        
        risk_score += cluster_risk * cluster.confidence
    
    risk_score = min(1.0, risk_score)
    
    # Determine recommendation
    is_suspicious = len(clusters) > 0 and risk_score >= 0.3
    
    if risk_score >= 0.7:
        recommendation = "INVESTIGATE"
    elif risk_score >= 0.4:
        recommendation = "WARN"
    else:
        recommendation = "ALLOW"
    
    logger.info(f"Sock puppet analysis complete: risk_score={risk_score:.2f}, clusters={len(clusters)}")
    
    return ClusteringReport(
        is_suspicious=is_suspicious,
        clusters=clusters,
        risk_score=risk_score,
        recommendation=recommendation
    )


async def flag_sock_puppets(user_id: str, report: ClusteringReport) -> None:
    """
    Flag user for sock puppet behavior.
    
    Args:
        user_id: User ID
        report: Clustering report
    """
    try:
        db = get_db()
        
        # Determine severity
        if report.risk_score >= 0.7:
            severity = "CRITICAL"
        elif report.risk_score >= 0.4:
            severity = "HIGH"
        else:
            severity = "MEDIUM"
        
        await db.abuse_flag.create({
            "data": {
                "userId": user_id,
                "flagType": "SOCK_PUPPET",
                "severity": severity,
                "details": {
                    "risk_score": report.risk_score,
                    "clusters": [
                        {
                            "users_count": len(c.users),
                            "interaction_count": c.interaction_count,
                            "confidence": c.confidence
                        }
                        for c in report.clusters
                    ],
                    "recommendation": report.recommendation
                },
                "autoModerated": report.recommendation == "INVESTIGATE"
            }
        })
        
        logger.warning(f"Flagged user {user_id} for sock puppets (risk: {report.risk_score:.2f})")
    
    except Exception as e:
        logger.error(f"Failed to flag sock puppets: {e}")


logger.info("IP clustering detector initialized")
