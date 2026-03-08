import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/achievements
 * Fetch all achievements with user unlock status from the database.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    const achievements = await prisma.achievement.findMany({
      orderBy: { points: "asc" },
    });

    if (!userId) {
      return NextResponse.json(
        achievements.map((a) => ({ ...a, unlocked: false, progress: null }))
      );
    }

    const [unlocks, progressRows] = await Promise.all([
      prisma.achievementUnlock.findMany({ where: { userId } }),
      prisma.achievementProgress.findMany({ where: { userId } }),
    ]);

    const unlockedIds = new Set(unlocks.map((u) => u.achievementId));
    const progressByAchievement = new Map(
      progressRows.map((p) => [p.achievementId, p])
    );

    return NextResponse.json(
      achievements.map((a) => ({
        ...a,
        unlocked: unlockedIds.has(a.id),
        unlockedAt: unlocks.find((u) => u.achievementId === a.id)?.unlockedAt ?? null,
        progress: progressByAchievement.get(a.id) ?? null,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}
