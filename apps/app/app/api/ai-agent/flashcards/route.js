import { NextResponse } from "next/server"
import { aiFetch, requireUser } from "@/lib/ai-proxy"

export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || !String(body.topic || "").trim()) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 })
    }

    const resp = await aiFetch(
      "/api/flashcards/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: String(body.topic).trim(),
          count: Number(body.count) || 10,
          customPrompt: body.customPrompt || undefined,
        }),
      },
      auth.userId
    )

    const text = await resp.text()
    if (!resp.ok) {
      console.error("[API][FLASHCARDS] Backend error:", resp.status, text)
      return NextResponse.json({ error: "Flashcard generation failed" }, { status: resp.status })
    }
    return new NextResponse(text, { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error("[API][FLASHCARDS] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
