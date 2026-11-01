"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"

import { JoinButton } from "@/components/community/join-button"
import { PostFeed } from "@/components/community/post-feed"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/client-api"
import { cn } from "@/lib/utils"

interface CommunityCard {
  id: string
  slug: string | null
  name: string
  description: string | null
  memberCount: number
  isMember: boolean
}

export default function CommunitiesPage() {
  const { status } = useSession()
  const [scope, setScope] = useState<"all" | "joined">("all")
  const [q, setQ] = useState("")
  const [list, setList] = useState<CommunityCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    const t = setTimeout(() => {
      apiFetch<CommunityCard[]>(`/api/communities?limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}`)
        .then((d) => {
          setList(d)
          setError(null)
        })
        .catch((e: Error) => setError(e.message))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, status])

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-foreground/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Communities</p>
          <h1 className="font-display text-4xl sm:text-5xl">Find your people.</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/create-community">Create a community</Link>
        </Button>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          {status === "authenticated" && (
            <div className="mb-4 flex gap-4 text-sm">
              {(["all", "joined"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={cn("border-b-2 pb-0.5", scope === s ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {s === "all" ? "Everything" : "Joined only"}
                </button>
              ))}
            </div>
          )}
          <PostFeed
            key={scope}
            endpoint="/api/feed"
            showCommunity
            extraParams={scope === "joined" ? "&joined=1" : ""}
            empty={scope === "joined" ? "Join a community and its posts will show up here." : "No posts yet. Be the first to start a discussion."}
          />
        </div>

        <aside aria-label="Communities">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search communities" aria-label="Search communities" className="mb-4" />
          <h2 className="eyebrow mb-1 border-b border-foreground/80 pb-2 text-foreground">{q ? "Results" : "Popular"}</h2>
          {error ? (
            <p role="alert" className="py-4 text-sm text-destructive">
              {error}
            </p>
          ) : list === null ? (
            <p className="py-4 text-sm text-muted-foreground">Loading...</p>
          ) : list.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{q ? "No communities match that search." : "No communities yet."}</p>
          ) : (
            <ul className="divide-y">
              {list.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <Link href={`/communities/${c.slug ?? c.id}`} className="group min-w-0">
                    <span className="block truncate font-medium group-hover:text-primary">c/{c.slug ?? c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.memberCount.toLocaleString()} {c.memberCount === 1 ? "member" : "members"}</span>
                    {c.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{c.description}</span>}
                  </Link>
                  <JoinButton communityId={c.id} isMember={c.isMember} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
