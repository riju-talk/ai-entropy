"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface SessionRow {
  id: string
  title: string | null
  updatedAt: string
  messages?: { content: string; role: string }[]
}

interface Props {
  userId?: string
  activeId?: string
  /** Bump to refetch (e.g. after an answer finishes, so titles and order stay current). */
  refreshKey: number
  /** Pick a chat (or `undefined` when none is left). */
  onSelect: (id: string | undefined) => void
}

/**
 * Sidebar list of chat sessions: a "New chat" button and the user's chats, click one to open it, trash to delete.
 * In demo mode the server caps sessions (`limit`, 5); at the cap "New chat" is disabled and says why.
 */
export function ChatSessions({ userId, activeId, refreshKey, onSelect }: Props) {
  const { toast } = useToast()
  const [rows, setRows] = useState<SessionRow[]>([])
  const [limit, setLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
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
  }, [userId])

  useEffect(() => { load() }, [load, refreshKey, activeId])

  const atLimit = limit !== null && rows.length >= limit

  const create = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/ai-agent/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const conv = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: res.status === 409 ? "Session limit reached" : "Could not start a new chat", description: conv?.error, variant: "destructive" })
        return
      }
      onSelect(conv.id)
      load()
    } catch {
      toast({ title: "Could not start a new chat", description: "Check your connection and try again.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/ai-agent/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) return
      const remaining = rows.filter((x) => x.id !== id)
      setRows(remaining)
      if (id === activeId) onSelect(remaining[0]?.id) // move off the deleted chat: newest remaining, or an empty screen
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  if (!userId) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Chats</span>
        <span className="font-mono text-[9px] text-muted-foreground">{loading ? "…" : limit !== null ? `${rows.length}/${limit}` : rows.length}</span>
      </div>

      <button
        onClick={create}
        disabled={atLimit || creating}
        title={atLimit ? "Delete a chat to start a new one" : "Start a new chat"}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-primary/30 bg-primary/5 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        New chat
      </button>
      {atLimit && <p className="text-center text-[9px] text-muted-foreground">Demo limit of {limit} reached. Delete a chat to add a new one.</p>}

      <ul className="space-y-1" aria-label="Chat sessions">
        {!loading && rows.length === 0 && <li className="py-1 text-center text-[9px] text-muted-foreground">No chats yet. Ask a question to start one.</li>}
        {rows.map((r) => {
          const label = r.title && r.title !== "New Chat" ? r.title : r.messages?.[0]?.content?.slice(0, 50) || "New chat"
          const active = r.id === activeId
          return (
            <li key={r.id} className={cn("group rounded border", active ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border hover:bg-card")}>
              {confirmId === r.id ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px]">
                  <span className="text-foreground">Delete this chat?</span>
                  <span className="flex gap-1">
                    <button onClick={() => remove(r.id)} disabled={busyId === r.id} className="rounded border border-destructive/40 px-1.5 py-0.5 text-destructive hover:bg-destructive/10 disabled:opacity-50">
                      {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent">No</button>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 pr-1">
                  <button onClick={() => !active && onSelect(r.id)} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
                    <MessageSquare className={cn("h-3 w-3 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("truncate text-[11px]", active ? "font-semibold text-foreground" : "text-foreground/80")}>{label}</span>
                  </button>
                  <button
                    onClick={() => setConfirmId(r.id)}
                    title="Delete this chat"
                    aria-label={`Delete chat ${label}`}
                    className="flex-shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
