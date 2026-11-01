export interface PostSummary {
  id: string
  title: string
  body: string | null
  url: string | null
  score: number
  commentCount: number
  isPinned: boolean
  createdAt: string
  author: { id: string; name: string | null; image: string | null }
  community?: { id: string; slug: string | null; name: string }
  myVote: number
}

export interface CommentData {
  id: string
  parentId: string | null
  body: string
  author: { id: string; name: string | null; image: string | null } | null
  score: number
  isRemoved: boolean
  createdAt: string
  myVote: number
}

export interface CommunityDetail {
  id: string
  slug: string | null
  name: string
  description: string | null
  subject: string | null
  rules: string[]
  isPublic: boolean
  createdAt: string
  memberCount: number
  postCount: number
  isMember: boolean
  role: "ADMIN" | "MODERATOR" | "MEMBER" | null
  moderators: { id: string; name: string | null; image: string | null; role: string }[]
}

export const postHref = (p: { id: string; community?: { id: string; slug: string | null } }, fallbackCommunity?: string) =>
  `/communities/${p.community?.slug ?? p.community?.id ?? fallbackCommunity}/posts/${p.id}`
