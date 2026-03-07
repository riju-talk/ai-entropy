import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 100);
        const period = searchParams.get("period") || "all";

        // Build optional date filter for period-based views
        let dateFilter: Record<string, unknown> = {};
        if (period === "weekly") {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            dateFilter = { lastActiveAt: { gte: cutoff } };
        } else if (period === "monthly") {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 1);
            dateFilter = { lastActiveAt: { gte: cutoff } };
        }

        const users = await prisma.user.findMany({
            where: {
                leaderboardOptOut: false,
                isShadowBanned: false,
                isSuspended: false,
                ...dateFilter,
            },
            select: {
                id: true,
                name: true,
                image: true,
                tier: true,
                credits: true,
                totalXP: true,
                reputation: true,
                streaks: {
                    select: {
                        currentStreak: true,
                        longestStreak: true,
                    },
                },
                _count: {
                    select: { achievementUnlocks: true },
                },
            },
            orderBy: { totalXP: "desc" },
            take: limit,
        });

        const leaderboard = users.map((user, index) => ({
            id: user.id,
            name: user.name ?? "Anonymous",
            image: user.image ?? null,
            tier: user.tier ?? "INITIATE",
            credits: user.credits ?? 0,
            totalXP: user.totalXP ?? 0,
            reputation: user.reputation ?? 0,
            totalAchievements: user._count.achievementUnlocks,
            rank: index + 1,
            streakInfo: {
                currentStreak: user.streaks?.currentStreak ?? 0,
                longestStreak: user.streaks?.longestStreak ?? 0,
            },
        }));

        return NextResponse.json(leaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}
