# Game Engine Architecture - NOVYRA Gamification System

## Overview

The NOVYRA Game Engine is a **non-exploitable, learning-centric gamification system** that rewards genuine knowledge growth and high-quality contributions. Unlike traditional point systems, it separates **engagement** from **authority** and uses **trust scoring** to prevent gaming.

---

## Core Philosophy

### What We Reward
✅ **Mastery Growth** - Demonstrable understanding improvement  
✅ **Quality Contributions** - Validated, helpful answers  
✅ **Community Trust** - Peer-verified expertise  
✅ **Consistent Learning** - Sustained engagement over time  

### What We Don't Reward
❌ **Volume** - Raw posting count  
❌ **Speed** - First-to-answer races  
❌ **Self-Promotion** - Vote trading, sockpuppets  
❌ **AI Spam** - Copy-pasted LLM outputs  

---

## System Architecture

### Component Separation

```
┌─────────────────────────────────────────────────────┐
│              Game Engine Service                    │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  XP Engine   │  │ Achievement  │  │Reputation│ │
│  │              │  │   Engine     │  │ Engine   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         │                  │                │      │
│         └──────────────────┴────────────────┘      │
│                         │                          │
│                  ┌──────▼──────┐                  │
│                  │  Event Bus  │                  │
│                  └─────────────┘                  │
└─────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   PostgreSQL           Trust Engine          Anti-Abuse
   (XP Ledger)         (Validation)          (Detection)
```

### Event-Driven Design

**ALL gamification updates are triggered by events, never direct manipulation.**

---

## XP System

### Design Principles

1. **Event-Driven** - XP awarded via events, not direct API calls
2. **Trust-Weighted** - Low-trust users earn less XP
3. **Mastery-Gated** - Large XP requires demonstrated mastery
4. **Time-Decayed** - Cannot farm same concept repeatedly
5. **Audit-Logged** - All XP changes are traceable

### XP Event Types

```python
class XPEvent(Enum):
    # Learning events (primary)
    MASTERY_GAIN = "mastery_gain"              # Mastery score increased
    CONCEPT_MASTERED = "concept_mastered"      # Mastery > 0.8
    PREREQUISITE_CLEARED = "prerequisite_cleared"
    
    # Contribution events (secondary)
    ANSWER_ACCEPTED = "answer_accepted"        # Your answer was accepted
    ANSWER_UPVOTED = "answer_upvoted"          # Community validation
    HELPFUL_COMMENT = "helpful_comment"        # Upvoted comment
    
    # Milestone events (bonus)
    STREAK_MILESTONE = "streak_milestone"      # 7, 30, 100 day streaks
    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    
    # Engagement events (small)
    DAILY_LOGIN = "daily_login"
    DOUBT_CREATED = "doubt_created"            # Minimal XP (anti-spam)
```

### XP Calculation Formula

```python
@dataclass
class XPAward:
    base_xp: int                    # Base amount for action
    mastery_multiplier: float       # Based on concept difficulty
    trust_multiplier: float         # Based on user trust score
    fact_check_multiplier: float    # Based on NLI validation
    time_decay: float               # Prevent rapid farming
    final_xp: int                   # Calculated final XP

def calculate_xp(
    event: XPEvent,
    user_id: str,
    concept_id: str | None,
    trust_score: float,
    fact_check_score: float = 1.0
) -> XPAward:
    # Base XP per event type
    base_xp = {
        XPEvent.MASTERY_GAIN: 50,
        XPEvent.CONCEPT_MASTERED: 200,
        XPEvent.ANSWER_ACCEPTED: 100,
        XPEvent.ANSWER_UPVOTED: 10,
        XPEvent.HELPFUL_COMMENT: 5,
        XPEvent.STREAK_MILESTONE: 150,
        XPEvent.DAILY_LOGIN: 5,
        XPEvent.DOUBT_CREATED: 2
    }[event]
    
    # Mastery multiplier (harder concepts = more XP)
    if concept_id:
        concept = get_concept(concept_id)
        mastery_mult = 1.0 + (concept.difficulty / 10) * 0.5  # 1.0-1.5×
    else:
        mastery_mult = 1.0
    
    # Trust multiplier (range: 0.5× - 1.5×)
    trust_mult = 0.5 + trust_score  # trust_score is 0.0-1.0
    
    # Fact-check multiplier (penalize low-confidence answers)
    if event in [XPEvent.ANSWER_ACCEPTED, XPEvent.ANSWER_UPVOTED]:
        fact_mult = fact_check_score
    else:
        fact_mult = 1.0
    
    # Time decay (penalize rapid repeated attempts on same concept)
    if concept_id:
        time_decay = calculate_time_decay(user_id, concept_id)
    else:
        time_decay = 1.0
    
    # Final calculation
    raw_xp = base_xp * mastery_mult * trust_mult * fact_mult * time_decay
    final_xp = max(1, int(raw_xp))  # Minimum 1 XP
    
    return XPAward(
        base_xp=base_xp,
        mastery_multiplier=mastery_mult,
        trust_multiplier=trust_mult,
        fact_check_multiplier=fact_mult,
        time_decay=time_decay,
        final_xp=final_xp
    )

def calculate_time_decay(user_id: str, concept_id: str) -> float:
    """
    Prevent XP farming by reducing rewards for rapid repeated attempts.
    """
    recent_awards = get_recent_xp_awards(
        user_id=user_id,
        concept_id=concept_id,
        within_hours=24
    )
    
    if len(recent_awards) == 0:
        return 1.0
    elif len(recent_awards) == 1:
        return 0.8
    elif len(recent_awards) == 2:
        return 0.5
    else:
        return 0.2  # Severe penalty for spam
```

### XP Ledger (Database Schema)

```prisma
model XPLedger {
  id              String   @id @default(cuid())
  userId          String
  eventType       XPEvent
  conceptId       String?
  
  // XP breakdown
  baseXP          Int
  masteryMult     Float
  trustMult       Float
  factCheckMult   Float
  timeDec ay      Float
  finalXP         Int
  
  // Audit
  reason          String   // Human-readable description
  metadata        Json     // Event-specific data
  createdAt       DateTime @default(now())
  
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([eventType])
  @@index([conceptId])
}
```

### XP API Constraints

**NO direct XP manipulation endpoints.**

Only event handlers can write to `XPLedger`.

```python
# ❌ FORBIDDEN
@router.post("/api/xp/add")  # NEVER IMPLEMENT THIS
async def add_xp(user_id: str, amount: int):
    # Direct XP manipulation is a security risk
    pass

# ✅ CORRECT
async def handle_answer_accepted_event(event: AnswerAcceptedEvent):
    xp_award = calculate_xp(
        event=XPEvent.ANSWER_ACCEPTED,
        user_id=event.answerer_id,
        concept_id=event.concept_id,
        trust_score=get_trust_score(event.answerer_id)
    )
    
    await xp_ledger.create(xp_award)
    await emit_event("XP_AWARDED", xp_award)
```

---

## Reputation System

### Reputation vs XP

| Metric | Purpose | Earned By | Lost By |
|--------|---------|-----------|---------|
| **XP** | Progress leveling | Learning + contributions | Never (monotonic) |
| **Reputation** | Community authority | Peer validation | Downvotes, flags |

**Reputation is NOT monotonic** - it can decrease with poor contributions.

### Reputation Events

```python
class ReputationEvent(Enum):
    # Positive
    ANSWER_ACCEPTED = 15
    ANSWER_UPVOTED = 5
    DOUBT_UPVOTED = 2
    HIGH_NLI_SCORE = 3           # Fact-check passed with > 0.9
    PEER_ENDORSED = 10            # Teacher/admin endorsement
    
    # Negative
    ANSWER_DOWNVOTED = -2
    DOUBT_DOWNVOTED = -1
    LOW_NLI_SCORE = -5            # Fact-check failed
    FLAGGED_SPAM = -10
    ANSWER_UNACCEPTED = -5        # Answer was accepted then un-accepted
```

### Reputation Calculation

```python
def calculate_reputation_change(
    event: ReputationEvent,
    user_id: str,
    target_id: str,  # Answer/doubt being voted on
    voter_trust: float = 1.0
) -> int:
    base_change = event.value
    
    # Weight votes by voter's trust
    weighted_change = int(base_change * voter_trust)
    
    # Cap daily reputation change to prevent manipulation
    daily_change = get_daily_reputation_change(user_id)
    daily_limit = 200
    
    if abs(daily_change + weighted_change) > daily_limit:
        # Throttle to prevent vote brigading
        weighted_change = max(-daily_limit - daily_change, 
                             min(daily_limit - daily_change, weighted_change))
    
    return weighted_change
```

### Reputation Tiers

| Tier | Reputation | Privileges |
|------|-----------|------------|
| **Novice** | 0-49 | Ask doubts, answer (moderated) |
| **Student** | 50-199 | Unmoderated answers, vote |
| **Scholar** | 200-499 | Comment editing, flag content |
| **Expert** | 500-999 | Close doubts, edit others' posts |
| **Master** | 1000+ | Moderator tools, trust weight 1.5× |

---

## Achievement System

### Design Requirements

**Every achievement must be:**
1. ✅ **Non-exploitable** - Cannot be farmed
2. ✅ **Cross-validated** - Requires multiple unique users or long time periods
3. ✅ **Quality-gated** - Minimum trust/NLI thresholds
4. ✅ **Meaningful** - Reflects genuine skill or contribution

### Achievement Categories

```python
class AchievementCategory(Enum):
    LEARNING = "learning"           # Mastery-based
    TEACHING = "teaching"           # Answer quality
    COMMUNITY = "community"         # Engagement
    MILESTONE = "milestone"         # Time-based
    SPECIAL = "special"             # Rare events
```

### 15 Core Achievements (Non-Exploitable)

#### Learning Category

##### 1. First Steps (Common)
**Criteria:** Complete first concept attempt  
**Reward:** 50 XP  
**Anti-Exploit:** One-time only  

```python
trigger = "CONCEPT_ATTEMPTED"
check = lambda user: count_attempts(user) == 1
```

##### 2. Concept Master (Uncommon)
**Criteria:** Achieve mastery score > 0.8 on any concept  
**Reward:** 100 XP  
**Anti-Exploit:** Requires consistent performance over 5+ attempts  

```python
trigger = "MASTERY_UPDATED"
check = lambda user, concept: (
    mastery_score(user, concept) > 0.8 and
    attempt_count(user, concept) >= 5
)
```

##### 3. Domain Expert (Rare)
**Criteria:** Master 10 concepts in same domain with avg mastery > 0.75  
**Reward:** 500 XP + "Domain Expert" badge  
**Anti-Exploit:** Requires 50+ total attempts across concepts  

```python
trigger = "MASTERY_UPDATED"
check = lambda user, domain: (
    len([c for c in user_concepts(user, domain) if c.mastery > 0.8]) >= 10 and
    sum([c.attempts for c in user_concepts(user, domain)]) >= 50 and
    days_span([c.last_attempt for c in user_concepts(user, domain)]) >= 7
)
```

##### 4. Knowledge Tree (Epic)
**Criteria:** Master a concept and all its prerequisites  
**Reward:** 300 XP  
**Anti-Exploit:** Graph-validated prerequisite chain  

```python
trigger = "MASTERY_UPDATED"
check = lambda user, concept: (
    mastery_score(user, concept) > 0.8 and
    all(mastery_score(user, p.id) > 0.7 for p in get_prerequisites(concept))
)
```

##### 5. Lifelong Learner (Legendary)
**Criteria:** Master 50 concepts across 5 domains  
**Reward:** 2000 XP + Special badge + 10% subscription discount  
**Anti-Exploit:** Minimum 30-day span, 200+ total attempts  

```python
trigger = "MASTERY_UPDATED"
check = lambda user: (
    len(get_mastered_concepts(user)) >= 50 and
    len(set(c.domain for c in get_mastered_concepts(user))) >= 5 and
    days_since_first_attempt(user) >= 30 and
    total_attempts(user) >= 200
)
```

---

#### Teaching Category

##### 6. First Teacher (Common)
**Criteria:** First answer accepted by another user  
**Reward:** 100 XP  
**Anti-Exploit:** Must be accepted by different user, not self  

```python
trigger = "ANSWER_ACCEPTED"
check = lambda user, answer: (
    count_accepted_answers(user) == 1 and
    answer.asker_id != user.id
)
```

##### 7. Quality Answers (Uncommon)
**Criteria:** 10 accepted answers with NLI confidence > 0.75  
**Reward:** 250 XP  
**Anti-Exploit:** Must be from 10 different users, > 7 days span  

```python
trigger = "ANSWER_ACCEPTED"
check = lambda user: (
    len(get_accepted_answers(user, min_nli=0.75)) >= 10 and
    len(set(a.asker_id for a in get_accepted_answers(user))) >= 10 and
    days_span([a.created_at for a in get_accepted_answers(user)]) >= 7
)
```

##### 8. Trusted Advisor (Rare)
**Criteria:** 25 accepted answers + trust score > 0.8  
**Reward:** 500 XP + "Advisor" badge  
**Anti-Exploit:** Trust score must be sustained for 14 days  

```python
trigger = "ANSWER_ACCEPTED"
check = lambda user: (
    count_accepted_answers(user) >= 25 and
    get_trust_score(user) > 0.8 and
    days_trust_above_threshold(user, 0.8) >= 14
)
```

##### 9. Perfect Explanation (Epic)
**Criteria:** 5 answers with NLI confidence > 0.95 + 10+ upvotes each  
**Reward:** 750 XP  
**Anti-Exploit:** Votes from high-trust users only (trust > 0.6)  

```python
trigger = "ANSWER_UPVOTED"
check = lambda user, answer: (
    len(get_answers(user, min_nli=0.95, min_upvotes=10)) >= 5 and
    all(
        sum(1 for v in a.votes if v.user.trust_score > 0.6) >= 10
        for a in get_answers(user, min_nli=0.95)
    )
)
```

##### 10. Master Teacher (Legendary)
**Criteria:** 100 accepted answers, 90% acceptance rate, trust > 0.9  
**Reward:** 3000 XP + "Master Teacher" badge + Moderator privileges  
**Anti-Exploit:** Minimum 60-day span, votes from 50+ unique users  

```python
trigger = "ANSWER_ACCEPTED"
check = lambda user: (
    count_accepted_answers(user) >= 100 and
    (count_accepted_answers(user) / count_total_answers(user)) > 0.9 and
    get_trust_score(user) > 0.9 and
    days_since_first_answer(user) >= 60 and
    len(set(v.user_id for a in user_answers(user) for v in a.votes)) >= 50
)
```

---

#### Community Category

##### 11. Helpful Member (Uncommon)
**Criteria:** 50 upvotes received on answers  
**Reward:** 150 XP  
**Anti-Exploit:** Votes from 25+ unique users over 14+ days  

```python
trigger = "ANSWER_UPVOTED"
check = lambda user: (
    sum(a.upvotes for a in user_answers(user)) >= 50 and
    len(set(v.user_id for a in user_answers(user) for v in a.votes if v.type == "UP")) >= 25 and
    days_span([v.created_at for a in user_answers(user) for v in a.votes]) >= 14
)
```

##### 12. Discussion Leader (Rare)
**Criteria:** Start 20 doubts with >= 5 answers each  
**Reward:** 300 XP  
**Anti-Exploit:** Doubts must stay open for 48+ hours before resolution  

```python
trigger = "DOUBT_RESOLVED"
check = lambda user: (
    len([d for d in user_doubts(user) if len(d.answers) >= 5]) >= 20 and
    all(
        (d.resolved_at - d.created_at).total_seconds() > 48 * 3600
        for d in user_doubts(user) if d.is_resolved
    )
)
```

##### 13. Community Pillar (Epic)
**Criteria:** Active for 90 consecutive days + 200+ contributions  
**Reward:** 1000 XP + "Pillar" badge  
**Anti-Exploit:** Contributions spread across all 90 days (min 2/day)  

```python
trigger = "DAILY_LOGIN"
check = lambda user: (
    current_streak(user) >= 90 and
    total_contributions(user) >= 200 and
    all(daily_contributions(user, day) >= 2 for day in last_90_days())
)
```

---

#### Milestone Category

##### 14. Week Warrior (Uncommon)
**Criteria:** 7-day streak with >= 3 learning activities/day  
**Reward:** 200 XP  
**Anti-Exploit:** Activity = attempt/answer/doubt (scored, not just login)  

```python
trigger = "STREAK_UPDATED"
check = lambda user: (
    current_streak(user) >= 7 and
    all(daily_activity_count(user, day) >= 3 for day in last_7_days())
)
```

##### 15. Century Club (Legendary)
**Criteria:** 100-day streak  
**Reward:** 5000 XP + "Century" badge + 20% discount  
**Anti-Exploit:** Verified login + activity each day (no bulk credits)  

```python
trigger = "STREAK_UPDATED"
check = lambda user: (
    current_streak(user) >= 100 and
    all(has_verified_activity(user, day) for day in last_100_days())
)
```

---

### Achievement Unlock Logic

```python
async def check_achievements(event_type: str, user_id: str, metadata: dict):
    """
    Check if any achievements should be unlocked after an event.
    """
    # Get all achievements triggered by this event type
    candidate_achievements = get_achievements_for_event(event_type)
    
    for achievement in candidate_achievements:
        # Skip if already unlocked
        if has_achievement(user_id, achievement.id):
            continue
        
        # Check if criteria met
        if await achievement.check_criteria(user_id, metadata):
            # Double-check with database transaction (prevent race condition)
            async with db.transaction():
                # Re-check after lock
                if not has_achievement(user_id, achievement.id):
                    await unlock_achievement(user_id, achievement.id)
                    await award_xp(user_id, achievement.reward_xp, 
                                   reason=f"Achievement: {achievement.name}")
                    await emit_event("ACHIEVEMENT_UNLOCKED", {
                        "user_id": user_id,
                        "achievement_id": achievement.id
                    })
```

### Achievement Progress Tracking

```prisma
model AchievementProgress {
  id             String   @id @default(cuid())
  userId         String
  achievementId  String
  current        Int      // Current progress value
  target         Int      // Target to unlock
  lastUpdated    DateTime @default(now())
  
  user           User        @relation(fields: [userId], references: [id])
  achievement    Achievement @relation(fields: [achievementId], references: [id])
  
  @@unique([userId, achievementId])
  @@index([userId])
}
```

**Example:**
- User has 8/10 accepted answers for "Quality Answers"
- Progress bar shows 80%
- Updated on each `ANSWER_ACCEPTED` event

---

## Streak System

### Streak Rules

1. **Daily Check-In** - User must perform >= 1 meaningful action per day
2. **Meaningful Action** - Concept attempt, answer submission, or doubt creation
3. **Login-Only Does NOT Count** - Must engage with learning
4. **Grace Period** - 4-hour window after midnight to maintain streak
5. **Freeze Items** - None (prevents pay-to-win)

### Streak Bonuses

| Milestone | XP Bonus | Special Reward |
|-----------|----------|----------------|
| 7 days | 100 | "Week Warrior" achievement |
| 30 days | 500 | Bronze streak badge |
| 60 days | 1000 | Silver streak badge |
| 100 days | 5000 | Gold streak badge + 20% discount |

### Streak Calculation

```python
async def update_streak(user_id: str):
    """
    Called after any meaningful action.
    """
    streak = await db.streak.find_unique(where={"userId": user_id})
    
    if not streak:
        # First action ever
        await db.streak.create({
            "userId": user_id,
            "currentStreak": 1,
            "longestStreak": 1,
            "lastActivityDate": date.today()
        })
        return
    
    last_date = streak.lastActivityDate
    today = date.today()
    
    if last_date == today:
        # Already logged today
        return
    
    days_diff = (today - last_date).days
    
    if days_diff == 1:
        # Consecutive day - increment streak
        new_streak = streak.currentStreak + 1
        await db.streak.update({
            "where": {"userId": user_id},
            "data": {
                "currentStreak": new_streak,
                "longestStreak": max(new_streak, streak.longestStreak),
                "lastActivityDate": today
            }
        })
        
        # Check for streak milestones
        if new_streak in [7, 30, 60, 100]:
            await emit_event("STREAK_MILESTONE", {
                "user_id": user_id,
                "streak": new_streak
            })
    
    else:
        # Streak broken - reset
        await db.streak.update({
            "where": {"userId": user_id},
            "data": {
                "currentStreak": 1,
                "lastActivityDate": today
            }
        })
```

---

## Leaderboards

### Leaderboard Types

```python
class LeaderboardType(Enum):
    GLOBAL_XP = "global_xp"               # All-time XP
    GLOBAL_REPUTATION = "global_reputation"
    WEEKLY_XP = "weekly_xp"               # This week's XP gains
    MONTHLY_XP = "monthly_xp"
    SUBJECT_EXPERT = "subject_expert"     # Top per subject
    RISING_STAR = "rising_star"           # Highest XP gain this week
```

### Materialized View Strategy

**Problem:** Calculating ranks on-demand is expensive.  
**Solution:** Precompute leaderboards every 5 minutes.

```sql
-- Materialized view for global XP leaderboard
CREATE MATERIALIZED VIEW leaderboard_global_xp AS
SELECT 
    u.id,
    u.name,
    u.image,
    SUM(x.finalXP) as total_xp,
    RANK() OVER (ORDER BY SUM(x.finalXP) DESC) as rank
FROM users u
JOIN xp_ledger x ON u.id = x.userId
GROUP BY u.id
ORDER BY total_xp DESC
LIMIT 100;

-- Refresh every 5 minutes (via cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global_xp;
```

### Privacy Controls

```python
# User can opt out of public leaderboards
model User {
  ...
  leaderboardOptOut Boolean @default(false)
}

# Filter query
async def get_leaderboard(type: LeaderboardType, limit: int = 50):
    # Exclude opted-out users
    return await db.raw_query(f"""
        SELECT * FROM leaderboard_{type.value}
        WHERE user_id NOT IN (
            SELECT id FROM users WHERE leaderboard_opt_out = true
        )
        LIMIT {limit}
    """)
```

---

## Anti-Gaming Integration

### Detection Hooks

Every XP/reputation change triggers anti-gaming checks:

```python
async def award_xp(user_id: str, xp: int, reason: str):
    # Run anti-gaming checks
    anomalies = await detect_anomalies(user_id, "XP_AWARD", xp)
    
    if anomalies:
        # Flag for review
        await emit_event("ABUSE_SUSPECTED", {
            "user_id": user_id,
            "type": "xp_anomaly",
            "details": anomalies
        })
        
        # Reduce award
        xp = int(xp * 0.5)
    
    # Record XP
    await db.xp_ledger.create({
        "userId": user_id,
        "finalXP": xp,
        "reason": reason,
        "flagged": bool(anomalies)
    })
```

### Rate Limiting

```python
# Per-user XP rate limits
MAX_XP_PER_HOUR = 1000
MAX_XP_PER_DAY = 5000

async def check_xp_rate_limit(user_id: str, proposed_xp: int) -> bool:
    hourly_xp = get_xp_in_window(user_id, hours=1)
    daily_xp = get_xp_in_window(user_id, hours=24)
    
    if hourly_xp + proposed_xp > MAX_XP_PER_HOUR:
        return False
    if daily_xp + proposed_xp > MAX_XP_PER_DAY:
        return False
    
    return True
```

---

## API Endpoints

### GET /api/gamification/user/:id/stats
```json
{
  "xp": {
    "total": 12450,
    "level": 15,
    "next_level_at": 13000,
    "weekly_gain": 850
  },
  "reputation": {
    "score": 342,
    "tier": "Scholar",
    "percentile": 78
  },
  "achievements": {
    "unlocked": 12,
    "total": 15,
    "recent": [...]
  },
  "streaks": {
    "current": 23,
    "longest": 45,
    "next_milestone": 30
  }
}
```

### GET /api/gamification/leaderboard/:type
```json
{
  "type": "global_xp",
  "period": "all_time",
  "last_updated": "2026-02-27T10:30:00Z",
  "entries": [
    {
      "rank": 1,
      "user_id": "...",
      "name": "Alice",
      "avatar": "...",
      "score": 45230
    },
    ...
  ]
}
```

---

## Testing Requirements

### Unit Tests
- XP calculation correct for all event types
- Trust multiplier applied correctly
- Time decay prevents farming
- Achievement criteria logic correct
- No race conditions in unlock logic

### Integration Tests
- Full event flow: action → event → XP award
- Leaderboard updates within 5 minutes
- Streak correctly handles timezone boundaries
- Achievement unlock triggers notification

### Performance Tests
- Leaderboard query < 100ms
- XP calculation < 50ms
- Achievement check < 200ms

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Ready for Implementation
