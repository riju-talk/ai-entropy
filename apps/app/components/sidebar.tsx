"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavLinks } from "@/components/nav-links"

interface CommunitySummary {
  id: string
  name: string
}

/** Desktop navigation rail: primary links plus a short list of communities. */
export function Sidebar() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  // The AI study page needs the width for the chat, so the nav shrinks to an icon rail there
  const compact = usePathname()?.startsWith("/ai-agent") ?? false

  useEffect(() => {
    const ac = new AbortController()
    fetch("/api/communities", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCommunities(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "AbortError") console.error(err)
      })
    return () => ac.abort()
  }, [])

  return (
    <aside className={`hidden shrink-0 flex-col gap-6 border-r bg-background py-8 lg:flex ${compact ? "w-14 px-1" : "w-60 px-3"}`}>
      <NavLinks compact={compact} />
      {!compact && (

      <div>
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="eyebrow">Communities</span>
          <Link href="/create-community" className="font-mono text-xs text-primary hover:underline">
            New
          </Link>
        </div>
        {communities.length > 0 ? (
          <ul className="space-y-0.5">
            {communities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/communities/${c.id}`}
                  className="flex items-center gap-3 border-l-2 border-transparent px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 text-sm text-muted-foreground">No communities yet.</p>
        )}
      </div>
      )}
    </aside>
  )
}
