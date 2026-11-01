import Link from "next/link"
import { getServerSession } from "next-auth"
import { Users } from "lucide-react"

import { DoubtsFeed } from "@/components/doubts-feed"
import { Button } from "@/components/ui/button"
import { authOptions } from "@/lib/auth"
import { listDoubts } from "@/lib/doubts-list"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function loadHome(viewerId: string | null) {
  const empty = { doubts: [], total: 0, page: 1, totalPages: 1, hasMore: false }
  if (process.env.SKIP_DB === "true") return { feed: empty, communities: [], stats: { questions: 0, answers: 0, learners: 0 } }
  try {
    const [feed, communities, answers, learners] = await Promise.all([
      listDoubts({ page: 1, limit: 10, viewerId }),
      prisma.community.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, description: true },
      }),
      prisma.answer.count(),
      prisma.user.count(),
    ])
    return { feed, communities, stats: { questions: feed.total, answers, learners } }
  } catch (e) {
    console.error("[HomePage] load failed:", e)
    return { feed: empty, communities: [], stats: { questions: 0, answers: 0, learners: 0 } }
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const viewerId = (session?.user as { id?: string } | undefined)?.id ?? null
  const { feed, communities, stats } = await loadHome(viewerId)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10 border-b border-foreground/80 pb-8">
        <p className="eyebrow mb-3">
          {stats.learners > 0
            ? `${stats.learners.toLocaleString()} ${stats.learners === 1 ? "learner" : "learners"} / ${stats.answers.toLocaleString()} ${stats.answers === 1 ? "answer" : "answers"}`
            : "Open for questions"}
        </p>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">
            Stuck on something?
            <br />
            <span className="text-muted-foreground">Someone here isn&apos;t.</span>
          </h1>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/ask">Ask a question</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
        <DoubtsFeed initial={feed} />

        <aside aria-label="Communities" className="lg:pt-1">
          <div className="mb-3 flex items-baseline justify-between border-b border-foreground/80 pb-2">
            <h2 className="eyebrow text-foreground">New communities</h2>
            <Link href="/communities" className="font-mono text-xs text-primary hover:underline">
              all
            </Link>
          </div>
          {communities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet.{" "}
              <Link href="/create-community" className="text-primary hover:underline">
                Start one
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {communities.map((c: { id: string; name: string; description: string | null }) => (
                <li key={c.id}>
                  <Link href={`/communities/${c.id}`} className="group block py-3">
                    <span className="font-medium group-hover:text-primary">{c.name}</span>
                    {c.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{c.description}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
