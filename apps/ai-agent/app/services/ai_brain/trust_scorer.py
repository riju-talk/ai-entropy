"""
NOVYRA Trust Scoring Engine

Calculates comprehensive trust scores based on 9 weighted components.
Reference: docs/TRUST_AND_ABUSE_MODEL.md
"""
import logging
from typing import Dict, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class TrustComponents:
    """Individual trust score components."""
    mastery_reliability: float  # 0.0-1.0
    nli_track_record: float
    community_validation: float
    account_age_trust: float
    interaction_entropy: float
    vote_pattern_score: float
    similarity_flags: float
    abuse_flags: float
    ip_clustering_risk: float


@dataclass
class TrustResult:
    """Complete trust calculation result."""
    score: float
    components: TrustComponents
    tier: str  # "Novice", "Contributor", "Expert", "Trusted"
    

# Component weights from TRUST_AND_ABUSE_MODEL.md
COMPONENT_WEIGHTS = {
    "mastery_reliability": 0.20,
    "nli_track_record": 0.20,
    "community_validation": 0.15,
    "account_age_trust": 0.10,
    "interaction_entropy": 0.10,
    "vote_pattern_score": 0.10,
    "similarity_flags": 0.05,
    "abuse_flags": 0.05,
    "ip_clustering_risk": 0.05
}


async def calculate_trust_score(user_id: str) -> TrustResult:
    """
    Calculate comprehensive trust score for a user.
    
    Returns TrustResult with score [0.0-1.0] and component breakdown.
    """
    db = get_db()
    
    # Get user data
    user = await db.user.find_unique({
        "where": {"id": user_id},
        "include": {
            "masteryRecords": True,
            "answers": {
                "include": {
                    "upvotes": True,
                    "downvotes": True
                }
            },
            "doubts": True,
            "upvotes": True,
            "downvotes": True,
            "abuseFlags": {"where": {"resolved": False}}
        }
    })
    
    if not user:
        # Return default for new users
        return TrustResult(
            score=0.5,
            components=TrustComponents(
                mastery_reliability=0.5,
                nli_track_record=0.5,
                community_validation=0.5,
                account_age_trust=0.0,
                interaction_entropy=0.5,
                vote_pattern_score=0.5,
                similarity_flags=1.0,
                abuse_flags=1.0,
                ip_clustering_risk=1.0
            ),
            tier="Novice"
        )
    
    # Calculate each component
    mastery_reliability = await calculate_mastery_reliability(user_id, user.masteryRecords)
    nli_track_record = await calculate_nli_track_record(user_id)
    community_validation = calculate_community_validation(user.answers)
    account_age_trust = calculate_account_age_trust(user.createdAt)
    interaction_entropy = await calculate_interaction_entropy(user_id)
    vote_pattern_score = await calculate_vote_pattern_score(user_id, user.upvotes, user.downvotes)
    similarity_flags = calculate_similarity_penalty(user_id)
    abuse_flags = calculate_abuse_penalty(user.abuseFlags)
    ip_clustering_risk = await calculate_ip_clustering_risk(user_id)
    
    components = TrustComponents(
        mastery_reliability=mastery_reliability,
        nli_track_record=nli_track_record,
        community_validation=community_validation,
        account_age_trust=account_age_trust,
        interaction_entropy=interaction_entropy,
        vote_pattern_score=vote_pattern_score,
        similarity_flags=similarity_flags,
        abuse_flags=abuse_flags,
        ip_clustering_risk=ip_clustering_risk
    )
    
    # Weighted sum
    final_score = (
        mastery_reliability * COMPONENT_WEIGHTS["mastery_reliability"] +
        nli_track_record * COMPONENT_WEIGHTS["nli_track_record"] +
        community_validation * COMPONENT_WEIGHTS["community_validation"] +
        account_age_trust * COMPONENT_WEIGHTS["account_age_trust"] +
        interaction_entropy * COMPONENT_WEIGHTS["interaction_entropy"] +
        vote_pattern_score * COMPONENT_WEIGHTS["vote_pattern_score"] +
        similarity_flags * COMPONENT_WEIGHTS["similarity_flags"] +
        abuse_flags * COMPONENT_WEIGHTS["abuse_flags"] +
        ip_clustering_risk * COMPONENT_WEIGHTS["ip_clustering_risk"]
    )
    
    tier = get_trust_tier(final_score)
    
    return TrustResult(score=final_score, components=components, tier=tier)


async def calculate_mastery_reliability(user_id: str, mastery_records) -> float:
    """
    Component 1: Mastery Reliability
    
    Measures how often user's demonstrated mastery aligns with actual performance.
    """
    if not mastery_records or len(mastery_records) < 5:
        return 0.5  # Not enough data
    
    # Calculate average mastery vs. variance
    scores = [record.masteryScore for record in mastery_records]
    avg_mastery = sum(scores) / len(scores)
    
    # Higher average + lower variance = higher reliability
    variance = sum((s - avg_mastery) ** 2 for s in scores) / len(scores)
    consistency = max(0, 1.0 - variance)
    
    # Weight by absolute mastery level
    reliability = (avg_mastery * 0.7) + (consistency * 0.3)
    
    return max(0.0, min(1.0, reliability))


async def calculate_nli_track_record(user_id: str) -> float:
    """
    Component 2: NLI Track Record
    
    Ratio of fact-checked claims that passed validation.
    """
    db = get_db()
    
    fact_checks = await db.fact_check_log.find_many({
        "where": {"userId": user_id},
        "orderBy": {"timestamp": "desc"},
        "take": 100  # Last 100 checks
    })
    
    if not fact_checks:
        return 0.5
    
    passed = sum(1 for check in fact_checks if check.verdict == "PASS")
    total = len(fact_checks)
    
    return passed / total if total > 0 else 0.5


def calculate_community_validation(answers) -> float:
    """
    Component 3: Community Validation
    
    Net upvote ratio weighted by trust of voters.
    """
    if not answers:
        return 0.5
    
    total_upvotes = 0
    total_downvotes = 0
    
    for answer in answers:
        total_upvotes += len(answer.upvotes) if hasattr(answer, 'upvotes') else 0
        total_downvotes += len(answer.downvotes) if hasattr(answer, 'downvotes') else 0
    
    total_votes = total_upvotes + total_downvotes
    
    if total_votes == 0:
        return 0.5
    
    # Wilson score confidence interval
    upvote_ratio = total_upvotes / total_votes
    
    # Normalize to 0-1 range
    return max(0.0, min(1.0, upvote_ratio))


def calculate_account_age_trust(created_at: datetime) -> float:
    """
    Component 4: Account Age Trust
    
    Asymptotic trust increase over time (fraud harder with aged accounts).
    """
    age_days = (datetime.now() - created_at).days
    
    # Asymptotic function: approaches 1.0 at 365 days
    trust = 1.0 - (1.0 / (1.0 + age_days / 30))
    
    return max(0.0, min(1.0, trust))


async def calculate_interaction_entropy(user_id: str) -> float:
    """
    Component 5: Interaction Entropy
    
    Diversity of interactions (prevents sock puppet detection).
    """
    db = get_db()
    
    # Get user's interactions
    interactions = await db.execute_raw(f"""
        SELECT DISTINCT target_user_id
        FROM (
            SELECT "answererId" as target_user_id FROM "Answer" WHERE "userId" = '{user_id}'
            UNION
            SELECT "userId" as target_user_id FROM "Vote" WHERE "voterId" = '{user_id}'
            UNION
            SELECT "userId" as target_user_id FROM "Comment" WHERE "authorId" = '{user_id}'
        ) interactions
    """)
    
    unique_users = len(interactions) if interactions else 0
    
    # More unique interactions = higher entropy
    if unique_users < 2:
        return 0.2
    elif unique_users < 5:
        return 0.5
    elif unique_users < 10:
        return 0.7
    else:
        return 1.0


async def calculate_vote_pattern_score(user_id: str, upvotes, downvotes) -> float:
    """
    Component 6: Vote Pattern Score
    
    Detects coordinated voting (always voting same users).
    """
    if not upvotes and not downvotes:
        return 1.0  # No votes = no abuse
    
    # Get target user distribution
    all_votes = upvotes + downvotes
    target_counts: Dict[str, int] = {}
    
    for vote in all_votes:
        target = vote.answerId  # Simplified - should get answer.userId
        target_counts[target] = target_counts.get(target, 0) + 1
    
    total_votes = len(all_votes)
    
    if total_votes < 5:
        return 1.0  # Too few votes to judge
    
    # Calculate Gini coefficient (distribution inequality)
    counts = sorted(target_counts.values())
    n = len(counts)
    gini = (2 * sum((i + 1) * count for i, count in enumerate(counts))) / (n * sum(counts)) - (n + 1) / n
    
    # Lower Gini (more equal distribution) = higher score
    return 1.0 - gini


def calculate_similarity_penalty(user_id: str) -> float:
    """
    Component 7: Similarity Flags
    
    Penalty for content similarity fraud.
    """
    # TODO: Integrate with similarity detector
    return 1.0  # No flags = 1.0, flags reduce score


def calculate_abuse_penalty(abuse_flags) -> float:
    """
    Component 8: Abuse Flags
    
    Direct penalty for active abuse flags.
    """
    active_flags = [f for f in abuse_flags if not f.resolved]
    
    if not active_flags:
        return 1.0
    
    # Each unresolved flag reduces score
    penalty = 0.2 * len(active_flags)
    
    return max(0.0, 1.0 - penalty)


async def calculate_ip_clustering_risk(user_id: str) -> float:
    """
    Component 9: IP Clustering Risk
    
    Detects users sharing IPs (sock puppets).
    """
    # TODO: Integrate with IP clustering detector
    return 1.0  # No shared IPs = 1.0


def get_trust_tier(score: float) -> str:
    """Map trust score to tier."""
    if score < 0.30:
        return "Restricted"
    elif score < 0.50:
        return "Novice"
    elif score < 0.70:
        return "Contributor"
    elif score < 0.85:
        return "Expert"
    else:
        return "Trusted"


logger.info("Trust scorer initialized")
