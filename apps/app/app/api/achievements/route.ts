import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000";

/**
 * GET /api/achievements
 * Fetch all achievements with user unlock status from AI backend.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      // Return just the achievement definitions without user progress
      const resp = await fetch(`${AI_AGENT_URL}/api/gamification/achievements/anonymous`, {
        cache: "no-store",
      });
      if (resp.ok) {
        return NextResponse.json(await resp.json());
      }
      // Fallback: return empty list
      return NextResponse.json([]);
    }

    const resp = await fetch(
      `${AI_AGENT_URL}/api/gamification/achievements/${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );

    if (!resp.ok) {
      console.error("[API][ACHIEVEMENTS] Backend error:", resp.status);
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: resp.status });
    }

    return NextResponse.json(await resp.json());
  } catch (error) {
    console.error("Failed to fetch achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}
