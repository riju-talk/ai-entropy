-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('COMPUTER_SCIENCE', 'MATHEMATICS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGINEERING', 'BUSINESS', 'LITERATURE', 'HISTORY', 'PSYCHOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "PointEventType" AS ENUM ('DOUBT_CREATED', 'COMMENT_CREATED', 'UPVOTE_RECEIVED', 'DOWNVOTE_RECEIVED', 'ANSWER_ACCEPTED', 'DOUBT_RESOLVED', 'DAILY_LOGIN', 'STREAK_BONUS', 'ACHIEVEMENT_UNLOCKED', 'BADGE_EARNED', 'CREDITS_REDEEMED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('FIRST_DOUBT', 'FIRST_COMMENT', 'PROBLEM_SOLVER', 'STREAK_MASTER', 'MENTOR', 'TOP_CONTRIBUTOR', 'SUBJECT_EXPERT', 'COMMUNITY_LEADER', 'RISING_STAR', 'KNOWLEDGE_SEEKER');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('AI_MASTER', 'PHYSICS_GURU', 'MATH_WIZARD', 'CODE_NINJA', 'BIO_EXPERT', 'PROBLEM_SOLVER', 'HELPER', 'INNOVATOR', 'TUTOR', 'RESEARCH_STAR');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "LeaderboardScope" AS ENUM ('GLOBAL', 'SUBJECT_CS', 'SUBJECT_MATH', 'SUBJECT_PHYSICS', 'SUBJECT_CHEMISTRY', 'SUBJECT_BIOLOGY', 'SUBJECT_ENGINEERING');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('WORKSHOP', 'CONFERENCE', 'MEETUP', 'HACKATHON', 'SEMINAR', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "bio" TEXT,
    "university" TEXT,
    "course" TEXT,
    "year" INTEGER,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 100,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trustScoreCache" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isShadowBanned" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardOptOut" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "totalReputation" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'INITIATE',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PDF',
    "size" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT,
    "pineconeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'OTHER',
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "isInCommunity" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doubts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAnswered" UUID,
    "isAiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "upvotes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt_votes" (
    "id" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "userId" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubt_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_votes" (
    "id" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "userId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "doubtsAsked" INTEGER NOT NULL DEFAULT 0,
    "doubtsResolved" INTEGER NOT NULL DEFAULT 0,
    "commentsPosted" INTEGER NOT NULL DEFAULT 0,
    "acceptedAnswers" INTEGER NOT NULL DEFAULT 0,
    "upvotesReceived" INTEGER NOT NULL DEFAULT 0,
    "downvotesReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "PointEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doubtId" TEXT,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "points" INTEGER NOT NULL,
    "rarity" "AchievementRarity" NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_unlocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "scope" "LeaderboardScope" NOT NULL,
    "points" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'QA',
    "systemPrompt" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_discounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT,

    CONSTRAINT "user_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "daySpan" INTEGER NOT NULL DEFAULT 0,
    "firstDate" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uniqueUsers" TEXT[],
    "validatedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievement_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" "Subject",
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_doubts" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doubtId" TEXT NOT NULL,

    CONSTRAINT "community_doubts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "embedding" JSONB,
    "synonyms" TEXT[],
    "keywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mastery_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "conceptId" TEXT,
    "baseXP" INTEGER NOT NULL,
    "masteryMult" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "trustMult" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "factCheckMult" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timeDecay" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "finalXP" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT,
    "masteryScoreBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masteryScoreAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_check_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "contextUsed" TEXT NOT NULL DEFAULT '',
    "claimsChecked" INTEGER NOT NULL DEFAULT 0,
    "entailmentCount" INTEGER NOT NULL DEFAULT 0,
    "contradictionCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "safeToDisplay" BOOLEAN NOT NULL DEFAULT true,
    "checks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_check_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 25,
    "actualSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalFocusSeconds" INTEGER NOT NULL DEFAULT 0,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "topicSeconds" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "university" TEXT,
    "subjects" TEXT[],
    "expertise" TEXT[],
    "availability" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_requests" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "preferredTime" TEXT,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'PENDING',
    "mentorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorship_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campus_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL DEFAULT 'OTHER',
    "location" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "tags" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campus_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "doubts_authorId_idx" ON "doubts"("authorId");

-- CreateIndex
CREATE INDEX "doubts_createdAt_idx" ON "doubts"("createdAt");

-- CreateIndex
CREATE INDEX "doubts_subject_idx" ON "doubts"("subject");

-- CreateIndex
CREATE INDEX "doubts_isInCommunity_idx" ON "doubts"("isInCommunity");

-- CreateIndex
CREATE UNIQUE INDEX "answers_isAnswered_key" ON "answers"("isAnswered");

-- CreateIndex
CREATE INDEX "answers_doubtId_idx" ON "answers"("doubtId");

-- CreateIndex
CREATE INDEX "answers_authorId_idx" ON "answers"("authorId");

-- CreateIndex
CREATE INDEX "answers_createdAt_idx" ON "answers"("createdAt");

-- CreateIndex
CREATE INDEX "doubt_votes_userId_idx" ON "doubt_votes"("userId");

-- CreateIndex
CREATE INDEX "doubt_votes_doubtId_idx" ON "doubt_votes"("doubtId");

-- CreateIndex
CREATE UNIQUE INDEX "doubt_votes_userId_doubtId_key" ON "doubt_votes"("userId", "doubtId");

-- CreateIndex
CREATE INDEX "answer_votes_userId_idx" ON "answer_votes"("userId");

-- CreateIndex
CREATE INDEX "answer_votes_answerId_idx" ON "answer_votes"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "answer_votes_userId_answerId_key" ON "answer_votes"("userId", "answerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_userId_key" ON "user_stats"("userId");

-- CreateIndex
CREATE INDEX "user_stats_totalPoints_idx" ON "user_stats"("totalPoints");

-- CreateIndex
CREATE INDEX "user_stats_currentLevel_idx" ON "user_stats"("currentLevel");

-- CreateIndex
CREATE INDEX "points_ledger_userId_createdAt_idx" ON "points_ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "points_ledger_eventType_idx" ON "points_ledger"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "levels_level_key" ON "levels"("level");

-- CreateIndex
CREATE INDEX "levels_minPoints_idx" ON "levels"("minPoints");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_name_key" ON "achievements"("name");

-- CreateIndex
CREATE INDEX "achievement_unlocks_userId_unlockedAt_idx" ON "achievement_unlocks"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_unlocks_userId_achievementId_key" ON "achievement_unlocks"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE INDEX "badge_grants_userId_grantedAt_idx" ON "badge_grants"("userId", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "badge_grants_userId_badgeId_key" ON "badge_grants"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_userId_key" ON "streaks"("userId");

-- CreateIndex
CREATE INDEX "streaks_lastActivityDate_idx" ON "streaks"("lastActivityDate");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_period_scope_periodStart_idx" ON "leaderboard_snapshots"("period", "scope", "periodStart");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_period_scope_rank_periodStart_idx" ON "leaderboard_snapshots"("period", "scope", "rank", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_userId_period_scope_periodStart_key" ON "leaderboard_snapshots"("userId", "period", "scope", "periodStart");

-- CreateIndex
CREATE INDEX "conversations_userId_createdAt_idx" ON "conversations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_userId_sessionType_idx" ON "conversations"("userId", "sessionType");

-- CreateIndex
CREATE INDEX "ai_recommendations_userId_idx" ON "ai_recommendations"("userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "user_discounts_userId_idx" ON "user_discounts"("userId");

-- CreateIndex
CREATE INDEX "achievement_progress_userId_idx" ON "achievement_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_progress_userId_achievementId_key" ON "achievement_progress"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "communities_createdBy_idx" ON "communities"("createdBy");

-- CreateIndex
CREATE INDEX "communities_isPublic_idx" ON "communities"("isPublic");

-- CreateIndex
CREATE INDEX "communities_subject_idx" ON "communities"("subject");

-- CreateIndex
CREATE INDEX "community_members_userId_idx" ON "community_members"("userId");

-- CreateIndex
CREATE INDEX "community_members_communityId_idx" ON "community_members"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_userId_communityId_key" ON "community_members"("userId", "communityId");

-- CreateIndex
CREATE INDEX "community_doubts_communityId_idx" ON "community_doubts"("communityId");

-- CreateIndex
CREATE INDEX "community_doubts_doubtId_idx" ON "community_doubts"("doubtId");

-- CreateIndex
CREATE UNIQUE INDEX "community_doubts_communityId_doubtId_key" ON "community_doubts"("communityId", "doubtId");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_name_key" ON "concepts"("name");

-- CreateIndex
CREATE INDEX "concepts_difficulty_idx" ON "concepts"("difficulty");

-- CreateIndex
CREATE INDEX "concepts_domain_idx" ON "concepts"("domain");

-- CreateIndex
CREATE INDEX "concepts_isActive_idx" ON "concepts"("isActive");

-- CreateIndex
CREATE INDEX "event_logs_eventType_emittedAt_idx" ON "event_logs"("eventType", "emittedAt");

-- CreateIndex
CREATE INDEX "event_logs_processedAt_idx" ON "event_logs"("processedAt");

-- CreateIndex
CREATE INDEX "event_logs_userId_emittedAt_idx" ON "event_logs"("userId", "emittedAt");

-- CreateIndex
CREATE INDEX "mastery_records_userId_idx" ON "mastery_records"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_records_userId_conceptId_key" ON "mastery_records"("userId", "conceptId");

-- CreateIndex
CREATE INDEX "xp_ledger_conceptId_idx" ON "xp_ledger"("conceptId");

-- CreateIndex
CREATE INDEX "xp_ledger_eventType_idx" ON "xp_ledger"("eventType");

-- CreateIndex
CREATE INDEX "xp_ledger_flagged_idx" ON "xp_ledger"("flagged");

-- CreateIndex
CREATE INDEX "xp_ledger_userId_createdAt_idx" ON "xp_ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "concept_attempts_userId_createdAt_idx" ON "concept_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "concept_attempts_conceptId_idx" ON "concept_attempts"("conceptId");

-- CreateIndex
CREATE INDEX "fact_check_logs_userId_createdAt_idx" ON "fact_check_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "fact_check_logs_safeToDisplay_idx" ON "fact_check_logs"("safeToDisplay");

-- CreateIndex
CREATE UNIQUE INDEX "trust_scores_userId_key" ON "trust_scores"("userId");

-- CreateIndex
CREATE INDEX "trust_scores_userId_idx" ON "trust_scores"("userId");

-- CreateIndex
CREATE INDEX "study_sessions_userId_startedAt_idx" ON "study_sessions"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "learner_profiles_userId_key" ON "learner_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_userId_key" ON "mentor_profiles"("userId");

-- CreateIndex
CREATE INDEX "mentor_profiles_isActive_createdAt_idx" ON "mentor_profiles"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "mentorship_requests_mentorId_status_idx" ON "mentorship_requests"("mentorId", "status");

-- CreateIndex
CREATE INDEX "mentorship_requests_studentId_createdAt_idx" ON "mentorship_requests"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "campus_events_startsAt_idx" ON "campus_events"("startsAt");

-- CreateIndex
CREATE INDEX "event_rsvps_userId_idx" ON "event_rsvps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_votes" ADD CONSTRAINT "doubt_votes_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_votes" ADD CONSTRAINT "doubt_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_votes" ADD CONSTRAINT "answer_votes_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_votes" ADD CONSTRAINT "answer_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_grants" ADD CONSTRAINT "badge_grants_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_grants" ADD CONSTRAINT "badge_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_discounts" ADD CONSTRAINT "user_discounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_progress" ADD CONSTRAINT "achievement_progress_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_progress" ADD CONSTRAINT "achievement_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_doubts" ADD CONSTRAINT "community_doubts_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_doubts" ADD CONSTRAINT "community_doubts_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campus_events" ADD CONSTRAINT "campus_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "campus_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

