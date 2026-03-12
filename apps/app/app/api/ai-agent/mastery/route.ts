import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";
const prisma = new PrismaClient()

async function tryUpstream(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
    ...init,
  })
  const text = await res.text()
  try { return { ok: true, status: res.status, body: JSON.parse(text) } }
  catch { return { ok: true, status: res.status, body: text, raw: true } }
}

// ── DB fallbacks ──────────────────────────────────────────────────────────────

async function dbProfile(userId: string) {
  const records = await prisma.masteryRecord.findMany({
    where: { userId },
    include: { concept: { select: { name: true, domain: true, difficulty: true } } },
    orderBy: { masteryScore: "desc" },
  })
  const avg = records.length
    ? records.reduce((s, r) => s + r.masteryScore, 0) / records.length
    : 0
  return {
    user_id: userId,
    total_concepts: records.length,
    average_mastery: Math.round(avg * 100) / 100,
    top_concepts: records.slice(0, 5).map((r) => ({
      concept: r.concept.name,
      domain: r.concept.domain,
      mastery_score: r.masteryScore,
      attempts: r.totalAttempts,
    })),
    weak_concepts: records
      .filter((r) => r.masteryScore < 0.5 && r.totalAttempts > 0)
      .slice(-5)
      .map((r) => ({
        concept: r.concept.name,
        domain: r.concept.domain,
        mastery_score: r.masteryScore,
      })),
  }
}

async function dbCognitiveStats(userId: string) {
  const records = await prisma.masteryRecord.findMany({ where: { userId } })
  const ledger = await prisma.xpLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const totalXp = ledger.reduce((s, r) => s + r.finalXP, 0)
  const masteredCount = records.filter((r) => r.masteryScore >= 0.8).length
  return {
    user_id: userId,
    total_xp: totalXp,
    concepts_mastered: masteredCount,
    concepts_in_progress: records.filter((r) => r.masteryScore > 0 && r.masteryScore < 0.8).length,
    total_attempts: records.reduce((s, r) => s + r.totalAttempts, 0),
    correct_attempts: records.reduce((s, r) => s + r.correctAttempts, 0),
  }
}

async function dbReviewQueue(userId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // >24 h since last seen
  const records = await prisma.masteryRecord.findMany({
    where: {
      userId,
      OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
      masteryScore: { lt: 0.9 },
    },
    include: { concept: { select: { name: true, domain: true, difficulty: true } } },
    orderBy: [{ masteryScore: "asc" }, { lastSeen: "asc" }],
    take: 20,
  })
  return {
    queue: records.map((r) => ({
      concept_id: r.conceptId,
      concept_name: r.concept.name,
      domain: r.concept.domain,
      difficulty: r.concept.difficulty,
      mastery_score: r.masteryScore,
      last_seen: r.lastSeen,
      total_attempts: r.totalAttempts,
    })),
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/ai-agent/mastery?action=...&user_id=X
 *   action=profile         → mastery profile summary
 *   action=cognitive-stats → XP / attempt stats
 *   action=review-queue    → spaced-repetition queue
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = (url.searchParams.get("action") || "profile").toLowerCase()
    const userId = url.searchParams.get("user_id") || url.searchParams.get("userId") || ""
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    // Try AI backend first
    const pathMap: Record<string, string> = {
      "cognitive-stats": `/api/mastery/cognitive-stats/${encodeURIComponent(userId)}`,
      "review-queue":    `/api/mastery/review-queue/${encodeURIComponent(userId)}`,
      "profile":         `/api/mastery/profile/${encodeURIComponent(userId)}`,
    }
    const path = pathMap[action] ?? pathMap["profile"]

    try {
      const res = await tryUpstream(path)
      if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
      return NextResponse.json(res.body, { status: res.status })
    } catch {
      // AI backend unavailable — fall back to DB
    }

    switch (action) {
      case "review-queue":    return NextResponse.json(await dbReviewQueue(userId))
      case "cognitive-stats": return NextResponse.json(await dbCognitiveStats(userId))
      default:                return NextResponse.json(await dbProfile(userId))
    }
  } catch (err) {
    console.error("[API][MASTERY] GET Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/ai-agent/mastery?action=...
 *   action=attempt     → /api/mastery/attempt
 *   action=study-plan  → /api/mastery/study-plan
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

    const url = new URL(req.url)
    const action = (url.searchParams.get("action") || "attempt").toLowerCase()
    const path = action === "study-plan" ? "/api/mastery/study-plan" : "/api/mastery/attempt"

    try {
      const res = await tryUpstream(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if ((res as any).raw) return new NextResponse(String(res.body), { status: res.status })
      return NextResponse.json(res.body, { status: res.status })
    } catch {
      // AI backend unavailable
      return NextResponse.json(
        { error: "AI backend unavailable", message: "Start the AI agent to use this feature." },
        { status: 503 }
      )
    }
  } catch (err) {
    console.error("[API][MASTERY] POST Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/ai-agent/mastery?user_id=X&concept=Y
 *   Removes a user's mastery record for a specific concept
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get("user_id") || ""
    const concept = url.searchParams.get("concept") || ""
    if (!userId || !concept) {
      return NextResponse.json({ error: "user_id and concept are required" }, { status: 400 })
    }
    const conceptRecord = await prisma.concept.findFirst({ where: { name: concept } })
    if (!conceptRecord) {
      return NextResponse.json({ deleted: false, message: "Concept not found" })
    }
    await prisma.masteryRecord.deleteMany({ where: { userId, conceptId: conceptRecord.id } })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error("[API][MASTERY] DELETE Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
