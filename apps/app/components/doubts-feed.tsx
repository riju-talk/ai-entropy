"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { DoubtCard, type DoubtSummary } from "@/components/doubt-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Sort = "newest" | "active" | "top" | "unanswered"

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "active", label: "Most answered" },
  { value: "top", label: "Top voted" },
  { value: "unanswered", label: "Unanswered" },
]

interface Page {
  doubts: DoubtSummary[]
  total: number
  page: number
  hasMore: boolean
}

/** Question list with sorting and "load more". The first page is rendered on the server. */
export function DoubtsFeed({ initial }: { initial: Page }) {
  const [sort, setSort] = useState<Sort>("newest")
  const [items, setItems] = useState(initial.doubts)
  const [total, setTotal] = useState(initial.total)
  const [page, setPage] = useState(initial.page)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const first = useRef(true)

  const fetchPage = useCallback(async (nextPage: number, nextSort: Sort) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/doubts?page=${nextPage}&limit=10&sort=${nextSort}`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data: Page = await res.json()
      setItems((prev) => (nextPage === 1 ? data.doubts : [...prev, ...data.doubts]))
      setTotal(data.total)
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void fetchPage(1, sort)
  }, [sort, fetchPage])

  return (
    <section aria-label="Questions">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-foreground/80 pb-2">
        <p className="eyebrow">
          {total.toLocaleString()} {total === 1 ? "question" : "questions"}
        </p>
        <div role="tablist" aria-label="Sort questions" className="flex gap-4">
          {SORTS.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={sort === s.value}
              onClick={() => setSort(s.value)}
              className={cn(
                "border-b-2 pb-0.5 text-sm transition-colors",
                sort === s.value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="border-b py-16 text-center">
          <h3 className="font-display text-xl">{sort === "unanswered" ? "Everything has an answer" : "No questions yet"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {sort === "unanswered" ? "Nothing is waiting for a reply right now." : "Ask the first one and start the conversation."}
          </p>
          {sort !== "unanswered" && (
            <Button asChild className="mt-4">
              <Link href="/ask">Ask a question</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("relative divide-y", loading && page === 1 && "opacity-60")}>
          {items.map((d) => (
            <DoubtCard key={d.id} doubt={d} />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Could not load questions.{" "}
          <button className="underline" onClick={() => fetchPage(sort === "newest" && page === 1 ? 1 : page + 1, sort)}>
            Retry
          </button>
        </p>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" disabled={loading} onClick={() => fetchPage(page + 1, sort)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </section>
  )
}
