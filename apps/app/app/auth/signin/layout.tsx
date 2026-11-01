import type React from "react"
import Link from "next/link"

import { Wordmark } from "@/components/header"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-8 grid min-h-[calc(100vh-3.5rem)] sm:-mx-6 lg:-mx-10 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-foreground p-12 text-background lg:flex">
        <Link href="/" aria-label="Entropy home">
          <Wordmark />
        </Link>
        <div>
          <h2 className="font-display text-5xl leading-[1.05]">
            Ask it.
            <br />
            Work it out.
            <br />
            <span className="text-primary">Keep it.</span>
          </h2>
          <p className="mt-6 max-w-sm text-background/70">
            Questions answered from your own notes, trusted community answers and the web, then turned into practice.
          </p>
        </div>
        <p className="font-mono text-xs text-background/50">Quizzes / flashcards / mind maps / focus timer</p>
      </div>
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
