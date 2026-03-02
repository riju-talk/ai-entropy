"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MessageSquare, Eye, User, ArrowUp, ArrowDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface DoubtCardProps {
  doubt: {
    id: string
    title: string
    content: string
    subject: string
    tags: string[]
    isAnonymous: boolean
    createdAt: Date | string // Allow both Date and string
    upvotes?: number
    downvotes?: number
    author?: {
      id: string
      name: string | null
      email: string
      image: string | null
    }
    _count?: {
      answers: number
      votes?: number
    }
  }
}

export function DoubtCard({ doubt }: DoubtCardProps) {
  const { data: session, status } = useSession()
  const { open: openAuthModal } = useAuthModal()
  const [upvotes, setUpvotes] = useState(doubt.upvotes || 0)
  const [downvotes, setDownvotes] = useState(doubt.downvotes || 0)
  const [userVote, setUserVote] = useState<"UP" | "DOWN" | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const [loadingVote, setLoadingVote] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

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

  const handleVote = async (type: "UP" | "DOWN", e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (status !== "authenticated") {
      openAuthModal()
      return
    }

    if (isVoting || loadingVote) return

    setIsVoting(true)

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
        description: "Failed to vote on question",
        variant: "destructive",
      })
    } finally {
      setIsVoting(false)
    }
  }

  const handleCardClick = () => {
    router.push(`/doubt/${doubt.id}`)
  }

  const hasAnswers = (doubt._count?.answers || 0) > 0

  // Safe date parsing helper
  const getValidDate = (dateInput: Date | string): Date => {
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return new Date() // Return current date as fallback
      }
      return date
    } catch {
      return new Date() // Return current date on any error
    }
  }

  return (
    <div
      className="flex gap-4 p-5 border rounded-2xl mb-4 bg-background/50 backdrop-blur-md border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] relative cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Vote Column */}
      <div
        className="flex flex-col items-center gap-1 min-w-[50px]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 rounded-full hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors ${userVote === "UP" ? "text-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]" : "text-muted-foreground"
            }`}
          onClick={(e) => handleVote("UP", e)}
          disabled={isVoting || loadingVote}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>

        <span
          className={`text-lg font-black font-mono tracking-tight ${netVotes > 0
            ? "text-cyan-400"
            : netVotes < 0
              ? "text-purple-400"
              : "text-muted-foreground"
            }`}
        >
          {netVotes}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 rounded-full hover:bg-purple-500/10 hover:text-purple-400 transition-colors ${userVote === "DOWN" ? "text-purple-400 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.3)]" : "text-muted-foreground"
            }`}
          onClick={(e) => handleVote("DOWN", e)}
          disabled={isVoting || loadingVote}
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-bold text-foreground group-hover:text-cyan-400 transition-colors line-clamp-2 leading-tight flex-1 tracking-tight">
            {doubt.title}
          </h3>

          {/* Answer count badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 border transition-colors uppercase tracking-wider ${hasAnswers
              ? "bg-cyan-950/30 text-cyan-400 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
              : "bg-white/5 text-muted-foreground border-transparent"
              }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{doubt._count?.answers || 0}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground/80 mb-4 line-clamp-2 leading-relaxed font-medium">
          {doubt.content.substring(0, 180)}...
        </p>

        {/* Tags and Meta */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-t border-white/5 pt-3 mt-2">
          <div
            className="flex flex-wrap gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {doubt.tags?.slice(0, 4).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="hover:bg-cyan-500 hover:text-white transition-all cursor-pointer text-[9px] uppercase tracking-widest font-bold bg-white/5 text-muted-foreground border-transparent"
              >
                #{tag}
              </Badge>
            ))}
          </div>

          {/* Author Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            {doubt.isAnonymous ? (
              <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                <User className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Anon</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/author px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
                <Avatar className="h-5 w-5 ring-1 ring-white/10 group-hover/author:ring-cyan-500/50 transition-all">
                  <AvatarImage src={doubt.author?.image || undefined} />
                  <AvatarFallback className="text-[9px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold">
                    {doubt.author?.name?.charAt(0) ||
                      doubt.author?.email?.charAt(0) ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="group-hover/author:text-cyan-300 transition-colors font-semibold">
                  {doubt.author?.name || doubt.author?.email?.split("@")[0]}
                </span>
              </div>
            )}
            <span className="opacity-30">|</span>
            <span className="text-[10px] uppercase tracking-wider opacity-70">
              {formatDistanceToNow(getValidDate(doubt.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
