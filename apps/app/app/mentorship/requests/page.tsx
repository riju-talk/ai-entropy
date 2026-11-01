"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

type Status = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"

interface Row {
  id: string
  topic: string
  message: string
  preferredTime: string | null
  status: Status
  mentorNote: string | null
  createdAt: string
  mentorName?: string
  mentorHeadline?: string
  studentName?: string
}

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "border-warning/40 text-warning",
  ACCEPTED: "border-success/40 text-success",
  DECLINED: "border-red-500/40 text-red-400",
  CANCELLED: "border-border text-muted-foreground",
}

export default function MentorshipRequestsPage() {
  const { toast } = useToast()
  const [sent, setSent] = useState<Row[]>([])
  const [received, setReceived] = useState<Row[]>([])
  const [isMentor, setIsMentor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mentorship/requests", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      setSent(d.sent)
      setReceived(d.received)
      setIsMentor(d.isMentor)
    } catch {
      toast({ title: "Could not load requests", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id: string, status: "ACCEPTED" | "DECLINED" | "CANCELLED") => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/mentorship/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, mentorNote: notes[id] || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Update failed")
      await load()
    } catch (e) {
      toast({ title: "Could not update", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading
      </div>
    )
  }

  const pendingIn = received.filter((r) => r.status === "PENDING").length

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div>
        <Link href="/mentorship" className="text-xs text-muted-foreground hover:underline">
          Back to mentors
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Mentorship requests</h1>
      </div>

      <Tabs defaultValue={isMentor && pendingIn > 0 ? "received" : "sent"}>
        <TabsList>
          <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
          {isMentor && (
            <TabsTrigger value="received">
              Received ({received.length}){pendingIn > 0 ? ` · ${pendingIn} new` : ""}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent" className="space-y-3">
          {sent.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have not requested a session yet.{" "}
              <Link href="/mentorship" className="underline">
                Find a mentor
              </Link>
            </p>
          )}
          {sent.map((r) => (
            <div key={r.id} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{r.topic}</div>
                  <div className="text-xs text-muted-foreground">
                    To {r.mentorName} · {r.mentorHeadline}
                  </div>
                </div>
                <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.message}</p>
              {r.mentorNote && <p className="text-xs">Mentor note: {r.mentorNote}</p>}
              {r.status === "PENDING" && (
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "CANCELLED")}>
                  Cancel request
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        {isMentor && (
          <TabsContent value="received" className="space-y-3">
            {received.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No one has requested a session yet.</p>
            )}
            {received.map((r) => (
              <div key={r.id} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{r.topic}</div>
                    <div className="text-xs text-muted-foreground">
                      From {r.studentName}
                      {r.preferredTime ? ` · prefers ${r.preferredTime}` : ""}
                    </div>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{r.message}</p>
                {r.status === "PENDING" ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Optional note (e.g. a meeting link or time)"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busyId === r.id} onClick={() => act(r.id, "ACCEPTED")}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "DECLINED")}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ) : (
                  r.mentorNote && <p className="text-xs">Your note: {r.mentorNote}</p>
                )}
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
