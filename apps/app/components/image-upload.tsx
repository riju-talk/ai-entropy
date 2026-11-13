"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

/** Picks an image, uploads it, and hands back a Markdown snippet to insert into the text. */
export function ImageUpload({ onUploaded, disabled }: { onUploaded: (markdown: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/uploads", { method: "POST", body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Upload failed")
      onUploaded(data.markdown)
      toast({ title: "Picture added" })
    } catch (e) {
      toast({ title: "Could not upload picture", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload a picture"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {busy ? "Uploading..." : "Add picture"}
      </Button>
    </>
  )
}
