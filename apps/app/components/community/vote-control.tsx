"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowBigDown, ArrowBigUp } from "lucide-react"

import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { apiFetch, ApiError } from "@/lib/client-api"
import { cn } from "@/lib/utils"

/**
 * Reddit-style up/down vote. Updates instantly and rolls back if the server rejects it.
 * `url` is the vote endpoint; it receives { value: 1 | -1 | 0 } and returns { score, myVote }.
 */
export function VoteControl({
  url,
  score,
  myVote,
  orientation = "vertical",
  disabled,
}: {
  url: string
  score: number
  myVote: number
  orientation?: "vertical" | "horizontal"
  disabled?: boolean
}) {
  const [state, setState] = useState({ score, myVote })
  const [pending, setPending] = useState(false)
  const { status } = useSession()
  const { open: openAuth } = useAuthModal()
  const { toast } = useToast()

  const cast = async (dir: 1 | -1) => {
    if (status !== "authenticated") return openAuth()
    if (pending || disabled) return
    const next = state.myVote === dir ? 0 : dir
    const before = state
    setState({ score: state.score + next - state.myVote, myVote: next })
    setPending(true)
    try {
      const res = await apiFetch<{ score: number; myVote: number }>(url, { method: "POST", json: { value: next } })
      setState({ score: res.score, myVote: res.myVote })
    } catch (e) {
      setState(before)
      if (e instanceof ApiError && e.status === 401) openAuth()
      else toast({ title: "Vote not saved", description: (e as Error).message, variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  const arrow = (dir: 1 | -1, Icon: typeof ArrowBigUp, label: string) => (
    <button
      type="button"
      onClick={() => cast(dir)}
      aria-label={label}
      aria-pressed={state.myVote === dir}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        state.myVote === dir && (dir === 1 ? "text-primary" : "text-foreground")
      )}
    >
      <Icon className="h-5 w-5" fill={state.myVote === dir ? "currentColor" : "none"} strokeWidth={1.5} />
    </button>
  )

  return (
    <div className={cn("flex items-center", orientation === "vertical" ? "w-9 flex-col" : "gap-1")}>
      {arrow(1, ArrowBigUp, "Upvote")}
      <span className={cn("min-w-[1.5rem] text-center font-mono text-sm tabular-nums", state.myVote === 1 && "text-primary")} aria-label={`${state.score} points`}>
        {state.score}
      </span>
      {arrow(-1, ArrowBigDown, "Downvote")}
    </div>
  )
}
