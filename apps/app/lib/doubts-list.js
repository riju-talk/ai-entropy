import { prisma } from "@/lib/prisma"
import { authorSelect, excerpt, SORTS, toPublicDoubt } from "@/lib/qa"

/**
 * One page of standalone questions (community posts are listed inside their community).
 * Shared by GET /api/doubts and the server-rendered home page so they always agree.
 * Never returns email addresses, and hides the author of anonymous questions.
 */
/** @param {{ page?: number, limit?: number, sort?: string, subject?: string, tag?: string, q?: string, viewerId?: string | null }} [opts] */
export async function listDoubts({ page = 1, limit = 10, sort = "newest", subject = "", tag = "", q = "", viewerId = null } = {}) {
  const safeSort = SORTS[sort] ? sort : "newest"
  const where = { isInCommunity: false, ...(SORTS[safeSort].where || {}) }
  if (subject) where.subject = subject
  if (tag) where.tags = { has: tag }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.doubt.findMany({
      where,
      orderBy: SORTS[safeSort].orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        subject: true,
        tags: true,
        isAnonymous: true,
        isResolved: true,
        views: true,
        upvotes: true,
        downvotes: true,
        createdAt: true,
        authorId: true,
        author: { select: authorSelect },
        _count: { select: { answers: true } },
      },
    }),
    prisma.doubt.count({ where }),
  ])

  const totalPages = Math.max(Math.ceil(total / limit), 1)
  return {
    doubts: rows.map((r) => {
      const { content, authorId, ...rest } = toPublicDoubt(r, { viewerId })
      return JSON.parse(JSON.stringify({ ...rest, content: excerpt(content), isMine: viewerId !== null && authorId === viewerId }))
    }),
    total,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}
