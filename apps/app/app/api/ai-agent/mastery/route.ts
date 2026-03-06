import { NextRequest, NextResponse } from "next/server"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

// GET /api/ai-agent/mastery?user_id=xxx  →  /api/mastery/profile/{user_id}
export async function GET(req: NextRequest) {
  try {
    const userId = new URL(req.url).searchParams.get("user_id") || new URL(req.url).searchParams.get("userId")
    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    const resp = await fetch(`${AI_AGENT_URL}/api/mastery/profile/${encodeURIComponent(userId)}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][MASTERY] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Failed to fetch mastery profile" }, { status: resp.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200 })
    }
  } catch (err) {
    console.error("[API][MASTERY] GET Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/ai-agent/mastery  →  /api/mastery/attempt
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const resp = await fetch(`${AI_AGENT_URL}/api/mastery/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][MASTERY] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Failed to record attempt", details: text }, { status: resp.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200 })
    }
  } catch (err) {
    console.error("[API][MASTERY] POST Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
