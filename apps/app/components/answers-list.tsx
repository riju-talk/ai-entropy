"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThumbsUp, ThumbsDown, Check } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { AuthModal } from "@/components/auth-modal"

interface Answer {
  id: string
  content: string
  createdAt: Date
  authorId: string
  author?: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface AnswersListProps {
  answers: Answer[]
  doubtAuthorId: string
  currentUserId?: string
}

interface VoteState {
  [answerId: string]: {
    upvoted: boolean
    downvoted: boolean
    count: number
  }
}

export function AnswersList({ answers: initialAnswers, doubtAuthorId, currentUserId }: AnswersListProps) {
  const { data: session, status } = useSession()
  const [answers] = useState(initialAnswers)
  const [voteStates, setVoteStates] = useState<VoteState>({})
  const [userVotes, setUserVotes] = useState<{ [answerId: string]: "UP" | "DOWN" | null }>({})
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { toast } = useToast()

  const isAuthenticated = status === "authenticated"
  const userEmail = session?.user?.email

  // Fetch user votes for all answers on mount
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchUserVotes = async () => {
      const votes: { [answerId: string]: "UP" | "DOWN" | null } = {}
      
      await Promise.all(
        answers.map(async (answer) => {
          try {
            const response = await fetch(`/api/answers/${answer.id}/vote`)
            const data = await response.json()
            votes[answer.id] = data.userVote
          } catch (error) {
            console.error(`Error fetching vote for answer ${answer.id}:`, error)
          }
        })
      )
      
      setUserVotes(votes)
    }

    fetchUserVotes()
  }, [answers, isAuthenticated])

  const handleVote = async (answerId: string, type: "up" | "down") => {
    // Check authentication
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    const voteType = type.toUpperCase() as "UP" | "DOWN"
    const currentUserVote = userVotes[answerId]
    const currentState = voteStates[answerId] || { upvoted: false, downvoted: false, count: 0 }
    
    let newState = { ...currentState }
    let newUserVote: "UP" | "DOWN" | null = voteType

    // Calculate optimistic update
    if (currentUserVote === voteType) {
      newUserVote = null
      if (type === "up") {
        newState = { upvoted: false, downvoted: false, count: currentState.count - 1 }
      } else {
        newState = { upvoted: false, downvoted: false, count: currentState.count + 1 }
      }
    } else if (currentUserVote) {
      if (type === "up") {
        newState = { upvoted: true, downvoted: false, count: currentState.count + 2 }
      } else {
        newState = { upvoted: false, downvoted: true, count: currentState.count - 2 }
      }
    } else {
      if (type === "up") {
        newState = { upvoted: true, downvoted: false, count: currentState.count + 1 }
      } else {
        newState = { upvoted: false, downvoted: true, count: currentState.count - 1 }
      }
    }

    setVoteStates(prev => ({ ...prev, [answerId]: newState }))
    setUserVotes(prev => ({ ...prev, [answerId]: newUserVote }))

    try {
      const response = await fetch(`/api/answers/${answerId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: voteType }),
      })

      if (!response.ok) {
        throw new Error("Failed to vote")
      }

      const data = await response.json()
      const netVotes = data.upvotes - data.downvotes
      
      setVoteStates(prev => ({
        ...prev,
        [answerId]: {
          upvoted: newUserVote === "UP",
          downvoted: newUserVote === "DOWN",
          count: netVotes
        }
      }))
    } catch (error) {
      setVoteStates(prev => ({ ...prev, [answerId]: currentState }))
      setUserVotes(prev => ({ ...prev, [answerId]: currentUserVote }))
      toast({
        title: "Error",
        description: "Failed to register vote",
        variant: "destructive",
      })
    }
  }

  if (answers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No answers yet</p>
        <p className="text-sm">Be the first to answer this question!</p>
      </div>
    )
  }

  // Check if current user is the doubt author
  const isDoubtAuthor = currentUserId === doubtAuthorId

  return (
    <>
      <div className="space-y-6">
        {answers.map((answer) => {
          const voteState = voteStates[answer.id] || { upvoted: false, downvoted: false, count: 0 }
          const userVote = userVotes[answer.id]
          
          return (
            <div key={answer.id} className="bg-card rounded-lg border p-6">
              <div className="flex gap-4">
                {/* Vote Column */}
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant={userVote === "UP" ? "default" : "ghost"}
                    size="sm"
                    className={`h-8 w-8 p-0 ${userVote === "UP" ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                    onClick={() => handleVote(answer.id, "up")}
                    disabled={!isAuthenticated}
                  >
                    <ThumbsUp className={`h-4 w-4 ${userVote === "UP" ? "fill-current" : ""}`} />
                  </Button>
                  <span className={`font-semibold text-lg ${
                    voteState.count > 0 ? "text-orange-500" : voteState.count < 0 ? "text-blue-500" : ""
                  }`}>
                    {voteState.count}
                  </span>
                  <Button
                    variant={userVote === "DOWN" ? "default" : "ghost"}
                    size="sm"
                    className={`h-8 w-8 p-0 ${userVote === "DOWN" ? "bg-blue-500 hover:bg-blue-600" : ""}`}
                    onClick={() => handleVote(answer.id, "down")}
                    disabled={!isAuthenticated}
                  >
                    <ThumbsDown className={`h-4 w-4 ${userVote === "DOWN" ? "fill-current" : ""}`} />
                  </Button>
                </div>

                {/* Content Column */}
                <div className="flex-1">
                  {/* Author Info */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={answer.author?.image || undefined} />
                      <AvatarFallback>
                        {answer.author?.name?.charAt(0) || answer.author?.email?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">
                          {answer.author?.name || answer.author?.email || "Unknown User"}
                        </span>
                        {answer.authorId === doubtAuthorId && (
                          <Badge variant="secondary" className="text-xs">
                            Question Author
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Answered {formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Answer Content */}
                  <div className="prose prose-sm max-w-none dark:prose-invert mb-4 whitespace-pre-wrap">
                    {answer.content}
                  </div>

                  {/* Actions - Only show Accept button if user is doubt author and authenticated */}
                  <div className="flex items-center gap-2">
                    {isAuthenticated && isDoubtAuthor && (
                      <Button variant="outline" size="sm">
                        <Check className="h-4 w-4 mr-1" />
                        Accept Answer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  )
}
