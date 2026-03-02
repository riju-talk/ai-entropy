# Trust & Anti-Abuse Model - NOVYRA Security Architecture

## Overview

The Trust & Anti-Abuse Model is NOVYRA's **defensive intelligence layer** that detects, prevents, and mitigates gaming attempts while maintaining a positive user experience. It operates on the principle that **trust is earned through consistent, validated contributions**, not granted by default.

---

## Threat Model

### Primary Abuse Vectors

#### 1. XP Farming Loops
**Attack:** Repeatedly attempt easy concepts to farm XP  
**Goal:** Inflate XP/level without genuine learning  
**Example:** Spam attempts on "Hello World" concept 100×/day  

#### 2. Vote Trading
**Attack:** Coordinated vote exchanges between users  
**Goal:** Artificially boost reputation  
**Example:** User A upvotes all User B posts, User B reciprocates  

#### 3. Sockpuppet Accounts
**Attack:** Create multiple accounts to self-upvote  
**Goal:** Manipulate reputation and bypass rate limits  
**Example:** One person operating 10 accounts to upvote own answers  

#### 4. AI Copy-Paste Spam
**Attack:** Post LLM-generated answers without validation  
**Goal:** Volume-based XP farming  
**Example:** Copy ChatGPT responses to every question  

#### 5. Low-Effort Streak Farming
**Attack:** Minimal daily actions to maintain streak  
**Goal:** Streak bonuses without genuine engagement  
**Example:** Daily login + 1 trivial doubt to keep streak alive  

#### 6. Mastery Farming via Trivial Attempts
**Attack:** Repeatedly answer memorized questions  
**Goal:** Artificially high mastery scores  
**Example:** Refresh page until same easy problem appears  

#### 7. Collusion Clusters
**Attack:** Groups coordinate to boost each other's metrics  
**Goal:** Gaming leaderboards and achievements  
**Example:** Discord group where members upvote each other exclusively  

---

## Detection Systems

### 1. Similarity Detection (Content Deduplication)

#### Purpose
Detect copied/plagiarized answers and questions.

#### Implementation

```python
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Initialize embedding model
embedder = SentenceTransformer('all-MiniLM-L6-v2')

def detect_similarity(new_text: str, user_id: str) -> SimilarityResult:
    """
    Check if new content is too similar to existing content.
    """
    # Embed new text
    new_embedding = embedder.encode([new_text])[0]
    
    # Get recent content from this user (last 50 posts)
    user_content = get_recent_content(user_id, limit=50)
    
    # Get popular answers on same doubt (if answering)
    if context := get_context():
        similar_answers = get_answers_for_doubt(context.doubt_id, limit=20)
    else:
        similar_answers = []
    
    # Compare embeddings
    max_self_similarity = 0.0
    max_other_similarity = 0.0
    
    for content in user_content:
        similarity = cosine_similarity([new_embedding], [content.embedding])[0][0]
        max_self_similarity = max(max_self_similarity, similarity)
    
    for answer in similar_answers:
        if answer.author_id != user_id:
            similarity = cosine_similarity([new_embedding], [answer.embedding])[0][0]
            max_other_similarity = max(max_other_similarity, similarity)
    
    return SimilarityResult(
        self_similarity=max_self_similarity,
        other_similarity=max_other_similarity,
        flagged=max_self_similarity > 0.95 or max_other_similarity > 0.90
    )

# Thresholds
SELF_SIMILARITY_THRESHOLD = 0.95   # User copy-pasting own answers
OTHER_SIMILARITY_THRESHOLD = 0.90  # Plagiarism from others
```

#### Action on Detection
```python
if similarity.flagged:
    if similarity.self_similarity > 0.95:
        # Duplicate content
        return {"error": "This content is too similar to your previous posts"}
    else:
        # Possible plagiarism
        await flag_for_review(user_id, content, "SIMILARITY_HIGH")
        # Allow post but with warning
        await reduce_xp_award(user_id, multiplier=0.3)
```

---

### 2. Vote Graph Anomaly Detection

#### Purpose
Identify coordinated voting rings and sockpuppets.

#### Vote Graph Structure

```python
# Directed graph: User A → User B means "A voted for B's content"
VoteGraph = Dict[str, Dict[str, int]]  # {voter_id: {target_id: vote_count}}
```

#### Metrics

##### Reciprocity Score
```python
def calculate_reciprocity(user_a: str, user_b: str, graph: VoteGraph) -> float:
    """
    Measure mutual voting between two users.
    """
    a_to_b = graph.get(user_a, {}).get(user_b, 0)
    b_to_a = graph.get(user_b, {}).get(user_a, 0)
    
    if a_to_b == 0 and b_to_a == 0:
        return 0.0
    
    # Normalized reciprocity (0-1)
    total = a_to_b + b_to_a
    balance = min(a_to_b, b_to_a) / total if total > 0 else 0
    
    return balance

# Flag if reciprocity > 0.7 AND total votes > 10
def detect_vote_trading(user_id: str, graph: VoteGraph) -> List[str]:
    suspects = []
    for other_id in graph.get(user_id, {}):
        recip = calculate_reciprocity(user_id, other_id, graph)
        total_votes = graph[user_id][other_id] + graph.get(other_id, {}).get(user_id, 0)
        
        if recip > 0.7 and total_votes > 10:
            suspects.append(other_id)
    
    return suspects
```

##### Voting Entropy
```python
def calculate_voting_entropy(user_id: str, graph: VoteGraph) -> float:
    """
    Measure diversity of voting targets.
    Low entropy = votes concentrated on few users (suspicious).
    """
    votes = graph.get(user_id, {})
    if not votes:
        return 0.0
    
    total = sum(votes.values())
    probabilities = [count / total for count in votes.values()]
    
    entropy = -sum(p * math.log2(p) for p in probabilities if p > 0)
    
    # Normalize by max possible entropy
    max_entropy = math.log2(len(votes))
    normalized = entropy / max_entropy if max_entropy > 0 else 0
    
    return normalized

# Flag if entropy < 0.3 AND total votes > 20
# (User votes almost exclusively for same few people)
```

##### Cluster Detection
```python
from sklearn.cluster import DBSCAN

def detect_collusion_clusters(graph: VoteGraph) -> List[Set[str]]:
    """
    Find clusters of users who primarily vote for each other.
    """
    # Build adjacency matrix
    users = list(graph.keys())
    n = len(users)
    user_to_idx = {u: i for i, u in enumerate(users)}
    
    # Mutual voting strength matrix
    matrix = np.zeros((n, n))
    for voter in users:
        for target, count in graph[voter].items():
            if target in user_to_idx:
                i, j = user_to_idx[voter], user_to_idx[target]
                reverse_count = graph.get(target, {}).get(voter, 0)
                matrix[i][j] = count + reverse_count
    
    # Cluster with DBSCAN
    clustering = DBSCAN(eps=5, min_samples=3).fit(matrix)
    
    # Extract clusters
    clusters = []
    for cluster_id in set(clustering.labels_):
        if cluster_id == -1:  # Noise
            continue
        cluster = {users[i] for i, label in enumerate(clustering.labels_) if label == cluster_id}
        if len(cluster) >= 3:
            clusters.append(cluster)
    
    return clusters
```

#### Scheduled Analysis
```python
# Run daily via cron job
async def daily_vote_analysis():
    graph = build_vote_graph(days=30)
    
    # Check reciprocity
    for user in all_users():
        suspects = detect_vote_trading(user, graph)
        if suspects:
            await flag_for_review(user, "VOTE_TRADING", {"suspects": suspects})
    
    # Check entropy
    for user in all_users():
        entropy = calculate_voting_entropy(user, graph)
        if entropy < 0.3:
            await flag_for_review(user, "LOW_VOTE_ENTROPY", {"entropy": entropy})
    
    # Detect clusters
    clusters = detect_collusion_clusters(graph)
    for cluster in clusters:
        await flag_cluster_for_review(cluster, "COLLUSION_CLUSTER")
```

---

### 3. Interaction Entropy Scoring

#### Purpose
Detect unnatural interaction patterns (e.g., always answering same user's questions).

#### Metrics

```python
def calculate_interaction_entropy(user_id: str, interaction_type: str) -> float:
    """
    Measure diversity of interactions.
    
    interaction_type: "answers_to" | "asks_to" | "votes_for"
    """
    interactions = get_user_interactions(user_id, interaction_type, days=30)
    
    if len(interactions) < 5:
        return 1.0  # Not enough data, give benefit of doubt
    
    # Count interactions per target user
    target_counts = {}
    for interaction in interactions:
        target = interaction.target_user_id
        target_counts[target] = target_counts.get(target, 0) + 1
    
    # Calculate entropy
    total = sum(target_counts.values())
    probabilities = [count / total for count in target_counts.values()]
    entropy = -sum(p * math.log2(p) for p in probabilities if p > 0)
    
    # Normalize
    max_entropy = math.log2(len(target_counts))
    return entropy / max_entropy if max_entropy > 0 else 0.0

# Flag if interaction_entropy < 0.2 for any type
# (User interacts with very limited set of other users)
```

---

### 4. IP Clustering

#### Purpose
Detect sockpuppet accounts from same IP address.

#### Implementation

```python
from collections import defaultdict

def detect_ip_clustering() -> Dict[str, List[str]]:
    """
    Find IP addresses with multiple active accounts.
    """
    # Get recent logins (last 7 days)
    logins = get_recent_logins(days=7)
    
    # Group by IP
    ip_to_users = defaultdict(set)
    for login in logins:
        ip_to_users[login.ip_address].add(login.user_id)
    
    # Flag IPs with 3+ accounts
    suspicious_ips = {}
    for ip, users in ip_to_users.items():
        if len(users) >= 3:
            suspicious_ips[ip] = list(users)
    
    return suspicious_ips

# Additional check: Cross-IP account similarity
def check_account_similarity(user_a: str, user_b: str) -> float:
    """
    Measure behavioral similarity between accounts.
    """
    features_a = extract_features(user_a)
    features_b = extract_features(user_b)
    
    # Compare features
    similarity_score = cosine_similarity([features_a], [features_b])[0][0]
    
    return similarity_score

def extract_features(user_id: str) -> List[float]:
    """
    Extract behavioral fingerprint.
    """
    stats = get_user_stats(user_id)
    
    return [
        stats.avg_answer_length,
        stats.avg_time_between_posts,
        stats.preferred_subjects_entropy,
        stats.upvote_ratio,
        stats.answer_acceptance_rate,
        stats.hours_of_day_activity_entropy,
        stats.day_of_week_activity_entropy
    ]

# Flag if same IP + similarity > 0.85
```

---

### 5. Streak Activity Diversity Scoring

#### Purpose
Prevent low-effort streak farming.

#### Metrics

```python
def calculate_daily_activity_quality(user_id: str, date: datetime.date) -> float:
    """
    Score daily activity quality (0-1).
    """
    activities = get_activities(user_id, date)
    
    if not activities:
        return 0.0
    
    # Scoring criteria
    score = 0.0
    
    # 1. Concept attempts (mastery-building)
    attempts = [a for a in activities if a.type == "CONCEPT_ATTEMPT"]
    if attempts:
        # Weighted by difficulty and correctness
        attempt_score = sum(
            (a.concept_difficulty / 10) * (1.0 if a.is_correct else 0.5)
            for a in attempts
        ) / len(attempts)
        score += attempt_score * 0.4
    
    # 2. Quality answers (NLI-checked)
    answers = [a for a in activities if a.type == "ANSWER_SUBMITTED"]
    if answers:
        answer_score = sum(
            a.nli_confidence for a in answers
        ) / len(answers)
        score += answer_score * 0.3
    
    # 3. Meaningful doubts (not trivial)
    doubts = [a for a in activities if a.type == "DOUBT_CREATED"]
    if doubts:
        doubt_score = sum(
            min(1.0, len(a.content) / 200)  # Length proxy for effort
            for a in doubts
        ) / len(doubts)
        score += doubt_score * 0.2
    
    # 4. Diversity (different activity types)
    activity_types = set(a.type for a in activities)
    diversity_score = len(activity_types) / 5  # Max 5 types
    score += diversity_score * 0.1
    
    return min(1.0, score)

# For streaks, require avg daily quality > 0.5
def validate_streak(user_id: str, streak_days: int) -> bool:
    """
    Verify streak is backed by quality activity.
    """
    quality_scores = []
    for i in range(streak_days):
        date = datetime.date.today() - datetime.timedelta(days=i)
        quality = calculate_daily_activity_quality(user_id, date)
        quality_scores.append(quality)
    
    avg_quality = sum(quality_scores) / len(quality_scores)
    
    return avg_quality > 0.5
```

---

### 6. Minimum Cognitive Load Scoring

#### Purpose
Detect trivial/memorized attempts that don't demonstrate learning.

#### Implementation

```python
def calculate_cognitive_load(attempt: ConceptAttempt) -> float:
    """
    Estimate cognitive effort (0-1).
    """
    score = 0.0
    
    # 1. Time spent (too fast = memorized)
    expected_time = 60 * attempt.concept_difficulty  # Seconds
    time_ratio = min(1.0, attempt.time_taken / expected_time)
    score += time_ratio * 0.4
    
    # 2. Hints used (more hints = higher effort)
    hint_ratio = attempt.hints_used / 3  # Max 3 hints
    score += hint_ratio * 0.2
    
    # 3. Variability in responses (same answer every time = memorized)
    recent_attempts = get_recent_attempts(attempt.user_id, attempt.concept_id, limit=5)
    if len(recent_attempts) > 1:
        # Check answer variability
        answers = [a.answer_text for a in recent_attempts]
        unique_ratio = len(set(answers)) / len(answers)
        score += unique_ratio * 0.3
    else:
        score += 0.3  # First attempt, give benefit of doubt
    
    # 4. Mistake diversity (learning from errors)
    if not attempt.is_correct:
        # Good sign if making different mistakes
        mistakes = [a.mistake_type for a in recent_attempts if not a.is_correct]
        mistake_diversity = len(set(mistakes)) / max(1, len(mistakes))
        score += mistake_diversity * 0.1
    else:
        score += 0.1
    
    return min(1.0, score)

# Flag attempts with cognitive_load < 0.3
# Award reduced XP if load < 0.5
```

---

## Trust Score System

### Trust Score Calculation (Comprehensive)

```python
@dataclass
class TrustComponents:
    mastery_reliability: float      # 0.0-1.0
    nli_track_record: float          # 0.0-1.0
    community_validation: float      # 0.0-1.0
    account_age_trust: float         # 0.0-1.0
    interaction_entropy: float       # 0.0-1.0
    vote_pattern_score: float        # 0.0-1.0
    similarity_flags: int            # Count of similarity violations
    abuse_flags: int                 # Count of abuse reports
    ip_clustering_risk: float        # 0.0-1.0

def calculate_comprehensive_trust(user_id: str, concept_id: str = None) -> TrustScore:
    """
    Comprehensive trust score incorporating all detection systems.
    """
    # Base components (from AI Brain Layer 8)
    mastery = mastery_reliability(user_id, concept_id) if concept_id else 0.5
    nli = nli_track_record(user_id)
    community = community_validation(user_id)
    account = account_trust(user_id)
    
    # Anti-abuse components
    interaction_ent = calculate_interaction_entropy(user_id, "answers_to")
    vote_pattern = calculate_voting_entropy(user_id, build_vote_graph(days=30))
    
    # Penalties
    similarity_flags = count_flags(user_id, "SIMILARITY", days=30)
    abuse_flags = count_flags(user_id, "ABUSE", days=90)
    ip_risk = get_ip_clustering_risk(user_id)
    
    # Weighted calculation
    base_score = (
        mastery * 0.25 +
        nli * 0.20 +
        community * 0.20 +
        account * 0.15 +
        interaction_ent * 0.10 +
        vote_pattern * 0.10
    )
    
    # Apply penalties
    penalty = 0.0
    penalty += similarity_flags * 0.05
    penalty += abuse_flags * 0.10
    penalty += ip_risk * 0.15
    
    final_score = max(0.0, base_score - penalty)
    
    return TrustScore(
        score=final_score,
        components=TrustComponents(
            mastery_reliability=mastery,
            nli_track_record=nli,
            community_validation=community,
            account_age_trust=account,
            interaction_entropy=interaction_ent,
            vote_pattern_score=vote_pattern,
            similarity_flags=similarity_flags,
            abuse_flags=abuse_flags,
            ip_clustering_risk=ip_risk
        ),
        last_updated=datetime.now()
    )
```

### Trust Decay Over Time

```python
def apply_trust_decay(user_id: str):
    """
    Gradually reduce trust if user becomes inactive.
    """
    user = get_user(user_id)
    days_inactive = (datetime.now() - user.last_active_at).days
    
    if days_inactive > 30:
        decay_factor = math.exp(-0.02 * (days_inactive - 30))
        current_trust = user.trust_score
        new_trust = current_trust * decay_factor
        
        update_user_trust(user_id, new_trust)

# Run weekly via cron
```

---

## Action Matrix (Trust-Based)

| Trust Range | XP Mult | Rate Limit | Moderation | Achievements | Vote Weight |
|-------------|---------|------------|------------|--------------|-------------|
| 0.0-0.2 (Banned) | 0× | Shadow ban | All manual | Disabled | 0× |
| 0.2-0.3 (Suspect) | 0.3× | 20/hr | 50% random | Disabled | 0.3× |
| 0.3-0.5 (New/Low) | 0.7× | 100/hr | Keyword filter | Limited | 0.7× |
| 0.5-0.7 (Good) | 1.0× | 200/hr | None | Full | 1.0× |
| 0.7-0.9 (High) | 1.2× | 500/hr | None | Full + Rare | 1.2× |
| 0.9-1.0 (Expert) | 1.5× | 1000/hr | None | Full + Legendary | 1.5× |

---

## Abuse Flag System

### Flag Types

```python
class AbuseFlag Type(Enum):
    SIMILARITY_HIGH = "similarity_high"
    VOTE_TRADING = "vote_trading"
    LOW_ENTROPY = "low_entropy"
    IP_CLUSTERING = "ip_clustering"
    STREAK_FRAUD = "streak_fraud"
    XP_FARMING = "xp_farming"
    SPAM_POSTING = "spam_posting"
    SOCKPUPPET = "sockpuppet"
```

### Flag Storage

```prisma
model AbuseFlag {
  id            String   @id @default(cuid())
  userId        String
  flagType      AbuseFlagType
  severity      Int      // 1-10
  details       Json     // Detection details
  autoDetected  Boolean  @default(true)
  reviewedBy    String?  // Admin who reviewed
  reviewedAt    DateTime?
  status        String   @default("PENDING")  // PENDING | CONFIRMED | FALSE_POSITIVE
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id])
  
  @@index([userId, status])
  @@index([flagType, createdAt])
}
```

### Auto-Flagging Logic

```python
async def auto_flag_user(
    user_id: str,
    flag_type: AbuseFlagType,
    severity: int,
    details: dict
):
    """
    Automatically flag user for suspicious behavior.
    """
    # Create flag
    flag = await db.abuse_flag.create({
        "userId": user_id,
        "flagType": flag_type,
        "severity": severity,
        "details": details,
        "autoDetected": True,
        "status": "PENDING"
    })
    
    # Update trust score
    trust = calculate_comprehensive_trust(user_id)
    await update_user_trust(user_id, trust.score)
    
    # Emit event for admin dashboard
    await emit_event("ABUSE_FLAG_CREATED", {
        "flag_id": flag.id,
        "user_id": user_id,
        "type": flag_type,
        "severity": severity
    })
    
    # Auto-action for high severity
    if severity >= 8:
        await apply_shadow_ban(user_id)
        await notify_admins(flag)
```

---

## Manual Review System

### Admin Dashboard

**View Pending Flags:**
```
GET /api/admin/abuse-flags?status=PENDING
```

**Review Flag:**
```
POST /api/admin/abuse-flags/:id/review
{
  "decision": "CONFIRMED" | "FALSE_POSITIVE",
  "action": "NONE" | "WARNING" | "SUSPEND" | "BAN",
  "notes": "..."
}
```

### Review Actions

```python
async def review_flag(flag_id: str, admin_id: str, decision: str, action: str):
    """
    Admin review of abuse flag.
    """
    flag = await db.abuse_flag.update({
        "where": {"id": flag_id},
        "data": {
            "status": decision,
            "reviewedBy": admin_id,
            "reviewedAt": datetime.now()
        }
    })
    
    if decision == "CONFIRMED":
        # Apply action
        if action == "WARNING":
            await send_warning_email(flag.userId)
        elif action == "SUSPEND":
            await suspend_user(flag.userId, days=7)
        elif action == "BAN":
            await ban_user(flag.userId)
        
        # Log moderation action
        await create_moderation_log(
            admin_id=admin_id,
            user_id=flag.userId,
            action=action,
            reason=flag.flagType
        )
    
    elif decision == "FALSE_POSITIVE":
        # Restore trust
        await restore_trust(flag.userId)
```

---

## Real-Time Monitoring

### Event Stream Dashboard

```python
# WebSocket endpoint for admin monitoring
@router.websocket("/api/admin/abuse-monitor")
async def abuse_monitor(websocket: WebSocket, admin_id: str):
    await websocket.accept()
    
    # Subscribe to abuse events
    async for event in subscribe_to_events([
        "ABUSE_FLAG_CREATED",
        "HIGH_SIMILARITY_DETECTED",
        "VOTE_ANOMALY_DETECTED",
        "XP_RATE_LIMIT_EXCEEDED"
    ]):
        await websocket.send_json({
            "type": event.type,
            "timestamp": event.timestamp.isoformat(),
            "user_id": event.user_id,
            "details": event.details
        })
```

---

## Performance Considerations

### Async Processing

- **Similarity checks**: Run async after content submitted (non-blocking)
- **Vote analysis**: Daily batch job (not real-time)
- **Trust recalculation**: Event-triggered, cached for 1 hour
- **IP clustering**: Weekly batch job

### Caching Strategy

```python
# Cache trust scores (invalidate on events)
@cache(ttl=3600)  # 1 hour
async def get_user_trust_cached(user_id: str) -> float:
    return calculate_comprehensive_trust(user_id).score

# Clear cache on relevant events
async def on_trust_affecting_event(user_id: str):
    cache.delete(f"trust:{user_id}")
```

---

## Testing Requirements

### Unit Tests
- Similarity detection accuracy > 90%
- Vote trading detection on synthetic data
- Entropy calculations correct
- Trust score calculation verified against test cases

### Integration Tests
- Full flag workflow (detection → flag → review → action)
- Trust score updates correctly on events
- Rate limiting works at all trust levels

### Performance Tests
- Similarity check < 200ms
- Trust calculation < 100ms (cached)
- Vote analysis completes < 5 minutes for 10k users

---

## Privacy & Ethics

### Data Collection
- **IP addresses**: Hashed, retained 30 days
- **Behavioral fingerprints**: Aggregated, not personally identifiable
- **Abuse flags**: Retained 1 year for audit

### User Transparency
- Export all flags on user: `GET /api/user/me/abuse-history`
- Explain trust score breakdown: `GET /api/user/me/trust-details`
- Appeal system for false positives

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Ready for Implementation
