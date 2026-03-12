import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

// POST /api/ai-agent/evaluation  →  /api/evaluation/evaluate
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const resp = await fetch(`${BACKEND_URL}/api/evaluation/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][EVALUATION] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Evaluation failed", details: text }, { status: resp.status })
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: 200 })
    } catch {
      return new NextResponse(text, { status: 200, headers: { "Content-Type": "application/json" } })
    }
  } catch (err) {
    console.error("[API][EVALUATION] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
