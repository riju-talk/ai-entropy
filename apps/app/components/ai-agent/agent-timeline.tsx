"use client"

import { useState } from "react"
import { CheckCircle2, ChevronDown, CircleAlert, Clock, Loader2, Plug, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"
import type { StageEvent, ToolEvent } from "@/lib/stream-qa"

/**
 * Live activity timeline for one tutor answer.
 *
 * What it shows: the harness's own stages ("Understanding the question", ...), each with a one-line summary, and every
 * tool call (name, built-in or MCP, status, time, a sanitized result summary). All of it is produced by the server in
 * safe, student-readable form. It deliberately does NOT show the model's private reasoning; the "reasoning" a student
 * sees is these concise summaries plus the step-by-step explanation inside the answer itself.
 */

export interface TimelineStep {
  name: string
  status: StageEvent["status"]
  ms?: number
  detail?: string
}

const LABELS: Record<string, string> = {
  guard: "Checking the question",
  history: "Searching conversation context",
  normalize: "Preparing the question",
  understand: "Understanding the question",
  graph: "Retrieving knowledge graph information",
  learner: "Reading your learning profile",
  documents: "Searching your documents",
  web: "Searching the web",
  tools: "Selecting tools",
  generate: "Generating the response",
  verify: "Validating the response",
  complete: "Completing the answer",
}

// Stages worth a row. `normalize` and `learner` are fast plumbing; show them only if they did something notable.
const QUIET = new Set(["normalize", "learner"])

export function applyStage(steps: TimelineStep[], e: StageEvent): TimelineStep[] {
  const i = steps.findIndex((s) => s.name === e.name)
  const next: TimelineStep = { name: e.name, status: e.status, ms: e.ms, detail: e.detail || (i >= 0 ? steps[i].detail : "") }
  if (i === -1) return [...steps, next]
  const copy = steps.slice()
  copy[i] = next
  return copy
}

export function applyTool(tools: ToolEvent[], e: ToolEvent): ToolEvent[] {
  const i = tools.findIndex((t) => t.id === e.id)
  if (i === -1) return [...tools, e]
  const copy = tools.slice()
  copy[i] = { ...tools[i], ...e }
  return copy
}

function StatusIcon({ status }: { status: string }) {
  if (status === "start" || status === "running") return <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="in progress" />
  if (status === "done" || status === "ok") return <CheckCircle2 className="h-3 w-3 text-success" aria-label="done" />
  if (status === "timeout") return <Clock className="h-3 w-3 text-warning" aria-label="timed out" />
  return <CircleAlert className="h-3 w-3 text-muted-foreground" aria-label="skipped or failed" />
}

const fmt = (ms?: number) => (ms === undefined ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

export function AgentTimeline({ steps, tools, live, totalMs, continuations = 0 }: { steps: TimelineStep[]; tools: ToolEvent[]; live: boolean; totalMs?: number; continuations?: number }) {
  const [open, setOpen] = useState(false)
  const visible = steps.filter((s) => !QUIET.has(s.name) || s.status === "error" || s.status === "timeout")
  if (!visible.length && !tools.length) return null
  const expanded = live || open
  const running = visible.find((s) => s.status === "start")

  return (
    <div className="rounded border border-border/70 bg-muted/20 text-[11px]" data-testid="agent-timeline">
      <button
        type="button"
        onClick={() => !live && setOpen((o) => !o)}
        aria-expanded={expanded}
        className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left", live ? "cursor-default" : "hover:bg-muted/40")}
      >
        {live ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <CheckCircle2 className="h-3 w-3 text-success" />}
        <span className="font-medium text-foreground">
          {live ? (running ? LABELS[running.name] ?? running.name : "Working on it") + "…" : "How this answer was made"}
        </span>
        {!live && (
          <span className="text-muted-foreground">
            · {visible.length} steps{tools.length ? ` · ${tools.length} tool call${tools.length === 1 ? "" : "s"}` : ""}
            {totalMs ? ` · ${fmt(totalMs)}` : ""}
          </span>
        )}
        {!live && <ChevronDown className={cn("ml-auto h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>

      {expanded && (
        <ol className="space-y-1 border-t border-border/60 px-3 py-2">
          {visible.map((s) => (
            <li key={s.name} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <StatusIcon status={s.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground">{LABELS[s.name] ?? s.name}</span>
                {s.detail ? <span className="text-muted-foreground"> — {s.detail}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fmt(s.ms)}</span>
            </li>
          ))}
          {continuations > 0 && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <Loader2 className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Long answer: continued {continuations} time{continuations === 1 ? "" : "s"} to avoid cutting it off</span>
            </li>
          )}
          {tools.length > 0 && (
            <li className="pt-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tool calls</p>
              <ul className="space-y-1">
                {tools.map((t) => (
                  <li key={t.id} className="flex items-start gap-2" data-testid={`tool-${t.name}`}>
                    <span className="mt-0.5 shrink-0">
                      <StatusIcon status={t.status} />
                    </span>
                    <span className="mt-0.5 shrink-0 text-muted-foreground">{t.kind === "mcp" ? <Plug className="h-3 w-3" aria-label="MCP tool" /> : <Wrench className="h-3 w-3" aria-label="built-in tool" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-foreground">{t.name}</span>
                      {t.kind === "mcp" && <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] uppercase text-primary">MCP{t.origin ? ` · ${t.origin}` : ""}</span>}
                      {t.summary ? <span className="block truncate text-muted-foreground" title={t.summary}>{t.summary}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fmt(t.ms)}</span>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      )}
    </div>
  )
}

/** One-line verification badge shown under a finished answer. Never claims more than the NLI check established. */
export function VerificationBadge({ verdict, supportedRatio, note }: { verdict?: string; supportedRatio?: number | null; note?: string }) {
  if (!verdict) return null
  const view: Record<string, { text: string; tone: string }> = {
    SUPPORTED: { text: `Backed by your sources${supportedRatio != null ? ` (${Math.round(supportedRatio * 100)}% of claims)` : ""}`, tone: "text-success" },
    PARTIAL: { text: "Only partly backed by your sources", tone: "text-warning" },
    CONTRADICTED: { text: "Conflicts with your sources", tone: "text-destructive" },
    UNGROUNDED: { text: "General knowledge — not checked against sources", tone: "text-muted-foreground" },
    UNVERIFIED: { text: "Could not be verified", tone: "text-muted-foreground" },
  }
  const v = view[verdict]
  if (!v) return null
  return (
    <div className="space-y-0.5" data-testid="verification-badge">
      <p className={cn("text-[10px] font-medium", v.tone)}>{v.text}</p>
      {note ? <p className="text-[10px] text-muted-foreground">{note}</p> : null}
    </div>
  )
}
