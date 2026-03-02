import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkUserCredits } from "@/app/actions/credits"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { allowed: false, reason: "unauthenticated" },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { operation, cost } = body

    if (!operation || typeof cost !== "number") {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      )
    }

    const credits = await checkUserCredits(session.user.id)
    const allowed = credits >= cost

    return NextResponse.json({
      allowed,
      credits,
      cost,
      needsUpgrade: !allowed,
    })
  } catch (err) {
    console.error("credits/check error:", err)
    return NextResponse.json(
      { error: "Failed to check credits" },
      { status: 500 }
    )
  }
}
