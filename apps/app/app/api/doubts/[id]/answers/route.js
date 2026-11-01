import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serverError } from "@/lib/http"
import { authorSelect } from "@/lib/qa"

export const dynamic = "force-dynamic"

// GET /api/doubts/:id/answers?page=&limit=   Accepted answer first, then most upvoted, then oldest.
export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 50)
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1)

    const session = await getServerSession(authOptions)
    const viewerId = session?.user?.id || null
    const where = { doubtId: params.id }
    const [total, answers] = await Promise.all([
      prisma.answer.count({ where }),
      prisma.answer.findMany({
        where,
        include: { author: { select: { ...authorSelect, reputation: true } } },
        orderBy: [{ isAccepted: "desc" }, { upvotes: "desc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Tell the signed-in viewer how they voted, so the client does not need a request per answer.
    const mine = viewerId
      ? await prisma.answerVote.findMany({
          where: { userId: viewerId, answerId: { in: answers.map((a) => a.id) } },
          select: { answerId: true, type: true },
        })
      : []
    const voteByAnswer = Object.fromEntries(mine.map((v) => [v.answerId, v.type]))

    const totalPages = Math.max(Math.ceil(total / limit), 1)
    return NextResponse.json({
      answers: answers.map((a) => ({ ...a, viewerVote: voteByAnswer[a.id] ?? null })),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    })
  } catch (err) {
    return serverError("DOUBT_ANSWERS", err)
  }
}
