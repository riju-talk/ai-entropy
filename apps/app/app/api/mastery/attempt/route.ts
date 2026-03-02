import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Forward the request to FastAPI backend
    const response = await fetch(`${AI_AGENT_URL}/api/mastery/attempt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        concept: body.concept,
        is_correct: body.is_correct,
        hints_used: body.hints_used || 0,
        confidence: body.confidence || 0.8,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("FastAPI mastery error:", error)
      return NextResponse.json(
        { error: "Failed to record mastery attempt", details: error },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Mastery attempt API error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
