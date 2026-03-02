"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { createCommentSchema, voteSchema } from "@/lib/validations"
import type { VoteType } from "@prisma/client"

let __prisma__: PrismaClient | undefined;
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] });
  }
  return __prisma__;
}

export async function createComment(formData: FormData) {
  const session = await getServerSession(authOptions)

  const data = {
    content: formData.get("content") as string,
    doubtId: formData.get("doubtId") as string,
    parentId: (formData.get("parentId") as string) || undefined,
    isAnonymous: formData.get("isAnonymous") === "true",
  }

  const validatedData = createCommentSchema.parse(data)

  await getPrisma().comment.create({
    data: {
      ...validatedData,
      authorId: validatedData.isAnonymous ? null : session?.user?.id,
    },
  })

  revalidatePath(`/doubt/${validatedData.doubtId}`)
}

export async function voteOnComment(commentId: string, voteType: VoteType) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const validatedData = voteSchema.parse({ type: voteType, commentId })

  // Check if user already voted
  const existingVote = await getPrisma().vote.findUnique({
    where: {
      userId_commentId: {
        userId: session.user.id,
        commentId,
      },
    },
  })

  if (existingVote) {
    if (existingVote.type === voteType) {
      // Remove vote if same type
      await getPrisma().vote.delete({
        where: { id: existingVote.id },
      })
    } else {
      // Update vote type
      await getPrisma().vote.update({
        where: { id: existingVote.id },
        data: { type: voteType },
      })
    }
  } else {
    // Create new vote
    await getPrisma().vote.create({
      data: {
        type: voteType,
        userId: session.user.id,
        commentId,
      },
    })
  }

  // Update comment vote count
  const voteCount = await getPrisma().vote.aggregate({
    where: { commentId },
    _sum: {
      type: true,
    },
  })

  await getPrisma().comment.update({
    where: { id: commentId },
    data: { votes: voteCount._sum.type || 0 },
  })

  const comment = await getPrisma().comment.findUnique({
    where: { id: commentId },
    select: { doubtId: true },
  })

  if (comment) {
    revalidatePath(`/doubt/${comment.doubtId}`)
  }
}

export async function markCommentAsAccepted(commentId: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }

  const comment = await getPrisma().comment.findUnique({
    where: { id: commentId },
    include: {
      doubt: {
        select: {
          authorId: true,
          id: true,
        },
      },
    },
  })

  if (!comment || comment.doubt.authorId !== session.user.id) {
    throw new Error("Only the doubt author can mark answers as accepted")
  }

  // Unmark other accepted answers for this doubt
  await getPrisma().comment.updateMany({
    where: {
      doubtId: comment.doubtId,
      isAccepted: true,
    },
    data: {
      isAccepted: false,
    },
  })

  // Mark this comment as accepted
  await getPrisma().comment.update({
    where: { id: commentId },
    data: { isAccepted: true },
  })

  // Mark doubt as resolved
  await getPrisma().doubt.update({
    where: { id: comment.doubtId },
    data: { isResolved: true },
  })

  revalidatePath(`/doubt/${comment.doubtId}`)
}
