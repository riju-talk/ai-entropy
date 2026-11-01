import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { PointEventType } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError, toList } from "@/lib/http"
import { SORTS } from "@/lib/qa"
import { listDoubts } from "@/lib/doubts-list"
import { awardXP, checkAchievements } from "@/lib/gamification"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  title: z.string().trim().min(8, "at least 8 characters").max(200),
  content: z.string().trim().min(20, "describe your question (20+ characters)").max(10000),
  subject: z.string().trim().max(40).optional().default("OTHER"),
  tags: z.union([z.string(), z.array(z.string())]).optional().default([]),
  isAnonymous: z.boolean().optional().default(false),
})

// GET /api/doubts?page=&limit=&sort=newest|top|active|unanswered&subject=&tag=&q=
// Public list of standalone questions (community posts are listed in their community).
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 30)
    const sort = SORTS[searchParams.get("sort")] ? searchParams.get("sort") : "newest"
    const subject = (searchParams.get("subject") || "").trim().slice(0, 40)
    const tag = (searchParams.get("tag") || "").trim().slice(0, 40)
    const q = (searchParams.get("q") || "").trim().slice(0, 100)

    const session = await getServerSession(authOptions)
    const viewerId = session?.user?.id || null

    const result = await listDoubts({ page, limit, sort, subject, tag, q, viewerId })
    return NextResponse.json(result)
  } catch (err) {
    return serverError("DOUBTS_LIST", err)
  }
}

// POST /api/doubts   Create a question. Always creates: editing is PATCH /api/doubts/:id.
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, createSchema)
    if (response) return response

    const doubt = await prisma.doubt.create({
      data: {
        title: data.title,
        content: data.content,
        subject: data.subject || "OTHER",
        tags: toList(data.tags, { max: 5, itemMax: 30 }),
        isAnonymous: data.isAnonymous,
        authorId: auth.userId,
        isInCommunity: false,
      },
      select: { id: true, title: true, subject: true, tags: true, isAnonymous: true, createdAt: true },
    })

    // Rewards are best-effort: a failure there must not lose the question.
    if (!data.isAnonymous) {
      try {
        await awardXP(auth.userId, PointEventType.DOUBT_CREATED, { description: `Asked: ${data.title}` })
        await checkAchievements(auth.userId, PointEventType.DOUBT_CREATED)
      } catch (e) {
        console.error("[API][DOUBTS] reward failed:", e)
      }
    }
    return NextResponse.json(doubt, { status: 201 })
  } catch (err) {
    return serverError("DOUBTS_CREATE", err)
  }
}
