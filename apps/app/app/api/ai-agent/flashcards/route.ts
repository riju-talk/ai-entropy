import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { deductCredits } from "@/lib/gamification"

const prisma = new PrismaClient()

const AI_AGENT_URL = process.env.AI_AGENT_URL || "http://localhost:8000"

// Helper function for proxying requests
async function proxyRequest(endpoint: string, options: RequestInit) {
  const url = `${AI_AGENT_URL}${endpoint}`
  console.log("[PROXY]", options.method || "GET", url)

  const resp = await fetch(url, options)
  const text = await resp.text()

  try {
    return {
      body: text ? JSON.parse(text) : null,
      status: resp.status,
      isText: false,
    }
  } catch {
    return {
      body: text,
      status: resp.status,
      isText: true,
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[API][FLASHCARDS] POST request received");

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!AI_AGENT_URL) {
      return NextResponse.json({ error: "AI_AGENT_URL not configured" }, { status: 500 })
    }

    console.log("[API][FLASHCARDS] Forwarding to backend:", JSON.stringify(body))

    // Deduct 3 credits for Flashcards
    try {
      await deductCredits(user.id, 3, "AI Flashcard Generation")
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 402 }) // 402 Payment Required
    }

    const resp = await proxyRequest("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (resp.isText) {
      return new NextResponse(String(resp.body), { status: resp.status, headers: { "Content-Type": "text/plain" } })
    }
    return NextResponse.json(resp.body, { status: resp.status })
  } catch (err) {
    console.error("[API][FLASHCARDS] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
