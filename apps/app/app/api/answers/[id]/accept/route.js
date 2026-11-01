import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/ai-proxy"
import { serverError } from "@/lib/http"
import { awardCredits } from "@/app/actions/credits"

// POST /api/answers/:id/accept
// The question's author picks the answer that solved it. Exactly one answer is accepted at a time;
// choosing another moves the mark. Credits are paid once per answer, never for accepting your own.
export async function POST(_req, { params }) {
  try {
    const auth = await requireUser()
    if (auth.response) return auth.response

    const result = await prisma.$transaction(async (tx) => {
      const answer = await tx.answer.findUnique({
        where: { id: params.id },
        include: { doubt: { select: { id: true, authorId: true } } },
      })
      if (!answer) return { status: 404, error: "Answer not found" }
      if (answer.doubt.authorId !== auth.userId) {
        return { status: 403, error: "Only the question's author can accept an answer" }
      }
      if (answer.isAccepted) return { status: 200, accepted: true, paid: false, answer }

      await tx.answer.updateMany({ where: { doubtId: answer.doubtId, isAccepted: true }, data: { isAccepted: false } })
      await tx.answer.update({ where: { id: answer.id }, data: { isAccepted: true } })
      await tx.doubt.update({ where: { id: answer.doubtId }, data: { isResolved: true } })
      return { status: 200, accepted: true, paid: answer.authorId !== auth.userId, answer }
    })

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })

    if (result.paid) {
      // Only reward the first time this answer is accepted.
      const marker = `answer:${result.answer.id}`
      const already = await prisma.pointsLedger.findFirst({
        where: { userId: result.answer.authorId, eventType: "ANSWER_ACCEPTED", description: { contains: marker } },
        select: { id: true },
      })
      if (!already) {
        try {
          await awardCredits(
            result.answer.authorId,
            "ANSWER_ACCEPTED",
            2,
            `Your answer was accepted (${marker})`,
            result.answer.doubtId
          )
        } catch (e) {
          console.error("[API][ACCEPT] credit award failed:", e)
        }
      }
    }
    return NextResponse.json({ accepted: true })
  } catch (err) {
    return serverError("ANSWER_ACCEPT", err)
  }
}
