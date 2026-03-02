"use server"

import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

const voteSchema = z.object({
  type: z.enum(["UP", "DOWN"]),
  doubtId: z.string().cuid().optional(),
  commentId: z.string().cuid().optional(),
})

export async function handleVote(formData: FormData) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const type = formData.get("type") as "UP" | "DOWN"
  const doubtId = formData.get("doubtId") as string
  const commentId = formData.get("commentId") as string

  const validatedData = voteSchema.parse({ type, doubtId, commentId })

  if (!doubtId && !commentId) {
    throw new Error("Either doubtId or commentId must be provided")
  }

  const existingVote = await getPrisma().vote.findFirst({
    where: {
      userId: session.user.id,
      ...(doubtId ? { doubtId } : {}),
      ...(commentId ? { commentId } : {}),
    },
  })

  // Begin transaction
  await getPrisma().$transaction(async (tx: any) => {
    if (existingVote) {
      if (existingVote.type === type) {
        // Remove vote if same type
        await tx.vote.delete({
          where: { id: existingVote.id },
        })
      } else {
        // Update vote type
        await tx.vote.update({
          where: { id: existingVote.id },
          data: { type },
        })
      }
    } else {
      // Create new vote
      await tx.vote.create({
        data: {
          type,
          userId: session.user.id,
          ...(doubtId ? { doubtId } : {}),
          ...(commentId ? { commentId } : {}),
        },
      })
    }

    // Update vote count
    const voteCount = await tx.vote.aggregate({
      where: doubtId ? { doubtId } : { commentId },
      _sum: {
        value: true,
      },
    })

    if (doubtId) {
      await tx.doubt.update({
        where: { id: doubtId },
        data: { votes: voteCount._sum.value || 0 },
      })
      revalidatePath(`/doubt/${doubtId}`)
    } else if (commentId) {
      const comment = await tx.comment.update({
        where: { id: commentId },
        data: { votes: voteCount._sum.value || 0 },
        select: { doubtId: true },
      })
      if (comment) {
        revalidatePath(`/doubt/${comment.doubtId}`)
      }
    }
  })

  return { success: true }
}
