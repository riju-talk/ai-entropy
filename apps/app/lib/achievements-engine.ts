/**
 * NOVYRA ACHIEVEMENT & BADGE ENGINE
 * Production-ready achievement management system with anti-gaming validation
 * 
 * @module lib/achievements-engine
 * @version 2.0.0
 */

import { PrismaClient } from "@prisma/client";
import type {
  AchievementType,
  AchievementRarity,
  BadgeType,
} from "@prisma/client";

const prisma = new PrismaClient();

/* ============================================================
   TYPE DEFINITIONS
============================================================ */

export interface AchievementDefinition {
  type: AchievementType;
  name: string;
  description: string;
  criteria: {
    requirementType: string;
    target: number;
    timeFrameDaysMin?: number; // Min days to complete naturally
  };
  points: number;
  rarity: AchievementRarity;
  icon: string;
}

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface AchievementProgress {
  current: number;
  target: number;
  percentage: number;
}

export interface UnlockResult {
  unlocked: boolean;
  flagged?: boolean;
  progress?: AchievementProgress;
  achievement?: {
    name: string;
    rarity: string;
    points: number;
  };
  message?: string;
}

/* ============================================================
   ACHIEVEMENT & BADGE DEFINITIONS
   Note: These are now stored in the database via the SQL migration.
   The engine reads from DB at runtime for all 15 achievements & 10 badges.
   
   Reference for development:
   - 15 Achievements: COMMON, UNCOMMON, RARE, EPIC, LEGENDARY
   - 10 Badges: Subject mastery + specialization badges
   - Criteria types: DOUBTS_ASKED, ANSWERS_POSTED, CONSECUTIVE_DAYS, etc.
============================================================ */

// Database now contains:
// Achievements: 15 total (ach_first_steps → ach_legend_status)
// Badges: 10 total (badge_code_ninja → badge_tutor)
// Read via: prisma.achievement.findMany() | prisma.badge.findMany()

/* ============================================================
   UTILITY HELPERS
============================================================ */

function calculateDaySpan(firstDate: Date | null, lastDate: Date): number {
  if (!firstDate) return 0;
  return Math.max(
    1,
    Math.ceil(
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}

function mergeUniqueUsers(
  existing: string[] | null | undefined,
  incoming: string[] | undefined
): string[] {
  const set = new Set([...(existing || []), ...(incoming || [])]);
  return Array.from(set);
}

/* ============================================================
   ANTI-GAMING VALIDATION (COMPREHENSIVE)
============================================================ */

export function validateProgressAuthenticity(
  progress: {
    current: number;
    target: number;
    firstDate: Date | null;
    lastDate: Date;
    uniqueUsers: string[] | null;
    validatedCount: number | null;
  },
  criteria: {
    target: number;
    requirementType: string; // From database: DOUBTS_ASKED, ANSWERS_POSTED, etc.
    timeFrameDaysMin?: number;
  }
): {
  valid: boolean;
  flags: string[];
} {
  const flags: string[] = [];

  // CHECK 1: TIME-BASED VALIDATION
  // Prevent unrealistic speed of achievement completion
  const daySpan = calculateDaySpan(progress.firstDate, progress.lastDate);
  const expectedMinDays = criteria.timeFrameDaysMin || Math.max(1, criteria.target / 10);

  if (
    daySpan < expectedMinDays &&
    criteria.requirementType !== "REPUTATION" &&
    criteria.target > 1
  ) {
    flags.push(`TOO_FAST: Completed in ${daySpan} days, expected ${expectedMinDays}+ days`);
  }

  // CHECK 2: UNIQUE CONTRIBUTION VALIDATION
  // Ensure diverse participation for helping achievements
  if (
    criteria.requirementType === "HELPFUL_ANSWERS" ||
    criteria.requirementType === "STUDENTS_HELPED"
  ) {
    const uniqueCount = progress.uniqueUsers?.length || 0;
    const diversityRatio = uniqueCount / Math.max(1, progress.current);

    // Need at least 30% unique sources for helping achievements
    if (diversityRatio < 0.3 && progress.current > 10) {
      flags.push(
        `LOW_DIVERSITY: Only ${Math.round(diversityRatio * 100)}% from unique sources (need 30%+)`
      );
    }
  }

  // CHECK 3: VALIDATION RATIO (Upvotes/Acceptance Rate)
  // Ensure contributions are actually validated by community
  const validatedRatio = progress.current > 0 
    ? (progress.validatedCount || 0) / progress.current 
    : 0;

  if (
    (criteria.requirementType === "DOUBTS_RESOLVED" ||
      criteria.requirementType === "HELPFUL_ANSWERS") &&
    validatedRatio < 0.5 &&
    progress.current > 5
  ) {
    flags.push(
      `LOW_VALIDATION: Only ${Math.round(validatedRatio * 100)}% validated (need 50%+)`
    );
  }

  // CHECK 4: BURST ACTIVITY DETECTION
  // Prevent rapid bulk actions in short timeframe
  if (daySpan > 0 && daySpan < 3 && progress.current > 20) {
    const actionsPerDay = progress.current / daySpan;
    if (actionsPerDay > 15) {
      flags.push(
        `BURST_ACTIVITY: ${actionsPerDay.toFixed(1)} actions/day (suspicious)`
      );
    }
  }

  return {
    valid: flags.length === 0,
    flags,
  };
}

/* ============================================================
   CORE ENGINE - UPDATE ACHIEVEMENT PROGRESS
============================================================ */

export async function updateAchievementProgress(
  userId: string,
  achievementId: string,
  currentValue: number, // Absolute value, not increment
  metadata?: {
    uniqueUsers?: string[];
    validated?: boolean;
  }
): Promise<UnlockResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Fetch achievement from database
      const achievement = await tx.achievement.findUnique({
        where: { id: achievementId },
      });

      if (!achievement) {
        throw new Error("Achievement not found");
      }

      const criteria = achievement.criteria as any;
      const target = criteria.target;

      // Check if already unlocked
      const alreadyUnlocked = await tx.achievementUnlock.findUnique({
        where: {
          userId_achievementId: { userId, achievementId },
        },
      });

      if (alreadyUnlocked) {
        return {
          unlocked: true,
          message: "Achievement already unlocked",
        };
      }

      // Upsert progress
      const progress = await tx.achievementProgress.upsert({
        where: {
          userId_achievementId: { userId, achievementId },
        },
        create: {
          userId,
          achievementId,
          current: currentValue,
          target,
          uniqueUsers: metadata?.uniqueUsers || [],
          validatedCount: metadata?.validated ? 1 : 0,
          firstDate: new Date(),
          lastDate: new Date(),
          daySpan: 0,
        },
        update: {
          current: currentValue,
          lastDate: new Date(),
          validatedCount: metadata?.validated
            ? { increment: 1 }
            : undefined,
          uniqueUsers: metadata?.uniqueUsers
            ? mergeUniqueUsers(
                (
                  await tx.achievementProgress.findUnique({
                    where: {
                      userId_achievementId: { userId, achievementId },
                    },
                    select: { uniqueUsers: true },
                  })
                )?.uniqueUsers,
                metadata.uniqueUsers
              )
            : undefined,
        },
      });

      // Refresh to get updated values
      const updated = await tx.achievementProgress.findUnique({
        where: {
          userId_achievementId: { userId, achievementId },
        },
      });

      if (!updated) {
        throw new Error("Failed to update progress");
      }

      // Calculate day span
      const daySpan = calculateDaySpan(updated.firstDate, updated.lastDate);
      await tx.achievementProgress.update({
        where: {
          userId_achievementId: { userId, achievementId },
        },
        data: { daySpan },
      });

      // Check if target reached
      if (updated.current >= target) {
        // Validate authenticity using criteria from database
        const validation = validateProgressAuthenticity(updated, criteria);

        if (!validation.valid) {
          // Flag for review
          return {
            unlocked: false,
            flagged: true,
            message: `Achievement flagged for review: ${validation.flags.join(", ")}`,
          };
        }

        // Proceed with unlock
        return await unlockAchievement(tx, userId, achievement);
      }

      return {
        unlocked: false,
        progress: {
          current: updated.current,
          target,
          percentage: Math.round((updated.current / target) * 100),
        },
      };
    });
  } catch (error) {
    console.error("Error updating achievement progress:", error);
    throw error;
  }
}

/* ============================================================
   UNLOCK ACHIEVEMENT (INTERNAL)
============================================================ */

async function unlockAchievement(
  tx: any,
  userId: string,
  achievement: any
): Promise<UnlockResult> {
  try {
    // Create unlock record
    const unlock = await tx.achievementUnlock.create({
      data: {
        userId,
        achievementId: achievement.id,
        unlockedAt: new Date(),
      },
    });

    // Award points
    await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: achievement.points },
      },
    });

    // Create ledger entry
    await tx.pointsLedger.create({
      data: {
        userId,
        eventType: "ACHIEVEMENT_UNLOCKED",
        points: achievement.points,
        description: `Achievement unlocked: ${achievement.name}`,
      },
    });

    return {
      unlocked: true,
      achievement: {
        name: achievement.name,
        rarity: achievement.rarity,
        points: achievement.points,
      },
      message: `🎉 Achievement unlocked: ${achievement.name}! Earned ${achievement.points} credits`,
    };
  } catch (error) {
    console.error("Error unlocking achievement:", error);
    throw error;
  }
}

/* ============================================================
   BADGE MANAGEMENT
============================================================ */

export async function grantBadge(
  userId: string,
  badgeId: string
): Promise<{ granted: boolean; message?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Check if already granted
      const existing = await tx.badgeGrant.findUnique({
        where: {
          userId_badgeId: { userId, badgeId },
        },
      });

      if (existing) {
        return { granted: false, message: "Badge already granted" };
      }

      // Create grant
      const grant = await tx.badgeGrant.create({
        data: {
          userId,
          badgeId,
          grantedAt: new Date(),
        },
      });

      // Create ledger entry
      await tx.pointsLedger.create({
        data: {
          userId,
          eventType: "BADGE_EARNED",
          points: 0,
          description: "Badge earned",
        },
      });

      return {
        granted: true,
        message: `Badge granted successfully`,
      };
    });
  } catch (error) {
    console.error("Error granting badge:", error);
    throw error;
  }
}

/* ============================================================
   SUBJECT BADGE AUTO-GRANT (>80% Mastery)
============================================================ */

const SUBJECT_BADGE_MAP: Record<string, string> = {
  Python: "CODE_NINJA",
  JavaScript: "CODE_NINJA",
  Java: "CODE_NINJA",
  Mathematics: "MATH_WIZARD",
  Physics: "PHYSICS_GURU",
  Biology: "BIO_EXPERT",
  "AI/ML": "AI_MASTER",
  "Artificial Intelligence": "AI_MASTER",
};

export async function updateSubjectBadges(
  userId: string,
  subjectName: string,
  masteryScore: number // 0-1 (e.g., 0.85 for 85%)
): Promise<{ granted: boolean; message?: string } | void> {
  if (masteryScore < 0.8) {
    return; // Not mastered yet
  }

  const badgeType = SUBJECT_BADGE_MAP[subjectName];
  if (!badgeType) {
    return; // No badge for this subject
  }

  const badge = await prisma.badge.findFirst({
    where: { type: badgeType as any },
  });

  if (!badge) {
    return; // Badge not in database
  }

  return grantBadge(userId, badge.id);
}

/* ============================================================
   GET USER ACHIEVEMENT PROGRESS
============================================================ */

export async function getUserAchievementProgress(userId: string) {
  try {
    const progress = await prisma.achievementProgress.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { lastDate: "desc" },
    });

    const unlocked = await prisma.achievementUnlock.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
    });

    const totalPoints = unlocked.reduce(
      (sum, u) => sum + (u.achievement?.points || 0),
      0
    );

    return {
      inProgress: progress.map((p) => ({
        achievement: p.achievement,
        current: p.current,
        target: p.target,
        percentage: Math.round((p.current / p.target) * 100),
      })),
      unlocked: unlocked.map((u) => ({
        achievement: u.achievement,
        unlockedAt: u.unlockedAt,
      })),
      totalPoints,
      totalUnlocked: unlocked.length,
    };
  } catch (error) {
    console.error("Error fetching achievement progress:", error);
    throw error;
  }
}

/* ============================================================
   UPDATE STREAK ACHIEVEMENTS (Daily Task)
============================================================ */

export async function updateStreakAchievements(userId: string) {
  try {
    const streak = await prisma.streak.findUnique({
      where: { userId },
    });

    if (!streak) return;

    const currentStreak = streak.currentStreak;

    // Update Streak Master (30 days)
    if (currentStreak >= 30) {
      const streakMasterAchievement = await prisma.achievement.findFirst({
        where: {
          criteria: {
            path: ["requirementType"],
            equals: "CONSECUTIVE_DAYS",
          },
        },
      });

      if (streakMasterAchievement) {
        await updateAchievementProgress(
          userId,
          streakMasterAchievement.id,
          currentStreak
        );
      }
    }

    // Update Consistency Wins (60 days)
    if (currentStreak >= 60) {
      const consistencyAchievements = await prisma.achievement.findMany({
        where: {
          name: { contains: "Consistency" },
        },
      });

      for (const achievement of consistencyAchievements) {
        await updateAchievementProgress(
          userId,
          achievement.id,
          currentStreak
        );
      }
    }
  } catch (error) {
    console.error("Error updating streak achievements:", error);
  }
}

/* ============================================================
   GET LEADERBOARD WITH ACHIEVEMENTS
============================================================ */

export async function getLeaderboardWithAchievements(
  limit: number = 50,
  period?: "DAILY" | "WEEKLY" | "MONTHLY" | "ALL_TIME"
) {
  try {
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: {
        totalReputation: "desc",
      },
      select: {
        id: true,
        name: true,
        image: true,
        totalReputation: true,
        totalXP: true,
        tier: true,
        credits: true,
        achievementUnlocks: {
          select: {
            achievement: {
              select: {
                id: true,
                name: true,
                rarity: true,
                points: true,
                icon: true,
              },
            },
            unlockedAt: true,
          },
          orderBy: { unlockedAt: "desc" },
        },
        badgeGrants: {
          select: {
            badge: {
              select: {
                id: true,
                name: true,
                type: true,
                icon: true,
                color: true,
              },
            },
            grantedAt: true,
          },
          orderBy: { grantedAt: "desc" },
        },
        streaks: {
          select: {
            currentStreak: true,
            longestStreak: true,
          },
        },
      },
    });

    return users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      image: user.image,
      totalReputation: user.totalReputation,
      totalXP: user.totalXP,
      tier: user.tier,
      credits: user.credits,
      streakInfo: user.streaks,
      achievements: user.achievementUnlocks.map((au) => ({
        ...au.achievement,
        unlockedAt: au.unlockedAt,
      })),
      badges: user.badgeGrants.map((bg) => ({
        ...bg.badge,
        grantedAt: bg.grantedAt,
      })),
      totalAchievementPoints: user.achievementUnlocks.reduce(
        (sum, au) => sum + (au.achievement?.points || 0),
        0
      ),
      totalAchievements: user.achievementUnlocks.length,
      totalBadges: user.badgeGrants.length,
    }));
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
}

/* ============================================================
   EXPORT PUBLIC API
============================================================ */

export default {
  updateAchievementProgress,
  grantBadge,
  getUserAchievementProgress,
  updateStreakAchievements,
  updateSubjectBadges,
  getLeaderboardWithAchievements,
  validateProgressAuthenticity,
};