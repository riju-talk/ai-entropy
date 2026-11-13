"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/image-upload"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { apiFetch, ApiError } from "@/lib/client-api"
import { cn } from "@/lib/utils"

/** Collapsed "Create a post" bar that expands into a text/link form. Members only. */
export function PostComposer({ communityId, isMember, onPosted }: { communityId: string; isMember: boolean; onPosted: () => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<"text" | "link">("text")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const { status } = useSession()
  const { open: openAuth } = useAuthModal()
  const { toast } = useToast()

  const start = () => {
    if (status !== "authenticated") return openAuth()
    if (!isMember) {
      toast({ title: "Join first", description: "Join this community to post in it." })
      return
    }
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await apiFetch(`/api/communities/${communityId}/posts`, {
        method: "POST",
        json: { title, ...(kind === "text" ? { body } : { url }) },
      })
      setTitle("")
      setBody("")
      setUrl("")
      setOpen(false)
      onPosted()
      toast({ title: "Posted" })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) openAuth()
      else toast({ title: "Could not post", description: (err as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={start}
        className="mb-4 w-full border border-dashed border-foreground/40 px-4 py-3 text-left text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        Start a discussion...
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-3 border border-foreground/80 p-4">
      <div className="flex gap-4 text-sm">
        {(["text", "link"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn("border-b-2 pb-0.5 capitalize", kind === k ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
          >
            {k}
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={300} required aria-label="Title" />
      {kind === "text" ? (
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="What do you want to discuss? Markdown works." aria-label="Post text" />
      ) : (
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." aria-label="Link" required />
      )}
      {kind === "text" && <ImageUpload onUploaded={(md) => setBody((b) => (b ? b + "\n\n" : "") + md)} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || title.trim().length < 3}>
          {busy ? "Posting..." : "Post"}
        </Button>
      </div>
    </form>
  )
}
