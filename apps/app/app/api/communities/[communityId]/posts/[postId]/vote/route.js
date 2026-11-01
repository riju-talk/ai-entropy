import { NextResponse } from "next/server"

import { currentUser, HttpError, readJson, route } from "@/lib/api"
import { assertCanRead, findCommunity } from "@/lib/community"
import { prisma } from "@/lib/prisma"

/** Body: { value: 1 | -1 | 0 }. 0 clears the vote. Returns the new score and the viewer's vote. */
export const POST = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const { value } = await readJson(req)
  if (![1, -1, 0].includes(value)) throw new HttpError(400, "value must be 1, -1 or 0")

  const c = await findCommunity(params.communityId)
  await assertCanRead(c, user)
  const post = await prisma.post.findFirst({ where: { id: params.postId, communityId: c.id, isRemoved: false }, select: { id: true } })
  if (!post) throw new HttpError(404, "Post not found")

  const score = await prisma.$transaction(async (tx) => {
    if (value === 0) await tx.postVote.deleteMany({ where: { postId: post.id, userId: user.id } })
    else {
      await tx.postVote.upsert({
        where: { postId_userId: { postId: post.id, userId: user.id } },
        update: { value },
        create: { postId: post.id, userId: user.id, value },
      })
    }
    const agg = await tx.postVote.aggregate({ where: { postId: post.id }, _sum: { value: true } })
    const s = agg._sum.value ?? 0
    await tx.post.update({ where: { id: post.id }, data: { score: s } })
    return s
  })
  return NextResponse.json({ score, myVote: value })
})
