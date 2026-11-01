import { NextResponse } from "next/server"

import { currentUser, HttpError, route } from "@/lib/api"
import { findCommunity, isMod, membershipOf } from "@/lib/community"
import { prisma } from "@/lib/prisma"

/** The author or a moderator removes a comment. Replies stay; only the text goes. */
export const DELETE = route(async (_req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  const comment = await prisma.comment.findFirst({
    where: { id: params.commentId, postId: params.postId, post: { communityId: c.id } },
    select: { id: true, authorId: true, isRemoved: true },
  })
  if (!comment) throw new HttpError(404, "Comment not found")
  if (comment.authorId !== user.id && !isMod(await membershipOf(user.id, c.id))) throw new HttpError(403, "You cannot remove this comment")
  if (!comment.isRemoved) {
    await prisma.$transaction([
      prisma.comment.update({ where: { id: comment.id }, data: { isRemoved: true } }),
      prisma.post.update({ where: { id: params.postId }, data: { commentCount: { decrement: 1 } } }),
    ])
  }
  return NextResponse.json({ removed: true })
})
