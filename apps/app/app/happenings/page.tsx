"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
import { Calendar, Clock, Loader2, MapPin, Plus, Trash2, Users } from "lucide-react"

const CATEGORIES = ["WORKSHOP", "CONFERENCE", "MEETUP", "HACKATHON", "SEMINAR", "OTHER"] as const

interface EventRow {
  id: string
  title: string
  description: string
  category: (typeof CATEGORIES)[number]
  location: string
  startsAt: string
  endsAt: string | null
  capacity: number | null
  tags: string[]
  hostName: string
  attendees: number
  isFull: boolean
  rsvped: boolean
  isHost: boolean
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })

const EMPTY = {
  title: "",
  description: "",
  category: "MEETUP" as (typeof CATEGORIES)[number],
  location: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  tags: "",
}

export default function HappeningsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [events, setEvents] = useState<EventRow[]>([])
  const [category, setCategory] = useState<string>("")
  const [past, setPast] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (past) params.set("past", "1")
      if (category) params.set("category", category)
      const res = await fetch(`/api/events?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      setEvents((await res.json()).events)
    } catch {
      setError("Could not load events. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [past, category])

  useEffect(() => {
    load()
  }, [load])

  const needSignIn = () => router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/happenings")}`)

  const toggleRsvp = async (e: EventRow) => {
    if (!session?.user) return needSignIn()
    setBusyId(e.id)
    try {
      const res = await fetch(`/api/events/${e.id}/rsvp`, { method: e.rsvped ? "DELETE" : "POST" })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Could not update RSVP")
      await load()
    } catch (err) {
      toast({ title: "RSVP failed", description: (err as Error).message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (e: EventRow) => {
    if (!window.confirm(`Delete "${e.title}"? This cannot be undone.`)) return
    setBusyId(e.id)
    try {
      const res = await fetch(`/api/events/${e.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not delete")
      await load()
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const create = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          location: form.location,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          capacity: form.capacity ? Number(form.capacity) : null,
          tags: form.tags,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || "Could not create event")
      toast({ title: "Event created" })
      setCreating(false)
      setForm(EMPTY)
      setPast(false)
      await load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary/60 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>ENTROPY · HAPPENINGS</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Campus happenings</h1>
          <p className="text-xs text-muted-foreground mt-1">Workshops, meetups, hackathons and talks. RSVP or host your own.</p>
        </div>
        <Button size="sm" onClick={() => (session?.user ? setCreating(true) : needSignIn())}>
          <Plus className="mr-2 h-4 w-4" /> Host an event
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={category === "" ? "default" : "outline"} onClick={() => setCategory("")}>
          All
        </Button>
        {CATEGORIES.map((c) => (
          <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant={past ? "default" : "outline"} onClick={() => setPast((p) => !p)}>
          {past ? "Showing past events" : "Show past events"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events
        </div>
      ) : error ? (
        <div className="rounded border border-destructive/40 p-6 text-center text-sm">
          {error}{" "}
          <button className="underline" onClick={load}>
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded border border-dashed p-10 text-center space-y-3">
          <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm">{past ? "No past events." : "No upcoming events yet."}</p>
          {!past && (
            <Button size="sm" onClick={() => (session?.user ? setCreating(true) : needSignIn())}>
              Host the first one
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((e) => {
            const start = new Date(e.startsAt)
            const isPast = start.getTime() < Date.now()
            return (
              <div key={e.id} className="rounded border border-border bg-background/80 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {e.category}
                    </span>
                    <h3 className="mt-1 text-sm font-bold">{e.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Hosted by {e.hostName}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {e.isHost && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete event"
                        disabled={busyId === e.id}
                        onClick={() => remove(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {!isPast && (
                      <Button
                        size="sm"
                        variant={e.rsvped ? "outline" : "default"}
                        disabled={busyId === e.id || (!e.rsvped && e.isFull)}
                        onClick={() => toggleRsvp(e)}
                      >
                        {e.rsvped ? "Going · Cancel" : e.isFull ? "Full" : "RSVP"}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{e.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> {dateFmt.format(start)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {timeFmt.format(start)}
                    {e.endsAt ? ` – ${timeFmt.format(new Date(e.endsAt))}` : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> {e.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> {e.attendees}
                    {e.capacity ? ` / ${e.capacity}` : ""} going
                  </span>
                </div>
                {e.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Host an event</DialogTitle>
            <DialogDescription>Anyone signed in can post an event. You can delete it later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ev-title">Title</Label>
              <Input id="ev-title" value={form.title} onChange={set("title")} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea id="ev-desc" rows={3} value={form.description} onChange={set("description")} maxLength={2000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ev-cat">Category</Label>
                <select
                  id="ev-cat"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-loc">Location</Label>
                <Input id="ev-loc" value={form.location} onChange={set("location")} placeholder="Room 204 or an online link" maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-start">Starts</Label>
                <Input id="ev-start" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">Ends (optional)</Label>
                <Input id="ev-end" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-cap">Capacity (optional)</Label>
                <Input id="ev-cap" type="number" min={1} value={form.capacity} onChange={set("capacity")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-tags">Tags (comma separated)</Label>
                <Input id="ev-tags" value={form.tags} onChange={set("tags")} placeholder="AI, beginners" />
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={saving || !form.title.trim() || !form.description.trim() || !form.location.trim() || !form.startsAt}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
