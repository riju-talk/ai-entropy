"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface StudySessionRow {
  id: string
  topic: string
  plannedMinutes: number
  actualSeconds: number
  completed: boolean
  startedAt: string
}

interface Summary {
  recent: StudySessionRow[]
  todaySeconds: number
  profile: { totalFocusSeconds: number; sessionsCompleted: number; topicSeconds: Record<string, number> } | null
}

const PRESETS = [15, 25, 50]
const BREAK_MINUTES = 5

function fmt(totalSeconds: number) {
  const s = Math.max(0, totalSeconds)
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function fmtMinutes(seconds: number) {
  const m = Math.round(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

/**
 * Pomodoro focus timer. The server owns the clock: it records the start time and computes the
 * duration on stop, so a refresh or a second tab cannot inflate focus time.
 */
export function StudyTimer() {
  const { toast } = useToast()
  const [topic, setTopic] = useState("")
  const [minutes, setMinutes] = useState(25)
  const [phase, setPhase] = useState<"idle" | "focus" | "break">("idle")
  const [paused, setPaused] = useState(false)
  const [remaining, setRemaining] = useState(25 * 60)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const sessionId = useRef<string | null>(null)
  const endAt = useRef<number>(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/study/sessions", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setSummary(data)
      // Resume a session that was still running when the page was closed.
      if (data.active && !sessionId.current) {
        const planned = data.active.plannedMinutes * 60
        const left = planned - Math.floor((Date.now() - new Date(data.active.startedAt).getTime()) / 1000)
        if (left > 0) {
          sessionId.current = data.active.id
          setTopic(data.active.topic)
          setMinutes(data.active.plannedMinutes)
          endAt.current = Date.now() + left * 1000
          setRemaining(left)
          setPhase("focus")
        }
      }
    } catch {
      /* the summary is optional */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const finish = useCallback(
    async (completed: boolean) => {
      const id = sessionId.current
      sessionId.current = null
      if (id) {
        try {
          await fetch("/api/study/sessions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, completed }),
          })
        } catch {
          toast({ title: "Could not save session", description: "Your focus time was not recorded.", variant: "destructive" })
        }
      }
      await load()
    },
    [load, toast]
  )

  // Tick from wall-clock time so background-tab throttling does not make the timer drift.
  useEffect(() => {
    if (phase === "idle" || paused) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        if (phase === "focus") {
          void finish(true).then(() => {
            toast({ title: "Focus session complete", description: `Take a ${BREAK_MINUTES}-minute break.` })
            endAt.current = Date.now() + BREAK_MINUTES * 60 * 1000
            setRemaining(BREAK_MINUTES * 60)
            setPhase("break")
          })
        } else {
          setPhase("idle")
          setRemaining(minutes * 60)
        }
      }
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [phase, paused, minutes, finish, toast])

  useEffect(() => {
    document.title = phase === "idle" ? "Study timer" : `${fmt(remaining)} · ${phase === "focus" ? "Focus" : "Break"}`
  }, [phase, remaining])

  const start = async () => {
    if (!topic.trim()) {
      toast({ title: "Pick a topic", description: "What are you studying?", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/study/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), plannedMinutes: minutes }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const { session } = await res.json()
      sessionId.current = session.id
      endAt.current = Date.now() + minutes * 60 * 1000
      setRemaining(minutes * 60)
      setPaused(false)
      setPhase("focus")
    } catch {
      toast({ title: "Could not start", description: "Sign in and try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const togglePause = () => {
    if (paused) {
      endAt.current = Date.now() + remaining * 1000
      setPaused(false)
    } else {
      setPaused(true)
    }
  }

  const stop = async () => {
    setBusy(true)
    if (phase === "focus") await finish(false)
    setPhase("idle")
    setPaused(false)
    setRemaining(minutes * 60)
    setBusy(false)
  }

  const total = phase === "break" ? BREAK_MINUTES * 60 : minutes * 60
  const progress = phase === "idle" ? 0 : 1 - remaining / total
  const topTopics = Object.entries(summary?.profile?.topicSeconds || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" /> Focus timer
          </CardTitle>
          <CardDescription>
            {phase === "break" ? "Break time. Step away from the screen." : "Work in focused intervals, then rest."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-56 w-56">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="5" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 282.7} 282.7`}
                  className={phase === "break" ? "text-success" : "text-primary"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-5xl font-semibold tabular-nums" role="timer" aria-live="off">
                  {fmt(phase === "idle" ? minutes * 60 : remaining)}
                </span>
                <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {phase === "idle" ? "ready" : paused ? "paused" : phase}
                </span>
              </div>
            </div>
          </div>

          {phase === "idle" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="study-topic">Topic</Label>
                <Input
                  id="study-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Eigenvalues, Cellular respiration"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Length</Label>
                <div className="flex gap-2">
                  {PRESETS.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={minutes === m ? "default" : "outline"}
                      onClick={() => {
                        setMinutes(m)
                        setRemaining(m * 60)
                      }}
                    >
                      {m} min
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-2">
            {phase === "idle" ? (
              <Button onClick={start} disabled={busy} size="lg">
                <Play className="mr-2 h-4 w-4" /> Start focus
              </Button>
            ) : (
              <>
                <Button onClick={togglePause} variant="outline" disabled={busy}>
                  {paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={stop} variant="destructive" disabled={busy}>
                  {phase === "focus" ? <Square className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {phase === "focus" ? "End session" : "Skip break"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Today" value={fmtMinutes(summary?.todaySeconds || 0)} />
            <Stat label="All time" value={fmtMinutes(summary?.profile?.totalFocusSeconds || 0)} />
            <Stat label="Sessions" value={String(summary?.profile?.sessionsCompleted || 0)} />
          </div>
          {topTopics.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Top topics</p>
              <ul className="space-y-1">
                {topTopics.map(([name, secs]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="text-muted-foreground">{fmtMinutes(secs)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
