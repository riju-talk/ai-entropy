"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Trophy, Timer, X, Brain, CheckCircle2, XCircle,
  Loader2, Zap, Target, BrainCircuit, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

export interface ExamResultBreakdown {
  finalScore: number
  totalTime: number
  avgConfidence: number
  questions: any[]
  conceptsMastered: string[]
  conceptsWeak: string[]
}

interface ExamModeOverlayProps {
  onExit: () => void
  onComplete: (result: ExamResultBreakdown) => void
  subject?: string
}

type Difficulty = "easy" | "medium" | "hard"

function buildFallback(topic: string, n: number, diff: Difficulty): QuizQuestion[] {
  const t = topic || "the subject"
  const isHard = diff === "hard"
  const qs: QuizQuestion[] = []
  for (let i = 0; i < n; i++) {
    qs.push({
      question: isHard
        ? `Which statement most precisely characterises the core mechanism of ${t}? (Q${i + 1})`
        : `Which of the following is correct about ${t}? (Q${i + 1})`,
      options: [
        `${t} relies exclusively on deterministic linear processes`,
        `${t} involves structured transformation of inputs to outputs`,
        `${t} is purely theoretical with no practical applications`,
        `${t} operates in isolation from all related disciplines`,
      ],
      correctAnswer: 1,
      explanation: `${t} fundamentally involves structured transformation — option B is most accurate.`,
    })
  }
  return qs
}

// ── Main Component ────────────────────────────────────────────────────────────

function normalizeConcept(raw: string): string {
  const s = raw.trim()
    .replace(/^(small\s+)?pop\s+quiz\s+(on|about|for)\s+/i, "")
    .replace(/^(quick\s+)?(quiz|test|exam|assessment)\s+(on|about|for)\s+/i, "")
    .replace(/^(quiz|test|exam|assessment):\s*/i, "")
    .trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ExamModeOverlay({ onExit, onComplete, subject = "" }: ExamModeOverlayProps) {
  const { data: session } = useSession()
  const [phase, setPhase] = useState<"configure" | "exam" | "results">("configure")
  const [topic, setTopic] = useState(subject || "")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [numQuestions, setNumQuestions] = useState(5)
  const [loading, setLoading] = useState(false)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [selected, setSelected] = useState<number | undefined>(undefined)
  const [showResult, setShowResult] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [startTime] = useState(Date.now())
  const [qStartTime, setQStartTime] = useState(Date.now())

  const timePerQ = difficulty === "hard" ? 45 : difficulty === "medium" ? 75 : 120

  // Per-question countdown
  useEffect(() => {
    if (phase !== "exam" || showResult) return
    setTimeLeft(timePerQ)
    const interval = setInterval(() => {
      setTimeLeft(v => {
        if (v <= 1) {
          clearInterval(interval)
          autoAdvance()
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [current, phase, showResult])

  const autoAdvance = useCallback(() => {
    setAnswers(prev => ({ ...prev, [current]: prev[current] ?? -1 }))
    setShowResult(true)
  }, [current])

  const handleSelect = (idx: number) => {
    if (showResult) return
    setSelected(idx)
    setAnswers(prev => ({ ...prev, [current]: idx }))
    setShowResult(true)
  }

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      finalize()
    } else {
      setCurrent(c => c + 1)
      setSelected(undefined)
      setShowResult(false)
      setQStartTime(Date.now())
    }
  }

  const finalize = () => {
    const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correctAnswer === a).length
    const pct = Math.round((score / questions.length) * 100)
    const result: ExamResultBreakdown = {
      finalScore: pct,
      totalTime: Math.round((Date.now() - startTime) / 1000),
      avgConfidence: 70,
      questions: questions.map((q, i) => ({ ...q, userAnswer: answers[i] })),
      conceptsMastered: [],
      conceptsWeak: [],
    }
    // Fire mastery updates for each answered question (best-effort)
    const userId = session?.user?.id
    if (userId && topic.trim()) {
      questions.forEach((q, i) => {
        const isCorrect = answers[i] === q.correctAnswer
        fetch("/api/ai-agent/mastery?action=attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            concept: normalizeConcept(topic),
            is_correct: isCorrect,
            evidence_weight: 1.0,
          }),
        }).catch(() => {})
      })
      // Notify sidebar to refresh cognitive stats
      window.dispatchEvent(new CustomEvent("mastery-updated"))
    }
    onComplete(result)
    setPhase("results")
  }

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setLoading(true)
    let qs: QuizQuestion[] = []
    try {
      const res = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), num_questions: numQuestions, difficulty }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      qs = (data.questions || []).slice(0, numQuestions)
      if (qs.length < 2) throw new Error()
    } catch {
      qs = buildFallback(topic, numQuestions, difficulty)
    }
    setQuestions(qs)
    setCurrent(0)
    setAnswers({})
    setSelected(undefined)
    setShowResult(false)
    setQStartTime(Date.now())
    setLoading(false)
    setPhase("exam")
  }

  // ── Configure ─────────────────────────────────────────────────────────────

  if (phase === "configure") {
    const diffStyle: Record<Difficulty, string> = {
      easy:   "bg-success/10 border-success/30 text-success",
      medium: "bg-warning/10  border-warning/30  text-warning",
      hard:   "bg-destructive/10    border-destructive/30    text-destructive",
    }
    return (
      <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center overflow-y-auto py-6">
        <div className="w-full max-w-md mx-4 rounded border border-primary/20 bg-background p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground tracking-tight">Pop Quiz</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                Timed per-question quiz · Adaptive difficulty · Cognitive trace
              </p>
            </div>
            <button onClick={onExit} className="text-muted-foreground hover:text-muted-foreground transition-colors shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Topic / Subject</label>
            <textarea value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Chain Rule · Recursion · Photosynthesis · Flask APIs"
              rows={2}
              className="w-full resize-none bg-card border border-border rounded px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/25 transition-all font-sans" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Difficulty</label>
              <div className="flex flex-col gap-1.5">
                {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={cn("py-2 rounded border text-[9px] font-bold uppercase tracking-widest transition-all",
                      difficulty === d ? diffStyle[d] : "bg-card border-border text-muted-foreground hover:text-muted-foreground"
                    )}>{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Questions</label>
              <div className="flex flex-col gap-1.5">
                {[3, 5, 10, 15].map(n => (
                  <button key={n} onClick={() => setNumQuestions(n)}
                    className={cn("py-2 rounded border text-[10px] font-bold transition-all",
                      numQuestions === n ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:text-muted-foreground"
                    )}>{n} questions</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded bg-card border border-border">
            <Timer className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[9px] text-muted-foreground">{timePerQ}s per question</span>
            <span className="ml-auto text-[9px] text-muted-foreground font-mono">~{Math.round(numQuestions * timePerQ / 60)} min total</span>
          </div>

          <Button onClick={handleGenerate} disabled={!topic.trim() || loading}
            className="w-full bg-primary hover:bg-primary disabled:opacity-40 text-foreground font-bold uppercase tracking-widest text-xs py-5">
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Generating…</>
              : <><Zap className="h-3.5 w-3.5 mr-2" />Start Exam</>}
          </Button>
        </div>
      </div>
    )
  }

  // ── Exam ──────────────────────────────────────────────────────────────────

  if (phase === "exam") {
    const q = questions[current]
    if (!q) return null
    const isCorrect = answers[current] === q.correctAnswer
    const timerPct = (timeLeft / timePerQ) * 100
    const timerColor = timeLeft < 15 ? "bg-destructive" : timeLeft < 30 ? "bg-warning" : "bg-primary"

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-3.5 border-b border-border bg-background">
          <Brain className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground truncate">{topic}</p>
            <p className="text-[7px] text-muted-foreground font-mono uppercase tracking-widest">
              Question {current + 1} of {questions.length} · {difficulty}
            </p>
          </div>
          {/* Timer */}
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[11px] font-bold shrink-0",
            timeLeft < 15 ? "bg-destructive/10 border-destructive/30 text-destructive animate-pulse"
            : timeLeft < 30 ? "bg-warning/10 border-warning/30 text-warning"
            : "bg-card border-border text-muted-foreground"
          )}>
            <Timer className="h-3 w-3" />
            {String(Math.floor(timeLeft / 60)).padStart(1, "0")}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          <button onClick={onExit} className="text-muted-foreground hover:text-muted-foreground transition-colors ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timer bar */}
        <div className="shrink-0 h-1 bg-accent">
          <div className={cn("h-full transition-all duration-1000", timerColor)}
            style={{ width: `${timerPct}%` }} />
        </div>

        {/* Progress dots */}
        <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
          {questions.map((_, i) => (
            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all",
              i === current ? "bg-primary w-4"
              : i in answers ? (answers[i] === questions[i]?.correctAnswer ? "bg-success/60" : "bg-destructive/50")
              : "bg-accent"
            )} />
          ))}
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-xl mx-auto space-y-5">
            <p className="text-[15px] text-foreground leading-relaxed font-sans">{q.question}</p>

            <div className="space-y-2.5">
              {q.options.map((opt, i) => {
                const isThis = selected === i
                const isCorrectOpt = i === q.correctAnswer
                let cls = "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                if (showResult) {
                  if (isCorrectOpt) cls = "bg-success/10 border-success/35 text-success"
                  else if (isThis && !isCorrectOpt) cls = "bg-destructive/10 border-destructive/35 text-destructive"
                  else cls = "bg-card border-border text-muted-foreground"
                } else if (isThis) {
                  cls = "bg-primary/10 border-primary/35 text-primary"
                }
                return (
                  <button key={i} onClick={() => handleSelect(i)} disabled={showResult}
                    className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded border transition-all text-left disabled:cursor-default", cls)}>
                    <div className={cn("w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] font-bold",
                      showResult && isCorrectOpt ? "border-success bg-success/20 text-success"
                      : showResult && isThis && !isCorrectOpt ? "border-destructive bg-destructive/20 text-destructive"
                      : isThis ? "border-primary bg-primary/20 text-primary"
                      : "border-border text-muted-foreground"
                    )}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-[13px] font-sans leading-normal flex-1">{opt}</span>
                    {showResult && isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                    {showResult && isThis && !isCorrectOpt && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  </button>
                )
              })}
            </div>

            {showResult && (
              <div className="rounded border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold", isCorrect ? "text-success" : "text-destructive")}>
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-[8px] text-primary/60 font-mono">
                    <BrainCircuit className="h-2.5 w-2.5" />
                    {Math.round((Date.now() - qStartTime) / 1000)}s
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{q.explanation}</p>
                </div>
                <div className="pt-1">
                  <Button onClick={handleNext}
                    className="w-full bg-primary hover:bg-primary text-foreground font-bold uppercase tracking-widest text-[10px] py-4">
                    {current + 1 >= questions.length ? <><Trophy className="h-3.5 w-3.5 mr-2" />Finish Exam</> : <>Next Question →</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────

  const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correctAnswer === Number(a)).length
  const pct = Math.round((score / (questions.length || 1)) * 100)
  const grade = pct >= 90 ? { label: "Expert", color: "text-success", border: "border-success/25" }
    : pct >= 70 ? { label: "Proficient", color: "text-primary", border: "border-primary/25" }
    : pct >= 50 ? { label: "Developing", color: "text-warning", border: "border-warning/25" }
    : { label: "Needs Review", color: "text-destructive", border: "border-destructive/25" }

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-y-auto py-6">
      <div className={cn("w-full max-w-md mx-4 rounded border bg-background p-8 space-y-6", grade.border)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Exam Complete</p>
            <h1 className="text-base font-bold text-foreground">{topic}</h1>
            <p className="text-[10px] text-muted-foreground">{difficulty} · {questions.length} questions</p>
          </div>
          <button onClick={onExit} className="text-muted-foreground hover:text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 py-4">
          <div className={cn("text-5xl font-bold", grade.color)}>{pct}<span className="text-2xl text-muted-foreground">%</span></div>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", grade.color)}>{grade.label}</p>
          <p className="text-[10px] text-muted-foreground">{score} / {questions.length} correct</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Target, label: "Score",    val: `${pct}%`,        color: "text-primary" },
            { icon: Trophy, label: "Correct",  val: `${score}/${questions.length}`, color: "text-primary" },
            { icon: Timer,  label: "Per Q",    val: `${timePerQ}s`,   color: "text-warning" },
          ].map(b => (
            <div key={b.label} className="rounded bg-card border border-border p-3 text-center space-y-1">
              <b.icon className={cn("h-4 w-4 mx-auto", b.color)} />
              <p className={cn("text-sm font-bold", b.color)}>{b.val}</p>
              <p className="text-[7px] uppercase tracking-widest text-muted-foreground">{b.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Question Breakdown</p>
          {questions.map((q, i) => {
            const correct = answers[i] === q.correctAnswer
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded bg-card border border-border">
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", correct ? "bg-success/20" : "bg-destructive/20")}>
                  {correct ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : <XCircle className="h-2.5 w-2.5 text-destructive" />}
                </div>
                <p className="text-[10px] text-muted-foreground flex-1 truncate">{q.question}</p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button onClick={() => { setPhase("configure"); setQuestions([]); setAnswers({}) }}
            className="flex-1 bg-primary hover:bg-primary text-foreground font-bold text-xs uppercase tracking-widest">
            Try Again
          </Button>
          <Button variant="ghost" onClick={onExit} className="text-muted-foreground hover:text-foreground text-xs">
            Back to Chat
          </Button>
        </div>
      </div>
    </div>
  )
}
