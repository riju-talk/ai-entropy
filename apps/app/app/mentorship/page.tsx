"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Clock, GraduationCap, Inbox, Loader2, Search, UserPlus, Users } from "lucide-react"

interface Mentor {
  id: string
  userId: string
  name: string
  image: string | null
  headline: string
  bio: string
  university: string | null
  subjects: string[]
  expertise: string[]
  availability: string
  acceptedSessions: number
}

export default function MentorshipPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [mentors, setMentors] = useState<Mentor[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [subject, setSubject] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMentor, setIsMentor] = useState(false)

  const [target, setTarget] = useState<Mentor | null>(null)
  const [topic, setTopic] = useState("")
  const [message, setMessage] = useState("")
  const [preferredTime, setPreferredTime] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (subject) params.set("subject", subject)
      const res = await fetch(`/api/mentors?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setMentors(data.mentors)
      setSubjects(data.subjects)
    } catch {
      setError("Could not load mentors. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [query, subject])

  useEffect(() => {
    const t = setTimeout(load, 250) // debounce typing
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (!session?.user) {
      setIsMentor(false)
      return
    }
    fetch("/api/mentors/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsMentor(Boolean(d?.mentor)))
      .catch(() => setIsMentor(false))
  }, [session?.user])

  const openRequest = (m: Mentor) => {
    if (!session?.user) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/mentorship")}`)
      return
    }
    setTarget(m)
    setTopic("")
    setMessage("")
    setPreferredTime("")
  }

  const sendRequest = async () => {
    if (!target) return
    setSending(true)
    try {
      const res = await fetch(`/api/mentors/${target.id}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message, preferredTime }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Request failed")
      toast({ title: "Request sent", description: `${target.name} will see it in their inbox.` })
      setTarget(null)
    } catch (e) {
      toast({ title: "Could not send request", description: (e as Error).message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary/60 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>ENTROPY · MENTORSHIP</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Find a mentor</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ask experienced students and teachers for a focused session on a topic.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session?.user && (
            <Button asChild variant="outline" size="sm">
              <Link href="/mentorship/requests">
                <Inbox className="mr-2 h-4 w-4" /> My requests
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/mentorship/register">
              <UserPlus className="mr-2 h-4 w-4" /> {isMentor ? "Manage mentor profile" : "Register as a mentor"}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, topic or university"
            className="pl-9"
            aria-label="Search mentors"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={subject === "" ? "default" : "outline"} onClick={() => setSubject("")}>
            All
          </Button>
          {subjects.map((s) => (
            <Button key={s} size="sm" variant={subject === s ? "default" : "outline"} onClick={() => setSubject(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading mentors
        </div>
      ) : error ? (
        <div className="rounded border border-destructive/40 p-6 text-center text-sm">
          {error}{" "}
          <button className="underline" onClick={load}>
            Retry
          </button>
        </div>
      ) : mentors.length === 0 ? (
        <div className="rounded border border-dashed p-10 text-center space-y-3">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm">
            {query || subject ? "No mentors match that search." : "No mentors have registered yet."}
          </p>
          {!query && !subject && (
            <Button asChild size="sm">
              <Link href="/mentorship/register">Be the first mentor</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mentors.map((m) => {
            const own = session?.user && (session.user as { id?: string }).id === m.userId
            return (
              <div key={m.id} className="rounded border border-border bg-background/80 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage src={m.image || undefined} />
                    <AvatarFallback className="text-foreground text-sm font-semibold">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.headline}</div>
                    {m.university && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <GraduationCap className="h-3 w-3" /> {m.university}
                      </div>
                    )}
                  </div>
                </div>

                <p className="line-clamp-3 text-xs text-muted-foreground">{m.bio}</p>

                <div className="flex flex-wrap gap-1.5">
                  {m.expertise.map((skill) => (
                    <span
                      key={skill}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {m.availability}
                  </span>
                  <span>
                    {m.acceptedSessions} accepted {m.acceptedSessions === 1 ? "session" : "sessions"}
                  </span>
                </div>

                <Button className="w-full" size="sm" disabled={Boolean(own)} onClick={() => openRequest(m)}>
                  {own ? "This is you" : "Request a session"}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a session with {target?.name}</DialogTitle>
            <DialogDescription>Be specific: mentors accept requests they can help with.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="req-topic">Topic</Label>
              <Input id="req-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-message">What do you need help with?</Label>
              <Textarea
                id="req-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-time">Preferred time (optional)</Label>
              <Input
                id="req-time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder={target?.availability}
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendRequest} disabled={sending || topic.trim().length < 3 || message.trim().length < 10}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
