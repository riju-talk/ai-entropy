import { PrismaClient, PointEventType, AchievementType } from "@prisma/client";

const prisma = new PrismaClient();

// Level constants
const XP_FOR_LEVEL_1 = 0;
const XP_MULTIPLIER = 1.5;
const BASE_XP = 100;

/**
 * Calculate the XP required for a specific level.
 */
export function getXPForLevel(level: number): number {
    if (level <= 1) return XP_FOR_LEVEL_1;
    return Math.floor(BASE_XP * Math.pow(XP_MULTIPLIER, level - 2));
}

/**
 * Calculate current level based on total points.
 */
export function calculateLevel(totalPoints: number): number {
    let level = 1;
    while (true) {
        const nextXP = getXPForLevel(level + 1);
        if (totalPoints < nextXP) break;
        level++;
    }
    return level;
}

export function getTierTitle(level: number): string {
    if (level <= 5) return "Initiate";
    if (level <= 15) return "Contributor";
    if (level <= 30) return "Authority";
    if (level <= 50) return "Luminary";
    return "Sage";
}

export const POINT_VALUES: Record<PointEventType, number> = {
    [PointEventType.DOUBT_CREATED]: 10,
    [PointEventType.COMMENT_CREATED]: 2,
    [PointEventType.UPVOTE_RECEIVED]: 5,
    [PointEventType.DOWNVOTE_RECEIVED]: -2,
    [PointEventType.ANSWER_ACCEPTED]: 20,
    [PointEventType.DOUBT_RESOLVED]: 15,
    [PointEventType.DAILY_LOGIN]: 1,
    [PointEventType.STREAK_BONUS]: 5,
    [PointEventType.ACHIEVEMENT_UNLOCKED]: 50,
    [PointEventType.BADGE_EARNED]: 30,
};

interface AwardXPOptions {
    isAiAssisted?: boolean;
    description?: string;
}

/**
 * Centered XP Engine with contextual multipliers.
 */
export async function awardXP(userId: string, eventType: PointEventType, options: AwardXPOptions = {}) {
    const basePoints = POINT_VALUES[eventType] || 0;

    return await prisma.$transaction(async (tx) => {
        // 1. Fetch User for multipliers
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { reputation: true, tier: true }
        });

        if (!user) throw new Error("User not found");

        // 2. Calculate Multipliers
        // Rigor Multiplier: 1.5x for non-AI assisted work
        const qualityMultiplier = options.isAiAssisted ? 1.0 : 1.5;
        // Reputation Multiplier: 1.0 to 2.0 based on reputation (capped at 1000 rep)
        const reputationMultiplier = Math.min(2.0, 1.0 + (user.reputation / 1000));

        const finalPoints = Math.floor(basePoints * qualityMultiplier * reputationMultiplier);

        // 3. Create Ledger Entry
        await tx.pointsLedger.create({
            data: {
                userId,
                eventType,
                points: finalPoints,
                description: options.description || `${eventType} (Rigor: ${qualityMultiplier}x, Rep: ${reputationMultiplier.toFixed(2)}x)`,
            },
        });

        // 4. Update User Stats & Levels
        const stats = await tx.userStat.upsert({
            where: { userId },
            create: {
                userId,
                totalPoints: finalPoints,
                currentLevel: calculateLevel(finalPoints),
            },
            update: {
                totalPoints: { increment: finalPoints },
                // Intermediate level check happens after txn or below
            },
        });

        const newLevel = calculateLevel(stats.totalPoints);
        const newTier = getTierTitle(newLevel);

        if (newLevel > stats.currentLevel) {
            await tx.userStat.update({
                where: { userId },
                data: { currentLevel: newLevel },
            });
            await tx.user.update({
                where: { id: userId },
                data: { tier: newTier },
            });
        }

        // 5. Special Currency logic
        if (eventType === PointEventType.DAILY_LOGIN) {
            await tx.user.update({
                where: { id: userId },
                data: { credits: { increment: 1 } },
            });
        }

        return { points: finalPoints, newLevel, newTier };
    });
}

/**
 * Backward compatibility wrapper
 */
export async function awardPoints(userId: string, eventType: PointEventType, description?: string) {
    return awardXP(userId, eventType, { description });
}

export async function checkDailyLogin(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastLogin = await prisma.pointsLedger.findFirst({
        where: {
            userId,
            eventType: PointEventType.DAILY_LOGIN,
            createdAt: { gte: today },
        },
    });

    if (!lastLogin) {
        return await awardXP(userId, PointEventType.DAILY_LOGIN, { description: "Daily Login Bonus" });
    }

    return null;
}

export async function updateStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const streak = await prisma.streak.upsert({
        where: { userId },
        create: {
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastActivityDate: today,
        },
        update: {},
    });

    if (streak.lastActivityDate) {
        const lastDate = new Date(streak.lastActivityDate);
        lastDate.setHours(0, 0, 0, 0);

        if (lastDate.getTime() === yesterday.getTime()) {
            const newStreak = streak.currentStreak + 1;
            const updated = await prisma.streak.update({
                where: { userId },
                data: {
                    currentStreak: newStreak,
                    longestStreak: Math.max(newStreak, streak.longestStreak),
                    lastActivityDate: today,
                },
            });

            // Trigger Streak Bonus
            if (newStreak % 5 === 0) {
                await awardXP(userId, PointEventType.STREAK_BONUS, { description: `${newStreak} Day Streak Bonus!` });
            }

            // Check for Scholar's Oath (30/90 days)
            await checkScholarOath(userId, newStreak);

            return updated;
        } else if (lastDate.getTime() < yesterday.getTime()) {
            return await prisma.streak.update({
                where: { userId },
                data: {
                    currentStreak: 1,
                    lastActivityDate: today,
                },
            });
        }
    }

    return streak;
}

async function checkScholarOath(userId: string, currentStreak: number) {
    let discount = 0;
    let source = "";

    if (currentStreak >= 90) {
        discount = 20;
        source = "Scholar's Oath (90 Days - Lifetime)";
    } else if (currentStreak >= 30) {
        discount = 10;
        source = "Scholar's Oath (30 Days)";
    }

    if (discount > 0) {
        const expiration = currentStreak >= 90 ? null : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 day expiry for 30-day streak

        await prisma.userDiscount.upsert({
            where: { id: `scholar-oath-${userId}` }, // simplified ID or use unique index
            create: {
                id: `scholar-oath-${userId}`,
                userId,
                discountPercent: discount,
                source,
                expiresAt: expiration
            },
            update: {
                discountPercent: discount,
                isActive: true, // Reactivate if was broken
                expiresAt: expiration
            }
        });
    }
}

export async function checkAchievements(userId: string, eventType: PointEventType) {
    const stats = await prisma.userStat.findUnique({
        where: { userId },
        include: { user: { include: { achievementUnlocks: true, achievementProgress: true } } },
    });

    if (!stats) return [];

    const unlockedIds = new Set((stats as any).user.achievementUnlocks.map((u: any) => u.achievementId));
    const newUnlocks: string[] = [];

    const achievements = await prisma.achievement.findMany();

    for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;

        let criterionMet = false;
        const criteria = achievement.criteria as any;

        // Progress Tracking
        let currentProgress = 0;
        switch (achievement.type) {
            case AchievementType.FIRST_DOUBT:
                currentProgress = stats.doubtsAsked;
                break;
            case AchievementType.PROBLEM_SOLVER:
                currentProgress = stats.doubtsResolved;
                break;
            case AchievementType.STREAK_MASTER:
                const streak = await prisma.streak.findUnique({ where: { userId } });
                currentProgress = streak?.currentStreak || 0;
                break;
        }

        if (currentProgress > 0) {
            await (prisma as any).achievementProgress.upsert({
                where: { userId_achievementId: { userId, achievementId: achievement.id } },
                create: { userId, achievementId: achievement.id, current: currentProgress, target: criteria.count || 1 },
                update: { current: currentProgress, lastUpdated: new Date() }
            });

            if (currentProgress >= (criteria.count || 1)) criterionMet = true;
        }

        if (criterionMet) {
            await awardXP(userId, PointEventType.ACHIEVEMENT_UNLOCKED, { description: `Unlocked Achievement: ${achievement.name}` });
            await prisma.achievementUnlock.create({
                data: { userId, achievementId: achievement.id },
            });
            newUnlocks.push(achievement.name);
        }
    }

    return newUnlocks;
}

/**
 * Economy Sink: Deduct Entropy Coins for feature usage.
 */
export async function deductCredits(userId: string, amount: number, description: string) {
    return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true }
        });

        if (!user || user.credits < amount) {
            throw new Error("Insufficient Entropy Coins. Perform more academic actions to earn more!");
        }

        await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: amount } }
        });

        // Log spending in the ledger (as negative points/coins)
        await tx.pointsLedger.create({
            data: {
                userId,
                eventType: PointEventType.STREAK_BONUS, // Using this as a proxy or just add generic
                points: -amount,
                description: `Feature Spend: ${description}`
            }
        });

        return true;
    });
}

export async function getLeaderboard(period: "all" | "weekly" | "monthly") {
    return await prisma.userStat.findMany({
        orderBy: { totalPoints: "desc" },
        take: 20,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    tier: true,
                    reputation: true,
                },
            },
        },
    });
}
