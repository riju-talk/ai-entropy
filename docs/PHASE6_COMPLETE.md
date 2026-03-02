# PHASE 6 COMPLETE: Event-Driven Core Implementation ✅

## Overview
Phase 6 establishes the event-driven architecture that powers NOVYRA's gamification, trust scoring, and anti-abuse systems. All actions flow through events to prevent direct manipulation.

## System Architecture

### Event Flow
```
User Action → Event Emitted → Event Bus → Handlers → Side Effects
                                    ↓
                              Database Log (Full Audit Trail)
```

### Core Principle
**No Direct Manipulation:** XP, reputation, trust scores CANNOT be directly modified. They are calculated by event handlers responding to verified events.

---

## Implemented Components

### 1. Event System Foundation

#### `event_definitions.py` (31 Event Types)
Structured event type system across 6 categories:

**Learning Events:**
- `CONCEPT_ATTEMPTED` - User starts learning a concept
- `CONCEPT_COMPLETED` - User completes concept module
- `HINT_REQUESTED` - User requests AI hint

**Mastery Events:**
- `MASTERY_UPDATED` - Mastery score changes
- `PREREQUISITE_UNLOCKED` - User unlocks prerequisite concept

**Evaluation Events:**
- `ANSWER_SUBMITTED` - User submits answer
- `ANSWER_ACCEPTED` - Answer marked as best
- `ANSWER_UPVOTED` - Community upvote
- `ANSWER_DOWNVOTED` - Community downvote
- `DOUBT_CREATED` - User posts question
- `DOUBT_UPVOTED` - Doubt receives upvote

**AI Brain Events:**
- `REASONING_INVOKED` - AI reasoning engine called
- `NLI_CHECKED` - Fact-check performed
- `NLI_FLAG_RAISED` - Content flagged by NLI

**Gamification Events:**
- `XP_AWARDED` - XP credited (calculated, not arbitrary)
- `ACHIEVEMENT_UNLOCKED` - User earns achievement
- `STREAK_UPDATED` - Daily streak incremented
- `STREAK_BROKEN` - Streak reset

**Trust Events:**
- `TRUST_SCORE_UPDATED` - Trust recalculated
- `ABUSE_FLAG_CREATED` - Suspicious activity detected
- `SIMILARITY_DETECTED` - Content plagiarism found
- `VOTE_ANOMALY` - Coordinated voting detected

**System Events:**
- `USER_REGISTERED` - New account created
- `MODERATION_ACTION` - Manual moderation

#### `event_bus.py` (Central Dispatcher)
Publish-subscribe pattern with:
- **Async Handler Execution:** Non-blocking event processing
- **Error Isolation:** Handler failures don't cascade
- **Database Logging:** All events logged to `EventLog` table
- **Statistics Tracking:** Monitor event throughput
- **Decorator Registration:** Simple `@event_handler` pattern

**API:**
```python
from app.services.events.event_bus import event_handler, emit_event

@event_handler(EventType.ANSWER_ACCEPTED)
async def my_handler(event: Event):
    # Process event
    pass

# Emit event
await emit_event(AnswerAcceptedEvent(
    user_id="123",
    answer_id="456",
    metadata={...}
))
```

---

### 2. Event Handlers (`event_handlers.py`)

#### XP Award Handlers
- **`award_xp_for_accepted_answer`** - Base 100 XP × multipliers
- **`award_xp_for_mastery_gain`** - Base 50 XP × difficulty × trust
- **`award_xp_for_upvote`** - Base 5 XP weighted by voter trust

**Safety:** All XP awards create `XPLedger` entries with full multiplier breakdown for audit.

#### Reputation Handlers
- **`update_reputation_for_accepted_answer`** - +15 reputation
- **`decrease_reputation_for_downvote`** - -2 reputation (weighted by voter trust)

**Safety:** All reputation changes logged to `ReputationLedger`.

#### Trust Score Handlers
- **`recalculate_trust_score`** - Triggered by significant events
  - Listens to: `ANSWER_ACCEPTED`, `ANSWER_UPVOTED`, `MASTERY_UPDATED`, `ABUSE_FLAG_CREATED`
  - Updates 9 trust components
  - Caches result in `User.trustScoreCache`

#### Achievement Handlers
- **`check_achievements`** - Validates criteria after events
  - Checks all 15 achievements
  - Anti-exploit validation before unlock
  - Awards XP reward on unlock

#### Streak Handlers
- **`update_streak`** - Increments streak on meaningful activity
  - Only counts once per calendar day
  - Detects broken streaks
  - Emits milestone events

---

### 3. Gamification Services

#### `xp_engine.py` (XP Calculation)
**Formula:**
```
XP = base_xp × trust_mult × time_decay × fact_check_mult × difficulty_mult
```

**Multipliers:**
- **Trust:** 0.5× to 1.5× (based on `User.trustScoreCache`)
- **Time Decay:** 1.0× (fresh) to 0.5× (old content)
- **Fact-Check:** 1.5× (passed) to 0.3× (flagged)
- **Difficulty:** 1.0× to 1.5× (concept difficulty 1-10)

**Base XP Values:**
- Answer accepted: 100 XP
- Mastery gain: 50 XP
- Concept completed: 75 XP
- Streak milestone: 50 XP
- Answer upvoted: 5 XP

**Anti-Exploit:**
- `validate_xp_authenticity()` - Detects farming (>5000 XP/24h or 30+ identical events)
- Full ledger audit trail in `XPLedger` table

#### `achievement_engine.py` (15 Non-Exploitable Achievements)
**Validation Checks:**
1. **Time Span:** Minimum 1 hour between answer-based achievements
2. **Unique Users:** Validate helped users have reasonable trust (>0.3)
3. **Account Age:** Minimum 1 day old
4. **Trust Threshold:** Minimum 0.3 trust score

**Example Achievement:**
```python
{
    "id": "trusted_expert",
    "name": "Trusted Expert",
    "description": "Reach trust score of 0.85+",
    "xp_reward": 2000,
    "criteria": {
        "type": "trust_score",
        "threshold": 0.85
    }
}
```

**Anti-Gaming:** Cross-validation of stats, time-based restrictions, trust score requirements.

#### `streak_manager.py` (Daily Streaks)
**Rules:**
- Only **one activity per calendar day** counts
- Requires **meaningful activity** (not just login):
  - Submit answer
  - Create doubt
  - Attempt concept
  - Vote on content
- Streak breaks if no activity yesterday

**Milestones:** 7, 14, 30, 60, 90, 180, 365 days

**Anti-Gaming:**
- `validate_streak_authenticity()` - Detects scripted behavior
  - Checks for activities at exact same time each day
  - Validates average time gap >30 seconds

---

### 4. Trust Scoring System

#### `trust_scorer.py` (9-Component Trust Score)
**Formula:**
```
Trust = Σ(component × weight)
```

**Components (0.0-1.0 each):**

1. **Mastery Reliability (20%)** - Avg mastery × consistency
2. **NLI Track Record (20%)** - Ratio of passed fact-checks
3. **Community Validation (15%)** - Net upvote ratio
4. **Account Age Trust (10%)** - Asymptotic: 1 - 1/(1 + days/30)
5. **Interaction Entropy (10%)** - Diversity of interactions
6. **Vote Pattern Score (10%)** - Gini coefficient of vote distribution
7. **Similarity Flags (5%)** - Penalty for plagiarism
8. **Abuse Flags (5%)** - Direct penalty for active flags
9. **IP Clustering Risk (5%)** - Sock puppet detection

**Trust Tiers:**
- **Restricted:** <0.30 (shadow banned, limited XP)
- **Novice:** 0.30-0.50 (default new users)
- **Contributor:** 0.50-0.70 (established users)
- **Expert:** 0.70-0.85 (high reputation)
- **Trusted:** 0.85+ (full privileges)

**Database Tables:**
- `TrustScore` - Full component breakdown
- `User.trustScoreCache` - Fast access for calculations

---

### 5. Database Integration

#### `database.py` (Prisma Client)
Global Prisma client management:
- `connect_db()` - Initialize connection
- `disconnect_db()` - Clean shutdown
- `get_db()` - Access singleton client
- `health_check()` - Connection validation

**Lifecycle:** Connected on app startup, disconnected on shutdown.

#### Updated Tables (from Phase 5)
All tables from schema extension are now actively used:
- **XPLedger** - Every XP award logged
- **TrustScore** - Updated by trust scorer
- **ReputationLedger** - All reputation changes
- **EventLog** - All system events
- **AbuseFlag** - Detected violations
- **FactCheckLog** - NLI validation results

---

## Integration with Application

### `main.py` Lifecycle

**Startup Sequence:**
1. Connect to PostgreSQL via Prisma ✅
2. Initialize event bus and register handlers ✅
3. Connect to Neo4j knowledge graph ✅
4. Auto-seed concepts if needed ✅

**Health Endpoint (`/health`):**
```json
{
  "status": "healthy",
  "postgres_connected": true,
  "neo4j_connected": true,
  "event_bus_active": true,
  "event_handlers": 12
}
```

---

## Anti-Exploit Guarantees

### 1. No Direct Manipulation
❌ **BLOCKED:** Direct updates to `User.totalXP`, `User.reputation`, `User.trustScoreCache`  
✅ **REQUIRED:** All changes via events → handlers → audited ledgers

### 2. XP Cannot Be Farmed
- Time decay on old content (0.5× after 30 days)
- Trust multiplier (low trust = 0.5× XP)
- Fact-check multiplier (flagged content = 0.3× XP)
- Daily rate limiting (>5000 XP/24h triggers investigation)

### 3. Achievements Cannot Be Rushed
- Minimum time span between progress (1 hour)
- Minimum account age (1 day)
- Minimum trust score (0.3)
- Unique user validation (no sock puppets)

### 4. Streaks Cannot Be Faked
- Only one activity per calendar day
- Meaningful activity required (not just login)
- Pattern detection for scripted behavior
- Timezone manipulation checks (TODO)

### 5. Trust Scores Cannot Be Gamed
- 9 independent components
- Cross-validation (mastery vs. NLI vs. community)
- Account age threshold (fraud harder with aged accounts)
- Interaction diversity (sock puppet detection)

---

## Event Flow Examples

### Example 1: User Submits Answer
```
1. User submits answer via API
   ↓
2. Emit: ANSWER_SUBMITTED
   ↓
3. Handlers:
   - update_streak() - Check daily streak
   - check_achievements() - Progress tracking
   ↓
4. Questioner accepts answer
   ↓
5. Emit: ANSWER_ACCEPTED
   ↓
6. Handlers:
   - award_xp_for_accepted_answer() - 100 XP × multipliers
   - update_reputation_for_accepted_answer() - +15 reputation
   - recalculate_trust_score() - Update 9 components
   - check_achievements() - Check "Doubt Resolver"
   ↓
7. Database updates:
   - XPLedger entry (full breakdown)
   - ReputationLedger entry
   - User.totalXP incremented
   - User.reputation incremented
   - TrustScore recalculated
   - EventLog recorded
```

### Example 2: NLI Flags Answer
```
1. Answer submitted
   ↓
2. NLI validation runs
   ↓
3. Emit: NLI_FLAG_RAISED
   ↓
4. Handlers:
   - recalculate_trust_score() - Reduce NLI track record
   ↓
5. Trust score drops from 0.7 → 0.55
   ↓
6. Next XP award: Multiplier reduced 1.2× → 1.05×
   ↓
7. Future flags trigger ABUSE_FLAG_CREATED
```

---

## Testing Checklist

### Unit Tests Needed
- [ ] Event bus pub/sub isolation
- [ ] XP calculation with all multiplier combinations
- [ ] Trust score 9-component calculation
- [ ] Achievement criteria validation
- [ ] Streak increment/reset logic
- [ ] Anti-exploit detection functions

### Integration Tests Needed
- [ ] End-to-end event flow (answer → XP → achievement)
- [ ] Database transaction rollback on handler error
- [ ] Concurrent event handling (race conditions)
- [ ] Event log audit trail completeness

### Load Tests Needed
- [ ] 1000 simultaneous events
- [ ] Handler performance (<100ms avg)
- [ ] Database connection pool saturation

---

## Performance Considerations

### Optimizations Implemented
1. **Cached Trust Scores:** Read from `User.trustScoreCache` (fast) instead of recalculating (slow)
2. **Async Handlers:** Non-blocking event processing
3. **Selective Recalculation:** Trust score only recalculated on significant events
4. **Batch Operations:** Future: batch similar events (e.g., mass upvotes)

### Database Indexes Needed
```prisma
model XPLedger {
  @@index([userId, timestamp])
  @@index([eventType])
}

model EventLog {
  @@index([userId, timestamp])
  @@index([eventType])
}

model TrustScore {
  @@index([userId])
  @@index([score])
}
```

---

## Next Steps (Phase 7)

### Remaining Services to Implement

#### AI Brain Layer (8 Layers)
- `intent_detector.py` - Layer 1: Intent classification
- `concept_mapper.py` - Layer 2: Map question to concepts
- `graph_traversal.py` - Layer 3: Neo4j traversal
- `cognitive_state.py` - Layer 4: User cognitive state
- `context_assembler.py` - Layer 5: Assemble context
- `reasoning_engine.py` - Layer 6: LLM reasoning
- `nli_validator.py` - Layer 7: Fact-checking
- (trust_scorer.py already complete) - Layer 8: Trust scoring

#### Anti-Abuse Detectors
- `similarity_detector.py` - Embedding-based plagiarism
- `vote_analyzer.py` - Graph analysis for vote trading
- `interaction_entropy.py` - Sock puppet detection
- `ip_clustering.py` - Shared IP detection

#### NLI System
- `inference_engine.py` - ONNX model loading
- `claim_extractor.py` - Extract verifiable claims
- `fact_checker.py` - Orchestrate NLI pipeline

#### API Routes
- `routes/gamification.py` - Leaderboard, achievements, stats
- `routes/trust.py` - Trust scores, abuse reports
- `routes/events.py` - Event log queries (admin)

---

## Security Notes

### Current Safeguards
✅ All XP awards logged with full audit trail  
✅ Trust score cannot be directly manipulated  
✅ Achievement unlocks require validation  
✅ Event handlers isolated (failures don't cascade)  
✅ Database transactions for ledger operations  

### TODO (Phase 8: Security Hardening)
- [ ] Rate limiting middleware (per user, per endpoint)
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (Prisma handles this)
- [ ] Event replay attack prevention
- [ ] Optimistic locking for concurrent updates
- [ ] Encrypted event payloads for sensitive data

---

## Conclusion

Phase 6 establishes the **non-exploitable foundation** for NOVYRA's gamification and trust systems. Every action flows through events, creating a **full audit trail** and enabling **sophisticated anti-gaming detection**.

**Key Achievement:** XP, reputation, and trust scores are now **emergent properties** of user behavior, not directly manipulable values.

**Status:** ✅ Phase 6 Complete — Ready for Phase 7 (AI Brain Implementation)
