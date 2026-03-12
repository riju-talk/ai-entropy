import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

export async function GET() {
	try {
		const session = await getServerSession(authOptions)

		if (!session?.user?.email) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const userId = (session.user as any).id
		if (!userId) {
			return NextResponse.json({ error: "User ID not found in session" }, { status: 400 })
		}

		const resp = await fetch(
			`${BACKEND_URL}/api/gamification/achievements/${encodeURIComponent(userId)}`,
			{ cache: "no-store" }
		)

		if (!resp.ok) {
			console.error("[API][ME/ACHIEVEMENTS] Backend error:", resp.status)
			return NextResponse.json({ error: "Failed to fetch achievements" }, { status: resp.status })
		}

		// AI backend returns a flat list of achievements with unlocked/unlocked_at fields.
		// Wrap it to match the existing response shape {achievements, badges}.
		const achievements = await resp.json()
		return NextResponse.json({ achievements, badges: [] })
	} catch (error) {
		console.error("Error fetching user achievements:", error)
		return NextResponse.json(
			{ error: "Failed to fetch achievements" },
			{ status: 500 }
		)
	}
}
