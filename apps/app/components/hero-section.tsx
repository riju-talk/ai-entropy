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
      // Mark as visited after showing hero
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
    <div className="relative mb-12 py-10 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* Background effects */}
      <div className="absolute top-0 right-0 -z-10 opacity-60 pointer-events-none hidden dark:block">
        <div className="w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>
      <div className="absolute bottom-0 left-0 -z-10 opacity-40 pointer-events-none hidden dark:block">
        <div className="w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground z-10"
        aria-label="Dismiss welcome message"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="space-y-6 max-w-3xl">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9]">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-gradient-x contrast-125">
            Entropy.
          </span>
          <br />
          <span className="text-foreground text-5xl md:text-7xl tracking-normal font-semibold">
            Learn without limits.
          </span>
        </h1>

        <p className="text-xl text-muted-foreground/80 font-medium leading-relaxed max-w-lg">
          The distinct urban space for academic discourse. Join {totalQuestions}+ students and experts pushing the boundaries of knowledge.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button 
            size="lg" 
            className="h-14 rounded-2xl px-8 text-lg font-bold shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] transition-all bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0" 
            asChild
          >
            <Link href="/ask">Ask a Question</Link>
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="h-14 rounded-2xl px-8 text-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400 transition-all font-semibold" 
            asChild
          >
            <Link href="/communities">Explore Hubs</Link>
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-8 pt-4">
          <div className="flex flex-col">
            <span className="text-2xl font-bold font-mono text-foreground">{totalQuestions}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Questions</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold font-mono text-foreground">{totalAnswers}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Answers</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold font-mono text-green-500">Active</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Community</span>
          </div>
        </div>
      </div>
    </div>
  )
}
