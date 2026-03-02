import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = (searchParams.get("period") as "all" | "weekly" | "monthly") || "all";

        const leaderboard = await getLeaderboard(period);

        return NextResponse.json(leaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch leaderboard" },
            { status: 500 }
        );
    }
}
