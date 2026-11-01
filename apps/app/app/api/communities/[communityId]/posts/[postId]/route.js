import { NextResponse } from "next/server"

import { currentUser, HttpError, readJson, route } from "@/lib/api"
import { assertCanRead, authorSelect, findCommunity, isMod, membershipOf, toPost, viewerVotes } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function load(communityParam, postId) {
  const c = await findCommunity(communityParam)
  const post = await prisma.post.findFirst({
    where: { id: postId, communityId: c.id },
    include: { author: { select: authorSelect }, community: { select: { id: true, slug: true, name: true } } },
  })
  if (!post) throw new HttpError(404, "Post not found")
  return { c, post }
}

export const GET = route(async (_req, { params }) => {
  const user = await currentUser()
  const { c, post } = await load(params.communityId, params.postId)
  await assertCanRead(c, user)
  if (post.isRemoved) throw new HttpError(410, "This post was removed")
  const votes = await viewerVotes(user, [post.id])
  const membership = await membershipOf(user?.id, c.id)
  return NextResponse.json({ post: toPost(post, votes, { full: true }), canModerate: isMod(membership), isMember: !!membership })
})

/** Moderators pin or unpin. */
export const PATCH = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const { c, post } = await load(params.communityId, params.postId)
  if (!isMod(await membershipOf(user.id, c.id))) throw new HttpError(403, "Only moderators can pin posts")
  const { isPinned } = await readJson(req)
  const updated = await prisma.post.update({ where: { id: post.id }, data: { isPinned: !!isPinned } })
  return NextResponse.json({ isPinned: updated.isPinned })
})

/** The author or a moderator removes the post. */
export const DELETE = route(async (_req, { params }) => {
  const user = await currentUser({ required: true })
  const { c, post } = await load(params.communityId, params.postId)
  if (post.authorId !== user.id && !isMod(await membershipOf(user.id, c.id))) throw new HttpError(403, "You cannot remove this post")
  await prisma.post.update({ where: { id: post.id }, data: { isRemoved: true } })
  return NextResponse.json({ removed: true })
})
