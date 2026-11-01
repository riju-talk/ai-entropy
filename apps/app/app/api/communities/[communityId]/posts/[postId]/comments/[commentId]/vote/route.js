import { NextResponse } from "next/server"

import { currentUser, HttpError, readJson, route } from "@/lib/api"
import { assertCanRead, findCommunity } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const POST = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const { value } = await readJson(req)
  if (![1, -1, 0].includes(value)) throw new HttpError(400, "value must be 1, -1 or 0")

  const c = await findCommunity(params.communityId)
  await assertCanRead(c, user)
  const comment = await prisma.comment.findFirst({
    where: { id: params.commentId, postId: params.postId, isRemoved: false, post: { communityId: c.id } },
    select: { id: true },
  })
  if (!comment) throw new HttpError(404, "Comment not found")

  const score = await prisma.$transaction(async (tx) => {
    if (value === 0) await tx.commentVote.deleteMany({ where: { commentId: comment.id, userId: user.id } })
    else {
      await tx.commentVote.upsert({
        where: { commentId_userId: { commentId: comment.id, userId: user.id } },
        update: { value },
        create: { commentId: comment.id, userId: user.id, value },
      })
    }
    const agg = await tx.commentVote.aggregate({ where: { commentId: comment.id }, _sum: { value: true } })
    const s = agg._sum.value ?? 0
    await tx.comment.update({ where: { id: comment.id }, data: { score: s } })
    return s
  })
  return NextResponse.json({ score, myVote: value })
})
