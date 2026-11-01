import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { parseBody, serverError } from "@/lib/http"

const updateSchema = z.object({ content: z.string().trim().min(10).max(10000) })

async function ownAnswer(id, userId) {
  const answer = await prisma.answer.findUnique({ where: { id }, select: { authorId: true, doubtId: true } })
  if (!answer) return { response: NextResponse.json({ error: "Answer not found" }, { status: 404 }) }
  if (answer.authorId !== userId) {
    return { response: NextResponse.json({ error: "Only the author can change this answer" }, { status: 403 }) }
  }
  return { answer }
}

// PATCH /api/answers/:id   Edit your own answer.
export async function PATCH(req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const { data, response } = await parseBody(req, updateSchema)
    if (response) return response
    const own = await ownAnswer(params.id, auth.userId)
    if (own.response) return own.response

    const answer = await prisma.answer.update({ where: { id: params.id }, data: { content: data.content } })
    return NextResponse.json({ id: answer.id, content: answer.content })
  } catch (err) {
    return serverError("ANSWER_PATCH", err)
  }
}

// DELETE /api/answers/:id   Delete your own answer. If it was the accepted one, the question reopens.
export async function DELETE(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response
    const own = await ownAnswer(params.id, auth.userId)
    if (own.response) return own.response

    await prisma.$transaction(async (tx) => {
      const answer = await tx.answer.delete({ where: { id: params.id } })
      if (answer.isAccepted) {
        await tx.doubt.update({ where: { id: answer.doubtId }, data: { isResolved: false } })
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError("ANSWER_DELETE", err)
  }
}
