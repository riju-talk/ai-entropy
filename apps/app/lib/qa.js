// Shared helpers for the question/answer API routes.
//
// Rule: public responses never contain email addresses, and anonymous questions never reveal
// their author (the author field is nulled on the server, not hidden in the UI).

/** The only author fields that may leave the server. */
export const authorSelect = { id: true, name: true, image: true }

export function toPublicDoubt(d, { viewerId = null } = {}) {
  const { author, answers, ...rest } = d
  const hideAuthor = d.isAnonymous && d.authorId !== viewerId
  return {
    ...rest,
    author: hideAuthor ? null : author,
    // the owner always knows their own anonymous post is theirs
    isMine: viewerId !== null && d.authorId === viewerId,
    ...(answers ? { answers } : {}),
  }
}

export const SORTS = {
  newest: { orderBy: { createdAt: "desc" } },
  top: { orderBy: [{ upvotes: "desc" }, { createdAt: "desc" }] },
  active: { orderBy: [{ answers: { _count: "desc" } }, { createdAt: "desc" }] },
  unanswered: { orderBy: { createdAt: "desc" }, where: { answers: { none: {} } } },
}

export function excerpt(text, max = 220) {
  const clean = String(text).replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}...` : clean
}
