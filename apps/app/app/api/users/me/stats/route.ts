import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { checkDailyLogin, updateStreak } from "@/lib/gamification";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;

        if (!userId) {
            return NextResponse.json({ error: "User ID not found in session" }, { status: 400 });
        }

        // Trigger daily login and streak update
        await checkDailyLogin(userId);
        await updateStreak(userId);

        const stats = await prisma.userStat.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        credits: true,
                        reputation: true,
                        streaks: true,
                        tier: true,
                    },
                },
            },
        });

        if (!stats) {
            // Create default stats if they don't exist
            const newStats = await prisma.userStat.create({
                data: {
                    userId,
                    totalPoints: 0,
                    currentLevel: 1,
                },
                include: {
                    user: {
                        select: {
                            credits: true,
                            reputation: true,
                            streaks: true,
                            tier: true,
                        },
                    },
                },
            });
            return NextResponse.json(newStats);
        }

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
