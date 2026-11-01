"use client"

import { useState } from "react"
import { ArrowBigDown, ArrowBigUp } from "lucide-react"

import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Vote = "UP" | "DOWN" | null

interface VoteControlProps {
  /** e.g. /api/doubts/ID/vote or /api/answers/ID/vote */
  endpoint: string
  upvotes: number
  downvotes: number
  initialVote: Vote
  signedIn: boolean
  /** The author cannot vote on their own post. */
  disabled?: boolean
}

/** Up/down voting with an optimistic update that rolls back if the server says no. */
export function VoteControl({ endpoint, upvotes, downvotes, initialVote, signedIn, disabled }: VoteControlProps) {
  const { open: openAuthModal } = useAuthModal()
  const { toast } = useToast()
  const [state, setState] = useState({ up: upvotes, down: downvotes, vote: initialVote })
  const [busy, setBusy] = useState(false)

  const cast = async (type: "UP" | "DOWN") => {
    if (!signedIn) return openAuthModal()
    if (busy || disabled) return
    const before = state
    // optimistic
    const removing = state.vote === type
    setState({
      up: state.up + (type === "UP" ? (removing ? -1 : 1) : 0) - (state.vote === "UP" && type === "DOWN" ? 1 : 0),
      down: state.down + (type === "DOWN" ? (removing ? -1 : 1) : 0) - (state.vote === "DOWN" && type === "UP" ? 1 : 0),
      vote: removing ? null : type,
    })
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Vote failed")
      setState((s) => ({ up: data.upvotes ?? s.up, down: data.downvotes ?? s.down, vote: "userVote" in data ? data.userVote : s.vote }))
    } catch (e) {
      setState(before)
      toast({ title: "Could not record your vote", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const score = state.up - state.down
  const btn = "grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-accent disabled:opacity-40"
  return (
    <div className="flex flex-col items-center gap-0.5" role="group" aria-label="Vote">
      <button
        type="button"
        onClick={() => cast("UP")}
        disabled={busy || disabled}
        aria-label="Upvote"
        aria-pressed={state.vote === "UP"}
        className={cn(btn, state.vote === "UP" && "text-primary")}
      >
        <ArrowBigUp className={cn("h-6 w-6", state.vote === "UP" && "fill-current")} />
      </button>
      <span className="text-sm font-semibold tabular-nums" aria-live="polite">
        {score}
      </span>
      <button
        type="button"
        onClick={() => cast("DOWN")}
        disabled={busy || disabled}
        aria-label="Downvote"
        aria-pressed={state.vote === "DOWN"}
        className={cn(btn, state.vote === "DOWN" && "text-destructive")}
      >
        <ArrowBigDown className={cn("h-6 w-6", state.vote === "DOWN" && "fill-current")} />
      </button>
    </div>
  )
}
