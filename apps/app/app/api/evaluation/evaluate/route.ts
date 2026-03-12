import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    // Forward the request to FastAPI backend
    const response = await fetch(`${BACKEND_URL}/api/evaluation/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_work: body.student_work,
        rubric: body.rubric,
        concept: body.concept,
        user_id: body.user_id || session?.user?.id || "anonymous",
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("FastAPI evaluation error:", error)
      return NextResponse.json(
        { error: "Failed to evaluate submission", details: error },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Evaluation API error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
