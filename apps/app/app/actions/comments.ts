"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import type { VoteType } from "@prisma/client"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

// In this codebase, "comments" are stored as Answers.
// These functions bridge the component API to the Answer model.

export async function createComment(formData: FormData) {
  const session = await getServerSession(authOptions)
  const content = formData.get("content") as string
  const doubtId = formData.get("doubtId") as string

  await getPrisma().answer.create({
    data: {
      content,
      doubtId,
      authorId: session?.user?.id || "",
    },
  })

  revalidatePath(`/doubt/${doubtId}`)
}

export async function voteOnComment(commentId: string, voteType: VoteType) {
  // commentId is an answerId in this schema
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Authentication required")

  const existing = await getPrisma().answerVote.findUnique({
    where: { userId_answerId: { userId: session.user.id, answerId: commentId } },
  })

  if (existing) {
    if (existing.type === voteType) {
      await getPrisma().answerVote.delete({ where: { id: existing.id } })
    } else {
      await getPrisma().answerVote.update({ where: { id: existing.id }, data: { type: voteType } })
    }
  } else {
    await getPrisma().answerVote.create({
      data: { type: voteType, userId: session.user.id, answerId: commentId },
    })
  }

  const votes = await getPrisma().answerVote.groupBy({
    by: ["type"],
    where: { answerId: commentId },
    _count: true,
  })
  const up = votes.find((v) => v.type === "UP")?._count ?? 0
  const down = votes.find((v) => v.type === "DOWN")?._count ?? 0

  const answer = await getPrisma().answer.update({
    where: { id: commentId },
    data: { upvotes: up, downvotes: down },
    select: { doubtId: true },
  })
  revalidatePath(`/doubt/${answer.doubtId}`)
}

export async function markCommentAsAccepted(commentId: string) {
  // commentId is an answerId in this schema
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Authentication required")

  const answer = await getPrisma().answer.findUnique({
    where: { id: commentId },
    select: { doubtId: true, doubt: { select: { authorId: true } } },
  })

  if (!answer || answer.doubt.authorId !== session.user.id) {
    throw new Error("Only the doubt author can mark answers as accepted")
  }

  await getPrisma().answer.updateMany({
    where: { doubtId: answer.doubtId, isAccepted: true },
    data: { isAccepted: false },
  })
  await getPrisma().answer.update({
    where: { id: commentId },
    data: { isAccepted: true },
  })
  await getPrisma().doubt.update({
    where: { id: answer.doubtId },
    data: { isResolved: true },
  })
  revalidatePath(`/doubt/${answer.doubtId}`)
}
