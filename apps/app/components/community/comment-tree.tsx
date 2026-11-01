"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"
import { Loader2, Minus, Plus } from "lucide-react"

import type { CommentData } from "@/components/community/types"
import { VoteControl } from "@/components/community/vote-control"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { apiFetch, ApiError } from "@/lib/client-api"

interface Node extends CommentData {
  children: Node[]
}

function buildTree(flat: CommentData[]): Node[] {
  const byId = new Map<string, Node>(flat.map((c) => [c.id, { ...c, children: [] }]))
  const roots: Node[] = []
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : null
    ;(parent ? parent.children : roots).push(n)
  }
  const order = (list: Node[]) => {
    list.sort((a, b) => b.score - a.score || +new Date(a.createdAt) - +new Date(b.createdAt))
    list.forEach((n) => order(n.children))
  }
  order(roots)
  return roots
}

function ReplyBox({ postPath, parentId, isMember, onDone, onCancel, autoFocus }: { postPath: string; parentId?: string; isMember: boolean; onDone: () => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const { status } = useSession()
  const { open: openAuth } = useAuthModal()
  const { toast } = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status !== "authenticated") return openAuth()
    setBusy(true)
    try {
      await apiFetch(`${postPath}/comments`, { method: "POST", json: { body: text, parentId } })
      setText("")
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) openAuth()
      else toast({ title: "Could not comment", description: (err as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (status === "authenticated" && !isMember) {
    return <p className="text-sm text-muted-foreground">Join this community to join the discussion.</p>
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={parentId ? 3 : 4} placeholder="Add to the discussion... Markdown works." autoFocus={autoFocus} aria-label="Comment" />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {busy ? "Posting..." : parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  )
}

function CommentNode({ node, postPath, isMember, canModerate, viewerId, reload }: { node: Node; postPath: string; isMember: boolean; canModerate: boolean; viewerId?: string; reload: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [replying, setReplying] = useState(false)
  const { toast } = useToast()
  const canDelete = !node.isRemoved && (canModerate || (viewerId && node.author?.id === viewerId))

  const remove = async () => {
    try {
      await apiFetch(`${postPath}/comments/${node.id}`, { method: "DELETE" })
      reload()
    } catch (e) {
      toast({ title: "Could not remove", description: (e as Error).message, variant: "destructive" })
    }
  }

  return (
    <li className="pt-4">
      <div className="flex gap-2">
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand thread" : "Collapse thread"} className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
          {collapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
            {node.author ? (
              <Link href={`/profile/${node.author.id}`} className="font-medium text-foreground hover:text-primary">
                {node.author.name || "Learner"}
              </Link>
            ) : (
              <span>[deleted]</span>
            )}
            <span aria-hidden>/</span>
            <time dateTime={node.createdAt}>{formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}</time>
            {collapsed && node.children.length > 0 && <span>({node.children.length} hidden)</span>}
          </div>

          {!collapsed && (
            <>
              <div className={node.isRemoved ? "mt-1 italic text-muted-foreground" : "mt-1"}>
                <Markdown>{node.body}</Markdown>
              </div>
              {!node.isRemoved && (
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <VoteControl url={`${postPath}/comments/${node.id}/vote`} score={node.score} myVote={node.myVote} orientation="horizontal" />
                  <button onClick={() => setReplying(!replying)} className="hover:text-foreground">
                    Reply
                  </button>
                  {canDelete && (
                    <button onClick={remove} className="hover:text-destructive">
                      Remove
                    </button>
                  )}
                </div>
              )}
              {replying && (
                <div className="mt-3">
                  <ReplyBox
                    postPath={postPath}
                    parentId={node.id}
                    isMember={isMember}
                    autoFocus
                    onCancel={() => setReplying(false)}
                    onDone={() => {
                      setReplying(false)
                      reload()
                    }}
                  />
                </div>
              )}
              {node.children.length > 0 && (
                <ul className="mt-1 border-l border-border pl-4">
                  {node.children.map((c) => (
                    <CommentNode key={c.id} node={c} postPath={postPath} isMember={isMember} canModerate={canModerate} viewerId={viewerId} reload={reload} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

/** Threaded discussion for a post. Loads the flat list once and nests it by parentId. */
export function CommentTree({ communityId, postId, isMember, canModerate, onCountChange }: { communityId: string; postId: string; isMember: boolean; canModerate: boolean; onCountChange?: (n: number) => void }) {
  const postPath = `/api/communities/${communityId}/posts/${postId}`
  const [flat, setFlat] = useState<CommentData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = useSession()
  const viewerId = (session?.user as { id?: string } | undefined)?.id

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ comments: CommentData[] }>(`${postPath}/comments`)
      setFlat(data.comments)
      onCountChange?.(data.comments.filter((c) => !c.isRemoved).length)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [postPath, onCountChange])

  useEffect(() => {
    void load()
  }, [load])

  const tree = useMemo(() => buildTree(flat ?? []), [flat])

  return (
    <section aria-label="Comments" className="mt-8">
      <h2 className="eyebrow mb-3 border-b border-foreground/80 pb-2 text-foreground">Discussion{flat ? ` (${flat.filter((c) => !c.isRemoved).length})` : ""}</h2>
      <ReplyBox postPath={postPath} isMember={isMember} onDone={load} />
      {error ? (
        <div role="alert" className="mt-6 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm">
          {error}{" "}
          <button className="underline" onClick={load}>
            Retry
          </button>
        </div>
      ) : flat === null ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tree.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="mt-2">
          {tree.map((n) => (
            <CommentNode key={n.id} node={n} postPath={postPath} isMember={isMember} canModerate={canModerate} viewerId={viewerId} reload={load} />
          ))}
        </ul>
      )}
    </section>
  )
}
