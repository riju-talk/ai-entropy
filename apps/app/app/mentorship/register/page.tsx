"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Form {
  headline: string
  bio: string
  university: string
  subjects: string
  expertise: string
  availability: string
}

const EMPTY: Form = { headline: "", bio: "", university: "", subjects: "", expertise: "", availability: "" }

export default function RegisterMentorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(EMPTY)
  const [exists, setExists] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/mentors/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m = d?.mentor
        if (m) {
          setExists(true)
          setIsActive(m.isActive)
          setForm({
            headline: m.headline,
            bio: m.bio,
            university: m.university || "",
            subjects: m.subjects.join(", "),
            expertise: m.expertise.join(", "),
            availability: m.availability,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Registration is POST /api/mentors; editing an existing profile is PATCH /api/mentors/me
      const res = await fetch(exists ? "/api/mentors/me" : "/api/mentors", {
        method: exists ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exists ? { ...form, isActive } : form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (exists ? "Could not save" : "Could not register"))
      toast(
        exists
          ? { title: "Profile saved" }
          : { title: "You are now a mentor", description: "Students can request sessions with you." }
      )
      router.push("/mentorship")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div>
        <Link href="/mentorship" className="text-xs text-muted-foreground hover:underline">
          Back to mentors
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          {exists ? "Your mentor profile" : "Register as a mentor"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Share what you can teach. Students find you by subject and expertise, then send you a session request.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={form.headline}
            onChange={set("headline")}
            placeholder="e.g. Final-year CS student, algorithms and interview prep"
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">About you</Label>
          <Textarea
            id="bio"
            value={form.bio}
            onChange={set("bio")}
            rows={5}
            maxLength={1500}
            placeholder="Your experience, how you like to teach, and what students can expect."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="university">University (optional)</Label>
          <Input id="university" value={form.university} onChange={set("university")} maxLength={120} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subjects">Subjects</Label>
            <Input
              id="subjects"
              value={form.subjects}
              onChange={set("subjects")}
              placeholder="CS, Math"
              required
            />
            <p className="text-[11px] text-muted-foreground">Comma separated. Used for the filter chips.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expertise">Areas of expertise</Label>
            <Input
              id="expertise"
              value={form.expertise}
              onChange={set("expertise")}
              placeholder="Algorithms, Dynamic programming"
              required
            />
            <p className="text-[11px] text-muted-foreground">Comma separated.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="availability">Availability</Label>
          <Input
            id="availability"
            value={form.availability}
            onChange={set("availability")}
            placeholder="Weekdays 6-8 PM IST"
            maxLength={200}
            required
          />
        </div>

        {exists && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="active">Accepting new requests</Label>
              <p className="text-[11px] text-muted-foreground">Turn off to hide your profile from the list.</p>
            </div>
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {exists ? "Save changes" : "Register as a mentor"}
        </Button>
      </form>
    </div>
  )
}
