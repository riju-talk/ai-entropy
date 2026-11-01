"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, Pin } from "lucide-react"

import { CommentTree } from "@/components/community/comment-tree"
import type { PostSummary } from "@/components/community/types"
import { VoteControl } from "@/components/community/vote-control"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ApiError, apiFetch } from "@/lib/client-api"

interface PostResponse {
  post: PostSummary
  canModerate: boolean
  isMember: boolean
}

export default function PostPage({ params }: { params: { communityId: string; postId: string } }) {
  const { communityId, postId } = params
  const [data, setData] = useState<PostResponse | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const router = useRouter()
  const { data: session } = useSession()
  const viewerId = (session?.user as { id?: string } | undefined)?.id
  const { toast } = useToast()
  const base = `/api/communities/${communityId}/posts/${postId}`

  useEffect(() => {
    apiFetch<PostResponse>(base)
      .then(setData)
      .catch((e: Error) => setError({ status: e instanceof ApiError ? e.status : 0, message: e.message }))
  }, [base])

  const act = async (fn: () => Promise<unknown>, failTitle: string) => {
    try {
      await fn()
    } catch (e) {
      toast({ title: failTitle, description: (e as Error).message, variant: "destructive" })
    }
  }

  if (error) {
    const gone = error.status === 404 || error.status === 410
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-3xl">{gone ? "This post is gone" : "Could not load this post"}</h1>
        <p className="mt-3 text-muted-foreground">{gone ? "It was removed or never existed." : error.message}</p>
        <Button asChild className="mt-6">
          <Link href={`/communities/${communityId}`}>Back to the community</Link>
        </Button>
      </div>
    )
  }
  if (!data) return <p className="py-16 text-center text-muted-foreground">Loading...</p>

  const { post, canModerate, isMember } = data
  const canRemove = canModerate || (!!viewerId && viewerId === post.author.id)

  return (
    <article className="mx-auto max-w-3xl">
      <nav className="mb-4 font-mono text-xs text-muted-foreground">
        <Link href={`/communities/${communityId}`} className="hover:text-foreground">
          c/{post.community?.slug ?? post.community?.name ?? communityId}
        </Link>
      </nav>

      <div className="flex gap-4">
        <VoteControl url={`${base}/vote`} score={post.score} myVote={post.myVote} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
            {post.isPinned && (
              <span className="flex items-center gap-1 text-success">
                <Pin className="h-3 w-3" /> pinned
              </span>
            )}
            <span>
              by{" "}
              <Link href={`/profile/${post.author.id}`} className="hover:text-foreground">
                {post.author.name || "Learner"}
              </Link>
            </span>
            <span aria-hidden>/</span>
            <time dateTime={post.createdAt}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</time>
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{post.title}</h1>

          {post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-2 break-all text-primary underline underline-offset-4">
              <ExternalLink className="h-4 w-4 shrink-0" /> {post.url}
            </a>
          )}
          {post.body && (
            <div className="mt-4">
              <Markdown>{post.body}</Markdown>
            </div>
          )}

          {canRemove && (
            <div className="mt-4 flex gap-3 text-sm text-muted-foreground">
              {canModerate && (
                <button
                  className="hover:text-foreground"
                  onClick={() =>
                    act(async () => {
                      const r = await apiFetch<{ isPinned: boolean }>(base, { method: "PATCH", json: { isPinned: !post.isPinned } })
                      setData({ ...data, post: { ...post, isPinned: r.isPinned } })
                    }, "Could not update pin")
                  }
                >
                  {post.isPinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button
                className="hover:text-destructive"
                onClick={() =>
                  act(async () => {
                    await apiFetch(base, { method: "DELETE" })
                    router.push(`/communities/${communityId}`)
                  }, "Could not remove post")
                }
              >
                Remove post
              </button>
            </div>
          )}
        </div>
      </div>

      <CommentTree communityId={communityId} postId={postId} isMember={isMember} canModerate={canModerate} onCountChange={setCount} />
      {count !== null && <span className="sr-only">{count} comments loaded</span>}
    </article>
  )
}
