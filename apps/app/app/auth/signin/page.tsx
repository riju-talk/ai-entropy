"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Globe, Github, Brain } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { signIn, useSession } from "next-auth/react"
import Link from "next/link"

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const callbackUrl = searchParams.get('callbackUrl') || '/'

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl)
    }
  }, [status, router, callbackUrl])

  const handleSignIn = async (provider: "google" | "github") => {
    setIsLoading(provider)
    try {
      const result = await signIn(provider, { callbackUrl, redirect: true })
      if (result?.error) {
        toast({ title: "Sign-in failed", description: `There was an issue signing in with ${provider}. Please try again.`, variant: "destructive" })
      }
    } catch (error) {
      console.error(`${provider} sign-in failed:`, error)
      toast({ title: "Sign-in failed", description: `There was an issue signing in with ${provider}. Please try again.`, variant: "destructive" })
    } finally {
      setIsLoading(null)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 text-white/40 font-mono">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[11px] uppercase tracking-widest">Initialising...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 font-mono">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-1.5 rounded-lg">
            <Brain className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">ENTROPY · AUTH</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Sign in
        </h1>
        <p className="text-[12px] text-white/40 leading-relaxed">
          Access your cognitive workspace. Choose a provider to continue.
        </p>
      </div>

      {/* Auth box */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-3 shadow-[0_0_40px_rgba(6,182,212,0.05)]">
        <div className="text-[9px] uppercase tracking-[0.2em] text-cyan-500/50 mb-4">// SELECT_PROVIDER</div>

        {/* Google */}
        <button
          disabled={!!isLoading}
          onClick={() => handleSignIn("google")}
          className="w-full flex items-center gap-3 px-4 h-11 rounded-lg border border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all text-[11px] uppercase tracking-[0.1em] font-bold disabled:opacity-40"
        >
          {isLoading === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          ) : (
            <Globe className="h-4 w-4 text-white/40" />
          )}
          {isLoading === "google" ? "Redirecting..." : "Continue with Google"}
        </button>

        {/* GitHub */}
        <button
          disabled={!!isLoading}
          onClick={() => handleSignIn("github")}
          className="w-full flex items-center gap-3 px-4 h-11 rounded-lg border border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all text-[11px] uppercase tracking-[0.1em] font-bold disabled:opacity-40"
        >
          {isLoading === "github" ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          ) : (
            <Github className="h-4 w-4 text-white/40" />
          )}
          {isLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/20">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <Link
          href="/"
          className="w-full flex items-center justify-center h-10 rounded-lg text-[11px] uppercase tracking-[0.1em] text-white/25 hover:text-white/50 transition-colors"
        >
          Explore as guest
        </Link>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-white/20 space-y-2 text-center">
        <p>By signing in you agree to our Terms of Service</p>
        <div className="flex justify-center gap-3">
          <Link href="#" className="hover:text-white/40 transition-colors">Privacy policy</Link>
          <span className="text-white/10">·</span>
          <Link href="#" className="hover:text-white/40 transition-colors">Terms of service</Link>
        </div>
      </div>
    </div>
  )
}
