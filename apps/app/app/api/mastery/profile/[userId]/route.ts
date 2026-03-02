import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow users to only access their own profile (unless admin in future)
    if (session?.user?.id !== params.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Forward the request to FastAPI backend
    const response = await fetch(
      `${AI_AGENT_URL}/api/mastery/profile/${params.userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("FastAPI mastery profile error:", error)
      return NextResponse.json(
        { error: "Failed to get mastery profile", details: error },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Mastery profile API error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
