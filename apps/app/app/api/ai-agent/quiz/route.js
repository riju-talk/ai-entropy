import { NextResponse } from "next/server"
import { aiFetch, requireUser } from "@/lib/ai-proxy"

export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { userId: sessionUserId } = auth
    console.log("[API][QUIZ] POST request received");

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const resp = await aiFetch("/api/quiz/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, sessionUserId)

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
