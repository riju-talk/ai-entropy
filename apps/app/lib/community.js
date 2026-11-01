import { HttpError } from "@/lib/api"
import { prisma } from "@/lib/prisma"

export const MOD_ROLES = ["ADMIN", "MODERATOR"]

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
}

/** Look a community up by URL slug or id; throws 404 when it does not exist. */
export async function findCommunity(idOrSlug) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  })
  if (!community) throw new HttpError(404, "Community not found")
  return community
}

export async function membershipOf(userId, communityId) {
  if (!userId) return null
  return prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { role: true },
  })
}

/** Private communities are only readable by members. */
export async function assertCanRead(community, user) {
  if (community.isPublic) return
  const m = await membershipOf(user?.id, community.id)
  if (!m) throw new HttpError(403, "This community is private. Join to see its posts.")
}

export function isMod(membership) {
  return !!membership && MOD_ROLES.includes(membership.role)
}

/** Reddit-style "hot": votes count logarithmically, recency counts linearly (one point per ~12.5 h). */
export function hotScore(score, createdAt) {
  const order = Math.log10(Math.max(Math.abs(score), 1))
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0
  return sign * order + (new Date(createdAt).getTime() / 1000 - 1700000000) / 45000
}

export const authorSelect = { id: true, name: true, image: true }

export function excerpt(text, n = 280) {
  if (!text) return ""
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > n ? `${t.slice(0, n)}...` : t
}

/** Shape a post for the API; `votes` is a Map(postId -> value) for the viewer. */
export function toPost(p, votes, { full = false } = {}) {
  return {
    id: p.id,
    title: p.title,
    body: full ? p.body : excerpt(p.body),
    url: p.url,
    score: p.score,
    commentCount: p.commentCount,
    isPinned: p.isPinned,
    createdAt: p.createdAt,
    author: p.author,
    community: p.community ? { id: p.community.id, slug: p.community.slug, name: p.community.name } : undefined,
    myVote: votes?.get(p.id) ?? 0,
  }
}

export async function viewerVotes(user, postIds) {
  if (!user || postIds.length === 0) return new Map()
  const rows = await prisma.postVote.findMany({ where: { userId: user.id, postId: { in: postIds } }, select: { postId: true, value: true } })
  return new Map(rows.map((r) => [r.postId, r.value]))
}

/** Sort + paginate posts in memory (pinned first for hot/new). Fine for a bounded candidate window. */
export function rankPosts(posts, sort, page, limit) {
  const rank = {
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    top: (a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt),
    hot: (a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt),
  }[sort] || null
  const sorted = [...posts].sort((a, b) => (sort !== "top" ? Number(b.isPinned) - Number(a.isPinned) : 0) || (rank ? rank(a, b) : 0))
  const start = (page - 1) * limit
  return { items: sorted.slice(start, start + limit), total: sorted.length, hasMore: start + limit < sorted.length }
}
