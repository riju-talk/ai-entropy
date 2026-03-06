"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { X } from "lucide-react"

interface HeroSectionProps {
  totalQuestions: number
  totalAnswers: number
}

export function HeroSection({ totalQuestions, totalAnswers }: HeroSectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    // Check if user has visited before
    const hasVisited = localStorage.getItem("entropy_has_visited")
    
    if (!hasVisited) {
      setIsVisible(true)
      localStorage.setItem("entropy_has_visited", "true")
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
  }

  // Don't render anything until mounted (prevents hydration mismatch)
  if (!isMounted || !isVisible) {
    return null
  }

  return (
    <div className="relative mb-8 py-8 md:py-12 animate-in fade-in slide-in-from-top-4 duration-700 font-mono">
      {/* Background grid effect */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 -z-10 pointer-events-none">
        <div className="w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-white/[0.06] border border-white/[0.06] transition-colors text-white/20 hover:text-white/50 z-10"
        aria-label="Dismiss welcome message"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Status bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">Engine Active</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400">7-Layer Reasoning</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400">Knowledge Graph</span>
        </div>
      </div>

      <div className="space-y-5 max-w-3xl">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-3">// COGNITIVE LEARNING PLATFORM</p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[0.9]">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              ENTROPY.
            </span>
            <br />
            <span className="text-white/80 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-normal mt-2 block">
              Learn without limits.
            </span>
          </h1>
        </div>

        <p className="text-sm text-white/40 font-normal leading-relaxed max-w-lg">
          Adaptive intelligence that maps your knowledge, identifies gaps, and generates personalised learning paths in real-time. Join{" "}
          <span className="text-cyan-400 font-bold">{totalQuestions}+</span> students pushing the boundaries of knowledge.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button
            size="lg"
            className="h-10 rounded-lg px-6 text-[11px] font-bold uppercase tracking-[0.15em] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.25)] transition-all"
            asChild
          >
            <Link href="/">⚡ Adaptive Learning</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-10 rounded-lg px-6 text-[11px] font-bold uppercase tracking-[0.15em] bg-transparent border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.04] hover:border-white/20 transition-all"
            asChild
          >
            <Link href="/communities">◈ Communities</Link>
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 pt-3 border-t border-white/[0.06]">
          <div>
            <span className="text-xl font-bold font-mono text-white">{totalQuestions}</span>
            <p className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-bold mt-0.5">Questions</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <span className="text-xl font-bold font-mono text-white">{totalAnswers}</span>
            <p className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-bold mt-0.5">Answers</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <span className="text-xl font-bold font-mono text-emerald-400">LIVE</span>
            <p className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-bold mt-0.5">Community</p>
          </div>
        </div>
      </div>
    </div>
  )
}
