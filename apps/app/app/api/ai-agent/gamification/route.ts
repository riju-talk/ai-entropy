import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

// POST /api/ai-agent/gamification  →  POST /api/gamification/event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const resp = await fetch(`${BACKEND_URL}/api/gamification/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][GAMIFICATION] Backend event error:", resp.status, text)
      return NextResponse.json(
        { error: "Failed to process gamification event", details: text },
        { status: resp.status }
      )
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200 })
    }
  } catch (err) {
    console.error("[API][GAMIFICATION] POST Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/ai-agent/gamification?user_id=xxx  →  GET /api/gamification/stats/{user_id}
export async function GET(req: NextRequest) {
  try {
    const userId =
      new URL(req.url).searchParams.get("user_id") ||
      new URL(req.url).searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    const resp = await fetch(
      `${BACKEND_URL}/api/gamification/stats/${encodeURIComponent(userId)}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][GAMIFICATION] Backend stats error:", resp.status, text)
      return NextResponse.json(
        { error: "Failed to fetch gamification stats" },
        { status: resp.status }
      )
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200 })
    }
  } catch (err) {
    console.error("[API][GAMIFICATION] GET Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
