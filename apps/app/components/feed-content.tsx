"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle, TrendingUp, Globe, BookOpen, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DoubtCard } from "@/components/doubt-card"

interface Community {
  id: string
  name: string
  description: string | null
  subject: string | null
  createdAt: string
}

interface Doubt {
  id: string
  title: string
  content: string
  subject: string
  tags: string[]
  isAnonymous: boolean
  createdAt: string
  upvotes: number
  downvotes: number
  isResolved?: boolean
  author?: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count: {
    answers: number
    votes: number
  }
}

export default function FeedContent() {
  const [recentCommunities, setRecentCommunities] = useState<Community[]>([])
  const [doubts, setDoubts] = useState<Doubt[]>([])
  const [loadingCommunities, setLoadingCommunities] = useState(true)
  const [loadingDoubts, setLoadingDoubts] = useState(true)

  useEffect(() => {
    fetchRecentCommunities()
    fetchDoubts()
  }, [])

  const fetchRecentCommunities = async () => {
    try {
      const response = await fetch("/api/communities/recent?limit=5")
      if (response.ok) {
        const data = await response.json()
        setRecentCommunities(data.communities)
      }
    } catch (error) {
      console.error("Failed to fetch recent communities:", error)
    } finally {
      setLoadingCommunities(false)
    }
  }

  const fetchDoubts = async () => {
    try {
      const response = await fetch("/api/doubts?limit=7")
      if (response.ok) {
        const data = await response.json()
        setDoubts(data.doubts)
      }
    } catch (error) {
      console.error("Failed to fetch doubts:", error)
    } finally {
      setLoadingDoubts(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <aside className="md:col-span-3">
          <Card className="border-neutral-200 mb-6">
            <CardContent className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/communities">
                  <Globe className="h-4 w-4 mr-2 text-blue-600" /> All Communities
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/classrooms">
                  <BookOpen className="h-4 w-4 mr-2 text-purple-600" /> My Classrooms
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/doubts/solved">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Solved Doubts
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/doubts/trending">
                  <TrendingUp className="h-4 w-4 mr-2 text-orange-600" /> Trending
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-neutral-200">
            <CardContent className="p-4">
              <h3 className="font-medium text-slate-800 mb-3">Popular Topics</h3>
              <div className="space-y-2">
                {popularTopics.map((topic) => (
                  <Button key={topic.id} variant="ghost" className="w-full justify-start text-sm" asChild>
                    <Link href={`/topics/${topic.slug}`}>
                      <span className="w-2 h-2 rounded-full bg-slate-700 mr-2"></span>
                      {topic.name}
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <div className="md:col-span-6 lg:col-span-7">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6 w-full grid grid-cols-4 h-auto">
              <TabsTrigger value="all" className="py-2">
                All Doubts
              </TabsTrigger>
              <TabsTrigger value="my-doubts" className="py-2">
                My Doubts
              </TabsTrigger>
              <TabsTrigger value="following" className="py-2">
                Following
              </TabsTrigger>
              <TabsTrigger value="unanswered" className="py-2">
                Unanswered
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0 space-y-4">
              {loadingDoubts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
              ) : (
                doubts.map((doubt) => (
                  <DoubtCard key={doubt.id} doubt={doubt} />
                ))
              )}
            </TabsContent>

            <TabsContent value="my-doubts" className="mt-0">
              <div className="text-center py-8">
                <p className="text-neutral-500">You haven't asked any doubts yet.</p>
                <Button className="bg-slate-700 hover:bg-slate-600 mt-4" asChild>
                  <Link href="/ask">Ask Your First Doubt</Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="following" className="mt-0">
              <div className="text-center py-8">
                <p className="text-neutral-500">Follow topics and users to see their content here.</p>
              </div>
            </TabsContent>

            <TabsContent value="unanswered" className="mt-0 space-y-4">
              {doubts
                .filter((doubt) => !doubt.isResolved)
                .map((doubt) => (
                  <DoubtCard key={doubt.id} doubt={doubt} />
                ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <aside className="md:col-span-3">
          {/* Global Stats */}
          <Card className="border-neutral-200 mb-6">
            <CardContent className="p-6">
              <h2 className="font-serif text-lg font-semibold text-slate-800 mb-4">Global Stats</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-slate-700">2.4M</p>
                  <p className="text-neutral-600 text-sm">Active Learners</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-700">847K</p>
                  <p className="text-neutral-600 text-sm">Doubts Resolved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-700">15K</p>
                  <p className="text-neutral-600 text-sm">Active Classrooms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NEW COMMUNITIES SECTION */}
          <Card className="border-neutral-200 mb-6">
            <CardContent className="p-6">
              <h2 className="font-serif text-lg font-semibold text-slate-800 mb-4">
                New Communities
              </h2>

              {loadingCommunities ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : recentCommunities.length > 0 ? (
                <div className="space-y-3">
                  {recentCommunities.map((community) => (
                    <Link key={community.id} href={`/communities/${community.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {community.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate mb-1">
                            {community.name}
                          </p>
                          {community.description && (
                            <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                              {community.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-neutral-400">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Community
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 text-center py-8">
                  No new communities yet
                </p>
              )}

              <Button variant="outline" className="w-full mt-4" size="sm" asChild>
                <Link href="/communities">View All Communities →</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Top Contributors */}
          <Card className="border-neutral-200">
            <CardContent className="p-6">
              <h2 className="font-serif text-lg font-semibold text-slate-800 mb-4">Top Contributors</h2>
              <div className="space-y-3">
                {contributors.map((contributor) => (
                  <div key={contributor.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-700">{contributor.initials}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{contributor.name}</p>
                        {contributor.isProfessor && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Prof</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">{contributor.reputation} reputation</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// Sample data
const popularTopics = [
  { id: "1", name: "Computer Science", slug: "computer-science" },
  { id: "2", name: "Mathematics", slug: "mathematics" },
  { id: "3", name: "Physics", slug: "physics" },
  { id: "4", name: "Data Science", slug: "data-science" },
  { id: "5", name: "Programming", slug: "programming" },
]

const contributors = [
  { id: "c1", name: "Prof. Michael Johnson", initials: "MJ", reputation: 15420, isProfessor: true },
  { id: "c2", name: "CodeMaster", initials: "CM", reputation: 8750, isProfessor: false },
  { id: "c3", name: "Dr. Lisa Wang", initials: "LW", reputation: 12300, isProfessor: true },
  { id: "c4", name: "AlgoExpert", initials: "AE", reputation: 6890, isProfessor: false },
]