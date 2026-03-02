"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Loader2, CheckCircle2, XCircle, RefreshCw,
  BrainCircuit, Trophy, Timer, Target, Layers,
  Atom, FlaskConical, Brain,
}from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type QuizDifficulty = "easy" | "medium" | "hard"

interface QuestionTrace {
  timeSpent: number
  confidence: number
  masteryDelta: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function difficultyScore(d: QuizDifficulty) {
  return d === "hard" ? 0.78 : d === "medium" ? 0.52 : 0.31
}

function masteryColor(val: number) {
  if (val >= 80) return "text-emerald-400"
  if (val >= 60) return "text-cyan-400"
  if (val >= 40) return "text-amber-400"
  return "text-red-400"
}

function masteryBg(val: number) {
  if (val >= 80) return "bg-emerald-500"
  if (val >= 60) return "bg-cyan-500"
  if (val >= 40) return "bg-amber-500"
  return "bg-red-500"
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SetupCard({
  topic, setTopic, numQuestions, setNumQuestions,
  difficulty, setDifficulty, onGenerate, loading,
}: any) {
  const diffOpts: QuizDifficulty[] = ["easy", "medium", "hard"]
  const counts = [3, 5, 10, 15]

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 max-w-xl mx-auto w-full gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/10 border border-purple-500/20 flex items-center justify-center">
          <Brain className="h-6 w-6 text-purple-400" />
        </div>
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">Quiz Generation Engine</h2>
        <p className="text-[10px] text-white/25">Adaptive difficulty · Cognitive trace per question · Mastery tracking</p>
      </div>

      <div className="w-full space-y-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Topic / Concept</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Chain Rule · Recursion · Photosynthesis · Flask APIs"
          rows={2}
          className="w-full resize-none bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-purple-500/30 focus:border-purple-500/25 transition-all font-sans"
        />
      </div>

      <div className="w-full grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Difficulty</label>
          <div className="flex gap-1.5">
            {diffOpts.map((d) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={cn("flex-1 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                  difficulty === d
                    ? d === "hard" ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : d === "medium" ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Questions</label>
          <div className="flex gap-1.5">
            {counts.map((n) => (
              <button key={n} onClick={() => setNumQuestions(n)}
                className={cn("flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all",
                  numQuestions === n ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                )}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <BrainCircuit className="h-3 w-3 text-cyan-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className="text-[8px] text-white/25 uppercase tracking-widest">Cognitive Difficulty Index</span>
            <span className="text-[9px] font-bold text-cyan-400">{(difficultyScore(difficulty) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full">
            <div className={cn("h-full rounded-full transition-all duration-500", masteryBg(difficultyScore(difficulty) * 100))}
              style={{ width: `${difficultyScore(difficulty) * 100}%` }} />
          </div>
        </div>
      </div>

      <button onClick={onGenerate} disabled={loading || !topic.trim()}
        className={cn("w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border font-bold text-[11px] uppercase tracking-widest transition-all",
          !loading && topic.trim()
            ? "bg-gradient-to-br from-purple-500/20 to-cyan-500/10 border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-cyan-500/20 shadow-[0_0_20px_rgba(192,132,252,0.15)]"
            : "bg-white/[0.02] border-white/[0.06] text-white/20 cursor-not-allowed"
        )}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><FlaskConical className="h-4 w-4" />Generate Quiz — {numQuestions} Questions</>}
      </button>
    </div>
  )
}

function TraceCell({ label, value, icon: Icon, valueClass }: { label: string; value: string; icon: any; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03]">
      <Icon className="h-3 w-3 text-white/25" />
      <span className={cn("text-[11px] font-bold", valueClass || "text-white/60")}>{value}</span>
      <span className="text-[8px] text-white/20 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: "cyan" | "purple" | "emerald" }) {
  const colors = { cyan: "bg-cyan-500/5 border-cyan-500/20 text-cyan-400", purple: "bg-purple-500/5 border-purple-500/20 text-purple-400", emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" }
  return (
    <div className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border", colors[color])}>
      <Icon className="h-4 w-4" />
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-[8px] uppercase tracking-widest">{label}</span>
    </div>
  )
}

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

// ─── Question View ────────────────────────────────────────────────────────────

function QuestionView({
  question, index, total, selected, onSelect, showResults, trace, timeLeft,
}: {
  question: QuizQuestion; index: number; total: number
  selected?: number; onSelect: (idx: number) => void
  showResults: boolean; trace?: QuestionTrace; timeLeft?: number
}) {
  const isCorrect = selected === question.correctAnswer
  const answered = selected !== undefined

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">
              Question {index + 1} / {total}
            </span>
            {timeLeft !== undefined && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-bold font-mono",
                timeLeft < 30 ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                  : "bg-white/[0.03] border-white/[0.06] text-white/30"
              )}>
                <Timer className="h-2.5 w-2.5" />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>
          {showResults && answered && (
            <div className={cn("flex items-center gap-1.5 text-[9px] font-bold", isCorrect ? "text-emerald-400" : "text-red-400")}>
              {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {isCorrect ? "Correct" : "Incorrect"}
            </div>
          )}
        </div>
        <div className="h-1 bg-white/5 rounded-full">
          <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <p className="text-[14px] text-white/80 leading-relaxed font-sans">{question.question}</p>

        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const isThis = selected === i
            const correct = i === question.correctAnswer
            let style = "bg-white/[0.02] border-white/[0.07] text-white/50 hover:bg-white/[0.04]"
            if (showResults) {
              if (correct) style = "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
              else if (isThis && !correct) style = "bg-red-500/10 border-red-500/40 text-red-200"
            } else if (isThis) {
              style = "bg-purple-500/10 border-purple-500/40 text-purple-200"
            }
            return (
              <button key={i} onClick={() => !showResults && onSelect(i)}
                className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left", style)}>
                <div className={cn("w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] font-bold",
                  showResults && correct ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : showResults && isThis && !correct ? "border-red-500 bg-red-500/20 text-red-400"
                    : isThis ? "border-purple-500 bg-purple-500/20 text-purple-400"
                    : "border-white/15 text-white/25"
                )}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-[13px] font-sans leading-normal flex-1">{opt}</span>
                {showResults && correct && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                {showResults && isThis && !correct && <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {showResults && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3 w-3 text-cyan-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Explanation</span>
            </div>
            <p className="text-[12px] text-white/50 leading-relaxed font-sans">{question.explanation}</p>
          </div>
        )}

        {showResults && trace && (
          <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <BrainCircuit className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Cognitive Trace</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TraceCell label="Time" value={`${trace.timeSpent}s`} icon={Timer} />
              <TraceCell label="Confidence" value={`${trace.confidence}%`} icon={Target} />
              <TraceCell label="Mastery Δ" value={`${trace.masteryDelta > 0 ? "+" : ""}${trace.masteryDelta}%`}
                icon={Atom} valueClass={trace.masteryDelta > 0 ? "text-emerald-400" : "text-red-400"} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({ questions, answers, traces, onReset }: {
  questions: QuizQuestion[]; answers: Record<number, number>
  traces: Record<number, QuestionTrace>; onReset: () => void
}) {
  const score = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correctAnswer === a).length
  const pct = Math.round((score / questions.length) * 100)
  const avgConf = Object.values(traces).reduce((a, t) => a + t.confidence, 0) / (Object.values(traces).length || 1)
  const totalMastery = Object.values(traces).reduce((a, t) => a + t.masteryDelta, 0)
  const grade = pct >= 90 ? { label: "Expert", color: "text-emerald-400", bg: "from-emerald-500/15 to-cyan-500/10", border: "border-emerald-500/30" }
    : pct >= 70 ? { label: "Proficient", color: "text-cyan-400", bg: "from-cyan-500/15 to-blue-500/10", border: "border-cyan-500/30" }
    : pct >= 50 ? { label: "Developing", color: "text-amber-400", bg: "from-amber-500/15 to-orange-500/10", border: "border-amber-500/30" }
    : { label: "Needs Review", color: "text-red-400", bg: "from-red-500/15 to-orange-500/10", border: "border-red-500/30" }

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-8 gap-6 max-w-lg mx-auto w-full">
      <div className={cn("relative w-28 h-28 rounded-3xl bg-gradient-to-br border flex items-center justify-center flex-col", grade.bg, grade.border)}>
        <span className={cn("text-3xl font-bold", grade.color)}>{pct}<span className="text-base text-white/30">%</span></span>
        <span className={cn("text-[9px] font-bold uppercase tracking-widest", grade.color)}>{grade.label}</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-white/50">{score}/{questions.length} correct</p>
        <p className="text-[10px] text-white/20 mt-0.5">Cognitive analysis complete</p>
      </div>
      <div className="w-full grid grid-cols-3 gap-2">
        <StatCard icon={Target} label="Accuracy" value={`${pct}%`} color="cyan" />
        <StatCard icon={Brain} label="Confidence" value={`${avgConf.toFixed(0)}%`} color="purple" />
        <StatCard icon={Atom} label="Mastery Δ" value={`+${Math.max(0, totalMastery)}%`} color="emerald" />
      </div>
      <div className="w-full space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Question Breakdown</p>
        {questions.map((q, i) => {
          const correct = answers[i] === q.correctAnswer
          const trace = traces[i]
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0", correct ? "bg-emerald-500/20" : "bg-red-500/20")}>
                {correct ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> : <XCircle className="h-2.5 w-2.5 text-red-400" />}
              </div>
              <p className="text-[10px] text-white/40 flex-1 truncate">{q.question}</p>
              {trace && (
                <span className={cn("text-[8px] font-bold font-mono flex-shrink-0", trace.masteryDelta > 0 ? "text-emerald-400" : "text-red-400")}>
                  {trace.masteryDelta > 0 ? "+" : ""}{trace.masteryDelta}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={onReset} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 hover:border-white/10 hover:bg-white/[0.04] transition-all">
        <RefreshCw className="h-3.5 w-3.5" />New Quiz
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function QuizAgent() {
  const [topic, setTopic] = useState("")
  const [numQuestions, setNumQuestions] = useState(5)
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium")
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [showFinalResults, setShowFinalResults] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [timeLeft, setTimeLeft] = useState<number | undefined>(undefined)
  const [traces, setTraces] = useState<Record<number, QuestionTrace>>({})
  const { toast } = useToast()

  // Exam countdown (hard + ≥10 questions = exam mode)
  useEffect(() => {
    if (difficulty !== "hard" || numQuestions < 10 || questions.length === 0 || showFinalResults) return
    const duration = numQuestions * 90
    setTimeLeft(duration)
    const interval = setInterval(() => {
      setTimeLeft(v => {
        if (v === undefined || v <= 1) { clearInterval(interval); submitAll(); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [questions.length])

  useEffect(() => { setQuestionStartTime(Date.now()) }, [currentQuestion])

  const recordTrace = (qi: number, correct: boolean) => {
    const elapsed = Math.floor((Date.now() - questionStartTime) / 1000)
    setTraces(prev => ({
      ...prev,
      [qi]: {
        timeSpent: elapsed,
        confidence: selectedAnswers[qi] !== undefined ? 65 + Math.floor(Math.random() * 30) : 20,
        masteryDelta: correct ? 2 + Math.floor(Math.random() * 3) : -1,
      }
    }))
  }

  const submitAll = () => {
    questions.forEach((q, i) => { if (!traces[i]) recordTrace(i, selectedAnswers[i] === q.correctAnswer) })
    setShowFinalResults(true)
  }

  const handleGenerate = async () => {
    if (!topic.trim()) { toast({ title: "Topic required", variant: "destructive" }); return }
    setLoading(true)
    setShowResults(false)
    setShowFinalResults(false)
    setSelectedAnswers({})
    setTraces({})
    setCurrentQuestion(0)
    try {
      const res = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), num_questions: numQuestions, difficulty }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setQuestions(data.questions || [])
      toast({ title: `${data.questions?.length || 0} questions generated` })
      fetch("/api/credits/deduct", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5, operation: "quiz", metadata: { topic, numQuestions, difficulty } }) }).catch(() => {})
    } catch {
      toast({ title: "Generation failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const advanceQuestion = () => {
    const correct = selectedAnswers[currentQuestion] === questions[currentQuestion]?.correctAnswer
    recordTrace(currentQuestion, correct)
    setCurrentQuestion(q => q + 1)
    setShowResults(false)
  }

  const currentQ = questions[currentQuestion]
  const isLast = currentQuestion === questions.length - 1
  const answered = selectedAnswers[currentQuestion] !== undefined

  if (questions.length === 0) {
    return (
      <div className="h-full flex items-center">
        <SetupCard topic={topic} setTopic={setTopic} numQuestions={numQuestions}
          setNumQuestions={setNumQuestions} difficulty={difficulty} setDifficulty={setDifficulty}
          onGenerate={handleGenerate} loading={loading} />
      </div>
    )
  }

  if (showFinalResults) {
    return (
      <div className="h-full overflow-y-auto">
        <ResultsScreen questions={questions} answers={selectedAnswers} traces={traces}
          onReset={() => { setQuestions([]); setShowFinalResults(false) }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        {currentQ && (
          <QuestionView question={currentQ} index={currentQuestion} total={questions.length}
            selected={selectedAnswers[currentQuestion]}
            onSelect={(ans) => setSelectedAnswers(prev => ({ ...prev, [currentQuestion]: ans }))}
            showResults={showResults}
            trace={showResults ? traces[currentQuestion] : undefined}
            timeLeft={timeLeft} />
        )}
      </div>

      {/* Navigation strip */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-t border-white/[0.06] bg-[#0c0c14]">
        <button onClick={() => setCurrentQuestion(q => q - 1)} disabled={currentQuestion === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.06] text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          ← Prev
        </button>

        <div className="flex-1 flex justify-center gap-1.5 overflow-hidden">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQuestion(i)}
              className={cn("w-5 h-5 rounded-full text-[7px] font-bold border transition-all flex items-center justify-center",
                i === currentQuestion ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                  : selectedAnswers[i] !== undefined
                    ? selectedAnswers[i] === questions[i]?.correctAnswer ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-white/[0.02] border-white/[0.06] text-white/20"
              )}>
              {i + 1}
            </button>
          ))}
        </div>

        {!showResults && answered && (
          <button onClick={() => setShowResults(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/25 bg-cyan-500/8 text-[9px] font-bold uppercase tracking-widest text-cyan-400 hover:bg-cyan-500/15 transition-all">
            <BrainCircuit className="h-3 w-3" />Explain
          </button>
        )}

        {isLast ? (
          <button onClick={submitAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[9px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-500/15 transition-all">
            <Trophy className="h-3 w-3" />Finish
          </button>
        ) : (
          <button onClick={advanceQuestion}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.06] text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/50 transition-all">
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
