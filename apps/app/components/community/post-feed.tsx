"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { PostRow } from "@/components/community/post-row"
import type { PostSummary } from "@/components/community/types"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/client-api"
import { cn } from "@/lib/utils"

type Sort = "hot" | "new" | "top"
const SORTS: Sort[] = ["hot", "new", "top"]

/**
 * Sortable, paginated list of posts from `endpoint` (e.g. /api/feed or /api/communities/x/posts).
 * `refreshKey` lets a parent force a reload after the user posts something.
 */
export function PostFeed({
  endpoint,
  communityId,
  showCommunity,
  extraParams = "",
  refreshKey = 0,
  empty,
}: {
  endpoint: string
  communityId?: string
  showCommunity?: boolean
  extraParams?: string
  refreshKey?: number
  empty?: React.ReactNode
}) {
  const [sort, setSort] = useState<Sort>("hot")
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiFetch<{ posts: PostSummary[]; hasMore: boolean }>(`${endpoint}?sort=${sort}&page=${nextPage}${extraParams}`)
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]))
        setHasMore(data.hasMore)
        setPage(nextPage)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [endpoint, sort, extraParams]
  )

  useEffect(() => {
    void load(1, true)
  }, [load, refreshKey])

  return (
    <section aria-label="Posts">
      <div role="tablist" aria-label="Sort posts" className="flex gap-4 border-b border-foreground/80 pb-2">
        {SORTS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={sort === s}
            onClick={() => setSort(s)}
            className={cn(
              "border-b-2 pb-0.5 text-sm capitalize transition-colors",
              sort === s ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm">
          {error}{" "}
          <button className="underline" onClick={() => load(1, true)}>
            Retry
          </button>
        </div>
      ) : posts.length === 0 && !loading ? (
        <div className="py-16 text-center text-muted-foreground">{empty ?? "Nothing here yet."}</div>
      ) : (
        <div className={cn("divide-y", loading && page === 1 && "opacity-60")}>
          {posts.map((p) => (
            <PostRow key={p.id} post={p} communityId={communityId} showCommunity={showCommunity} />
          ))}
        </div>
      )}

      {loading && posts.length === 0 && !error && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" disabled={loading} onClick={() => load(page + 1, false)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </section>
  )
}
