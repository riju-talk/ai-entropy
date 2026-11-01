import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError } from "@/lib/http"

export const dynamic = "force-dynamic"

const voteSchema = z.object({ type: z.enum(["UP", "DOWN"]) })

// GET /api/answers/:id/vote -> { userVote: "UP" | "DOWN" | null }
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ userVote: null })
    const vote = await prisma.answerVote.findUnique({
      where: { userId_answerId: { userId, answerId: params.id } },
      select: { type: true },
    })
    return NextResponse.json({ userVote: vote?.type ?? null })
  } catch (err) {
    return serverError("ANSWER_VOTE_GET", err)
  }
}

// POST /api/answers/:id/vote { type }
// Same vote again removes it, the other direction switches it. The totals stored on the answer
// are recomputed in the same transaction so profile and ordering never drift from the votes.
export async function POST(req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, voteSchema)
    if (response) return response

    const result = await prisma.$transaction(async (tx) => {
      const answer = await tx.answer.findUnique({ where: { id: params.id }, select: { authorId: true } })
      if (!answer) return { status: 404, error: "Answer not found" }
      if (answer.authorId === auth.userId) return { status: 403, error: "You cannot vote on your own answer" }

      const key = { userId_answerId: { userId: auth.userId, answerId: params.id } }
      const existing = await tx.answerVote.findUnique({ where: key })
      let userVote = data.type
      if (!existing) {
        await tx.answerVote.create({ data: { userId: auth.userId, answerId: params.id, type: data.type } })
      } else if (existing.type === data.type) {
        await tx.answerVote.delete({ where: key })
        userVote = null
      } else {
        await tx.answerVote.update({ where: key, data: { type: data.type } })
      }

      const [upvotes, downvotes] = await Promise.all([
        tx.answerVote.count({ where: { answerId: params.id, type: "UP" } }),
        tx.answerVote.count({ where: { answerId: params.id, type: "DOWN" } }),
      ])
      await tx.answer.update({ where: { id: params.id }, data: { upvotes, downvotes } })
      return { status: 200, upvotes, downvotes, userVote }
    })

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, upvotes: result.upvotes, downvotes: result.downvotes, userVote: result.userVote })
  } catch (err) {
    return serverError("ANSWER_VOTE", err)
  }
}
