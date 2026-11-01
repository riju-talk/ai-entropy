"use client"

import { useEffect, useState } from "react"
import { getProviders, signIn } from "next-auth/react"
import { Loader2, FlaskConical } from "lucide-react"

const PERSONAS = [
  { email: "student@local.dev", name: "Test Student", hint: "joined most communities, has questions and answers" },
  { email: "student2@local.dev", name: "Second Student", hint: "a second account to test interactions" },
  { email: "mentor@local.dev", name: "Test Mentor", hint: "moderates communities, mentorship requests" },
]

/**
 * Local-only sign-in. Renders nothing unless the server enabled the "dev-login" provider,
 * which only happens outside production with ENABLE_DEV_LOGIN=true (see lib/auth.ts).
 */
export function DevLogin({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [custom, setCustom] = useState("")

  useEffect(() => {
    getProviders()
      .then((p) => setEnabled(Boolean(p && p["dev-login"])))
      .catch(() => setEnabled(false))
  }, [])

  if (!enabled) return null

  const login = async (email: string, name?: string) => {
    setBusy(email)
    await signIn("dev-login", { email, name, callbackUrl })
    setBusy(null)
  }

  const customEmail = custom.trim().toLowerCase()
  const customValid = /^[a-z0-9._-]+$/.test(customEmail)

  return (
    <div className="rounded border border-warning/30 bg-warning/[0.04] p-4 space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-warning/80">
        <FlaskConical className="h-3.5 w-3.5" /> Demo accounts (local only, no password)
      </div>
      <div className="space-y-2">
        {PERSONAS.map((p) => (
          <button
            key={p.email}
            type="button"
            disabled={!!busy}
            onClick={() => login(p.email, p.name)}
            className="w-full flex items-center justify-between gap-3 px-3 h-10 rounded border border-border bg-card hover:bg-accent text-left text-[11px] text-foreground hover:text-foreground transition-all disabled:opacity-40"
          >
            <span className="font-bold">{p.name}</span>
            <span className="text-[9px] text-muted-foreground truncate">{busy === p.email ? <Loader2 className="h-3 w-3 animate-spin" /> : p.hint}</span>
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (customValid) void login(`${customEmail}@local.dev`)
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="any-name"
          className="flex-1 h-9 rounded border border-border bg-transparent px-3 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-warning/40"
        />
        <span className="self-center text-[11px] text-muted-foreground">@local.dev</span>
        <button
          type="submit"
          disabled={!customValid || !!busy}
          className="px-3 h-9 rounded border border-warning/30 text-[10px] uppercase tracking-widest text-warning hover:bg-warning/10 disabled:opacity-30"
        >
          Go
        </button>
      </form>
    </div>
  )
}
