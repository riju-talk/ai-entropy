import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { aiFetch } from "@/lib/ai-proxy"

export async function GET(
  request,
  { params }
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
    const response = await aiFetch(
      `/api/mastery/profile/${encodeURIComponent(params.userId)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
      session.user.id
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
  } catch (error) {
    console.error("Mastery profile API error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
