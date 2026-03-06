"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Users, Search, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { formatDistanceToNow } from "date-fns"

interface Community {
  id: string
  name: string
  description: string | null
  subject: string | null
  createdAt: string
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const { data: session } = useSession()
  const { open: openAuthModal } = useAuthModal()

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return
      if (observerRef.current) observerRef.current.disconnect()

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1)
        }
      })

      if (node) observerRef.current.observe(node)
    },
    [loading, hasMore]
  )

  useEffect(() => {
    fetchCommunities()
  }, [page])

  const fetchCommunities = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/communities/recent?limit=12&page=${page}`)
      if (response.ok) {
        const data = await response.json()
        setCommunities((prev) => (page === 1 ? data.communities : [...prev, ...data.communities]))
        setHasMore(data.hasMore)
      }
    } catch (error) {
      console.error("Failed to fetch communities:", error)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const filteredCommunities = (communities || []).filter((community) =>
    community.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateCommunity = () => {
    if (!session) {
      openAuthModal()
      return
    }
    window.location.href = "/communities/create"
  }

  if (initialLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 space-y-4 font-mono animate-pulse">
        <div className="h-6 w-48 bg-white/5 rounded" />
        <div className="h-10 w-full bg-white/5 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-white/5 rounded-xl border border-white/5" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-mono">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENTROPY · COMMUNITIES</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Communities</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Join communities to connect with others and share knowledge
          </p>
        </div>
        <Button
          onClick={handleCreateCommunity}
          size="sm"
          className="font-mono text-[11px] uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Search communities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-white/8 bg-[#0d0d14]/80 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 text-foreground"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCommunities.map((community, index) => (
          <div
            key={community.id}
            ref={index === filteredCommunities.length - 1 ? lastElementRef : null}
          >
            <Link href={`/communities/${community.id}`}>
              <div className="rounded-xl border border-white/5 bg-[#0d0d14]/80 p-5 hover:border-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.06)] transition-all duration-300 cursor-pointer h-full flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-black text-base shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                    {community.name[0].toUpperCase()}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.12em] border border-white/8 text-muted-foreground px-2 py-0.5 rounded">
                    {formatDistanceToNow(new Date(community.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{community.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {community.description || "No description"}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-white/5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Community</span>
                  {community.subject && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="text-cyan-400/70">{community.subject}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      )}

      {!initialLoading && filteredCommunities.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-[#0d0d14]/80 p-12 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">
            NO_RESULTS
          </div>
          <p className="text-sm text-muted-foreground">No communities match your search</p>
        </div>
      )}
    </div>
  )
}
