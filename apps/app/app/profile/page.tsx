"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  BookOpen, 
  MessageSquare, 
  Award, 
  Settings, 
  Calendar,
  MapPin,
  GraduationCap,
  Users,
  Trophy
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { EditProfileModal } from "@/components/edit-profile-modal"
import Link from "next/link"

interface UserProfile {
  id: string
  name: string | null
  email: string
  image: string | null
  bio: string | null
  university: string | null
  course: string | null
  year: number | null
  reputation: number
  createdAt: string
  doubts: Array<{
    id: string
    title: string
    createdAt: string
    _count: {
      answers: number
      votes: number
    }
  }>
  answers: Array<{
    id: string
    content: string
    createdAt: string
    doubt: {
      id: string
      title: string
    }
  }>
  communityMemberships: Array<{
    community: {
      id: string
      name: string
      description: string | null
      _count: {
        members: number
      }
    }
  }>
  _count: {
    doubts: number
    answers: number
    doubtVotes: number
    answerVotes: number
  }
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [recentDoubts, setRecentDoubts] = useState<UserProfile["doubts"] | null>(null)
  const [recentAnswers, setRecentAnswers] = useState<UserProfile["answers"] | null>(null)
  // lazy-loading state for doubts
  const [doubtsPage, setDoubtsPage] = useState(1)
  const [doubtsItems, setDoubtsItems] = useState<UserProfile["doubts"]>([])
  const [doubtsHasMore, setDoubtsHasMore] = useState(false)
  const [doubtsLoadingMore, setDoubtsLoadingMore] = useState(false)
  const doubtsSentinelRef = useRef<HTMLDivElement | null>(null)
  // lazy-loading state for answers
  const [answersPage, setAnswersPage] = useState(1)
  const [answersItems, setAnswersItems] = useState<UserProfile["answers"]>([])
  const [answersHasMore, setAnswersHasMore] = useState(false)
  const [answersLoadingMore, setAnswersLoadingMore] = useState(false)
  const answersSentinelRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)

  useEffect(() => {
    // Middleware handles auth redirect, so just wait for session
    if (status === "loading") return

    if (status === "authenticated" && session?.user?.email) {
      checkProfileAndFetch(session.user.email)
    }
  }, [status, session, router])

  const checkProfileAndFetch = async (email: string) => {
    try {
      setLoading(true)

      const response = await fetch("/api/users/me/profile")
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`)
      }

      const data = await response.json()
      setUser(data)
      // initialize lazy-loaded lists (page 1, show 3 items)
      try {
        setDoubtsPage(1)
        setDoubtsItems([])
        await loadDoubtsPage(1)
      } catch (e) {
        console.error("Failed to fetch recent doubts:", e)
        // fallback to any server-provided data
        try {
          const dRes = await fetch(`/api/users/me/doubts?limit=3`)
          if (dRes.ok) {
            const djson = await dRes.json()
            setDoubtsItems(djson.doubts || [])
            setDoubtsHasMore(djson.hasMore ?? false)
          }
        } catch (err) {
          console.error(err)
        }
      }

      try {
        setAnswersPage(1)
        setAnswersItems([])
        await loadAnswersPage(1)
      } catch (e) {
        console.error("Failed to fetch recent answers:", e)
        try {
          const aRes = await fetch(`/api/users/me/answers?limit=3`)
          if (aRes.ok) {
            const ajson = await aRes.json()
            setAnswersItems(ajson.answers || [])
            setAnswersHasMore(ajson.hasMore ?? false)
          }
        } catch (err) {
          console.error(err)
        }
      }
    } catch (error) {
      console.error("[Profile] Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadDoubtsPage(page: number) {
    setDoubtsLoadingMore(true)
    try {
      const res = await fetch(`/api/users/me/doubts?limit=3&page=${page}`)
      if (res.ok) {
        const json = await res.json()
        const items = json.doubts || []
        setDoubtsItems((prev) => (page === 1 ? items : [...prev, ...items]))
        setDoubtsHasMore(json.hasMore ?? false)
        setDoubtsPage(page)
      }
    } catch (err) {
      console.error("loadDoubtsPage error:", err)
    } finally {
      setDoubtsLoadingMore(false)
    }
  }

  async function loadAnswersPage(page: number) {
    setAnswersLoadingMore(true)
    try {
      const res = await fetch(`/api/users/me/answers?limit=3&page=${page}`)
      if (res.ok) {
        const json = await res.json()
        const items = json.answers || []
        setAnswersItems((prev) => (page === 1 ? items : [...prev, ...items]))
        setAnswersHasMore(json.hasMore ?? false)
        setAnswersPage(page)
      }
    } catch (err) {
      console.error("loadAnswersPage error:", err)
    } finally {
      setAnswersLoadingMore(false)
    }
  }

  // observe sentinel for doubts lazy-loading
  useEffect(() => {
    const node = doubtsSentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && doubtsHasMore && !doubtsLoadingMore) {
          loadDoubtsPage(doubtsPage + 1)
        }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [doubtsHasMore, doubtsLoadingMore, doubtsPage])

  // observe sentinel for answers lazy-loading
  useEffect(() => {
    const node = answersSentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && answersHasMore && !answersLoadingMore) {
          loadAnswersPage(answersPage + 1)
        }
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [answersHasMore, answersLoadingMore, answersPage])

  const handleProfileUpdate = () => {
    if (session?.user?.email) {
      checkProfileAndFetch(session.user.email)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="text-2xl">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h1 className="text-3xl font-bold">{user.name || "Anonymous User"}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                  <Button onClick={() => setEditModalOpen(true)} variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>

                {user.bio && (
                  <p className="text-muted-foreground mb-4">{user.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {user.university && (
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" />
                      {user.university}
                    </div>
                  )}
                  {user.course && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {user.course}
                      {user.year && ` - Year ${user.year}`}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <BookOpen className="h-8 w-8 mb-2 text-primary" />
                <div className="text-3xl font-bold">{user._count.doubts}</div>
                <div className="text-xs text-muted-foreground mt-1">Questions</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <MessageSquare className="h-8 w-8 mb-2 text-primary" />
                <div className="text-3xl font-bold">{user._count.answers}</div>
                <div className="text-xs text-muted-foreground mt-1">Answers</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Award className="h-8 w-8 mb-2 text-primary" />
                <div className="text-base font-medium">Gamification & rewards</div>
                <div className="text-xs text-muted-foreground mt-1">Badges & rewards coming soon</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Achievements & Badges</CardTitle>
              </div>
              <Link href="/profile/achievements">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                Earn badges and achievements by contributing to the community
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Questions</CardTitle>
            </CardHeader>
            <CardContent>
                {((doubtsItems.length ?? 0) === 0 && (recentDoubts?.length ?? 0) === 0 && (user.doubts?.length ?? 0) === 0) ? (
                  <div className="py-12 text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-4">No questions asked yet</p>
                    <Button onClick={() => router.push("/ask")}>Ask Your First Question</Button>
                  </div>
                ) : (
                    <div className="space-y-4 h-80 overflow-auto">
                    {(doubtsItems.length > 0 ? doubtsItems : (recentDoubts ?? user.doubts ?? [])).map((doubt) => (
                      <Link key={doubt.id} href={`/doubt/${doubt.id}`}>
                        <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <h3 className="font-semibold mb-2 line-clamp-2">{doubt.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{doubt._count.answers} answers</span>
                            <span>{doubt._count.votes} votes</span>
                            <span>{formatDistanceToNow(new Date(doubt.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                    <div ref={doubtsSentinelRef as any} />
                    {doubtsLoadingMore && <div className="py-2 text-center text-sm text-muted-foreground">Loading more...</div>}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Recent Answers */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Answers</CardTitle>
            </CardHeader>
            <CardContent>
                {((answersItems.length ?? 0) === 0 && (recentAnswers?.length ?? 0) === 0 && (user.answers?.length ?? 0) === 0) ? (
                  <div className="py-12 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No answers yet</p>
                  </div>
                ) : (
                    <div className="space-y-4 h-80 overflow-auto">
                    {(answersItems.length > 0 ? answersItems : (recentAnswers ?? user.answers ?? [])).map((answer) => (
                      <Link key={answer.id} href={`/doubt/${answer.doubt.id}`}>
                        <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <p className="text-sm text-muted-foreground mb-2">
                            Answered: {answer.doubt.title}
                          </p>
                          <p className="text-sm line-clamp-2">{answer.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </Link>
                    ))}
                    <div ref={answersSentinelRef as any} />
                    {answersLoadingMore && <div className="py-2 text-center text-sm text-muted-foreground">Loading more...</div>}
                  </div>
                )}
              </CardContent>
          </Card>
        </div>

        {/* Communities */}
        {(user.communityMemberships?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Communities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(user.communityMemberships ?? []).map(({ community }) => (
                  <Link key={community.id} href={`/communities/${community.id}`}>
                    <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{community.name}</h3>
                      </div>
                      {community.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {community.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {community._count.members} members
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <EditProfileModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        user={{
          name: user.name,
          bio: user.bio,
          university: user.university,
          course: user.course,
          year: user.year,
          image: user.image,
        }}
        onUpdate={handleProfileUpdate}
      />
    </div>
  )
}