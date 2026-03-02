import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// GET - List user's chat sessions
export async function GET(req: NextRequest) {
  try {
    console.log("[AI-AGENT][SESSIONS] GET called:", { url: req.url })
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.warn("[AI-AGENT][SESSIONS] Unauthorized request (no session)")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      console.warn("[AI-AGENT][SESSIONS] User not found:", session.user.email)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const sessionType = (searchParams.get("type") || null) as
      | "QA"
      | "MINDMAP"
      | "QUIZ"
      | "FLASHCARDS"
      | null

    console.log("[AI-AGENT][SESSIONS] Query params:", { sessionType })

    const sessions = await prisma.aIChatSession.findMany({
      where: {
        userId: user.id,
        ...(sessionType && { sessionType }),
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
            documents: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    console.log(`[AI-AGENT][SESSIONS] Returning ${sessions.length} sessions for user ${user.id}`)
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("[AI-AGENT][SESSIONS] Error fetching sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

// POST - Create new chat session
export async function POST(req: NextRequest) {
  try {
    console.log("[AI-AGENT][SESSIONS] POST called")
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.warn("[AI-AGENT][SESSIONS] Unauthorized POST (no session)")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      console.warn("[AI-AGENT][SESSIONS] User not found on POST:", session.user.email)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { sessionType, systemPrompt } = body || {}

    console.log("[AI-AGENT][SESSIONS] Creating session with body:", { sessionType })

    const chatSession = await prisma.aIChatSession.create({
      data: {
        userId: user.id,
        sessionType: sessionType || "QA",
        systemPrompt: systemPrompt || "You are a helpful AI tutor.",
      },
    })

    console.log("[AI-AGENT][SESSIONS] Created session:", chatSession.id)
    return NextResponse.json({ session: chatSession })
  } catch (error) {
    console.error("[AI-AGENT][SESSIONS] Error creating session:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
