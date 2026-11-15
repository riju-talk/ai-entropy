"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { History, Loader2, MessageSquare, PlusCircle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SessionRow {
  id: string
  title: string | null
  updatedAt: string
  messages?: { content: string; role: string }[]
}

interface Props {
  activeId?: string
  /** Bump to refetch (e.g. after an answer finishes, so titles and order stay current). */
  refreshKey: number
  disabled?: boolean
  onSelect: (id: string) => void
  onNew: () => Promise<void> | void
  /** Called after a session is deleted; `wasActive` tells the parent to move off it; `remaining` is newest first. */
  onDeleted: (id: string, wasActive: boolean, remaining: { id: string }[]) => void
}

/**
 * Chat sessions menu: switch, delete, start a new one. In demo mode the server caps sessions (`limit`);
 * at the cap "New" is disabled and the user is told to delete one.
 */
export function ChatSessions({ activeId, refreshKey, disabled, onSelect, onNew, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [limit, setLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-agent/conversations")
      if (!res.ok) return
      const data = await res.json()
      setRows(data.conversations || [])
      setLimit(typeof data.limit === "number" ? data.limit : null)
    } catch {
      /* offline: keep what we have */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey, activeId])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setConfirmId(null) } }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setConfirmId(null) } }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc) }
  }, [open])

  const atLimit = limit !== null && rows.length >= limit

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/ai-agent/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (res.ok) {
        const remaining = rows.filter((x) => x.id !== id)
        setRows(remaining)
        onDeleted(id, id === activeId, remaining)
      }
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  const create = async () => {
    setCreating(true)
    try { await onNew() } finally { setCreating(false); setOpen(false); load() }
  }

  return (
    <div ref={box} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Chat sessions"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest transition-all",
          open ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
          "disabled:opacity-40",
        )}
      >
        <History className="h-3 w-3" />
        <span className="hidden sm:inline">Sessions</span>
        <span className="font-mono">{loading ? "…" : limit !== null ? `${rows.length}/${limit}` : rows.length}</span>
      </button>

      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Chat sessions{limit !== null && ` · demo limit ${limit}`}
            </span>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {rows.length === 0 && <li className="px-3 py-3 text-[11px] text-muted-foreground">No sessions yet. Ask a question to start one.</li>}
            {rows.map((r) => {
              const preview = r.title && r.title !== "New Chat" ? r.title : r.messages?.[0]?.content?.slice(0, 60) || "New Chat"
              const active = r.id === activeId
              return (
                <li key={r.id} className={cn("group flex items-center gap-1 px-1.5", active && "bg-primary/5")}>
                  {confirmId === r.id ? (
                    <div className="flex w-full items-center justify-between gap-2 px-1.5 py-1.5 text-[11px]">
                      <span className="text-foreground">Delete this chat?</span>
                      <span className="flex gap-1">
                        <button onClick={() => remove(r.id)} disabled={busyId === r.id} className="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10 disabled:opacity-50">
                          {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-accent">Cancel</button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        role="menuitem"
                        onClick={() => { setOpen(false); if (!active) onSelect(r.id) }}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-accent/60"
                      >
                        <MessageSquare className={cn("h-3 w-3 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] text-foreground">{preview}</span>
                          <span className="block text-[9px] text-muted-foreground">{new Date(r.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      </button>
                      <button
                        onClick={() => setConfirmId(r.id)}
                        title="Delete this session"
                        aria-label={`Delete session ${preview}`}
                        className="flex-shrink-0 rounded p-1.5 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="border-t border-border p-2">
            <button
              onClick={create}
              disabled={atLimit || creating}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
              New session
            </button>
            {atLimit && <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Demo limit reached. Delete a session to add a new one.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
