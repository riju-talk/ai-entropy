"use server"

import { getServerSession } from "next-auth"
import { PrismaClient } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

export async function handleVote(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("Authentication required")

  const type = formData.get("type") as "UP" | "DOWN"
  const doubtId = formData.get("doubtId") as string | null
  const answerId = (formData.get("commentId") || formData.get("answerId")) as string | null

  if (!doubtId && !answerId) throw new Error("Either doubtId or answerId must be provided")

  if (doubtId) {
    const existing = await getPrisma().doubtVote.findUnique({
      where: { userId_doubtId: { userId: session.user.id, doubtId } },
    })
    if (existing) {
      if (existing.type === type) {
        await getPrisma().doubtVote.delete({ where: { id: existing.id } })
      } else {
        await getPrisma().doubtVote.update({ where: { id: existing.id }, data: { type } })
      }
    } else {
      await getPrisma().doubtVote.create({ data: { type, userId: session.user.id, doubtId } })
    }
    const votes = await getPrisma().doubtVote.groupBy({ by: ["type"], where: { doubtId }, _count: true })
    await getPrisma().doubt.update({
      where: { id: doubtId },
      data: {
        upvotes: votes.find((v) => v.type === "UP")?._count ?? 0,
        downvotes: votes.find((v) => v.type === "DOWN")?._count ?? 0,
      },
    })
    revalidatePath(`/doubt/${doubtId}`)
  } else if (answerId) {
    const existing = await getPrisma().answerVote.findUnique({
      where: { userId_answerId: { userId: session.user.id, answerId } },
    })
    if (existing) {
      if (existing.type === type) {
        await getPrisma().answerVote.delete({ where: { id: existing.id } })
      } else {
        await getPrisma().answerVote.update({ where: { id: existing.id }, data: { type } })
      }
    } else {
      await getPrisma().answerVote.create({ data: { type, userId: session.user.id, answerId } })
    }
  }
}
