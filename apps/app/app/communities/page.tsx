"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Plus, TrendingUp, Clock, Loader2 } from "lucide-react"
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Communities</h1>
            <p className="text-muted-foreground">
              Join communities to connect with others and share knowledge
            </p>
          </div>
          <Button onClick={handleCreateCommunity}>
            <Plus className="mr-2 h-4 w-4" />
            Create Community
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map((community, index) => (
            <div
              key={community.id}
              ref={index === filteredCommunities.length - 1 ? lastElementRef : null}
            >
              <Link href={`/communities/${community.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xl mb-3">
                        {community.name[0].toUpperCase()}
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(community.createdAt), { addSuffix: true })}
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-1">{community.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {community.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>Community</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(community.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    {community.subject && (
                      <Badge variant="outline" className="mt-2">
                        {community.subject}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!initialLoading && filteredCommunities.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No communities found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
