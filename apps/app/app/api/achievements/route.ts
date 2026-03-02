import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/achievements
 * Fetch all achievements from database
 */
export async function GET() {
  try {
    const achievements = await prisma.achievement.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        rarity: true,
        points: true,
        criteria: true,
        type: true,
      },
      orderBy: [
        { rarity: "asc" }, // COMMON first
        { points: "asc" }, // then by points
      ],
    });

    return NextResponse.json(achievements);
  } catch (error) {
    console.error("Failed to fetch achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
