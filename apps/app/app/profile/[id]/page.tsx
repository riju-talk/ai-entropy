"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  Award,
  CalendarDays,
  Check,
  Flame,
  GraduationCap,
  HelpCircle,
  Loader2,
  MessageSquare,
  Pencil,
  Timer,
  ThumbsUp,
  Users,
} from "lucide-react"

import { ActivityHeatmap } from "@/components/activity-heatmap"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Profile {
  isSelf: boolean
  user: {
    id: string
    name: string | null
    image: string | null
    email?: string
    bio: string | null
    university: string | null
    course: string | null
    year: number | null
    reputation: number
    totalXP: number
    tier: string
    createdAt: string
  }
  engagement: {
    questions: number
    answers: number
    acceptedAnswers: number
    resolvedQuestions: number
    upvotesReceived: number
    currentStreak: number
    longestStreak: number
    activeDays: number
    focusSeconds: number
    focusSessions: number
    eventsHosted: number
    eventsJoined: number
    mentorSessions: number
    achievements: number
  }
  topics: Record<string, number> | null
  mentor: { id: string; headline: string; subjects: string[] } | null
  communities: { id: string; name: string }[]
  achievements: { name: string; description: string; rarity: string; unlockedAt: string }[]
  recentQuestions: { id: string; title: string; createdAt: string; isResolved: boolean; isAnonymous: boolean; upvotes: number; _count: { answers: number } }[]
  recentAnswers: { id: string; content: string; createdAt: string; isAccepted: boolean; upvotes: number; doubt: { id: string; title: string } }[]
  activity: { date: string; count: number }[]
}

function hours(seconds: number) {
  if (seconds < 60) return "0m"
  const m = Math.round(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<Profile | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${params.id}/profile`, { cache: "no-store" })
      if (res.status === 404) return setState("missing")
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setState("ready")
    } catch {
      setState("error")
    }
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile
      </div>
    )
  }
  if (state === "missing") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="font-display text-2xl">Profile not found</h1>
        <p className="mt-2 text-muted-foreground">This person does not exist or their account is unavailable.</p>
        <Button asChild className="mt-6">
          <Link href="/">Back to questions</Link>
        </Button>
      </div>
    )
  }
  if (state === "error" || !data) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-muted-foreground">Could not load this profile.</p>
        <Button className="mt-4" variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  const { user, engagement: e, isSelf } = data
  const name = user.name || "Anonymous learner"
  const subtitle = [user.course, user.year ? `Year ${user.year}` : null, user.university].filter(Boolean).join(" · ")
  const topTopics = data.topics ? Object.entries(data.topics).sort((a, b) => b[1] - a[1]).slice(0, 6) : []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 border">
          <AvatarImage src={user.image || undefined} alt="" />
          <AvatarFallback className="text-2xl">{name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{name}</h1>
            <Badge variant="secondary" className="capitalize">
              {user.tier.toLowerCase()}
            </Badge>
            {data.mentor && (
              <Badge variant="outline" className="gap-1">
                <GraduationCap className="h-3 w-3" /> Mentor
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {user.bio && <p className="max-w-2xl text-sm leading-relaxed">{user.bio}</p>}
          <p className="text-xs text-muted-foreground">
            Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })} · {user.reputation} reputation · {user.totalXP} XP
          </p>
        </div>
        <div className="flex gap-2">
          {isSelf ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit profile
            </Button>
          ) : (
            data.mentor && (
              <Button size="sm" asChild>
                <Link href="/mentorship">Request a session</Link>
              </Button>
            )
          )}
        </div>
      </section>

      {/* Engagement */}
      <section aria-labelledby="engagement" className="space-y-3">
        <h2 id="engagement" className="text-lg font-semibold">
          Engagement
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={HelpCircle} label="Questions" value={e.questions} hint={`${e.resolvedQuestions} resolved`} />
          <Stat icon={MessageSquare} label="Answers" value={e.answers} hint={`${e.acceptedAnswers} accepted`} />
          <Stat icon={ThumbsUp} label="Upvotes received" value={e.upvotesReceived} />
          <Stat icon={Award} label="Achievements" value={e.achievements} />
          <Stat icon={Flame} label="Day streak" value={e.currentStreak} hint={`Longest ${e.longestStreak}`} />
          <Stat icon={Timer} label="Focus time" value={hours(e.focusSeconds)} hint={`${e.focusSessions} sessions`} />
          <Stat icon={CalendarDays} label="Events" value={e.eventsJoined} hint={`${e.eventsHosted} hosted`} />
          <Stat icon={GraduationCap} label="Mentor sessions" value={e.mentorSessions} />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Activity in the last 26 weeks</h3>
            <span className="text-xs text-muted-foreground">{e.activeDays} active days</span>
          </div>
          <ActivityHeatmap days={data.activity} />
        </div>
      </section>

      {/* Details */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions ({e.questions})</TabsTrigger>
          <TabsTrigger value="answers">Answers ({e.answers})</TabsTrigger>
          <TabsTrigger value="achievements">Achievements ({e.achievements})</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-2">
          {data.recentQuestions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isSelf ? "You have not asked a question yet." : "No public questions yet."}
              {isSelf && (
                <>
                  {" "}
                  <Link href="/ask" className="underline">
                    Ask one
                  </Link>
                </>
              )}
            </p>
          )}
          {data.recentQuestions.map((q) => (
            <Link key={q.id} href={`/doubt/${q.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{q.title}</span>
                {q.isResolved && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Resolved
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {q._count.answers} {q._count.answers === 1 ? "answer" : "answers"} · {q.upvotes} votes ·{" "}
                {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                {q.isAnonymous && " · posted anonymously (only you can see this)"}
              </div>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="answers" className="space-y-2">
          {data.recentAnswers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No answers yet.</p>}
          {data.recentAnswers.map((a) => (
            <Link key={a.id} href={`/doubt/${a.doubt.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium">{a.doubt.title}</span>
                {a.isAccepted && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Accepted
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.content}</p>
              <div className="mt-1 text-xs text-muted-foreground">
                {a.upvotes} votes · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
              </div>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="achievements">
          {data.achievements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No achievements unlocked yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.achievements.map((a) => (
                <li key={a.name} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {a.rarity.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Unlocked {formatDistanceToNow(new Date(a.unlockedAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {isSelf && (
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href="/profile/achievements">See all achievements and progress</Link>
            </Button>
          )}
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          {data.mentor && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="flex items-center gap-2 font-medium">
                <GraduationCap className="h-4 w-4" /> Mentor
              </h3>
              <p className="mt-1 text-sm">{data.mentor.headline}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.mentor.subjects.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" /> Communities
            </h3>
            {data.communities.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Not a member of any community yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.communities.map((c) => (
                  <li key={c.id}>
                    <Link href={`/communities/${c.id}`} className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isSelf && topTopics.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="flex items-center gap-2 font-medium">
                <Timer className="h-4 w-4" /> Where your focus time goes
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {topTopics.map(([topic, secs]) => (
                  <li key={topic} className="flex justify-between gap-2">
                    <span className="truncate">{topic}</span>
                    <span className="text-muted-foreground">{hours(secs)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Only you can see this.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {isSelf && (
        <EditProfileModal
          open={editing}
          onOpenChange={setEditing}
          user={{ name: user.name, bio: user.bio, university: user.university, course: user.course, year: user.year, image: user.image }}
          onUpdate={load}
        />
      )}
    </div>
  )
}
