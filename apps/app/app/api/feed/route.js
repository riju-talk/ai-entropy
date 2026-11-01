import { NextResponse } from "next/server"

import { currentUser, intParam, route } from "@/lib/api"
import { authorSelect, rankPosts, toPost, viewerVotes } from "@/lib/community"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET /api/feed?sort=hot|new|top&joined=1 — posts across public communities (or only the ones you joined). */
export const GET = route(async (req) => {
  const url = new URL(req.url)
  const sort = ["hot", "new", "top"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "hot"
  const page = intParam(url, "page", 1, { max: 1000 })
  const limit = intParam(url, "limit", 15, { max: 50 })
  const user = await currentUser()

  let communityFilter = { isPublic: true }
  if (url.searchParams.get("joined") === "1" && user) {
    const joined = await prisma.communityMember.findMany({ where: { userId: user.id }, select: { communityId: true } })
    communityFilter = { id: { in: joined.map((j) => j.communityId) } }
  }

  const posts = await prisma.post.findMany({
    where: { isRemoved: false, community: communityFilter },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { author: { select: authorSelect }, community: { select: { id: true, slug: true, name: true } } },
  })
  const { items, total, hasMore } = rankPosts(posts.map((p) => ({ ...p, isPinned: false })), sort, page, limit)
  const votes = await viewerVotes(user, items.map((p) => p.id))
  return NextResponse.json({ posts: items.map((p) => toPost(p, votes)), total, page, hasMore, sort })
})
