"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Lock } from "lucide-react"

import { JoinButton } from "@/components/community/join-button"
import { PostComposer } from "@/components/community/post-composer"
import { PostFeed } from "@/components/community/post-feed"
import type { CommunityDetail } from "@/components/community/types"
import { Button } from "@/components/ui/button"
import { ApiError, apiFetch } from "@/lib/client-api"

export default function CommunityPage({ params }: { params: { communityId: string } }) {
  const [c, setC] = useState<CommunityDetail | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    apiFetch<CommunityDetail>(`/api/communities/${params.communityId}`)
      .then(setC)
      .catch((e: Error) => setError({ status: e instanceof ApiError ? e.status : 0, message: e.message }))
  }, [params.communityId])

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-3xl">{error.status === 404 ? "No such community" : "Could not load this community"}</h1>
        <p className="mt-3 text-muted-foreground">{error.status === 404 ? "It may have been renamed or never existed." : error.message}</p>
        <Button asChild className="mt-6">
          <Link href="/communities">Browse communities</Link>
        </Button>
      </div>
    )
  }
  if (!c) return <p className="py-16 text-center text-muted-foreground">Loading...</p>

  const canRead = c.isPublic || c.isMember

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-foreground/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-2">
            {!c.isPublic && <Lock className="h-3 w-3" />} c/{c.slug ?? c.id}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">{c.name}</h1>
        </div>
        <JoinButton communityId={c.id} isMember={c.isMember} onChange={(m) => setC((prev) => (prev ? { ...prev, isMember: m.isMember, role: m.role as CommunityDetail["role"], memberCount: m.memberCount } : prev))} />
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div>
          {canRead ? (
            <>
              <PostComposer communityId={c.id} isMember={c.isMember} onPosted={() => setRefresh((n) => n + 1)} />
              <PostFeed endpoint={`/api/communities/${c.id}/posts`} communityId={c.id} refreshKey={refresh} empty="No posts yet. Start the first discussion." />
            </>
          ) : (
            <div className="border-b py-16 text-center text-muted-foreground">This community is private. Join to see its posts.</div>
          )}
        </div>

        <aside aria-label="About this community" className="space-y-8 text-sm">
          <section>
            <h2 className="eyebrow mb-2 border-b border-foreground/80 pb-2 text-foreground">About</h2>
            {c.description && <p className="text-muted-foreground">{c.description}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-y-3 font-mono text-xs">
              <div>
                <dt className="text-muted-foreground">Members</dt>
                <dd className="text-base text-foreground">{c.memberCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Posts</dt>
                <dd className="text-base text-foreground">{c.postCount.toLocaleString()}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">{format(new Date(c.createdAt), "d MMM yyyy")}</dd>
              </div>
            </dl>
          </section>

          {c.rules.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 border-b border-foreground/80 pb-2 text-foreground">Rules</h2>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                {c.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </section>
          )}

          {c.moderators.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2 border-b border-foreground/80 pb-2 text-foreground">Moderators</h2>
              <ul className="space-y-1">
                {c.moderators.map((m) => (
                  <li key={m.id}>
                    <Link href={`/profile/${m.id}`} className="hover:text-primary">
                      {m.name || "Learner"}
                    </Link>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{m.role.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
