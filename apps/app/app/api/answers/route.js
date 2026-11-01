import { NextResponse } from "next/server"
import { z } from "zod"
import { PointEventType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError } from "@/lib/http"
import { authorSelect } from "@/lib/qa"
import { awardXP } from "@/lib/gamification"

const createSchema = z.object({
  doubtId: z.string().min(1, "required"),
  content: z.string().trim().min(10, "write a bit more (10+ characters)").max(10000),
  isAiAssisted: z.boolean().optional().default(false),
})

// POST /api/answers   Answer a question.
export async function POST(req) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, createSchema)
    if (response) return response

    const doubt = await prisma.doubt.findUnique({
      where: { id: data.doubtId },
      select: { id: true, authorId: true },
    })
    if (!doubt) return NextResponse.json({ error: "Question not found" }, { status: 404 })

    const answer = await prisma.answer.create({
      data: {
        content: data.content,
        doubtId: doubt.id,
        authorId: auth.userId,
        isAiAssisted: data.isAiAssisted,
      },
      include: { author: { select: authorSelect } },
    })

    // Answering your own question earns nothing, so it cannot be used to farm points.
    if (doubt.authorId !== auth.userId) {
      try {
        await awardXP(auth.userId, PointEventType.COMMENT_CREATED, {
          isAiAssisted: data.isAiAssisted,
          description: `Answered question ${doubt.id}`,
        })
      } catch (e) {
        console.error("[API][ANSWERS] reward failed:", e)
      }
    }
    return NextResponse.json(answer, { status: 201 })
  } catch (err) {
    return serverError("ANSWERS_CREATE", err)
  }
}
