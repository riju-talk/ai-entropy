"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { ApiError, apiFetch } from "@/lib/client-api"
import { cn } from "@/lib/utils"

const SUBJECTS = [
  ["COMPUTER_SCIENCE", "Computer Science"],
  ["MATHEMATICS", "Mathematics"],
  ["PHYSICS", "Physics"],
  ["CHEMISTRY", "Chemistry"],
  ["BIOLOGY", "Biology"],
  ["ENGINEERING", "Engineering"],
  ["PSYCHOLOGY", "Psychology"],
  ["HISTORY", "History"],
  ["LITERATURE", "Literature"],
  ["BUSINESS", "Business"],
]

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)

export default function CreateCommunityPage() {
  const { status } = useSession()
  const { open: openAuth } = useAuthModal()
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [subject, setSubject] = useState("COMPUTER_SCIENCE")
  const [rules, setRules] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status !== "authenticated") return openAuth()
    setBusy(true)
    try {
      const { community } = await apiFetch<{ community: { slug: string; id: string } }>("/api/communities", {
        method: "POST",
        json: { name, description, subject, isPublic, rules: rules.split("\n") },
      })
      toast({ title: "Community created" })
      router.push(`/communities/${community.slug ?? community.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) openAuth()
      else toast({ title: "Could not create community", description: (err as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow mb-2">New community</p>
      <h1 className="font-display text-4xl">Start a community</h1>
      <p className="mt-2 text-muted-foreground">Pick a name people will remember. You will be its first admin.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Linear Algebra Study Group" maxLength={40} required />
          {name.trim() && <p className="mt-1 font-mono text-xs text-muted-foreground">c/{slugOf(name) || "..."}</p>}
        </div>

        <div>
          <label htmlFor="desc" className="mb-1 block text-sm font-medium">
            What is it about?
          </label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-medium">Subject</span>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger aria-label="Subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Who can read it?</span>
            <div className="flex gap-4 pt-2 text-sm">
              {[
                [true, "Anyone"],
                [false, "Members only"],
              ].map(([v, l]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setIsPublic(v as boolean)}
                  aria-pressed={isPublic === v}
                  className={cn("border-b-2 pb-0.5", isPublic === v ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {l as string}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="rules" className="mb-1 block text-sm font-medium">
            Rules <span className="font-normal text-muted-foreground">(one per line, up to 8)</span>
          </label>
          <Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder={"Be respectful\nShow your working"} />
        </div>

        <Button type="submit" size="lg" disabled={busy || name.trim().length < 3}>
          {busy ? "Creating..." : "Create community"}
        </Button>
      </form>
    </div>
  )
}
