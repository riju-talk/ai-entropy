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
            concept: topic.trim(),
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
      easy:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      medium: "bg-amber-500/10  border-amber-500/30  text-amber-400",
      hard:   "bg-red-500/10    border-red-500/30    text-red-400",
    }
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-6">
        <div className="w-full max-w-md mx-4 rounded-2xl border border-purple-500/20 bg-[#0e0e1a] p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0">
              <Brain className="h-6 w-6 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight">Pop Quiz</h2>
              <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
                Timed per-question quiz · Adaptive difficulty · Cognitive trace
              </p>
            </div>
            <button onClick={onExit} className="text-white/20 hover:text-white/50 transition-colors shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Topic / Subject</label>
            <textarea value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Chain Rule · Recursion · Photosynthesis · Flask APIs"
              rows={2}
              className="w-full resize-none bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-purple-500/30 focus:border-purple-500/25 transition-all font-sans" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Difficulty</label>
              <div className="flex flex-col gap-1.5">
                {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={cn("py-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                      difficulty === d ? diffStyle[d] : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/40"
                    )}>{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Questions</label>
              <div className="flex flex-col gap-1.5">
                {[3, 5, 10, 15].map(n => (
                  <button key={n} onClick={() => setNumQuestions(n)}
                    className={cn("py-2 rounded-lg border text-[10px] font-bold transition-all",
                      numQuestions === n ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/40"
                    )}>{n} questions</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <Timer className="h-3 w-3 text-cyan-400 shrink-0" />
            <span className="text-[9px] text-white/30">{timePerQ}s per question</span>
            <span className="ml-auto text-[9px] text-white/20 font-mono">~{Math.round(numQuestions * timePerQ / 60)} min total</span>
          </div>

          <Button onClick={handleGenerate} disabled={!topic.trim() || loading}
            className="w-full bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-white font-bold uppercase tracking-widest text-xs py-5">
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
    const timerColor = timeLeft < 15 ? "bg-red-500" : timeLeft < 30 ? "bg-amber-500" : "bg-purple-500"

    return (
      <div className="fixed inset-0 z-50 bg-[#08080f] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.07] bg-[#0d0d18]">
          <Brain className="h-4 w-4 text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-white/50 truncate">{topic}</p>
            <p className="text-[7px] text-white/20 font-mono uppercase tracking-widest">
              Question {current + 1} of {questions.length} · {difficulty}
            </p>
          </div>
          {/* Timer */}
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[11px] font-bold shrink-0",
            timeLeft < 15 ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
            : timeLeft < 30 ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : "bg-white/[0.03] border-white/[0.07] text-white/40"
          )}>
            <Timer className="h-3 w-3" />
            {String(Math.floor(timeLeft / 60)).padStart(1, "0")}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          <button onClick={onExit} className="text-white/20 hover:text-white/50 transition-colors ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timer bar */}
        <div className="shrink-0 h-1 bg-white/[0.04]">
          <div className={cn("h-full transition-all duration-1000", timerColor)}
            style={{ width: `${timerPct}%` }} />
        </div>

        {/* Progress dots */}
        <div className="shrink-0 flex items-center justify-center gap-1.5 py-3">
          {questions.map((_, i) => (
            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all",
              i === current ? "bg-purple-400 w-4"
              : i in answers ? (answers[i] === questions[i]?.correctAnswer ? "bg-emerald-500/60" : "bg-red-500/50")
              : "bg-white/[0.10]"
            )} />
          ))}
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-xl mx-auto space-y-5">
            <p className="text-[15px] text-white/85 leading-relaxed font-sans">{q.question}</p>

            <div className="space-y-2.5">
              {q.options.map((opt, i) => {
                const isThis = selected === i
                const isCorrectOpt = i === q.correctAnswer
                let cls = "bg-white/[0.02] border-white/[0.07] text-white/55 hover:bg-white/[0.04] hover:text-white/75"
                if (showResult) {
                  if (isCorrectOpt) cls = "bg-emerald-500/10 border-emerald-500/35 text-emerald-200"
                  else if (isThis && !isCorrectOpt) cls = "bg-red-500/10 border-red-500/35 text-red-200"
                  else cls = "bg-white/[0.01] border-white/[0.04] text-white/25"
                } else if (isThis) {
                  cls = "bg-purple-500/10 border-purple-500/35 text-purple-200"
                }
                return (
                  <button key={i} onClick={() => handleSelect(i)} disabled={showResult}
                    className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left disabled:cursor-default", cls)}>
                    <div className={cn("w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] font-bold",
                      showResult && isCorrectOpt ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : showResult && isThis && !isCorrectOpt ? "border-red-500 bg-red-500/20 text-red-400"
                      : isThis ? "border-purple-500 bg-purple-500/20 text-purple-400"
                      : "border-white/15 text-white/25"
                    )}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-[13px] font-sans leading-normal flex-1">{opt}</span>
                    {showResult && isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {showResult && isThis && !isCorrectOpt && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                  </button>
                )
              })}
            </div>

            {showResult && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold", isCorrect ? "text-emerald-400" : "text-red-400")}>
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-[8px] text-purple-400/60 font-mono">
                    <BrainCircuit className="h-2.5 w-2.5" />
                    {Math.round((Date.now() - qStartTime) / 1000)}s
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="h-3 w-3 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/45 leading-relaxed">{q.explanation}</p>
                </div>
                <div className="pt-1">
                  <Button onClick={handleNext}
                    className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold uppercase tracking-widest text-[10px] py-4">
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
  const grade = pct >= 90 ? { label: "Expert", color: "text-emerald-400", border: "border-emerald-500/25" }
    : pct >= 70 ? { label: "Proficient", color: "text-cyan-400", border: "border-cyan-500/25" }
    : pct >= 50 ? { label: "Developing", color: "text-amber-400", border: "border-amber-500/25" }
    : { label: "Needs Review", color: "text-red-400", border: "border-red-500/25" }

  return (
    <div className="fixed inset-0 z-50 bg-[#08080f] flex items-center justify-center overflow-y-auto py-6">
      <div className={cn("w-full max-w-md mx-4 rounded-2xl border bg-[#0e0e1a] p-8 space-y-6", grade.border)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20 mb-1">Exam Complete</p>
            <h1 className="text-base font-bold text-white">{topic}</h1>
            <p className="text-[10px] text-white/30">{difficulty} · {questions.length} questions</p>
          </div>
          <button onClick={onExit} className="text-white/20 hover:text-white/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 py-4">
          <div className={cn("text-5xl font-bold", grade.color)}>{pct}<span className="text-2xl text-white/25">%</span></div>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", grade.color)}>{grade.label}</p>
          <p className="text-[10px] text-white/30">{score} / {questions.length} correct</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Target, label: "Score",    val: `${pct}%`,        color: "text-cyan-400" },
            { icon: Trophy, label: "Correct",  val: `${score}/${questions.length}`, color: "text-purple-400" },
            { icon: Timer,  label: "Per Q",    val: `${timePerQ}s`,   color: "text-amber-400" },
          ].map(b => (
            <div key={b.label} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-center space-y-1">
              <b.icon className={cn("h-4 w-4 mx-auto", b.color)} />
              <p className={cn("text-sm font-bold", b.color)}>{b.val}</p>
              <p className="text-[7px] uppercase tracking-widest text-white/20">{b.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[8px] font-bold uppercase tracking-widest text-white/25">Question Breakdown</p>
          {questions.map((q, i) => {
            const correct = answers[i] === q.correctAnswer
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", correct ? "bg-emerald-500/20" : "bg-red-500/20")}>
                  {correct ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> : <XCircle className="h-2.5 w-2.5 text-red-400" />}
                </div>
                <p className="text-[10px] text-white/35 flex-1 truncate">{q.question}</p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button onClick={() => { setPhase("configure"); setQuestions([]); setAnswers({}) }}
            className="flex-1 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs uppercase tracking-widest">
            Try Again
          </Button>
          <Button variant="ghost" onClick={onExit} className="text-white/30 hover:text-white/60 text-xs">
            Back to Chat
          </Button>
        </div>
      </div>
    </div>
  )
}
