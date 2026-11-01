"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Check, Eye, Loader2, Pencil, Trash2 } from "lucide-react"

import { Markdown } from "@/components/markdown"
import { VoteControl } from "@/components/vote-control"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Vote = "UP" | "DOWN" | null
type Person = { id: string; name: string | null; image: string | null; reputation?: number } | null

export interface QuestionData {
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
  author: Person
  isMine: boolean
  viewerVote: Vote
}

interface AnswerData {
  id: string
  content: string
  createdAt: string
  isAccepted: boolean
  isAiAssisted: boolean
  upvotes: number
  downvotes: number
  author: Person
  viewerVote: Vote
}

function PersonLine({ person, anonymous, when }: { person: Person; anonymous?: boolean; when: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {person && !anonymous ? (
        <Link href={`/profile/${person.id}`} className="flex items-center gap-2 hover:text-foreground">
          <Avatar className="h-6 w-6">
            <AvatarImage src={person.image || undefined} alt="" />
            <AvatarFallback className="text-[10px]">{person.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{person.name || "Learner"}</span>
          {typeof person.reputation === "number" && <span>{person.reputation} rep</span>}
        </Link>
      ) : (
        <span className="font-medium text-foreground">Anonymous</span>
      )}
      <span aria-hidden>·</span>
      <time dateTime={when}>{formatDistanceToNow(new Date(when), { addSuffix: true })}</time>
    </div>
  )
}

export function QuestionThread({ question, viewerId }: { question: QuestionData; viewerId: string | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const { open: openAuthModal } = useAuthModal()
  const signedIn = Boolean(viewerId)

  const [q, setQ] = useState(question)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(question.title)
  const [draftBody, setDraftBody] = useState(question.content)
  const [saving, setSaving] = useState(false)

  const [answers, setAnswers] = useState<AnswerData[]>([])
  const [loadingAnswers, setLoadingAnswers] = useState(true)
  const [newAnswer, setNewAnswer] = useState("")
  const [aiAssisted, setAiAssisted] = useState(false)
  const [posting, setPosting] = useState(false)
  const [editingAnswer, setEditingAnswer] = useState<{ id: string; text: string } | null>(null)
  const [busyAnswer, setBusyAnswer] = useState<string | null>(null)

  const loadAnswers = useCallback(async () => {
    try {
      const res = await fetch(`/api/doubts/${question.id}/answers?limit=50`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      setAnswers((await res.json()).answers)
    } catch {
      toast({ title: "Could not load answers", variant: "destructive" })
    } finally {
      setLoadingAnswers(false)
    }
  }, [question.id, toast])

  useEffect(() => {
    void loadAnswers()
  }, [loadAnswers])

  const api = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "Request failed")
    return data
  }

  const saveQuestion = async () => {
    setSaving(true)
    try {
      const data = await api(`/api/doubts/${q.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: draftTitle, content: draftBody }),
      })
      setQ((prev) => ({ ...prev, title: data.title, content: data.content }))
      setEditing(false)
      toast({ title: "Question updated" })
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const deleteQuestion = async () => {
    if (!window.confirm("Delete this question and all its answers? This cannot be undone.")) return
    try {
      await api(`/api/doubts/${q.id}`, { method: "DELETE" })
      toast({ title: "Question deleted" })
      router.push("/")
      router.refresh()
    } catch (e) {
      toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" })
    }
  }

  const postAnswer = async () => {
    if (!signedIn) return openAuthModal()
    setPosting(true)
    try {
      await api("/api/answers", {
        method: "POST",
        body: JSON.stringify({ doubtId: q.id, content: newAnswer, isAiAssisted: aiAssisted }),
      })
      setNewAnswer("")
      setAiAssisted(false)
      await loadAnswers()
      toast({ title: "Answer posted" })
    } catch (e) {
      toast({ title: "Could not post answer", description: (e as Error).message, variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }

  const accept = async (id: string) => {
    setBusyAnswer(id)
    try {
      await api(`/api/answers/${id}/accept`, { method: "POST" })
      setQ((prev) => ({ ...prev, isResolved: true }))
      await loadAnswers()
    } catch (e) {
      toast({ title: "Could not accept answer", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusyAnswer(null)
    }
  }

  const saveAnswer = async () => {
    if (!editingAnswer) return
    setBusyAnswer(editingAnswer.id)
    try {
      await api(`/api/answers/${editingAnswer.id}`, { method: "PATCH", body: JSON.stringify({ content: editingAnswer.text }) })
      setEditingAnswer(null)
      await loadAnswers()
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusyAnswer(null)
    }
  }

  const removeAnswer = async (id: string) => {
    if (!window.confirm("Delete your answer?")) return
    setBusyAnswer(id)
    try {
      await api(`/api/answers/${id}`, { method: "DELETE" })
      await loadAnswers()
      setQ((prev) => ({ ...prev, isResolved: answers.some((a) => a.id !== id && a.isAccepted) }))
    } catch (e) {
      toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusyAnswer(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* Question */}
      <article className="flex gap-4">
        <VoteControl
          endpoint={`/api/doubts/${q.id}/vote`}
          upvotes={q.upvotes}
          downvotes={q.downvotes}
          initialVote={q.viewerVote}
          signedIn={signedIn}
          disabled={q.isMine}
        />
        <div className="min-w-0 flex-1 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={200} aria-label="Title" />
              <Textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={10} maxLength={10000} aria-label="Details" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveQuestion} disabled={saving || draftTitle.trim().length < 8 || draftBody.trim().length < 20}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-display text-3xl leading-tight">{q.title}</h1>
                {q.isResolved && (
                  <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full border border-success/40 px-2.5 py-0.5 text-xs font-medium text-success">
                    <Check className="h-3.5 w-3.5" /> Resolved
                  </span>
                )}
              </div>
              <Markdown>{q.content}</Markdown>
            </>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{q.subject.replace(/_/g, " ").toLowerCase()}</Badge>
            {q.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <PersonLine person={q.author} anonymous={q.isAnonymous && !q.isMine} when={q.createdAt} />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" /> {q.views}
              </span>
              {q.isMine && !editing && (
                <>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button className="flex items-center gap-1 hover:text-destructive" onClick={deleteQuestion}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
          {q.isMine && q.isAnonymous && <p className="text-xs text-muted-foreground">Posted anonymously. Only you can see that it is yours.</p>}
        </div>
      </article>

      {/* Answers */}
      <section aria-labelledby="answers-heading" className="space-y-6">
        <h2 id="answers-heading" className="text-xl font-semibold">
          {answers.length} {answers.length === 1 ? "answer" : "answers"}
        </h2>

        {loadingAnswers ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading answers
          </div>
        ) : answers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No answers yet. If you know this, write the first one below.
          </p>
        ) : (
          <ul className="space-y-6">
            {answers.map((a) => {
              const mine = a.author?.id === viewerId
              const isEditing = editingAnswer?.id === a.id
              return (
                <li key={a.id} className={cn("flex gap-4 rounded-lg border p-4", a.isAccepted && "border-success/50 bg-success/5")}>
                  <VoteControl
                    endpoint={`/api/answers/${a.id}/vote`}
                    upvotes={a.upvotes}
                    downvotes={a.downvotes}
                    initialVote={a.viewerVote}
                    signedIn={signedIn}
                    disabled={mine}
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    {a.isAccepted && (
                      <p className="flex items-center gap-1 text-sm font-medium text-success">
                        <Check className="h-4 w-4" /> Accepted answer
                      </p>
                    )}
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingAnswer.text}
                          onChange={(e) => setEditingAnswer({ id: a.id, text: e.target.value })}
                          rows={8}
                          aria-label="Edit answer"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveAnswer} disabled={busyAnswer === a.id || editingAnswer.text.trim().length < 10}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingAnswer(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Markdown>{a.content}</Markdown>
                    )}
                    {a.isAiAssisted && <p className="text-xs text-muted-foreground">The author says AI helped write this answer.</p>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <PersonLine person={a.author} when={a.createdAt} />
                      <div className="flex items-center gap-3 text-sm">
                        {q.isMine && !a.isAccepted && !mine && (
                          <Button size="sm" variant="outline" disabled={busyAnswer === a.id} onClick={() => accept(a.id)}>
                            <Check className="mr-1 h-4 w-4" /> Accept answer
                          </Button>
                        )}
                        {mine && !isEditing && (
                          <>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => setEditingAnswer({ id: a.id, text: a.content })}>
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-destructive" onClick={() => removeAnswer(a.id)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Write an answer */}
      <section aria-labelledby="write-heading" className="space-y-3">
        <h2 id="write-heading" className="text-xl font-semibold">
          Your answer
        </h2>
        <Textarea
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
          onFocus={() => !signedIn && openAuthModal()}
          rows={8}
          maxLength={10000}
          placeholder={signedIn ? "Explain the idea, not just the result. Markdown is supported." : "Sign in to answer"}
          aria-label="Your answer"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="ai-assisted" checked={aiAssisted} onCheckedChange={setAiAssisted} />
            <Label htmlFor="ai-assisted" className="text-sm text-muted-foreground">
              AI helped me write this
            </Label>
          </div>
          <Button onClick={postAnswer} disabled={posting || (signedIn && newAnswer.trim().length < 10)}>
            {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post answer
          </Button>
        </div>
      </section>
    </div>
  )
}
