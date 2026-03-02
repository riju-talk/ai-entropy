import { NextRequest, NextResponse } from "next/server"

// Resolve AI agent URL from multiple possible env names
const AI_AGENT_URL =
  process.env.AI_AGENT_URL ||
  process.env.NEXT_PUBLIC_SPARK_API_URL ||
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    console.log("[API][QUIZ] POST request received");
    
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    console.log("[API][QUIZ] Forwarding payload to backend:", JSON.stringify(body))

    const resp = await fetch(`${AI_AGENT_URL}/api/quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    console.log("[API][QUIZ] Backend response status:", resp.status)

    if (!resp.ok) {
      console.error("[API][QUIZ] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Quiz generation failed", details: text }, { status: resp.status })
    }

    try {
      const json = JSON.parse(text)
      return NextResponse.json(json, { status: 200 })
    } catch (parseErr) {
      console.error("[API][QUIZ] Failed to parse response:", parseErr)
      return new NextResponse(text, { status: 200, headers: { "Content-Type": "application/json" } })
    }
  } catch (err) {
    console.error("[API][QUIZ] Error:", err)
    return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 })
  }
}
