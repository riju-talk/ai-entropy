"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DoubtCard } from "@/components/doubt-card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Doubt {
  id: string
  title: string
  content: string
  subject: string
  tags: string[]
  isAnonymous: boolean
  createdAt: Date
  author?: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count?: {
    answers: number
  }
}

interface DoubtsFeedProps {
  initialDoubts: Doubt[]
  currentPage: number
  totalPages: number
  hasMore: boolean
}

export function DoubtsFeed({ initialDoubts, currentPage, totalPages, hasMore }: DoubtsFeedProps) {
  const [doubts, setDoubts] = useState(initialDoubts)
  const [page, setPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<"all" | "trending" | "unanswered">("all")
  const router = useRouter()
  const searchParams = useSearchParams()
  const DOUBTS_PER_PAGE = 7
  const [localHasMore, setLocalHasMore] = useState(hasMore)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const loadMore = async () => {
    if (!localHasMore || loading) return

    setLoading(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", (page + 1).toString())

      const response = await fetch(`/api/doubt?${params.toString()}`)
      const data = await response.json()

      setDoubts([...doubts, ...data.doubts])
      setPage(page + 1)
      // update local hasMore if backend returns it
      if (typeof data.hasMore === "boolean") setLocalHasMore(data.hasMore)
    } catch (error) {
      console.error("Error loading more doubts:", error)
    } finally {
      setLoading(false)
    }
  }

  // Check if we need to show load more button
  const shouldShowLoadMore = () => {
    const displayedCount = doubts.length
    return hasMore && displayedCount % DOUBTS_PER_PAGE === 0 && filter === "all"
  }

  const getFilteredDoubts = () => {
    switch (filter) {
      case "trending":
        return [...doubts].sort((a, b) => (b._count?.answers || 0) - (a._count?.answers || 0))
      case "unanswered":
        return doubts.filter((d) => (d._count?.answers || 0) === 0)
      default:
        return doubts
    }
  }

  const filteredDoubts = getFilteredDoubts()

  // IntersectionObserver for infinite scroll
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading && localHasMore) {
            loadMore()
          }
        })
      },
      { root: null, rootMargin: "300px", threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, localHasMore])

  if (doubts.length === 0) {
    return (
      <div className="text-center py-16 border rounded-lg bg-card">
        <div className="text-5xl mb-4">💭</div>
        <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
        <p className="text-sm text-muted-foreground">Be the first to ask a question!</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {filter === "all" && `${doubts.length.toLocaleString()} questions`}
          {filter === "trending" && "Trending questions"}
          {filter === "unanswered" && `${doubts.filter((d) => (d._count?.answers || 0) === 0).length} unanswered questions`}
        </h2>

        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className="text-xs"
          >
            Newest
          </Button>
          <Button
            variant={filter === "trending" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("trending")}
            className="text-xs"
          >
            Active
          </Button>
          <Button
            variant={filter === "unanswered" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("unanswered")}
            className="text-xs"
          >
            Unanswered
          </Button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredDoubts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card/40 backdrop-blur-sm">
            No questions found
          </div>
        ) : (
          filteredDoubts.map((doubt) => (
            <DoubtCard key={doubt.id} doubt={doubt} />
          ))
        )}
      </div>

      {/* sentinel for intersection observer */}
      <div ref={sentinelRef} className="h-2" aria-hidden />

      {/* Load More */}
      {shouldShowLoadMore() && (
        <div className="flex justify-center pt-6">
          <Button onClick={loadMore} disabled={loading} variant="outline">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more questions"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
