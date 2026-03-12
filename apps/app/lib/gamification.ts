import { PrismaClient, PointEventType } from "@prisma/client";

const prisma = new PrismaClient();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Level constants (kept for UI calculations)
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
 * Calculate current level based on total XP.
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
    [PointEventType.ANSWER_ACCEPTED]: 100,
    [PointEventType.DOUBT_RESOLVED]: 15,
    [PointEventType.DAILY_LOGIN]: 5,
    [PointEventType.STREAK_BONUS]: 50,
    [PointEventType.ACHIEVEMENT_UNLOCKED]: 0,
    [PointEventType.BADGE_EARNED]: 30,
    [PointEventType.CREDITS_REDEEMED]: 0,
};

// Map Next.js PointEventType to AI backend event type strings
const POINT_EVENT_TO_AI_EVENT: Record<PointEventType, string> = {
    [PointEventType.DOUBT_CREATED]: "DOUBT_CREATED",
    [PointEventType.COMMENT_CREATED]: "COMMENT_CREATED",
    [PointEventType.UPVOTE_RECEIVED]: "UPVOTE_RECEIVED",
    [PointEventType.DOWNVOTE_RECEIVED]: "DOWNVOTE_RECEIVED",
    [PointEventType.ANSWER_ACCEPTED]: "ANSWER_ACCEPTED",
    [PointEventType.DOUBT_RESOLVED]: "DOUBT_RESOLVED",
    [PointEventType.DAILY_LOGIN]: "DAILY_LOGIN",
    [PointEventType.STREAK_BONUS]: "STREAK_MILESTONE",
    [PointEventType.ACHIEVEMENT_UNLOCKED]: "ACHIEVEMENT_UNLOCKED",
    [PointEventType.BADGE_EARNED]: "BADGE_EARNED",
    [PointEventType.CREDITS_REDEEMED]: "CREDITS_REDEEMED",
};

interface AwardXPOptions {
    isAiAssisted?: boolean;
    description?: string;
}

/**
 * Post a gamification event to the AI backend.
 * Fire-and-forget: errors are logged but not rethrown.
 */
async function postGamificationEvent(
    userId: string,
    eventType: string,
    metadata?: Record<string, unknown>
) {
    try {
        const resp = await fetch(`${BACKEND_URL}/api/gamification/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, event_type: eventType, metadata: metadata || {} }),
        });
        if (!resp.ok) {
            console.error(`[Gamification] Backend error for ${eventType}:`, resp.status, await resp.text());
            return null;
        }
        return resp.json() as Promise<{
            xp_awarded: number;
            new_total_xp: number;
            level: number;
            tier: string;
            streak_updated: boolean;
            milestone_reached: boolean;
            achievements_unlocked: string[];
        }>;
    } catch (err) {
        console.error(`[Gamification] Failed to post event ${eventType} for user ${userId}:`, err);
        return null;
    }
}

/**
 * Award XP via the AI backend (applies trust/NLI/difficulty multipliers).
 * XP is stored in user.totalXP and tracked in the xp_ledger table.
 */
export async function awardXP(userId: string, eventType: PointEventType, options: AwardXPOptions = {}) {
    const aiEventType = POINT_EVENT_TO_AI_EVENT[eventType] || (eventType as string);
    const result = await postGamificationEvent(userId, aiEventType, {
        reason: options.description,
        is_ai_assisted: options.isAiAssisted,
    });

    const points = result?.xp_awarded ?? POINT_VALUES[eventType] ?? 0;
    const level = result?.level ?? calculateLevel(points);
    const tier = result?.tier ?? getTierTitle(level);

    return { points, newLevel: level, newTier: tier };
}

/**
 * Backward compatibility wrapper.
 */
export async function awardPoints(userId: string, eventType: PointEventType, description?: string) {
    return awardXP(userId, eventType, { description });
}

/**
 * Trigger daily login XP event via AI backend (deduplicates per calendar day).
 */
export async function checkDailyLogin(userId: string) {
    return postGamificationEvent(userId, "DAILY_LOGIN", { reason: "Daily login bonus" });
}

/**
 * Streak is updated automatically in the AI backend as part of event processing.
 * Kept for backward compatibility - callers of this function can remain unchanged.
 */
export async function updateStreak(_userId: string) {
    // No-op: streak tracking is now exclusively handled by the AI backend.
    // Every qualifying event (DAILY_LOGIN, DOUBT_CREATED, etc.) triggers streak update.
    return null;
}

/**
 * Achievement checking is automatic in the AI backend event handler.
 * Kept for backward compatibility - callers can remain unchanged.
 */
export async function checkAchievements(_userId: string, _eventType?: PointEventType) {
    // No-op: achievements are checked automatically as part of postGamificationEvent.
    return [];
}

/**
 * Economy Sink: Deduct Entropy Coins for feature usage.
 * Credits are distinct from XP economy and remain a direct DB operation.
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

        await tx.pointsLedger.create({
            data: {
                userId,
                eventType: PointEventType.STREAK_BONUS,
                points: -amount,
                description: `Feature Spend: ${description}`
            }
        });

        return true;
    });
}

/**
 * Get leaderboard from the AI backend (ranked by smart XP with trust/multipliers).
 */
export async function getLeaderboard(_period: "all" | "weekly" | "monthly") {
    try {
        const resp = await fetch(
            `${BACKEND_URL}/api/gamification/leaderboard/xp?limit=100`,
            { cache: "no-store" }
        );
        if (!resp.ok) {
            throw new Error(`AI backend leaderboard error: ${resp.status}`);
        }
        const entries = await resp.json() as Array<{
            user_id: string;
            username: string;
            total_xp: number;
            reputation: number;
            trust_score: number;
            rank: number;
        }>;

        return entries.map((entry) => ({
            rank: entry.rank,
            id: entry.user_id,
            name: entry.username,
            image: null as string | null,
            tier: getTierTitle(calculateLevel(entry.total_xp)),
            totalReputation: entry.reputation,
            totalXP: entry.total_xp,
            credits: 0,
            streakInfo: null as null,
            achievements: [] as unknown[],
            badges: [] as unknown[],
            totalAchievements: 0,
            totalBadges: 0,
            totalAchievementPoints: 0,
        }));
    } catch (error) {
        console.error("Error fetching leaderboard from AI backend:", error);
        throw error;
    }
}