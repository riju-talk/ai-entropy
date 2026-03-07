"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Trophy, Timer, X, ChevronRight, Zap, Brain, CheckCircle2, XCircle, Loader2, BookOpen, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Types ──────────────────────────────────────────────────────────────────

interface MCQQuestion {
  question: string
  options: string[]
  correctAnswer: number   // index into options
  explanation: string
  isEssay: false
}

interface EssayQuestion {
  question: string
  keywords: string[]      // rubric keywords
  isEssay: true
  explanation: string
}

type ExamQuestion = MCQQuestion | EssayQuestion

interface AnsweredQuestion {
  question: string
  userAnswer: string      // selected option text or essay text
  selectedIdx?: number    // for MCQ
  correctAnswer?: string  // for MCQ
  isCorrect?: boolean     // for MCQ
  score: number           // 0-100
  timeSpent: number
}

interface ExamResultBreakdown {
  questions: AnsweredQuestion[]
  totalTime: number
  avgConfidence: number
  finalScore: number
  conceptsMastered: string[]
  conceptsWeak: string[]
}

interface ExamConfig {
  topic: string
  difficulty: "easy" | "medium" | "hard"
  durationMin: number
  numQuestions: number
}

interface ExamModeOverlayProps {
  onExit: () => void
  onComplete: (result: ExamResultBreakdown) => void
  subject?: string
}

// ── Fallback essay questions by topic keywords ─────────────────────────────
function generateFallbackQuestions(topic: string, n: number, difficulty: string): EssayQuestion[] {
  const base = [
    { question: `Explain the core principles of ${topic}.`, keywords: [topic.toLowerCase().split(" ")[0], "principle", "concept", "define"] },
    { question: `Describe how ${topic} is applied in practice with a real-world example.`, keywords: ["example", "apply", "use", "practice"] },
    { question: `What are the most common challenges or misconceptions around ${topic}?`, keywords: ["challenge", "mistake", "common", "error", "misconception"] },
    { question: `Compare and contrast two different approaches related to ${topic}.`, keywords: ["compare", "contrast", "difference", "similar", "versus"] },
    { question: `If ${topic} were unavailable, what alternative would you use and why?`, keywords: ["alternative", "instead", "replace", "reason", "because"] },
    { question: `Explain the historical development or evolution of ${topic}.`, keywords: ["history", "develop", "evolve", "origin", "change"] },
    { question: `How does ${topic} relate to other concepts you have studied?`, keywords: ["relate", "connect", "link", "depend", "combine"] },
    { question: `Provide a mathematical or logical derivation involving ${topic} if applicable.`, keywords: ["derive", "proof", "formula", "equation", "step"] },
    { question: `What are the limitations or edge cases of ${topic}?`, keywords: ["limit", "edge", "case", "fail", "except"] },
    { question: `Summarise ${topic} as if explaining it to someone with no background.`, keywords: ["simple", "basic", "explain", "understand", "mean"] },
  ]
  const diffExtra = difficulty === "hard" ? ` Provide a rigorous, detailed answer.` : difficulty === "medium" ? ` Include an example.` : ""
  return base.slice(0, n).map(q => ({
    question: q.question + diffExtra,
    keywords: q.keywords,
    isEssay: true as const,
    explanation: `A good answer should clearly address ${topic} and use relevant terminology.`,
  }))
}

export function ExamModeOverlay({ onExit, onComplete, subject = "" }: ExamModeOverlayProps) {
  // ── Setup phase ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<ExamConfig>({
    topic: subject || "",
    difficulty: "medium",
    durationMin: 10,
    numQuestions: 5,
  })
  const [phase, setPhase] = useState<"configure" | "intro" | "exam" | "results">("configure")
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [fetchingQs, setFetchingQs] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Exam runtime ──────────────────────────────────────────────────────────
  const EXAM_DURATION = config.durationMin * 60
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [mcqSelected, setMcqSelected] = useState<number | undefined>(undefined)
  const [essayInput, setEssayInput] = useState("")
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  // Timer
  useEffect(() => {
    if (phase !== "exam") return
    if (timeLeft <= 0) { finalizeExam(); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset timer when exam starts
  useEffect(() => {
    if (phase === "exam") setTimeLeft(config.durationMin * 60)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchQuestions = useCallback(async (cfg: ExamConfig) => {
    setFetchingQs(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: cfg.topic,
          difficulty: cfg.difficulty,
          num_questions: cfg.numQuestions,
          language: "english",
        }),
      })
      if (!res.ok) throw new Error("backend error")
      const data = await res.json()
      const raw: any[] = data.questions || data || []
      if (!Array.isArray(raw) || raw.length === 0) throw new Error("empty response")
      const mcq: MCQQuestion[] = raw.slice(0, cfg.numQuestions).map((q: any) => ({
        question: q.question || q.text || "",
        options: q.options || q.choices || [],
        correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer
          : typeof q.correct_answer === "number" ? q.correct_answer : 0,
        explanation: q.explanation || "",
        isEssay: false,
      })).filter(q => q.question && q.options.length >= 2)
      if (mcq.length === 0) throw new Error("invalid format")
      setQuestions(mcq)
    } catch {
      // Fallback: generate essay questions
      setFetchError("Using built-in question set (backend offline)")
      setQuestions(generateFallbackQuestions(cfg.topic || "the topic", cfg.numQuestions, cfg.difficulty))
    } finally {
      setFetchingQs(false)
    }
  }, [])

  const handleConfigure = async () => {
    if (!config.topic.trim()) return
    await fetchQuestions(config)
    setPhase("intro")
  }

  const finalizeExam = useCallback(() => {
    const totalScore = answers.length
      ? Math.round(answers.reduce((s, a) => s + a.score, 0) / answers.length)
      : 0
    const mastered = answers.filter(a => a.score >= 70).map(a => a.question.slice(0, 30) + "…")
    const weak = answers.filter(a => a.score < 50).map(a => a.question.slice(0, 30) + "…")
    onComplete({
      questions: answers,
      totalTime: (config.durationMin * 60) - timeLeft,
      avgConfidence: 0,
      finalScore: totalScore,
      conceptsMastered: mastered,
      conceptsWeak: weak,
    })
    setPhase("results")
  }, [answers, timeLeft, config.durationMin, onComplete])

  const submitAnswer = useCallback(() => {
    const q = questions[questionIndex]
    if (!q) return
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)

    let score = 0
    let userAnswer = ""
    let isCorrect: boolean | undefined
    let correctAnswer: string | undefined

    if (!q.isEssay) {
      // MCQ: strict binary scoring
      if (mcqSelected === undefined) return
      isCorrect = mcqSelected === q.correctAnswer
      score = isCorrect ? 100 : 0
      userAnswer = q.options[mcqSelected] ?? ""
      correctAnswer = q.options[q.correctAnswer] ?? ""
    } else {
      // Essay: keyword rubric
      if (!essayInput.trim()) return
      const ans = essayInput.toLowerCase()
      const topicWords = config.topic.toLowerCase().split(/\s+/).filter(Boolean)
      const keywordHits = q.keywords.filter(k => ans.includes(k)).length
      const topicHits = topicWords.filter(k => ans.includes(k)).length
      const lengthBonus = Math.min(essayInput.length / 8, 20)
      score = Math.min(100, Math.round(25 + keywordHits * 12 + topicHits * 8 + lengthBonus))
      userAnswer = essayInput
    }

    setAnswers(prev => [...prev, { question: q.question, userAnswer, selectedIdx: mcqSelected, isCorrect, correctAnswer, score, timeSpent }])
    setMcqSelected(undefined)
    setEssayInput("")
    setQuestionStartTime(Date.now())

    if (questionIndex + 1 >= questions.length) {
      // Let finalizeExam pick up the new answers on next render
      setTimeout(() => finalizeExam(), 50)
    } else {
      setQuestionIndex(prev => prev + 1)
    }
  }, [questions, questionIndex, mcqSelected, essayInput, questionStartTime, config.topic, finalizeExam])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timerColor = timeLeft < 60 ? "text-red-400" : timeLeft < 180 ? "text-amber-400" : "text-emerald-400"

  // ── Phase: Configure ──────────────────────────────────────────────────────
  if (phase === "configure") {
    const diffOpts: Array<ExamConfig["difficulty"]> = ["easy", "medium", "hard"]
    const durations = [5, 10, 15, 20]
    const qCounts = [3, 5, 7, 10]
    const diffColors: Record<string, string> = {
      easy: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      medium: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      hard: "bg-red-500/10 border-red-500/30 text-red-400",
    }
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-4">
        <div className="w-full max-w-lg mx-4 rounded-2xl border border-amber-500/20 bg-[#0e0e1a] p-7 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Settings2 className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Configure Exam</h2>
              <p className="text-[10px] text-white/30 font-mono">Set topic, difficulty and duration before starting</p>
            </div>
            <button onClick={onExit} className="ml-auto text-white/20 hover:text-white/50 transition-colors"><X className="h-4 w-4" /></button>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Subject / Topic</label>
            <textarea
              value={config.topic}
              onChange={e => setConfig(c => ({ ...c, topic: e.target.value }))}
              placeholder="e.g. Calculus · Photosynthesis · React Hooks · Keynesian Economics"
              rows={2}
              className="w-full resize-none bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/25 transition-all font-sans"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Difficulty</label>
            <div className="flex gap-2">
              {diffOpts.map(d => (
                <button key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                  className={cn("flex-1 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                    config.difficulty === d ? diffColors[d] : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                  )}>{d}</button>
              ))}
            </div>
          </div>

          {/* Duration + Questions grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Duration (min)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {durations.map(d => (
                  <button key={d} onClick={() => setConfig(c => ({ ...c, durationMin: d }))}
                    className={cn("py-2 rounded-lg border text-[10px] font-bold transition-all",
                      config.durationMin === d ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                    )}>{d}m</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Questions</label>
              <div className="grid grid-cols-2 gap-1.5">
                {qCounts.map(n => (
                  <button key={n} onClick={() => setConfig(c => ({ ...c, numQuestions: n }))}
                    className={cn("py-2 rounded-lg border text-[10px] font-bold transition-all",
                      config.numQuestions === n ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                    )}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleConfigure}
            disabled={!config.topic.trim() || fetchingQs}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs uppercase tracking-widest"
          >
            {fetchingQs ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Generating questions…</> : <><BookOpen className="h-3.5 w-3.5 mr-2" />Build Exam</>}
          </Button>
        </div>
      </div>
    )
  }

  // ── Phase: Intro ──────────────────────────────────────────────────────────
  const isMCQ = questions.length > 0 && !questions[0].isEssay

  if (phase === "intro") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center">
        <div className="w-full max-w-lg mx-4 rounded-2xl border border-amber-500/20 bg-[#0e0e1a] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Exam Simulation</h2>
              <p className="text-[10px] text-white/30 font-mono">{config.topic} · {questions.length} questions · {config.durationMin} min</p>
            </div>
          </div>
          {fetchError && (
            <div className="text-[9px] text-amber-400/60 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">{fetchError}</div>
          )}
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <RuleRow text={isMCQ ? "Multiple-choice · objective scoring" : "Open answers · keyword rubric scoring"} />
            <RuleRow text="No hints or cognitive trace shown" />
            <RuleRow text="Timer cannot be paused" />
            <RuleRow text={`Difficulty: ${config.difficulty.toUpperCase()}`} />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => { setPhase("exam"); setQuestionStartTime(Date.now()) }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-widest"
            >
              <Zap className="h-3.5 w-3.5 mr-2" /> Begin Exam
            </Button>
            <Button variant="ghost" onClick={() => setPhase("configure")} className="text-white/30 hover:text-white/60 text-xs">
              ← Reconfigure
            </Button>
            <Button variant="ghost" onClick={onExit} className="text-white/30 hover:text-white/60 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Phase: Results ──────────────────────────────────────────────────────
  if (phase === "results") {
    const finalScore = answers.length
      ? Math.round(answers.reduce((s, a) => s + a.score, 0) / answers.length)
      : 0
    const totalTime = config.durationMin * 60 - timeLeft
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-8">
        <div className="w-full max-w-xl mx-4 rounded-2xl border border-cyan-500/20 bg-[#0e0e1a] p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-2">
              <Brain className="h-8 w-8 text-cyan-400" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Exam Complete</h2>
            <p className="text-[10px] text-white/30 font-mono">{config.topic} · {isMCQ ? "MCQ rubric" : "Keyword rubric"}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ScoreBox label="Final Score" value={`${finalScore}%`} sub={isMCQ ? "Objective (MCQ)" : "Keyword rubric"}
              color={finalScore >= 70 ? "cyan" : finalScore >= 50 ? "amber" : "red"} />
            <ScoreBox label="Questions" value={`${answers.length}`} sub={`of ${config.numQuestions}`} color="purple" />
            <ScoreBox label="Time Used" value={`${Math.floor(totalTime / 60)}m ${totalTime % 60}s`} sub={`of ${config.durationMin} min`} color="slate" />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Per-Question Breakdown</p>
            {answers.map((a, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40 uppercase">Q{i + 1} · {a.timeSpent}s</span>
                  <div className="flex items-center gap-2">
                    {a.isCorrect !== undefined && (
                      a.isCorrect
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        : <XCircle className="h-3 w-3 text-red-400" />
                    )}
                    <span className={cn("text-[9px] font-bold",
                      a.score >= 70 ? "text-emerald-400" : a.score >= 50 ? "text-amber-400" : "text-red-400"
                    )}>{a.score}%</span>
                  </div>
                </div>
                <p className="text-[9px] text-white/55 line-clamp-2">{a.question}</p>
                {a.correctAnswer && !a.isCorrect && (
                  <p className="text-[8px] text-emerald-400/60">✓ Correct: {a.correctAnswer}</p>
                )}
                <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", a.score >= 70 ? "bg-emerald-500" : a.score >= 50 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${a.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={onExit}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold text-xs uppercase tracking-widest"
          >
            Return to Cognitive Engine
          </Button>
        </div>
      </div>
    )
  }

  // ── Phase: Exam ─────────────────────────────────────────────────────────
  const currentQ = questions[questionIndex]
  if (!currentQ) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f]/98 backdrop-blur-sm flex flex-col">
      {/* Exam header bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-amber-500/20 bg-amber-500/[0.03]">
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{config.topic} Exam</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <Timer className={cn("h-4 w-4", timerColor)} />
          <span className={cn("text-sm font-bold font-mono tabular-nums", timerColor)}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1">
          <span className="text-[9px] text-white/30">Q</span>
          <span className="text-[9px] font-bold text-white">{questionIndex + 1}</span>
          <span className="text-[9px] text-white/20">/</span>
          <span className="text-[9px] text-white/30">{questions.length}</span>
        </div>
        <button onClick={onExit} className="h-7 w-7 rounded-lg bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.06] transition-colors">
          <X className="h-3.5 w-3.5 text-white/30" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div className="h-full bg-amber-500/60 transition-all duration-300" style={{ width: `${((questionIndex) / questions.length) * 100}%` }} />
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-400">
                Question {questionIndex + 1} · {config.difficulty}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[8px] text-white/20 font-mono">{isMCQ ? "MCQ" : "Open answer"} · No hints</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{currentQ.question}</p>
          </div>

          {/* MCQ options */}
          {!currentQ.isEssay && (
            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setMcqSelected(idx)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-[13px] transition-all",
                    mcqSelected === idx
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                      : "bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:border-white/10"
                  )}
                >
                  <span className="font-mono text-[10px] text-white/30 mr-3">{String.fromCharCode(65 + idx)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Essay input */}
          {currentQ.isEssay && (
            <textarea
              value={essayInput}
              onChange={e => setEssayInput(e.target.value)}
              placeholder="Write your answer in detail…"
              className="w-full h-36 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-amber-500/30 transition-colors font-sans"
            />
          )}

          <button
            onClick={submitAnswer}
            disabled={currentQ.isEssay ? !essayInput.trim() : mcqSelected === undefined}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-black font-bold text-xs uppercase tracking-widest"
          >
            {questionIndex + 1 >= questions.length
              ? <><CheckCircle2 className="h-4 w-4" /> Submit Final Answer</>
              : <><ChevronRight className="h-4 w-4" /> Submit &amp; Continue</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function RuleRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-1 rounded-full bg-amber-400 flex-shrink-0" />
      <span className="text-[10px] text-white/40">{text}</span>
    </div>
  )
}

function ScoreBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const textColor: Record<string, string> = {
    cyan: "text-cyan-400", purple: "text-purple-400", amber: "text-amber-400",
    red: "text-red-400", slate: "text-white/40",
  }
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center space-y-1">
      <p className="text-[7px] text-white/25 uppercase tracking-widest">{label}</p>
      <p className={cn("text-lg font-bold", textColor[color])}>{value}</p>
      <p className="text-[7px] text-white/15">{sub}</p>
    </div>
  )
}
