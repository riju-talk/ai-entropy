import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, MessageSquare, Pin } from "lucide-react"

import { VoteControl } from "@/components/community/vote-control"
import { postHref, type PostSummary } from "@/components/community/types"

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** One post in a feed: vote column on the left, title and meta on the right. */
export function PostRow({ post, communityId, showCommunity = false }: { post: PostSummary; communityId?: string; showCommunity?: boolean }) {
  const href = postHref(post, communityId)
  const communityHref = post.community ? `/communities/${post.community.slug ?? post.community.id}` : undefined
  const votePath = `/api/communities/${post.community?.id ?? communityId}/posts/${post.id}/vote`

  return (
    <article className="group relative flex gap-3 py-4">
      <VoteControl url={votePath} score={post.score} myVote={post.myVote} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
          {post.isPinned && (
            <span className="flex items-center gap-1 text-success">
              <Pin className="h-3 w-3" /> pinned
            </span>
          )}
          {showCommunity && communityHref && (
            <Link href={communityHref} className="relative z-10 font-medium text-foreground hover:text-primary">
              c/{post.community?.slug ?? post.community?.name}
            </Link>
          )}
          <span>
            by{" "}
            <Link href={`/profile/${post.author.id}`} className="relative z-10 hover:text-foreground">
              {post.author.name || "Learner"}
            </Link>
          </span>
          <span aria-hidden>/</span>
          <time dateTime={post.createdAt}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</time>
        </div>

        <h3 className="mt-1 font-display text-xl leading-snug sm:text-2xl">
          <Link href={href} className="after:absolute after:inset-0 group-hover:text-primary">
            {post.title}
          </Link>
        </h3>

        {post.body && <p className="mt-1 line-clamp-2 text-muted-foreground">{post.body}</p>}

        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          {post.url && (
            <span className="flex items-center gap-1 font-mono text-xs">
              <ExternalLink className="h-3 w-3" /> {domain(post.url)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
            {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
          </span>
        </div>
      </div>
    </article>
  )
}
