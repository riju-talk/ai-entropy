"use client"

import { useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Button } from "./ui/button"
import { ArrowUp, ArrowDown } from "lucide-react"
import { voteOnDoubt } from "@/app/actions/doubts"
import { voteOnComment } from "@/app/actions/comments"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface VoteButtonsProps {
  itemId: string
  itemType: "doubt" | "comment"
  votes: number
  className?: string
}

export default function VoteButtons({ itemId, itemType, votes, className }: VoteButtonsProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [optimisticVotes, setOptimisticVotes] = useState(votes)

  const handleVote = (voteType: "UP" | "DOWN") => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please sign in to vote.",
        variant: "destructive",
      })
      return
    }

    startTransition(async () => {
      try {
        // Optimistic update
        const increment = voteType === "UP" ? 1 : -1
        setOptimisticVotes((prev) => prev + increment)

        if (itemType === "doubt") {
          await voteOnDoubt(itemId, voteType)
        } else {
          await voteOnComment(itemId, voteType)
        }

        toast({
          title: "Vote recorded",
          description: `Your ${voteType.toLowerCase()} vote has been recorded.`,
        })
      } catch (error) {
        // Revert optimistic update on error
        setOptimisticVotes(votes)
        toast({
          title: "Error",
          description: "Failed to record your vote. Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
        onClick={() => handleVote("UP")}
        disabled={isPending}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>

      <span
        className={cn(
          "text-sm font-medium min-w-[2rem] text-center",
          optimisticVotes > 0 && "text-green-600",
          optimisticVotes < 0 && "text-red-600",
        )}
      >
        {optimisticVotes}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
        onClick={() => handleVote("DOWN")}
        disabled={isPending}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  )
}
