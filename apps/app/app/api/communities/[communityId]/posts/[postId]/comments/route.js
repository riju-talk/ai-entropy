import { NextResponse } from "next/server"

import { currentUser, HttpError, readJson, route } from "@/lib/api"
import { assertCanRead, authorSelect, findCommunity, membershipOf } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const MAX_DEPTH = 8

async function loadPost(communityParam, postId) {
  const c = await findCommunity(communityParam)
  const post = await prisma.post.findFirst({ where: { id: postId, communityId: c.id }, select: { id: true, isRemoved: true } })
  if (!post || post.isRemoved) throw new HttpError(404, "Post not found")
  return { c, post }
}

/** Flat list; the client nests it by parentId. Removed comments keep their place in the tree but lose their text. */
export const GET = route(async (_req, { params }) => {
  const user = await currentUser()
  const { c, post } = await loadPost(params.communityId, params.postId)
  await assertCanRead(c, user)

  const rows = await prisma.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    take: 1000,
    include: { author: { select: authorSelect } },
  })
  const mine = user
    ? await prisma.commentVote.findMany({ where: { userId: user.id, commentId: { in: rows.map((r) => r.id) } }, select: { commentId: true, value: true } })
    : []
  const myVote = new Map(mine.map((v) => [v.commentId, v.value]))

  return NextResponse.json({
    comments: rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      body: r.isRemoved ? "[removed]" : r.body,
      author: r.isRemoved ? null : r.author,
      score: r.score,
      isRemoved: r.isRemoved,
      createdAt: r.createdAt,
      myVote: myVote.get(r.id) ?? 0,
    })),
  })
})

export const POST = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const { c, post } = await loadPost(params.communityId, params.postId)
  if (!(await membershipOf(user.id, c.id))) throw new HttpError(403, "Join this community to comment")

  const { body, parentId } = await readJson(req)
  const text = String(body || "").trim()
  if (!text) throw new HttpError(400, "Write something first")
  if (text.length > 10000) throw new HttpError(400, "Comment is too long (10,000 characters max)")

  if (parentId) {
    // Walk up the chain to enforce the depth limit and that the parent belongs to this post.
    let depth = 1
    let cursor = await prisma.comment.findUnique({ where: { id: parentId }, select: { postId: true, parentId: true, isRemoved: true } })
    if (!cursor || cursor.postId !== post.id) throw new HttpError(404, "The comment you are replying to no longer exists")
    if (cursor.isRemoved) throw new HttpError(409, "You cannot reply to a removed comment")
    while (cursor.parentId && depth <= MAX_DEPTH) {
      cursor = await prisma.comment.findUnique({ where: { id: cursor.parentId }, select: { parentId: true } })
      depth++
    }
    if (depth > MAX_DEPTH) throw new HttpError(400, "This thread is nested too deeply. Reply higher up.")
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { postId: post.id, authorId: user.id, parentId: parentId || null, body: text },
      include: { author: { select: authorSelect } },
    })
    await tx.commentVote.create({ data: { commentId: created.id, userId: user.id, value: 1 } })
    await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } })
    return created
  })
  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        parentId: comment.parentId,
        body: comment.body,
        author: comment.author,
        score: 1,
        isRemoved: false,
        createdAt: comment.createdAt,
        myVote: 1,
      },
    },
    { status: 201 }
  )
})
