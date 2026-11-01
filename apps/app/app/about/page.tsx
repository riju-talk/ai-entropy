import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "About" }

const FEATURES = [
  ["Ask and learn", "Answers with citations from your own uploads, trusted community answers and the web."],
  ["Remembers you", "Mastery and focus time are tracked per topic, so quizzes and reviews follow what you actually know."],
  ["Practice built in", "Quizzes, flashcards and mind maps generated from the same material you just read."],
  ["Focus timer", "Pomodoro sessions tied to a topic, kept in your learner profile."],
  ["Community", "Doubts, answers, voting, reputation and mentorship from people studying the same things."],
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow mb-3">About</p>
      <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">
        Learning tools that know what you&apos;re studying.
      </h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Students learn from scattered places: their own notes, forum answers, the web. Generic AI answers know none of it
        and forget you next session. Entropy brings those sources together, answers from them, and turns every question
        into practice.
      </p>

      <dl className="mt-12 divide-y border-y border-foreground/80">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-display text-xl">{title}</dt>
            <dd className="text-muted-foreground">{body}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex gap-3">
        <Button asChild size="lg">
          <Link href="/ask">Ask a question</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/ai-agent">Try AI study</Link>
        </Button>
      </div>
    </div>
  )
}
