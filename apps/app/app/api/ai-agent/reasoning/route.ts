import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

// POST /api/ai-agent/reasoning  →  /api/reasoning/ask
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // Normalise field names — frontend may send question/user_prompt/prompt
    const payload = {
      question: body.question || body.user_prompt || body.prompt || "",
      user_id: body.user_id || body.userId || undefined,
      language: body.language || "en",
      include_hints: body.include_hints ?? true,
    }

    if (!payload.question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 })
    }

    const resp = await fetch(`${BACKEND_URL}/api/reasoning/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][REASONING] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Reasoning engine error", details: text }, { status: resp.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200, headers: { "Content-Type": "application/json" } })
    }
  } catch (err) {
    console.error("[API][REASONING] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
