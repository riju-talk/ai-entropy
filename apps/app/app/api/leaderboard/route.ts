import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get("limit") || "100";

        const resp = await fetch(
            `${AI_AGENT_URL}/api/gamification/leaderboard/xp?limit=${limit}`,
            { cache: "no-store" }
        );

        if (!resp.ok) {
            console.error("[API][LEADERBOARD] Backend error:", resp.status);
            return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: resp.status });
        }

        const data = await resp.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}
