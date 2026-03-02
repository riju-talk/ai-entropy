# Schema Migration Plan - NOVYRA Database Integration

## Overview

This document maps the existing Prisma schema to the new architecture requirements and proposes migration-safe extensions.

---

## Current Schema Assessment

### ✅ Already Implemented (Keep As-Is)

**User Management:**
- `User` - Core user table with auth
- `Account` - OAuth accounts (NextAuth)
- `VerificationToken` - Email verification

**Content:**
- `Doubt` - Questions/doubts
- `Answer` - Responses to doubts
- `DoubtVote` & `AnswerVote` - Voting system

**Basic Gamification:**
- `UserStat` - Basic stats
- `PointsLedger` - XP tracking (needs extension)
- `Level` - Level definitions
- `Achievement` & `AchievementUnlock` - Basic achievements
- `Badge` & `BadgeGrant` - Badge system
- `Streak` - Streak tracking
- `LeaderboardSnapshot` - Leaderboard cache

**AI Foundation:**
- `Concept` - Knowledge graph nodes
- `ConceptPrerequisite` - Dependency edges
- `ConceptAttempt` - Attempt tracking
- `MasteryRecord` - Mastery scores
- `RubricEvaluation` - Evaluation storage

**Community:**
- `Community` - Community/group system
- `CommunityMember` - Membership
- `CommunityDoubt` - Doubts in communities

---

## Required Extensions

### 1. XP Ledger (Detailed Tracking)

**Current:** `PointsLedger` with basic fields  
**Needed:** Detailed XP breakdown with multipliers

```prisma
model XPLedger {
  id              String   @id @default(cuid())
  userId          String
  eventType       String   // XPEvent enum
  conceptId       String?
  
  // XP breakdown (NEW)
  baseXP          Int
  masteryMult     Float    @default(1.0)
  trustMult       Float    @default(1.0)
  factCheckMult   Float    @default(1.0)
  timeDecay       Float    @default(1.0)
  finalXP         Int
  
  // Audit (NEW)
  reason          String
  metadata        Json?
  flagged         Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  
  user            User     @relation("XPLedger", fields: [userId], references: [id], onDelete: Cascade)
  concept         Concept? @relation(fields: [conceptId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([eventType])
  @@index([conceptId])
  @@index([flagged])
  @@map("xp_ledger")
}
```

**Migration Strategy:**
- Rename `PointsLedger` to `XPLedger`
- Add new columns with defaults
- Backfill existing records with multipliers = 1.0

---

### 2. Trust Score System

**Status:** Not in current schema  
**Action:** Add new table

```prisma
model TrustScore {
  id                    String   @id @default(cuid())
  userId                String   @unique
  
  // Overall score
  score                 Float    @default(0.5)
  
  // Component breakdown
  masteryReliability    Float    @default(0.5)
  nliTrackRecord        Float    @default(0.7)
  communityValidation   Float    @default(0.5)
  accountAgeTrust       Float    @default(0.5)
  interactionEntropy    Float    @default(1.0)
  votePatternScore      Float    @default(1.0)
  
  // Penalties
  similarityFlags       Int      @default(0)
  abuseFlags            Int      @default(0)
  ipClusteringRisk      Float    @default(0.0)
  
  // Metadata
  lastUpdated           DateTime @default(now())
  historicalLow         Float    @default(0.5)
  historicalHigh        Float    @default(0.5)
  
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([score])
  @@map("trust_scores")
}
```

---

### 3. Abuse Detection System

**Status:** Not in current schema  
**Action:** Add new tables

```prisma
enum AbuseFlagType {
  SIMILARITY_HIGH
  VOTE_TRADING
  LOW_ENTROPY
  IP_CLUSTERING
  STREAK_FRAUD
  XP_FARMING
  SPAM_POSTING
  SOCKPUPPET
}

model AbuseFlag {
  id            String        @id @default(cuid())
  userId        String
  flagType      AbuseFlagType
  severity      Int           // 1-10
  details       Json
  autoDetected  Boolean       @default(true)
  reviewedBy    String?
  reviewedAt    DateTime?
  status        String        @default("PENDING")  // PENDING | CONFIRMED | FALSE_POSITIVE
  createdAt     DateTime      @default(now())
  
  user          User          @relation("AbuseFlags", fields: [userId], references: [id], onDelete: Cascade)
  reviewer      User?         @relation("ReviewedFlags", fields: [reviewedBy], references: [id], onDelete: SetNull)
  
  @@index([userId, status])
  @@index([flagType, createdAt])
  @@index([status, severity])
  @@map("abuse_flags")
}

model ModerationLog {
  id          String   @id @default(cuid())
  adminId     String
  targetUserId String
  action      String   // WARNING | SUSPEND | BAN | RESTORE
  reason      String
  details     Json?
  createdAt   DateTime @default(now())
  
  admin       User     @relation("ModerationsGiven", fields: [adminId], references: [id])
  targetUser  User     @relation("ModerationsReceived", fields: [targetUserId], references: [id])
  
  @@index([targetUserId, createdAt])
  @@index([adminId])
  @@map("moderation_logs")
}
```

---

### 4. NLI Fact-Check Logging

**Status:** Not in current schema  
**Action:** Add new table

```prisma
model FactCheckLog {
  id                  String   @id @default(cuid())
  userId              String?
  generatedText       String   @db.Text
  contextUsed         String   @db.Text
  claimsChecked       Int
  entailmentCount     Int
  contradictionCount  Int
  neutralCount        Int
  overallConfidence   Float
  safeToDisplay       Boolean
  checks              Json     // Array of ClaimCheck
  actionTaken         String?  // DISPLAY | DISPLAY_WITH_WARNING | BLOCK | REGENERATE
  createdAt           DateTime @default(now())
  
  user                User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([safeToDisplay])
  @@index([contradictionCount])
  @@map("fact_check_logs")
}
```

---

### 5. Event Log (Audit Trail)

**Status:** Not in current schema  
**Action:** Add new table

```prisma
model EventLog {
  id          String   @id @default(cuid())
  eventType   String   // e.g., "ANSWER_ACCEPTED", "MASTERY_UPDATED"
  userId      String?
  targetId    String?  // ID of affected resource (answer, doubt, etc.)
  metadata    Json
  emittedAt   DateTime @default(now())
  processedAt DateTime?
  
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([eventType, emittedAt])
  @@index([userId, emittedAt])
  @@index([processedAt])
  @@map("event_logs")
}
```

---

### 6. Extended Achievement Progress

**Current:** Basic `AchievementProgress` exists  
**Action:** Extend with validation fields

```prisma
model AchievementProgress {
  id              String      @id @default(cuid())
  userId          String
  achievementId   String
  current         Int         @default(0)
  target          Int
  lastUpdated     DateTime    @default(now())
  
  // NEW: Anti-gaming validation
  uniqueUsers     String[]    // Track unique user interactions
  firstDate       DateTime?   // Track time span
  lastDate        DateTime?
  daySpan         Int         @default(0)
  validatedCount  Int         @default(0)  // Count of validated contributions
  
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement     Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  
  @@unique([userId, achievementId])
  @@index([userId])
  @@map("achievement_progress")
}
```

---

### 7. Reputation Ledger

**Current:** Only `reputation` field on `User`  
**Action:** Add detailed ledger

```prisma
model ReputationLedger {
  id          String   @id @default(cuid())
  userId      String
  eventType   String   // ReputationEvent enum
  change      Int      // Can be negative
  reason      String
  sourceId    String?  // ID of vote/answer that caused change
  voterTrust  Float?   // Trust weight of voter
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, createdAt])
  @@index([eventType])
  @@map("reputation_ledger")
}
```

---

### 8. Content Embeddings (For Similarity Detection)

**Status:** Not in current schema  
**Action:** Add new table

```prisma
model ContentEmbedding {
  id          String   @id @default(cuid())
  contentType String   // "answer" | "doubt"
  contentId   String
  userId      String
  embedding   Json     // Store as JSON array (or use pgvector extension)
  text        String   @db.Text
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([contentType, contentId])
  @@index([userId])
  @@map("content_embeddings")
}
```

---

### 9. Vote Graph (For Anomaly Detection)

**Status:** Basic vote tables exist  
**Action:** Add analytics table (materialized view)

```prisma
model VoteGraph {
  id              String   @id @default(cuid())
  voterId         String
  targetUserId    String
  voteCount       Int      @default(0)
  upvoteCount     Int      @default(0)
  downvoteCount   Int      @default(0)
  reciprocity     Float    @default(0.0)
  lastVoteAt      DateTime @default(now())
  
  voter           User     @relation("VotesGiven", fields: [voterId], references: [id], onDelete: Cascade)
  targetUser      User     @relation("VotesReceived", fields: [targetUserId], references: [id], onDelete: Cascade)
  
  @@unique([voterId, targetUserId])
  @@index([reciprocity])
  @@map("vote_graph")
}
```

**Note:** Populated by scheduled job, not updated on every vote.

---

### 10. Extended User Model

**Current:** User has basic fields  
**Action:** Add computed fields and flags

```prisma
model User {
  id                   String   @id @default(cuid())
  // ... existing fields ...
  
  // NEW: Trust & moderation
  trustScoreCache      Float    @default(0.5)   // Cached trust score
  isShadowBanned       Boolean  @default(false)
  isSuspended          Boolean  @default(false)
  suspendedUntil       DateTime?
  leaderboardOptOut    Boolean  @default(false)
  
  // NEW: Accumulated totals (denormalized for performance)
  totalXP              Int      @default(0)
  totalReputation      Int      @default(0)
  
  // NEW: Relations to new tables
  xpLedger             XPLedger[]        @relation("XPLedger")
  trustScore           TrustScore?
  abuseFlags           AbuseFlag[]       @relation("AbuseFlags")
  flagsReviewed        AbuseFlag[]       @relation("ReviewedFlags")
  moderationsGiven     ModerationLog[]   @relation("ModerationsGiven")
  moderationsReceived  ModerationLog[]   @relation("ModerationsReceived")
  factCheckLogs        FactCheckLog[]
  eventLogs            EventLog[]
  reputationLedger     ReputationLedger[]
  contentEmbeddings    ContentEmbedding[]
  votesGiven           VoteGraph[]       @relation("VotesGiven")
  votesReceived        VoteGraph[]       @relation("VotesReceived")
  
  // ... rest of existing relations ...
}
```

---

### 11. Extended Concept Model

**Current:** Basic concept fields  
**Action:** Add metadata for AI Brain

```prisma
model Concept {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  domain      String?
  difficulty  Int      @default(1)
  
  // NEW: AI Brain integration
  embedding   Json?    // Vector embedding for similarity search
  synonyms    String[] // Alternative names
  keywords    String[] // For search
  isActive    Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  prerequisites   ConceptPrerequisite[]  @relation("ConceptPrerequisites")
  dependents      ConceptPrerequisite[]  @relation("DependentConcepts")
  masteryRecords  MasteryRecord[]
  attempts        ConceptAttempt[]
  xpEntries       XPLedger[]
  
  @@index([domain])
  @@index([difficulty])
  @@map("concepts")
}
```

---

## Migration Steps

### Phase 1: Add New Tables (Non-Breaking)

```bash
# 1. Add new tables that don't affect existing ones
prisma migrate dev --name add-trust-and-abuse-system
```

Tables to add:
- ✅ `TrustScore`
- ✅ `AbuseFlag`
- ✅ `ModerationLog`
- ✅ `FactCheckLog`
- ✅ `EventLog`
- ✅ `ReputationLedger`
- ✅ `ContentEmbedding`
- ✅ `VoteGraph`

### Phase 2: Extend Existing Tables (Additive Changes)

```bash
prisma migrate dev --name extend-user-and-concept
```

Changes:
- ✅ Add new fields to `User` (with defaults)
- ✅ Add new fields to `Concept` (with defaults)
- ✅ Add new fields to `AchievementProgress` (with defaults)

### Phase 3: Rename & Restructure (Breaking)

```bash
prisma migrate dev --name restructure-points-to-xp
```

Changes:
- ⚠️ Rename `PointsLedger` to `XPLedger`
- ⚠️ Add new columns to XP tracking
- ⚠️ Backfill data with migration script

**Migration Script:**
```sql
-- Rename table
ALTER TABLE "points_ledger" RENAME TO "xp_ledger";

-- Add new columns
ALTER TABLE "xp_ledger"
  ADD COLUMN "base_xp" INT DEFAULT 0,
  ADD COLUMN "mastery_mult" FLOAT DEFAULT 1.0,
  ADD COLUMN "trust_mult" FLOAT DEFAULT 1.0,
  ADD COLUMN "fact_check_mult" FLOAT DEFAULT 1.0,
  ADD COLUMN "time_decay" FLOAT DEFAULT 1.0,
  ADD COLUMN "final_xp" INT DEFAULT 0,
  ADD COLUMN "reason" TEXT DEFAULT '',
  ADD COLUMN "flagged" BOOLEAN DEFAULT false;

-- Backfill: Copy points to finalXP and baseXP
UPDATE "xp_ledger"
SET "base_xp" = "points",
    "final_xp" = "points",
    "reason" = COALESCE("description", '');

-- Remove old column
ALTER TABLE "xp_ledger" DROP COLUMN "points";
```

### Phase 4: Initialize Trust Scores

```typescript
// Run as Prisma seed or standalone script
async function initializeTrustScores() {
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    await prisma.trustScore.create({
      data: {
        userId: user.id,
        score: 0.5,  // Neutral starting point
        // All components default to 0.5 except where specified
      }
    });
  }
}
```

### Phase 5: Compute Denormalized Fields

```typescript
// Backfill totalXP and totalReputation
async function computeTotals() {
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    const xpSum = await prisma.xpLedger.aggregate({
      where: { userId: user.id },
      _sum: { finalXP: true }
    });
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalXP: xpSum._sum.finalXP || 0,
        trustScoreCache: 0.5  // Will be computed by trust engine
      }
    });
  }
}
```

---

## Service Mapping

### Existing Services → New Architecture

| Current Service | Maps To | Action |
|----------------|---------|--------|
| `reasoning_service.py` | AI Brain Layer 6 | Extend with fact-check integration |
| `mastery_service.py` | AI Brain Layer 4 | Keep, add decay calculation |
| `knowledge_graph_service.py` | AI Brain Layer 3 | Extend with traversal logic |
| `rubric_service.py` | AI Brain Layer 6 | Keep as-is |
| `groq_service.py` / `langchain_service.py` | AI Brain Layer 6 | Consolidate to single LLM service |
| ❌ No service | AI Brain Layer 1 (Intent) | **CREATE NEW** |
| ❌ No service | AI Brain Layer 2 (Concept Mapping) | **CREATE NEW** |
| ❌ No service | AI Brain Layer 5 (Context Assembly) | **CREATE NEW** |
| ❌ No service | AI Brain Layer 7 (NLI) | **CREATE NEW** |
| ❌ No service | AI Brain Layer 8 (Trust) | **CREATE NEW** |
| ❌ No service | Game Engine | **CREATE NEW** |
| ❌ No service | Anti-Abuse Detection | **CREATE NEW** |
| ❌ No service | Event Bus | **CREATE NEW** |

---

## File Structure (After Implementation)

```
apps/ai-agent/app/
├── services/
│   ├── ai_brain/
│   │   ├── intent_detector.py          # Layer 1
│   │   ├── concept_mapper.py           # Layer 2
│   │   ├── graph_traversal.py          # Layer 3
│   │   ├── cognitive_state.py          # Layer 4
│   │   ├── context_assembler.py        # Layer 5
│   │   ├── reasoning_engine.py         # Layer 6 (existing)
│   │   ├── nli_validator.py            # Layer 7
│   │   └── trust_scorer.py             # Layer 8
│   │
│   ├── gamification/
│   │   ├── xp_engine.py
│   │   ├── achievement_engine.py
│   │   ├── reputation_engine.py
│   │   └── streak_manager.py
│   │
│   ├── anti_abuse/
│   │   ├── similarity_detector.py
│   │   ├── vote_analyzer.py
│   │   ├── interaction_entropy.py
│   │   └── ip_clustering.py
│   │
│   ├── nli/
│   │   ├── inference_engine.py
│   │   ├── claim_extractor.py
│   │   └── fact_checker.py
│   │
│   ├── events/
│   │   ├── event_bus.py
│   │   ├── event_handlers.py
│   │   └── event_definitions.py
│   │
│   └── [existing services]
│       ├── knowledge_graph_service.py  # Keep
│       ├── mastery_service.py          # Keep
│       ├── rubric_service.py           # Keep
│       └── ...
```

---

## Prisma Client Regeneration

After schema changes:

```bash
# Generate new Prisma client
cd apps/app
npx prisma generate

# Apply migrations
npx prisma migrate dev

# Seed initial data if needed
npx prisma db seed
```

---

## Testing Strategy

### Migration Testing

1. **Create test database** with production-like data
2. **Run migrations** against test DB
3. **Validate data integrity** (no nulls where unexpected, foreign keys valid)
4. **Run seed scripts** (trust scores, backfill totals)
5. **Test queries** from new schema
6. **Performance test** (indexes working, no slow queries)

### Integration Testing

1. **Event flow**: Create doubt → verify eventLog created
2. **XP calculation**: Answer accepted → verify XP awarded with multipliers
3. **Trust update**: Flag created → verify trust score recalculated
4. **Achievement unlock**: Meet criteria → verify unlock + progress tracking

---

## Rollback Plan

Each migration should be reversible:

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back <migration_name>

# Or manually revert
psql $DATABASE_URL -c "DROP TABLE IF EXISTS trust_scores CASCADE;"
```

**Critical:** Test rollback procedure in staging before production.

---

## Production Deployment Checklist

- [ ] Backup production database
- [ ] Run migrations in maintenance window
- [ ] Verify no data loss
- [ ] Run backfill scripts
- [ ] Validate foreign key integrity
- [ ] Check query performance
- [ ] Monitor error logs for 24 hours
- [ ] Have rollback plan ready

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-27  
**Status:** ✅ Ready for Implementation
