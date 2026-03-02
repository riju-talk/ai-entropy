"use client"

import { Card, CardContent, CardHeader } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Share2, Bookmark, Flag, ArrowUp, ArrowDown, Clock, User } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getSubjectColor } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { AuthModal } from "@/components/auth-modal"

interface Answer {
  id: string
  content: string
  createdAt: string
  author: {
    name: string | null
    image: string | null
  }
}

interface DoubtDetailProps {
  doubt: {
    id: string
    title: string
    content: string
    subject: string
    tags: string[]
    isAnonymous: boolean
    createdAt: string
    author: {
      name: string | null
      image: string | null
    }
    _count: {
      answers: number
      votes: number
    }
  }
  answers?: Answer[]
}

export function DoubtDetail({ doubt, answers = [] }: DoubtDetailProps) {
  const { data: session, status } = useSession()
  const [upvotes, setUpvotes] = useState(doubt.upvotes)
  const [downvotes, setDownvotes] = useState(doubt.downvotes)
  const [userVote, setUserVote] = useState<"UP" | "DOWN" | null>(null)
  const [loadingVote, setLoadingVote] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { toast } = useToast()

  const netVotes = upvotes - downvotes
  const isAuthenticated = status === "authenticated"

  // Fetch user's existing vote on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setLoadingVote(false)
      return
    }

    const fetchUserVote = async () => {
      try {
        const response = await fetch(`/api/doubts/${doubt.id}/vote`)
        const data = await response.json()
        setUserVote(data.userVote)
      } catch (error) {
        console.error("Error fetching user vote:", error)
      } finally {
        setLoadingVote(false)
      }
    }

    fetchUserVote()
  }, [doubt.id, isAuthenticated])

  const handleVote = async (type: "UP" | "DOWN") => {
    // Check authentication
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    if (loadingVote) return

    const previousUpvotes = upvotes
    const previousDownvotes = downvotes
    const previousUserVote = userVote
    
    // Optimistic update
    if (userVote === type) {
      if (type === "UP") {
        setUpvotes(upvotes - 1)
      } else {
        setDownvotes(downvotes - 1)
      }
      setUserVote(null)
    } else {
      if (userVote === "UP") {
        setUpvotes(upvotes - 1)
        setDownvotes(downvotes + 1)
      } else if (userVote === "DOWN") {
        setDownvotes(downvotes - 1)
        setUpvotes(upvotes + 1)
      } else {
        if (type === "UP") {
          setUpvotes(upvotes + 1)
        } else {
          setDownvotes(downvotes + 1)
        }
      }
      setUserVote(type)
    }

    try {
      const response = await fetch(`/api/doubts/${doubt.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) throw new Error("Failed to vote")

      const data = await response.json()
      setUpvotes(data.upvotes)
      setDownvotes(data.downvotes)
    } catch (error) {
      setUpvotes(previousUpvotes)
      setDownvotes(previousDownvotes)
      setUserVote(previousUserVote)
      toast({
        title: "Error",
        description: "Failed to vote",
        variant: "destructive",
      })
    }
  }

  // Answer submission is handled by the AnswersSection component on the page

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      COMPUTER_SCIENCE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      MATHEMATICS: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      PHYSICS: "bg-green-500/10 text-green-500 border-green-500/20",
      CHEMISTRY: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      OTHER: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    }
    return colors[subject] || colors.OTHER
  }

  return (
    <>
      <div className="bg-card rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-6 p-4 sm:p-8">
          {/* Vote Column */}
          <div className="flex flex-row sm:flex-col items-center gap-2">
            <Button
              variant={userVote === "UP" ? "default" : "ghost"}
              size="sm"
              className={`h-10 w-10 p-0 ${userVote === "UP" ? "bg-orange-500 hover:bg-orange-600" : ""}`}
              onClick={() => handleVote("UP")}
              disabled={loadingVote}
            >
              <ArrowUp className={`h-5 w-5 ${userVote === "UP" ? "fill-current" : ""}`} />
            </Button>
            <span className={`text-2xl font-bold ${
              netVotes > 0 ? "text-orange-500" : netVotes < 0 ? "text-blue-500" : ""
            }`}>
              {netVotes}
            </span>
            <Button
              variant={userVote === "DOWN" ? "default" : "ghost"}
              size="sm"
              className={`h-10 w-10 p-0 ${userVote === "DOWN" ? "bg-blue-500 hover:bg-blue-600" : ""}`}
              onClick={() => handleVote("DOWN")}
              disabled={loadingVote}
            >
              <ArrowDown className={`h-5 w-5 ${userVote === "DOWN" ? "fill-current" : ""}`} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Header */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getSubjectColor(doubt.subject)}>
                  {doubt.subject?.replace(/_/g, " ") || "Other"}
                </Badge>
                {doubt.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-3xl font-bold">{doubt.title}</h1>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  {doubt.isAnonymous ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <span>Anonymous</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={doubt.author?.image || undefined} />
                        <AvatarFallback>
                          {doubt.author?.name?.charAt(0) || doubt.author?.email?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{doubt.author?.name || doubt.author?.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Asked {formatDistanceToNow(new Date(doubt.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {doubt.content}
            </div>
          </div>
        </div>
      </div>

      {/* Answers list is handled by `AnswersSection` on the page to avoid duplicate forms. */}

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  )
}
