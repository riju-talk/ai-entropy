"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { awardCredits } from "./credits"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

export async function createAnswer(doubtId: string, content: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const answer = await getPrisma().answer.create({
    data: {
      content,
      doubtId,
      authorId: session.user.id,
    },
  })

  revalidatePath(`/doubt/${doubtId}`)

  return answer
}

export async function acceptAnswer(answerId: string, doubtId: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  try {
    // Verify the doubt belongs to the current user
    const doubt = await getPrisma().doubt.findUnique({
      where: { id: doubtId },
      select: { authorId: true },
    })

    if (!doubt || doubt.authorId !== session.user.id) {
      throw new Error("Only the doubt author can accept answers")
    }

    // Get the answer to find the answerer's ID
    const answer = await getPrisma().answer.findUnique({
      where: { id: answerId },
      select: { userId: true },
    })

    if (!answer) {
      throw new Error("Answer not found")
    }

    // Mark answer as accepted
    await getPrisma().answer.update({
      where: { id: answerId },
      data: { isAccepted: true },
    })

    // Award 2 credits to the answerer for having their answer accepted
    await awardCredits(
      answer.userId,
      "ANSWER_ACCEPTED",
      2,
      `Answer accepted for doubt ${doubtId}`,
      doubtId
    )

    revalidatePath(`/doubt/${doubtId}`)

    return { success: true }
  } catch (error) {
    console.error("Accept answer error:", error)
    throw error
  }
}

export async function voteOnAnswer(answerId: string, voteType: "UP" | "DOWN") {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const existingVote = await getPrisma().answerVote.findUnique({
    where: {
      userId_answerId: {
        userId: session.user.id,
        answerId,
      },
    },
  })

  if (existingVote) {
    if (existingVote.type === voteType) {
      // Remove vote
      await getPrisma().answerVote.delete({
        where: { id: existingVote.id },
      })
    } else {
      // Change vote
      await getPrisma().answerVote.update({
        where: { id: existingVote.id },
        data: { type: voteType },
      })
    }
  } else {
    // New vote
    await getPrisma().answerVote.create({
      data: {
        userId: session.user.id,
        answerId,
        type: voteType,
      },
    })
  }

  // Recalculate answer score
  const votes = await getPrisma().answerVote.groupBy({
    by: ["type"],
    where: { answerId },
    _count: true,
  })

  const upvotes = votes.find((v) => v.type === "UP")?._count ?? 0
  const downvotes = votes.find((v) => v.type === "DOWN")?._count ?? 0

  const answer = await getPrisma().answer.update({
    where: { id: answerId },
    data: {
      upvotes,
      downvotes,
    },
    select: {
      doubtId: true,
      doubt: {
        select: {
          communityId: true,
        },
      },
    },
  })

  revalidatePath(`/doubt/${answer.doubtId}`)
  if (answer.doubt.communityId) {
    revalidatePath(`/communities/${answer.doubt.communityId}`)
  }

  return { success: true }
}
