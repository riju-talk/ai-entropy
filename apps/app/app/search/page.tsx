"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, MessageSquare, Users, Calendar } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

interface SearchResults {
  doubts: Array<{
    id: string
    title: string
    content: string
    subject: string
    createdAt: string
    author: {
      name: string | null
      image: string | null
    }
    _count: {
      answers: number
    }
  }>
  communities: Array<{
    id: string
    name: string
    description: string | null
    _count: {
      members: number
    }
  }>
  users: Array<{
    id: string
    name: string | null
    email: string
    image: string | null
  }>
}

function SearchPageContent() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "doubts" | "communities" | "users">("all")

  useEffect(() => {
    const q = searchParams.get("q")
    if (q) {
      setQuery(q)
      performSearch(q)
    }
  }, [searchParams])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      } else {
        setResults({ doubts: [], communities: [], users: [] })
      }
    } catch (error) {
      console.error("Search error:", error)
      setResults({ doubts: [], communities: [], users: [] })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      window.history.pushState({}, "", `/search?q=${encodeURIComponent(query)}`)
      performSearch(query)
    }
  }

  const totalResults = results
    ? (results.doubts?.length || 0) + (results.communities?.length || 0) + (results.users?.length || 0)
    : 0

  const filteredDoubts = results?.doubts || []
  const filteredCommunities = results?.communities || []
  const filteredUsers = results?.users || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Search Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Search</h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search questions, topics, communities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </div>

        {/* Filter Tabs */}
        {results && (
          <div className="flex gap-2 border-b">
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              onClick={() => setActiveTab("all")}
              className="rounded-b-none"
            >
              All ({totalResults})
            </Button>
            <Button
              variant={activeTab === "doubts" ? "default" : "ghost"}
              onClick={() => setActiveTab("doubts")}
              className="rounded-b-none"
            >
              Questions ({filteredDoubts.length})
            </Button>
            <Button
              variant={activeTab === "communities" ? "default" : "ghost"}
              onClick={() => setActiveTab("communities")}
              className="rounded-b-none"
            >
              Communities ({filteredCommunities.length})
            </Button>
            <Button
              variant={activeTab === "users" ? "default" : "ghost"}
              onClick={() => setActiveTab("users")}
              className="rounded-b-none"
            >
              Users ({filteredUsers.length})
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* No Results */}
        {!loading && results && totalResults === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!loading && results && totalResults > 0 && (
          <div className="space-y-4">
            {/* Doubts/Questions */}
            {(activeTab === "all" || activeTab === "doubts") && filteredDoubts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Questions</h2>
                {filteredDoubts.map((doubt) => (
                  <Card key={doubt.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <Link href={`/doubt/${doubt.id}`}>
                        <CardTitle className="hover:text-primary transition-colors cursor-pointer">
                          {doubt.title}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{doubt.subject}</Badge>
                        <span>•</span>
                        <span>{doubt.author.name || "Anonymous"}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(doubt.createdAt), { addSuffix: true })}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{doubt.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{doubt._count.answers} answers</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Communities */}
            {(activeTab === "all" || activeTab === "communities") && filteredCommunities.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Communities</h2>
                {filteredCommunities.map((community) => (
                  <Card key={community.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <Link href={`/communities/${community.id}`}>
                        <CardTitle className="hover:text-primary transition-colors cursor-pointer">
                          {community.name}
                        </CardTitle>
                      </Link>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {community.description || "No description"}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{community._count.members} members</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Users */}
            {(activeTab === "all" || activeTab === "users") && filteredUsers.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Users</h2>
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="hover:border-primary transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {user.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-medium">{user.name || "Anonymous"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}
