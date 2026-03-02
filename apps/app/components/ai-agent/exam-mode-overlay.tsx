"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Trophy, Timer, X, ChevronRight, Zap, BarChart3, Brain, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ExamQuestion {
  question: string
  userAnswer: string
  confidence: number // 0-100
  timeSpent: number  // seconds
  score: number      // 0-100 rubric
}

interface ExamResultBreakdown {
  questions: ExamQuestion[]
  totalTime: number
  avgConfidence: number
  finalScore: number
  conceptsMastered: string[]
  conceptsWeak: string[]
}

interface ExamModeOverlayProps {
  onExit: () => void
  onComplete: (result: ExamResultBreakdown) => void
  subject?: string
}

const EXAM_DURATION = 600 // 10 minutes in seconds

export function ExamModeOverlay({ onExit, onComplete, subject = "General" }: ExamModeOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION)
  const [started, setStarted] = useState(false)
  const [currentInput, setCurrentInput] = useState("")
  const [confidence, setConfidence] = useState(50)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<ExamQuestion[]>([])
  const [showResults, setShowResults] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  const questions = [
    "Define the Chain Rule and state when it applies.",
    "Calculate the derivative of f(x) = sin(x²) using the Chain Rule.",
    "Explain the relationship between derivatives and instantaneous rate of change.",
    "What is the limit definition of a derivative?",
    "Describe when a function is not differentiable at a point.",
  ]

  useEffect(() => {
    if (!started || showResults) return
    if (timeLeft <= 0) { finalizeExam(); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [started, timeLeft, showResults])

  const finalizeExam = useCallback(() => {
    const mockResult: ExamResultBreakdown = {
      questions: answers,
      totalTime: EXAM_DURATION - timeLeft,
      avgConfidence: answers.length
        ? Math.round(answers.reduce((s, a) => s + a.confidence, 0) / answers.length)
        : 0,
      finalScore: answers.length
        ? Math.round(answers.reduce((s, a) => s + a.score, 0) / answers.length)
        : 0,
      conceptsMastered: ["Chain Rule", "Derivatives"],
      conceptsWeak: ["Limits", "Non-differentiability"],
    }
    setShowResults(true)
    onComplete(mockResult)
  }, [answers, timeLeft, onComplete])

  const submitAnswer = () => {
    if (!currentInput.trim()) return
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    // Mock rubric scoring based on length and keywords
    const keywords = ["derivative", "chain", "limit", "function", "differential", "rate", "slope"]
    const hits = keywords.filter(k => currentInput.toLowerCase().includes(k)).length
    const score = Math.min(100, 30 + hits * 12 + Math.min(currentInput.length / 5, 20))

    setAnswers(prev => [...prev, {
      question: questions[questionIndex],
      userAnswer: currentInput,
      confidence,
      timeSpent,
      score: Math.round(score),
    }])
    setCurrentInput("")
    setConfidence(50)
    setQuestionStartTime(Date.now())

    if (questionIndex + 1 >= questions.length) {
      finalizeExam()
    } else {
      setQuestionIndex(prev => prev + 1)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timerColor = timeLeft < 60 ? "text-red-400" : timeLeft < 180 ? "text-amber-400" : "text-emerald-400"

  if (!started) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center">
        <div className="w-full max-w-lg mx-4 rounded-2xl border border-amber-500/20 bg-[#0e0e1a] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Exam Simulation</h2>
              <p className="text-[10px] text-white/30 font-mono">Subject: {subject} · {questions.length} questions · {EXAM_DURATION / 60} min</p>
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <RuleRow text="No hints provided" />
            <RuleRow text="No cognitive trace shown" />
            <RuleRow text="Confidence rating required per answer" />
            <RuleRow text="Rubric-based automated scoring" />
            <RuleRow text="Timer cannot be paused" />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => { setStarted(true); setQuestionStartTime(Date.now()) }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase tracking-widest"
            >
              <Zap className="h-3.5 w-3.5 mr-2" /> Begin Exam
            </Button>
            <Button variant="ghost" onClick={onExit} className="text-white/30 hover:text-white/60 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (showResults) {
    const finalScore = answers.length
      ? Math.round(answers.reduce((s, a) => s + a.score, 0) / answers.length)
      : 0
    const avgConf = answers.length
      ? Math.round(answers.reduce((s, a) => s + a.confidence, 0) / answers.length)
      : 0
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-8">
        <div className="w-full max-w-xl mx-4 rounded-2xl border border-cyan-500/20 bg-[#0e0e1a] p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-2">
              <Brain className="h-8 w-8 text-cyan-400" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Exam Complete</h2>
            <p className="text-[10px] text-white/30 font-mono">Cognitive performance analysis</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ScoreBox label="Final Score" value={`${finalScore}%`} sub="Rubric-based"
              color={finalScore >= 70 ? "cyan" : finalScore >= 50 ? "amber" : "red"} />
            <ScoreBox label="Avg Confidence" value={`${avgConf}%`} sub="Self-reported" color="purple" />
            <ScoreBox label="Time Used" value={`${Math.floor((EXAM_DURATION - timeLeft) / 60)}m ${(EXAM_DURATION - timeLeft) % 60}s`} sub="of 10 min" color="slate" />
          </div>

          <div className="space-y-2">
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Per-Question Breakdown</p>
            {answers.map((a, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40 uppercase">Q{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/20">{a.timeSpent}s</span>
                    <span className={cn(
                      "text-[9px] font-bold",
                      a.score >= 70 ? "text-emerald-400" : a.score >= 50 ? "text-amber-400" : "text-red-400"
                    )}>{a.score}%</span>
                  </div>
                </div>
                <p className="text-[9px] text-white/50 line-clamp-1">{a.question}</p>
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

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f]/98 backdrop-blur-sm flex flex-col">
      {/* Exam header bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-amber-500/20 bg-amber-500/[0.03]">
        <Trophy className="h-4 w-4 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Exam Mode Active</span>
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

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-400">Question {questionIndex + 1}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[8px] text-white/20 font-mono">No hints available</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{questions[questionIndex]}</p>
          </div>

          <textarea
            value={currentInput}
            onChange={e => setCurrentInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full h-32 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-amber-500/30 transition-colors font-mono"
          />

          {/* Confidence slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Confidence Level</span>
              <span className={cn(
                "text-[9px] font-bold",
                confidence >= 70 ? "text-emerald-400" : confidence >= 40 ? "text-amber-400" : "text-red-400"
              )}>{confidence}%</span>
            </div>
            <input
              type="range"
              min={0} max={100}
              value={confidence}
              onChange={e => setConfidence(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between">
              <span className="text-[7px] text-white/15">Not sure</span>
              <span className="text-[7px] text-white/15">Very confident</span>
            </div>
          </div>

          <button
            onClick={submitAnswer}
            disabled={!currentInput.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-black font-bold text-xs uppercase tracking-widest"
          >
            {questionIndex + 1 >= questions.length ? (
              <><CheckCircle2 className="h-4 w-4" /> Submit Final Answer</>
            ) : (
              <><ChevronRight className="h-4 w-4" /> Submit & Continue</>
            )}
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
