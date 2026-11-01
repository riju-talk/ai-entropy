"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { getProviders, signIn, useSession } from "next-auth/react"
import { Github, Globe, Loader2 } from "lucide-react"

import { DevLogin } from "@/components/dev-login"
import { authErrorMessage } from "@/lib/auth-errors"

const OAUTH = [
  { id: "google", label: "Google", Icon: Globe },
  { id: "github", label: "GitHub", Icon: Github },
] as const

function SignInForm() {
  const [busy, setBusy] = useState<string | null>(null)
  const [available, setAvailable] = useState<string[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const { status } = useSession()

  const callbackUrl = params.get("callbackUrl") || "/"
  const errorCode = params.get("error")

  useEffect(() => {
    if (status === "authenticated") router.push(callbackUrl)
  }, [status, router, callbackUrl])

  useEffect(() => {
    getProviders()
      .then((p) => setAvailable(Object.keys(p ?? {})))
      .catch(() => {
        setAvailable([])
        setLoadFailed(true)
      })
  }, [])

  const oauthShown = OAUTH.filter((p) => available?.includes(p.id))
  const hasDemo = !!available?.includes("dev-login")
  const nothingConfigured = available !== null && oauthShown.length === 0 && !hasDemo

  const start = async (id: string) => {
    setBusy(id)
    try {
      await signIn(id, { callbackUrl })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Sign in</h1>
        <p className="mt-2 text-muted-foreground">
          {hasDemo && oauthShown.length === 0 ? "Pick a demo account to try the app." : "Pick a provider to continue. No password to remember."}
        </p>
      </div>

      {errorCode && (
        <div role="alert" className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm">
          {authErrorMessage(errorCode)}
        </div>
      )}

      {available === null && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-mono text-xs">Loading sign-in options...</span>
        </div>
      )}

      {oauthShown.length > 0 && (
        <div className="space-y-3">
          {oauthShown.map(({ id, label, Icon }) => (
            <button
              key={id}
              disabled={!!busy}
              onClick={() => start(id)}
              className="flex h-11 w-full items-center gap-3 border border-foreground/70 px-4 text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
            >
              {busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" strokeWidth={1.5} />}
              {busy === id ? "Redirecting..." : `Continue with ${label}`}
            </button>
          ))}
        </div>
      )}

      {nothingConfigured && (
        <div role="alert" className="border-l-2 border-warning bg-warning/5 px-4 py-3 text-sm">
          {loadFailed
            ? "Could not reach the sign-in service. Refresh the page, or try again in a moment."
            : "No sign-in method is configured on this server. Set Google or GitHub credentials, or ENABLE_DEV_LOGIN=true for local demos."}
        </div>
      )}

      <DevLogin callbackUrl={callbackUrl} />

      <Link href="/" className="inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Look around as a guest
      </Link>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
