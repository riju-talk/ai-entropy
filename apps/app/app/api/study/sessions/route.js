import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"

const MAX_MINUTES = 180

// GET /api/study/sessions  -> recent sessions, today's total and the learner's running profile
export async function GET() {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [recent, today, profile, active] = await Promise.all([
      prisma.studySession.findMany({
        where: { userId: auth.userId },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      prisma.studySession.aggregate({
        where: { userId: auth.userId, startedAt: { gte: startOfDay } },
        _sum: { actualSeconds: true },
      }),
      prisma.learnerProfile.findUnique({ where: { userId: auth.userId } }),
      prisma.studySession.findFirst({
        where: { userId: auth.userId, endedAt: null },
        orderBy: { startedAt: "desc" },
      }),
    ])

    return NextResponse.json({
      recent,
      active,
      todaySeconds: today._sum.actualSeconds || 0,
      profile: profile && {
        totalFocusSeconds: profile.totalFocusSeconds,
        sessionsCompleted: profile.sessionsCompleted,
        topicSeconds: profile.topicSeconds,
      },
    })
  } catch (err) {
    console.error("[API][STUDY] GET failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/study/sessions  { topic, plannedMinutes }  -> start a focus interval.
// Any interval the user left running is closed first so there is only ever one active session.
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const body = await req.json().catch(() => null)
    const topic = String(body?.topic || "").trim().slice(0, 200)
    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 })
    const plannedMinutes = Math.min(Math.max(parseInt(body?.plannedMinutes, 10) || 25, 1), MAX_MINUTES)

    const stale = await prisma.studySession.findMany({ where: { userId: auth.userId, endedAt: null } })
    for (const s of stale) await finishSession(s, false)

    const created = await prisma.studySession.create({
      data: { userId: auth.userId, topic, plannedMinutes },
    })
    return NextResponse.json({ session: created }, { status: 201 })
  } catch (err) {
    console.error("[API][STUDY] POST failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/study/sessions  { id, completed }  -> stop an interval and fold it into the profile.
export async function PATCH(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const body = await req.json().catch(() => null)
    if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const session = await prisma.studySession.findFirst({ where: { id: String(body.id), userId: auth.userId } })
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    if (session.endedAt) return NextResponse.json({ session })

    const done = await finishSession(session, body.completed === true)
    return NextResponse.json({ session: done })
  } catch (err) {
    console.error("[API][STUDY] PATCH failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Server clock decides the duration (never trust the browser), capped at the planned length + 5 min.
async function finishSession(session, completed) {
  const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
  const actualSeconds = Math.max(0, Math.min(elapsed, session.plannedMinutes * 60 + 300))
  const isComplete = completed && actualSeconds >= session.plannedMinutes * 60 * 0.9

  const updated = await prisma.studySession.update({
    where: { id: session.id },
    data: { endedAt: new Date(), actualSeconds, completed: isComplete },
  })

  const profile = await prisma.learnerProfile.findUnique({ where: { userId: session.userId } })
  const topicSeconds = { ...(profile?.topicSeconds || {}) }
  topicSeconds[session.topic] = (topicSeconds[session.topic] || 0) + actualSeconds
  await prisma.learnerProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      totalFocusSeconds: actualSeconds,
      sessionsCompleted: isComplete ? 1 : 0,
      topicSeconds,
    },
    update: {
      totalFocusSeconds: { increment: actualSeconds },
      sessionsCompleted: { increment: isComplete ? 1 : 0 },
      topicSeconds,
    },
  })
  return updated
}
