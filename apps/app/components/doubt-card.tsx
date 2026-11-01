import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface DoubtSummary {
  id: string
  title: string
  content: string
  subject: string
  tags: string[]
  isAnonymous: boolean
  isResolved: boolean
  views: number
  upvotes: number
  downvotes: number
  createdAt: string
  author: { id: string; name: string | null; image: string | null } | null
  _count: { answers: number }
}

export function DoubtCard({ doubt }: { doubt: DoubtSummary }) {
  const score = doubt.upvotes - doubt.downvotes
  const answers = doubt._count.answers

  return (
    <article className="group relative grid grid-cols-[3.25rem_1fr] gap-4 py-5">
      <div className="flex flex-col items-center font-mono leading-none">
        <span className="text-lg tabular-nums">{score}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">votes</span>
        <span
          className={cn(
            "mt-3 rounded-sm px-1.5 py-1 text-sm tabular-nums",
            doubt.isResolved ? "bg-success text-background" : answers > 0 ? "border border-success text-success" : "text-muted-foreground"
          )}
        >
          {answers}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">ans</span>
      </div>

      <div className="min-w-0">
        <h3 className="font-display text-xl leading-snug sm:text-2xl">
          <Link href={`/doubt/${doubt.id}`} className="after:absolute after:inset-0 group-hover:text-primary">
            {doubt.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-muted-foreground">{doubt.content}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {doubt.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="font-mono text-xs text-foreground/70">
              #{tag}
            </span>
          ))}
          <span className="relative z-10 ml-auto flex items-center gap-2">
            {doubt.author && !doubt.isAnonymous ? (
              <Link href={`/profile/${doubt.author.id}`} className="flex items-center gap-2 hover:text-foreground">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={doubt.author.image || undefined} alt="" />
                  <AvatarFallback className="text-[10px]">{doubt.author.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <span className="max-w-[10rem] truncate">{doubt.author.name || "Learner"}</span>
              </Link>
            ) : (
              <span>Anonymous</span>
            )}
            <span aria-hidden>/</span>
            <time dateTime={doubt.createdAt}>{formatDistanceToNow(new Date(doubt.createdAt), { addSuffix: true })}</time>
          </span>
        </div>
      </div>
    </article>
  )
}
