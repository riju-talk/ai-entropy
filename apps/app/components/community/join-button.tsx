"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { apiFetch, ApiError } from "@/lib/client-api"

interface Membership {
  isMember: boolean
  role: string | null
  memberCount: number
}

/** Join / Joined toggle. Reports the new membership upward so counts and the composer stay in sync. */
export function JoinButton({
  communityId,
  isMember,
  size = "default",
  onChange,
}: {
  communityId: string
  isMember: boolean
  size?: "default" | "sm"
  onChange?: (m: Membership) => void
}) {
  const [member, setMember] = useState(isMember)
  const [busy, setBusy] = useState(false)
  const { status } = useSession()
  const { open: openAuth } = useAuthModal()
  const { toast } = useToast()

  const toggle = async () => {
    if (status !== "authenticated") return openAuth()
    setBusy(true)
    try {
      const m = await apiFetch<Membership>(`/api/communities/${communityId}/membership`, { method: member ? "DELETE" : "POST" })
      setMember(m.isMember)
      onChange?.(m)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuth()
      else toast({ title: member ? "Could not leave" : "Could not join", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={member ? "outline" : "default"} disabled={busy} onClick={toggle} aria-pressed={member}>
      {member ? "Joined" : "Join"}
    </Button>
  )
}
