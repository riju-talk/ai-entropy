import { NextResponse } from "next/server"

import { currentUser, HttpError, intParam, readJson, route } from "@/lib/api"
import { assertCanRead, authorSelect, findCommunity, membershipOf, rankPosts, toPost, viewerVotes } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const WINDOW = 300 // candidate posts considered when ranking

export const GET = route(async (req, { params }) => {
  const url = new URL(req.url)
  const sort = ["hot", "new", "top"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "hot"
  const page = intParam(url, "page", 1, { max: 1000 })
  const limit = intParam(url, "limit", 15, { max: 50 })

  const user = await currentUser()
  const c = await findCommunity(params.communityId)
  await assertCanRead(c, user)

  const posts = await prisma.post.findMany({
    where: { communityId: c.id, isRemoved: false },
    orderBy: { createdAt: "desc" },
    take: WINDOW,
    include: { author: { select: authorSelect }, community: { select: { id: true, slug: true, name: true } } },
  })
  const { items, total, hasMore } = rankPosts(posts, sort, page, limit)
  const votes = await viewerVotes(user, items.map((p) => p.id))
  return NextResponse.json({ posts: items.map((p) => toPost(p, votes)), total, page, hasMore, sort })
})

/** Create a post. You must have joined the community first, like on Reddit. */
export const POST = route(async (req, { params }) => {
  const user = await currentUser({ required: true })
  const c = await findCommunity(params.communityId)
  if (!(await membershipOf(user.id, c.id))) throw new HttpError(403, "Join this community to post in it")

  const body = await readJson(req)
  const title = String(body.title || "").trim()
  const text = String(body.body ?? body.content ?? "").trim()
  const link = String(body.url || "").trim()
  if (title.length < 3 || title.length > 300) throw new HttpError(400, "Title must be 3-300 characters")
  if (!text && !link) throw new HttpError(400, "Add some text or a link")
  if (text.length > 20000) throw new HttpError(400, "Post text is too long (20,000 characters max)")
  if (link && !/^https?:\/\/[^\s]+$/i.test(link)) throw new HttpError(400, "Link must start with http:// or https://")

  const post = await prisma.$transaction(async (tx) => {
    const p = await tx.post.create({
      data: { communityId: c.id, authorId: user.id, title, body: text || null, url: link || null },
      include: { author: { select: authorSelect }, community: { select: { id: true, slug: true, name: true } } },
    })
    await tx.postVote.create({ data: { postId: p.id, userId: user.id, value: 1 } }) // author's own upvote
    return p
  })
  return NextResponse.json({ post: toPost(post, new Map([[post.id, 1]]), { full: true }) }, { status: 201 })
})
