import { NextRequest, NextResponse } from "next/server"

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

async function upstream(path: string, init?: RequestInit) {
  const res = await fetch(`${AI_AGENT_URL}${path}`, { cache: "no-store", ...init })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } }
  catch { return { status: res.status, body: text, raw: true } }
}

/**
 * GET /api/ai-agent/mastery?action=...&user_id=X
 *   action=profile        → /api/mastery/profile/{user_id}
 *   action=cognitive-stats→ /api/mastery/cognitive-stats/{user_id}
 *   action=review-queue   → /api/mastery/review-queue/{user_id}
 *   (default)             → /api/mastery/profile/{user_id}
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = (url.searchParams.get("action") || "profile").toLowerCase()
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || ""
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    let path: string
    switch (action) {
      case "cognitive-stats":
        path = `/api/mastery/cognitive-stats/${encodeURIComponent(userId)}`; break
      case "review-queue":
        path = `/api/mastery/review-queue/${encodeURIComponent(userId)}`; break
      default:
        path = `/api/mastery/profile/${encodeURIComponent(userId)}`
    }

    const res = await upstream(path)
    if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
    return NextResponse.json(res.body, { status: res.status })
  } catch (err) {
    console.error("[API][MASTERY] GET Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/ai-agent/mastery?action=...
 *   action=attempt     → /api/mastery/attempt
 *   action=study-plan  → /api/mastery/study-plan
 *   (default)          → /api/mastery/attempt
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

    const url = new URL(req.url)
    const action = (url.searchParams.get("action") || "attempt").toLowerCase()
    const path = action === "study-plan" ? "/api/mastery/study-plan" : "/api/mastery/attempt"

    const res = await upstream(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
    return NextResponse.json(res.body, { status: res.status })
  } catch (err) {
    console.error("[API][MASTERY] POST Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
