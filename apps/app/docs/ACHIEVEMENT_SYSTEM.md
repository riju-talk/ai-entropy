# NOVYRA ACHIEVEMENT & BADGE MANAGEMENT SYSTEM
## Complete Implementation Guide

---

## 📋 TABLE OF CONTENTS
1. [System Architecture](#system-architecture)
2. [15 Achievements Overview](#15-achievements-overview)
3. [10 Badges Overview](#10-badges-overview)
4. [Database Schema](#database-schema)
5. [Achievement Unlock Logic](#achievement-unlock-logic)
6. [Real-Time Progress Tracking](#real-time-progress-tracking)
7. [Anti-Gaming Validation](#anti-gaming-validation)
8. [Integration Points](#integration-points)
9. [Setup Instructions](#setup-instructions)

---

## SYSTEM ARCHITECTURE

### Core Components

```
┌─────────────────────────────────────────────┐
│       NOVYRA Achievement Engine              │
└─────────────────────────────────────────────┘
            ↓
        Core Modules:
        • Achievement Progress Tracker
        • Badge Grant Manager
        • Points/Credits Distributor
        • Anti-Gaming Validator
        • Streak Manager
            ↓
    ┌───────────────────────────┐
    │   Database Layer (PostgreSQL)
    ├───────────────────────────┤
    │ • achievements            │
    │ • achievement_progress    │
    │ • achievement_unlocks     │
    │ • badges                  │
    │ • badge_grants            │
    │ • streaks                 │
    │ • points_ledger           │
    └───────────────────────────┘
```

### Rarity Tiers & Point Distribution

| Rarity | Points Range | Purpose | Count |
|--------|------------|---------|-------|
| COMMON | 50-100 | Entry level | 2 |
| UNCOMMON | 150-250 | Engagement | 3 |
| RARE | 300-400 | Dedication | 3 |
| EPIC | 500-650 | Championship | 4 |
| LEGENDARY | 800-1500 | Hall of Fame | 3 |

---

## 15 ACHIEVEMENTS OVERVIEW

### TIER 1: COMMON (Entry Level)
**Target Users**: New members getting started

#### 1. First Steps 🎯
- **Category**: Participation
- **Requirement**: Ask your first doubt
- **Criteria**: doubts_asked >= 1
- **Points**: 50
- **Unlock Trigger**: On first doubt posted

#### 2. First Helper 🤝
- **Category**: Helpfulness
- **Requirement**: Post your first answer
- **Criteria**: answers_posted >= 1
- **Points**: 50
- **Unlock Trigger**: On first answer posted

---

### TIER 2: UNCOMMON (Engagement)
**Target Users**: Active community members

#### 3. Knowledge Seeker 💡
- **Category**: Participation
- **Requirement**: Ask 100 questions
- **Criteria**: doubts_asked >= 100
- **Points**: 150
- **Progression**: Trackable, shows /100 progress

#### 4. Quick Learner ⭐
- **Category**: Learning
- **Requirement**: Complete 10 courses
- **Criteria**: courses_completed >= 10
- **Points**: 200
- **Time Frame**: No time limit

#### 5. Problem Solver 🔧
- **Category**: Helpfulness
- **Requirement**: Solve 50 doubts
- **Criteria**: doubts_resolved >= 50
- **Points**: 250
- **Validation**: Only counts accepted/upvoted answers

---

### TIER 3: RARE (Dedication)
**Target Users**: Highly engaged members

#### 6. Streak Master 🔥
- **Category**: Consistency
- **Requirement**: Maintain 30-day streak
- **Criteria**: consecutive_days >= 30
- **Points**: 300
- **Special Rule**: Requires activity every 24h
- **Break Condition**: >24h inactivity resets streak

#### 7. Code Master 💻
- **Category**: Subject Expert
- **Requirement**: Solve 50 coding problems
- **Criteria**: coding_problems_solved >= 50
- **Points**: 400
- **Tracks**: Programming language mastery

#### 8. Helper Extraordinaire ❤️
- **Category**: Helpfulness
- **Requirement**: Post 200 helpful answers
- **Criteria**: helpful_answers >= 200
- **Points**: 350
- **Validation**: Upvotes or acceptance required

---

### TIER 4: EPIC (Community Champion)
**Target Users**: Community leaders

#### 9. Mentor 🎓
- **Category**: Leadership
- **Requirement**: Help 100 students
- **Criteria**: students_helped >= 100
- **Points**: 500
- **Validation**: Track unique students mentored

#### 10. Community Champion 👥
- **Category**: Reputation
- **Requirement**: Earn 10,000 reputation
- **Criteria**: reputation >= 10,000
- **Points**: 600
- **Real-Time**: Updates with reputation changes

#### 11. Research Star 📚
- **Category**: Contribution
- **Requirement**: Contribute 5 research articles
- **Criteria**: research_articles >= 5
- **Points**: 550
- **Quality Check**: Articles must meet quality threshold

#### 12. Subject Master 📊
- **Category**: Mastery
- **Requirement**: Master 3 different subjects
- **Criteria**: subjects_mastered >= 3
- **Points**: 650
- **Threshold**: Each subject >80% mastery

---

### TIER 5: LEGENDARY (Hall of Fame)
**Target Users**: Platform elite

#### 13. AI Master ⚡
- **Category**: Technical Mastery
- **Requirement**: Master AI concepts
- **Criteria**: ai_mastery_score >= 100
- **Points**: 1,000
- **Prerequisites**: Advanced coursework completion

#### 14. Consistency Wins 🎯
- **Category**: Discipline
- **Requirement**: Maintain 60-day streak
- **Criteria**: consecutive_days >= 60
- **Points**: 800
- **Difficulty**: Extremely challenging
- **Badge**: Auto-grants "Streak Legend" badge

#### 15. Legend Status 👑
- **Category**: Ultimate Achievement
- **Requirement**: Reach 50,000 total reputation
- **Criteria**: reputation >= 50,000
- **Points**: 1,500
- **Prestige**: Highest honor on platform

---

## 10 BADGES OVERVIEW

### Subject Mastery Badges

Auto-granted when user achieves >80% mastery in subject

| Badge | Subject | Icon | Color | Requirement |
|-------|---------|------|-------|------------|
| Code Ninja | Programming | 💻 | blue-500 | Coding mastery >80% |
| Math Wizard | Mathematics | 🔢 | purple-500 | Math mastery >80% |
| Physics Guru | Physics | ⚛️ | cyan-500 | Physics mastery >80% |
| Bio Expert | Biology | 🧬 | green-500 | Biology mastery >80% |
| AI Master | AI/ML | 🤖 | yellow-500 | AI mastery >80% |

### Contribution Badges

Earned through specific types of contributions

| Badge | Category | Icon | Color | Requirement |
|-------|----------|------|-------|------------|
| Problem Solver | Solving | 🎯 | orange-500 | 50+ problems solved |
| Community Helper | Helping | 🤝 | pink-500 | 200+ helpful answers |
| Research Star | Research | 📡 | indigo-500 | 5+ articles published |
| Innovator | Innovation | 💡 | lime-500 | Unique solutions created |
| Tutor | Teaching | 📖 | rose-500 | 100+ students helped |

---

## DATABASE SCHEMA

### Tables Involved

```sql
-- Achievements Table
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  type ACHIEVEMENT_TYPE,
  name TEXT UNIQUE,
  description TEXT,
  criteria JSON,           -- {"requirementType": "...", "target": 100}
  points INT,
  rarity ACHIEVEMENT_RARITY,
  icon TEXT,
  createdAt TIMESTAMP
);

-- Achievement Progress Tracking
CREATE TABLE achievement_progress (
  id TEXT PRIMARY KEY,
  userId TEXT FOREIGN KEY,
  achievementId TEXT FOREIGN KEY,
  current INT DEFAULT 0,   -- Current value
  target INT,              -- Target value
  lastUpdated TIMESTAMP,
  -- Anti-gaming fields
  uniqueUsers TEXT[],      -- Track unique contributors
  firstDate TIMESTAMP,
  lastDate TIMESTAMP,
  daySpan INT,
  validatedCount INT,      -- Validated contributions
  UNIQUE(userId, achievementId)
);

-- Achievement Unlocks (Final Record)
CREATE TABLE achievement_unlocks (
  id TEXT PRIMARY KEY,
  userId TEXT FOREIGN KEY,
  achievementId TEXT FOREIGN KEY,
  unlockedAt TIMESTAMP,
  UNIQUE(userId, achievementId)
);

-- Badges Table
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  type BADGE_TYPE,
  name TEXT UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  createdAt TIMESTAMP
);

-- Badge Grants
CREATE TABLE badge_grants (
  id TEXT PRIMARY KEY,
  userId TEXT FOREIGN KEY,
  badgeId TEXT FOREIGN KEY,
  grantedAt TIMESTAMP,
  UNIQUE(userId, badgeId)
);

-- Points Ledger (Audit Trail)
CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  userId TEXT FOREIGN KEY,
  eventType ENUM('ACHIEVEMENT_UNLOCKED', 'BADGE_EARNED', ...),
  points INT,
  description TEXT,
  createdAt TIMESTAMP
);
```

---

## ACHIEVEMENT UNLOCK LOGIC

### Step-by-Step Unlock Process

```
1. EVENT TRIGGER
   └─ User performs action (ask question, post answer, etc.)

2. PROGRESS UPDATE
   └─ Fetch current progress
   └─ Calculate new value
   └─ Update achievement_progress table

3. VALIDATION CHECKS
   ├─ Is achievement already unlocked?
   │  └─ YES: Return "already unlocked"
   └─ Is current >= target?
      └─ NO: Return progress update
      └─ YES: Proceed to unlock

4. AUTHENTICITY VALIDATION
   ├─ Check time span (not too fast)
   ├─ Validate unique user count
   ├─ Verify validated contributions ratio
   └─ If suspicious: Flag and return

5. UNLOCK CREATION
   └─ INSERT into achievement_unlocks table
   └─ Ensure idempotency (UNIQUE constraint)

6. POINTS DISTRIBUTION
   ├─ Award points to user.credits
   ├─ Create points_ledger entry
   └─ Update user.totalPoints

7. NOTIFICATION
   └─ Return achievement details
   └─ Trigger toast notification
   └─ Update UI leaderboard
```

### PostgreSQL Trigger Example

```sql
CREATE OR REPLACE FUNCTION process_achievement_unlock()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement RECORD;
  v_already_unlocked INT;
BEGIN
  -- Get achievement details
  SELECT * INTO v_achievement 
  FROM achievements 
  WHERE id = NEW.achievementId;
  
  -- Check if already unlocked
  SELECT COUNT(*) INTO v_already_unlocked
  FROM achievement_unlocks
  WHERE userId = NEW.userId 
    AND achievementId = NEW.achievementId;
  
  -- If already unlocked, raise an error
  IF v_already_unlocked > 0 THEN
    RAISE EXCEPTION 'Achievement already unlocked';
  END IF;
  
  -- Award points
  UPDATE users 
  SET credits = credits + v_achievement.points
  WHERE id = NEW.userId;
  
  -- Create ledger entry
  INSERT INTO points_ledger (userId, eventType, points, description)
  VALUES (NEW.userId, 'ACHIEVEMENT_UNLOCKED', v_achievement.points, v_achievement.name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER achievement_unlock_trigger
AFTER INSERT ON achievement_unlocks
FOR EACH ROW
EXECUTE FUNCTION process_achievement_unlock();
```

---

## REAL-TIME PROGRESS TRACKING

### Progress Update Triggers

| Action | Achievement | Update Logic |
|--------|-------------|--------------|
| Post question | Knowledge Seeker, First Steps | +1 to doubts_asked |
| Post answer | First Helper, Helper Extraordinaire | +1 to answers_posted |
| Upvote received | Multiple | +1 to reputation |
| Course completed | Quick Learner | +1 to courses_completed |
| Daily login | Streak Master, Consistency Wins | +1 to streak (if <24h gap) |
| Mastery >80% | Subject Master, Badges | Check all 3 subjects |
| Research article | Research Star | +1 to research_articles |

### Progress Display Format

```
Achievement: Knowledge Seeker
┌─────────────────────────────────────────┐
│ Ask 100 questions                       │
│                                         │
│ Progress: 45/100 ████░░░░░ 45%         │
│                                         │
│ 55 more questions needed to unlock!     │
└─────────────────────────────────────────┘
```

---

## ANTI-GAMING VALIDATION

### Detection Mechanisms

#### 1. Time-Based Validation
```typescript
if (daySpan < expectedMinDays && eventType !== 'REPUTATION') {
  flag = 'SUSPICIOUS_SPEED'; // Too fast
}
```

#### 2. Unique User Validation
```typescript
const uniqueRatio = uniqueUsers.count / currentValue;
if (uniqueRatio < 0.3 && isHelpingAchievement) {
  flag = 'SUSPICIOUS_USERS'; // Too many from same user
}
```

#### 3. Validated Contribution Ratio
```typescript
const validationRatio = validatedCount / currentValue;
if (validationRatio < 0.5) {
  flag = 'TOO_MANY_UNVALIDATED'; // Need >50% upvotes/acceptance
}
```

#### 4. Pattern Detection
```typescript
// Detect rapid bulk actions
if (actionsPerHour > threshold && daySpan < 3) {
  flag = 'BURST_ACTIVITY';
  require_manual_review = true;
}
```

### Consequence Levels

| Level | Condition | Action |
|-------|-----------|--------|
| 1 - Review | 1 flag triggered | Manual admin review |
| 2 - Warn | 2+ flags triggered | Flag in system, user warning |
| 3 - Revoke | Clear gaming evidence | Revoke achievement, return points |
| 4 - Ban | Repeated gaming attempts | Shadow ban from achievements |

---

## INTEGRATION POINTS

### 1. Question Posting Page
```typescript
// After question created
import { updateAchievementProgress } from '@/lib/achievements-engine';

const achievement = await updateAchievementProgress(
  userId,
  'FIRST_STEPS_ID',
  1  // doubts_asked = 1
);

if (achievement.unlocked) {
  showToast('🎉 Achievement unlocked: First Steps!');
}
```

### 2. Leaderboard Page
```typescript
import { getLeaderboardWithAchievements } from '@/lib/achievements-engine';

const leaderboard = await getLeaderboardWithAchievements(50, 'ALL_TIME');
// Returns users with achievementUnlocks, badgeGrants, etc.
```

### 3. User Profile Page
```typescript
import { getUserAchievementProgress } from '@/lib/achievements-engine';

const stats = await getUserAchievementProgress(userId);
// Returns: inProgress, unlocked, totalPoints, totalUnlocked

<AchievementsGrid
  inProgress={stats.inProgress}
  unlocked={stats.unlocked}
/>
```

### 4. Streak Management
```typescript
// Called daily
import { updateStreakAchievements } from '@/lib/achievements-engine';

await updateStreakAchievements(userId);
// Auto-updates Streak Master and Consistency Wins
```

### 5. Concept Mastery
```typescript
// When mastery score calculated
import { updateSubjectBadges } from '@/lib/achievements-engine';

await updateSubjectBadges(userId, 'Python', 0.85);
// Auto-grants "Code Ninja" badge if >0.8
```

---

## SETUP INSTRUCTIONS

### Step 1: Run SQL Setup Script
```bash
# Navigate to prisma folder
cd apps/app/prisma

# Execute the SQL script
psql -U postgres -d novyra < sql/achievements_setup.sql

# Verify achievements were created
psql -U postgres -d novyra
SELECT COUNT(*) FROM achievements;
-- Should return: 15
```

### Step 2: Verify Database Enums
```bash
# Check if enums exist in schema
npx prisma db pull  # Generate from DB if needed
npx prisma generate  # Generate Prisma client
```

### Step 3: Create API Endpoints
```typescript
// apps/app/app/api/achievements/route.ts
import { getUserAchievementProgress } from '@/lib/achievements-engine';

export async function GET(req: Request) {
  const userId = getSessionUserId(req);
  const stats = await getUserAchievementProgress(userId);
  return Response.json(stats);
}
```

### Step 4: Update Leaderboard Component
```typescript
import { getLeaderboardWithAchievements } from '@/lib/achievements-engine';

const achievements = await getLeaderboardWithAchievements();
// Use in leaderboard page
```

### Step 5: Initialize User Achievements
```typescript
// On user signup
for (const achievement of ACHIEVEMENTS) {
  await prisma.achievementProgress.create({
    data: {
      userId: newUser.id,
      achievementId: achievement.id,
      current: 0,
      target: achievement.criteria.target,
    },
  });
}
```

---

## USEFUL QUERIES

### Get User's Achievements
```sql
SELECT a.name, a.rarity, a.points, au."unlockedAt"
FROM achievement_unlocks au
JOIN achievements a ON au."achievementId" = a.id
WHERE au."userId" = $1
ORDER BY au."unlockedAt" DESC;
```

### Get Achievement Progress
```sql
SELECT a.name, ap.current, ap.target,
  ROUND((ap.current::NUMERIC / ap.target::NUMERIC) * 100, 2) as percentage
FROM achievement_progress ap
JOIN achievements a ON ap."achievementId" = a.id
WHERE ap."userId" = $1
ORDER BY percentage DESC;
```

### Leaderboard by Achievement Count
```sql
SELECT u.name, COUNT(DISTINCT au."achievementId") as achievement_count,
  SUM(a.points) as total_points
FROM users u
LEFT JOIN achievement_unlocks au ON u.id = au."userId"
LEFT JOIN achievements a ON au."achievementId" = a.id
GROUP BY u.id
ORDER BY achievement_count DESC, total_points DESC
LIMIT 50;
```

---

## MONITORING & MAINTENANCE

### Monthly Checks
- [ ] Review flagged achievements
- [ ] Verify point distribution fairness
- [ ] Check for gaming patterns
- [ ] Archive old achievement_progress records

### Performance Indices
```sql
CREATE INDEX idx_achievement_progress_user_achievement 
ON achievement_progress(userId, achievementId);

CREATE INDEX idx_achievement_unlocks_user_date 
ON achievement_unlocks(userId, unlockedAt DESC);

CREATE INDEX idx_points_ledger_user_date 
ON points_ledger(userId, createdAt DESC);
```

---

## CONCLUSION

The NOVYRA Achievement System is designed to:
- ✅ Reward user engagement and learning
- ✅ Prevent gaming and fraud
- ✅ Provide real-time progress tracking
- ✅ Maintain database integrity
- ✅ Scale with user growth

For questions or modifications, refer to:
- `lib/achievements-engine.ts` - Core logic
- `prisma/sql/achievements_setup.sql` - Database setup
- `app/leaderboard/page.tsx` - Frontend integration
