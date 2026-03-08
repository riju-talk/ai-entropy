"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Loader2, CheckCircle2, XCircle, RefreshCw,
  Brain, BookOpen, ClipboardList, ListChecks, PenLine,
  AlignLeft, FileText, ToggleLeft, CheckSquare, X,
} from "lucide-react"
import React from "react"

// ── Question Types ────────────────────────────────────────────────────────────

type QuestionType =
  | "single_correct"
  | "multiple_correct"
  | "fill_blank"
  | "true_false"
  | "short_answer"
  | "long_answer"

interface BaseQ {
  id: string
  type: QuestionType
  question: string
  points: number
  sectionLabel?: string
}

interface SingleCorrectQ extends BaseQ {
  type: "single_correct"
  options: string[]
  correctIndex: number
  explanation: string
}

interface MultipleCorrectQ extends BaseQ {
  type: "multiple_correct"
  options: string[]
  correctIndices: number[]
  explanation: string
}

interface FillBlankQ extends BaseQ {
  type: "fill_blank"
  blanks: string[]
  explanation: string
}

interface TrueFalseQ extends BaseQ {
  type: "true_false"
  correct: boolean
  explanation: string
}

interface ShortAnswerQ extends BaseQ {
  type: "short_answer"
  sampleAnswer: string
  rubricKeywords: string[]
  explanation: string
}

interface LongAnswerQ extends BaseQ {
  type: "long_answer"
  sampleAnswer: string
  rubricCriteria: Array<{ criterion: string; points: number }>
  explanation: string
}

type AnyQ = SingleCorrectQ | MultipleCorrectQ | FillBlankQ | TrueFalseQ | ShortAnswerQ | LongAnswerQ

// ── Answer union ──────────────────────────────────────────────────────────────

type AnsScq  = { type: "single_correct";   selectedIndex: number | null }
type AnsMcq  = { type: "multiple_correct"; selectedIndices: number[] }
type AnsFib  = { type: "fill_blank";       values: string[] }
type AnsTf   = { type: "true_false";       value: boolean | null }
type AnsText = { type: "short_answer" | "long_answer"; text: string }
type Answer  = AnsScq | AnsMcq | AnsFib | AnsTf | AnsText

// ── Section metadata ──────────────────────────────────────────────────────────

const SECTION_META: Record<QuestionType, {
  label: string; short: string; icon: React.ElementType
  ring: string; pill: string; accent: string
}> = {
  single_correct:  { label: "Single Correct Answer",   short: "SCQ", icon: CheckCircle2, ring: "border-l-cyan-500/50",    pill: "bg-cyan-400/10 border-cyan-400/20 text-cyan-400",         accent: "text-cyan-400" },
  multiple_correct:{ label: "Multiple Correct Answers", short: "MCQ", icon: ListChecks,   ring: "border-l-purple-500/50",  pill: "bg-purple-400/10 border-purple-400/20 text-purple-400",   accent: "text-purple-400" },
  fill_blank:      { label: "Fill in the Blanks",       short: "FIB", icon: PenLine,      ring: "border-l-amber-500/50",   pill: "bg-amber-400/10 border-amber-400/20 text-amber-400",      accent: "text-amber-400" },
  true_false:      { label: "True / False",             short: "T/F", icon: ToggleLeft,   ring: "border-l-emerald-500/50", pill: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400", accent: "text-emerald-400" },
  short_answer:    { label: "Short Answer",             short: "SA",  icon: AlignLeft,    ring: "border-l-orange-500/50",  pill: "bg-orange-400/10 border-orange-400/20 text-orange-400",   accent: "text-orange-400" },
  long_answer:     { label: "Long Answer / Essay",      short: "LA",  icon: FileText,     ring: "border-l-rose-500/50",    pill: "bg-rose-400/10 border-rose-400/20 text-rose-400",         accent: "text-rose-400" },
}

type QuizDifficulty = "easy" | "medium" | "hard"

// ── Fallback question builder ─────────────────────────────────────────────────

function buildFallback(topic: string, n: number, diff: string): AnyQ[] {
  const t = topic || "the subject"
  const isHard = diff === "hard"
  const questions: AnyQ[] = []
  let uid = 0
  const nid = () => String(++uid)

  const push = (scqN: number) => {
    for (let i = 0; i < scqN; i++) {
      questions.push({
        id: nid(), type: "single_correct", points: 2,
        sectionLabel: i === 0 ? "Section A — Single Correct Answer" : undefined,
        question: isHard
          ? `Which of the following most precisely characterises the fundamental mechanism underlying ${t}?`
          : `Which of the following statements about ${t} is correct?`,
        options: [
          `${t} operates exclusively through deterministic, linear processes`,
          `${t} involves structured transformation of inputs to meaningful outputs`,
          `${t} is a purely theoretical concept with no practical applications`,
          `${t} is completely independent of all adjacent disciplines`,
        ],
        correctIndex: 1,
        explanation: `${t} fundamentally involves structured transformation — option B captures this most accurately.`,
      } as SingleCorrectQ)
    }
  }

  const pushMcq = (mcqN: number) => {
    for (let i = 0; i < mcqN; i++) {
      questions.push({
        id: nid(), type: "multiple_correct", points: 3,
        sectionLabel: i === 0 ? "Section B — Multiple Correct Answers" : undefined,
        question: `Select ALL statements that correctly describe ${t}. More than one answer may be correct.`,
        options: [
          `${t} can be applied across multiple real-world domains`,
          `${t} has no universally agreed-upon formal definition`,
          `A solid foundation in related concepts is needed to understand ${t}`,
          `${t} operates in complete isolation from all other fields`,
        ],
        correctIndices: [0, 2],
        explanation: `Options A and C are correct. ${t} is multi-domain and requires prerequisite knowledge.`,
      } as MultipleCorrectQ)
    }
  }

  const pushFib = (fibN: number) => {
    for (let i = 0; i < fibN; i++) {
      questions.push({
        id: nid(), type: "fill_blank", points: 2,
        sectionLabel: i === 0 ? "Section C — Fill in the Blanks" : undefined,
        question: `The systematic study of ___ forms the theoretical core of ${t}, and its practical application requires a thorough understanding of ___ principles.`,
        blanks: [t.split(" ")[0] || t, "foundational"],
        explanation: `The first blank refers to the primary subject; the second to the type of principles required.`,
      } as FillBlankQ)
    }
  }

  const pushTf = (tfN: number) => {
    for (let i = 0; i < tfN; i++) {
      const isTrue = i % 2 === 0
      questions.push({
        id: nid(), type: "true_false", points: 1,
        sectionLabel: i === 0 ? "Section D — True or False" : undefined,
        question: isTrue
          ? `${t} has documented applications in multiple real-world fields and industries.`
          : `${t} is a fully isolated discipline with no meaningful connection to any other field of study.`,
        correct: isTrue,
        explanation: isTrue
          ? `True — ${t} sees application across a broad range of domains.`
          : `False — ${t} is fundamentally interconnected with related disciplines.`,
      } as TrueFalseQ)
    }
  }

  const pushSa = (saN: number) => {
    for (let i = 0; i < saN; i++) {
      questions.push({
        id: nid(), type: "short_answer", points: 5,
        sectionLabel: i === 0 ? "Section E — Short Answer" : undefined,
        question: isHard
          ? `In 3–5 sentences, critically evaluate the significance of ${t} and identify one key limitation or trade-off.`
          : `In 2–3 sentences, explain what ${t} is and why it is important.`,
        sampleAnswer: `${t} is a foundational concept providing a systematic framework for understanding its domain. Its significance lies in enabling structured analysis and real-world application. A key limitation is that it may not generalise uniformly across all edge cases.`,
        rubricKeywords: [t.split(" ")[0]?.toLowerCase() || "topic", "framework", "application", "significance", "limitation"],
        explanation: `Award marks for: clear definition (2 pts), articulation of significance (2 pts), awareness of limitations (1 pt).`,
      } as ShortAnswerQ)
    }
  }

  const scqN = Math.max(1, Math.round(n * 0.2))
  const mcqN = Math.max(1, Math.round(n * 0.15))
  const fibN = Math.max(1, Math.round(n * 0.15))
  const tfN  = Math.max(1, Math.round(n * 0.15))
  const saN  = Math.max(1, Math.round(n * 0.2))

  push(scqN); pushMcq(mcqN); pushFib(fibN); pushTf(tfN); pushSa(saN)

  const laTarget = Math.max(1, n - questions.length)
  for (let i = 0; i < laTarget; i++) {
    questions.push({
      id: nid(), type: "long_answer", points: 10,
      sectionLabel: i === 0 ? "Section F — Long Answer / Essay" : undefined,
      question: isHard
        ? `Write a structured academic essay (400–600 words) covering: (a) definition and context of ${t}, (b) core theoretical foundations, (c) practical applications with examples, (d) limitations and future directions.`
        : `Write a comprehensive answer (200–400 words) on ${t}: clear definition, key principles, at least one concrete example, and reflection on broader significance.`,
      sampleAnswer: `A strong answer opens with a precise definition of ${t}, explains its theoretical underpinnings, illustrates with concrete examples, then reflects on importance and limitations.`,
      rubricCriteria: [
        { criterion: "Clear, accurate definition and contextualisation", points: 2 },
        { criterion: "Explanation of core principles or mechanisms", points: 3 },
        { criterion: "Concrete, well-chosen examples or applications", points: 2 },
        { criterion: "Critical analysis, limitations, or future directions", points: 2 },
        { criterion: "Logical structure, clarity, and academic tone", points: 1 },
      ],
      explanation: `Apply the rubric criteria above. Reward conceptual depth over rote recall.`,
    } as LongAnswerQ)
  }

  return questions.slice(0, n)
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreAnswer(q: AnyQ, a: Answer): number {
  switch (q.type) {
    case "single_correct":
      return (a as AnsScq).selectedIndex === q.correctIndex ? q.points : 0
    case "multiple_correct": {
      const idxs = (a as AnsMcq).selectedIndices
      if (!idxs.length) return 0
      const correct = new Set(q.correctIndices)
      let right = 0, wrong = 0
      idxs.forEach(i => correct.has(i) ? right++ : wrong++)
      return Math.round(q.points * Math.max(0, right - wrong) / q.correctIndices.length)
    }
    case "fill_blank": {
      const vals = (a as AnsFib).values
      let hits = 0
      q.blanks.forEach((b, i) => {
        const v = (vals[i] || "").trim().toLowerCase()
        if (v && b.toLowerCase().split(/[,|]/).map(s => s.trim()).some(t => v.includes(t))) hits++
      })
      return hits === 0 ? 0 : Math.round(q.points * hits / q.blanks.length)
    }
    case "true_false":
      return (a as AnsTf).value === q.correct ? q.points : 0
    case "short_answer": {
      const text = (a as AnsText).text.toLowerCase()
      if (!text.trim()) return 0
      const hits = q.rubricKeywords.filter(k => text.includes(k.toLowerCase())).length
      return Math.min(q.points, Math.round(1 + hits * 0.8 + Math.min(1.5, text.split(/\s+/).length / 30)))
    }
    case "long_answer": {
      const text = (a as AnsText).text.toLowerCase()
      if (!text.trim()) return 0
      const words = text.split(/\s+/).length
      const kw = q.rubricCriteria.flatMap(c => c.criterion.toLowerCase().split(/\s+/)).filter(w => w.length > 4 && text.includes(w)).length
      return Math.min(q.points, Math.round(2 + Math.min(4, kw * 0.35) + Math.min(3, words / 60)))
    }
  }
}

function blankAnswer(q: AnyQ): Answer {
  switch (q.type) {
    case "single_correct":   return { type: "single_correct",   selectedIndex: null }
    case "multiple_correct": return { type: "multiple_correct", selectedIndices: [] }
    case "fill_blank":       return { type: "fill_blank",       values: Array((q as FillBlankQ).blanks.length).fill("") }
    case "true_false":       return { type: "true_false",       value: null }
    case "short_answer":     return { type: "short_answer",     text: "" }
    case "long_answer":      return { type: "long_answer",      text: "" }
  }
}

function isAnswered(a: Answer | undefined): boolean {
  if (!a) return false
  if (a.type === "single_correct")   return (a as AnsScq).selectedIndex !== null
  if (a.type === "multiple_correct") return (a as AnsMcq).selectedIndices.length > 0
  if (a.type === "fill_blank")       return (a as AnsFib).values.some(v => v.trim())
  if (a.type === "true_false")       return (a as AnsTf).value !== null
  return !!((a as AnsText).text?.trim())
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── Main Component ────────────────────────────────────────────────────────────

// ── Normalize concept name (strip quiz/test prefixes) ────────────────────────

function normalizeConcept(raw: string): string {
  const s = raw.trim()
    .replace(/^(small\s+)?pop\s+quiz\s+(on|about|for)\s+/i, "")
    .replace(/^(quick\s+)?(quiz|test|exam|assessment|full\s+assessment)\s+(on|about|for)\s+/i, "")
    .replace(/^(quiz|test|exam|assessment):\s*/i, "")
    .trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Map raw API question to typed AnyQ ───────────────────────────────────────

function mapApiQuestion(q: any, idx: number): AnyQ | null {
  const base = { id: String(idx), question: (q.question || q.text || "").trim(), points: 0 }
  if (!base.question) return null
  const type: QuestionType = q.type || "single_correct"
  switch (type) {
    case "single_correct":
      return { ...base, type: "single_correct", points: 2, options: q.options || [], correctIndex: q.correctAnswer ?? 0, explanation: q.explanation || "" } as SingleCorrectQ
    case "multiple_correct":
      return { ...base, type: "multiple_correct", points: 3, options: q.options || [], correctIndices: q.correctAnswers || [], explanation: q.explanation || "" } as MultipleCorrectQ
    case "fill_blank":
      return { ...base, type: "fill_blank", points: 2, blanks: q.blanks || [], explanation: q.explanation || "" } as FillBlankQ
    case "true_false":
      return { ...base, type: "true_false", points: 1, correct: q.correct ?? true, explanation: q.explanation || "" } as TrueFalseQ
    case "short_answer":
      return { ...base, type: "short_answer", points: 5, sampleAnswer: q.sampleAnswer || "", rubricKeywords: q.rubricKeywords || [], explanation: q.explanation || "" } as ShortAnswerQ
    case "long_answer":
      return { ...base, type: "long_answer", points: 10, sampleAnswer: q.sampleAnswer || "", rubricCriteria: q.rubricCriteria || [], explanation: q.explanation || "" } as LongAnswerQ
    default:
      if (q.options?.length) return { ...base, type: "single_correct", points: 2, options: q.options, correctIndex: q.correctAnswer ?? 0, explanation: q.explanation || "" } as SingleCorrectQ
      return null
  }
}

// ── Assign section labels by type ─────────────────────────────────────────────

function assignSectionLabels(qs: AnyQ[]): AnyQ[] {
  const seenTypes = new Set<QuestionType>()
  return qs.map(q => {
    if (!seenTypes.has(q.type)) {
      seenTypes.add(q.type)
      const m = SECTION_META[q.type]
      const letter = String.fromCharCode(65 + [...seenTypes].indexOf(q.type))
      return { ...q, sectionLabel: `Section ${letter} — ${m.label}` }
    }
    return { ...q, sectionLabel: undefined }
  })
}

export function QuizAgent() {
  const { data: session } = useSession()
  const [topic, setTopic]       = useState("")
  const [difficulty, setDiff]   = useState<QuizDifficulty>("medium")
  const [numQ, setNumQ]         = useState(5)
  const [loading, setLoading]   = useState(false)
  const [fetchNote, setFetchNote] = useState<string | null>(null)
  const [phase, setPhase]       = useState<"configure" | "assessment" | "results">("configure")
  const [questions, setQuestions] = useState<AnyQ[]>([])
  const [answers, setAnswers]   = useState<Record<string, Answer>>({})

  const sectionMap = (() => {
    const map = new Map<string, AnyQ[]>()
    questions.forEach(q => {
      const key = q.sectionLabel || "Questions"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(q)
    })
    return Array.from(map.entries())
  })()

  const setAnswer = useCallback((id: string, upd: Partial<Answer>) => {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], ...upd } as Answer }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return
    setLoading(true)
    setFetchNote(null)
    let qs: AnyQ[] = []
    try {
      const res = await fetch("/api/ai-agent/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty, num_questions: numQ,
          question_types: ["single_correct", "multiple_correct", "fill_blank", "true_false", "short_answer", "long_answer"] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const raw: any[] = data.questions || data || []
      if (!Array.isArray(raw) || raw.length < 2) throw new Error()
      const mapped = raw.slice(0, numQ).map((q: any, i: number) => mapApiQuestion(q, i)).filter((q): q is AnyQ => q !== null)
      if (mapped.length < 2) throw new Error()
      qs = assignSectionLabels(mapped)
    } catch {
      setFetchNote("Using built-in assessment (backend offline or returned invalid data)")
      qs = buildFallback(topic, numQ, difficulty)
    }
    const init: Record<string, Answer> = {}
    qs.forEach(q => { init[q.id] = blankAnswer(q) })
    setQuestions(qs); setAnswers(init)
    setLoading(false); setPhase("assessment")
  }, [topic, difficulty, numQ])

  const handleSubmit = useCallback(async () => {
    setPhase("results")
    // Fire mastery updates for each answered question (best-effort, no await)
    const userId = session?.user?.id
    if (userId && topic.trim()) {
      for (const q of questions) {
        const a = answers[q.id]
        const correct = a ? scoreAnswer(q, a) > 0 : false
        fetch("/api/ai-agent/mastery?action=attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            concept: normalizeConcept(topic),
            is_correct: correct,
            evidence_weight: 0.8,
          }),
        }).catch(() => {})
      }
      // Notify sidebar to refresh cognitive stats
      window.dispatchEvent(new CustomEvent("mastery-updated"))
    }
  }, [questions, answers, topic, session])
  

  // ── Configure ─────────────────────────────────────────────────────────────

  if (phase === "configure") {
    const diffStyle: Record<string, string> = {
      easy:   "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      medium: "bg-amber-500/10  border-amber-500/30  text-amber-400",
      hard:   "bg-red-500/10    border-red-500/30    text-red-400",
    }
    return (
      <div className="h-full flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md px-6 py-8 space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">Full Assessment Generation</h2>
              <p className="text-[10px] text-white/25 mt-1">All 6 question types · Coursera-style · Full rubric</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {(Object.entries(SECTION_META) as [QuestionType, typeof SECTION_META[QuestionType]][]).map(([type, m]) => (
              <span key={type} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-bold uppercase tracking-widest", m.pill)}>
                <m.icon className="h-2.5 w-2.5" />{m.short}
              </span>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Topic / Concept</label>
            <textarea value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Chain Rule · Recursion · Photosynthesis · Flask APIs"
              rows={2}
              className="w-full resize-none bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/25 transition-all font-sans" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Difficulty</label>
              <div className="flex flex-col gap-1">
                {(["easy", "medium", "hard"] as QuizDifficulty[]).map(d => (
                  <button key={d} onClick={() => setDiff(d)}
                    className={cn("py-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                      difficulty === d ? diffStyle[d] : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                    )}>{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Questions</label>
              <div className="flex flex-col gap-1">
                {[5, 10, 15, 20].map(n => (
                  <button key={n} onClick={() => setNumQ(n)}
                    className={cn("py-2 rounded-lg border text-[10px] font-bold transition-all",
                      numQ === n ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/[0.02] border-white/[0.06] text-white/20 hover:text-white/40"
                    )}>{n} questions</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={!topic.trim() || loading}
            className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-[11px] uppercase tracking-widest transition-all",
              !loading && topic.trim()
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                : "bg-white/[0.02] border-white/[0.06] text-white/20 cursor-not-allowed"
            )}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
              : <><BookOpen className="h-4 w-4" />Generate Full Assessment — {numQ} Questions</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Assessment (Coursera-style, all questions visible) ────────────────────

  if (phase === "assessment") {
    const answeredCount = Object.values(answers).filter(a => isAnswered(a)).length
    const totalPts = questions.reduce((s, q) => s + q.points, 0)
    return (
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#0c0c14]">
          <ClipboardList className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/60 truncate">{topic}</p>
            <p className="text-[8px] text-white/20 font-mono uppercase tracking-widest">{difficulty} · {questions.length} questions · {totalPts} pts</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[8px] text-white/25 font-mono">{answeredCount}/{questions.length}</span>
            <div className="w-20 h-1 rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-amber-500/60 transition-all" style={{ width: `${(answeredCount / (questions.length || 1)) * 100}%` }} />
            </div>
            <button onClick={() => { setPhase("configure"); setQuestions([]); setAnswers({}) }}
              className="text-white/15 hover:text-white/40 transition-colors ml-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {fetchNote && (
          <div className="shrink-0 px-4 py-1.5 bg-amber-500/[0.04] border-b border-amber-500/10">
            <p className="text-[8px] text-amber-400/50">{fetchNote}</p>
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          {/* Section nav */}
          <nav className="w-44 shrink-0 border-r border-white/[0.05] bg-[#0b0b16] overflow-y-auto py-4 px-2 hidden lg:flex flex-col gap-1">
            <p className="text-[7px] font-bold uppercase tracking-[0.22em] text-white/20 px-2 mb-1.5">Sections</p>
            {sectionMap.map(([label, qs], si) => {
              const m = qs[0] ? SECTION_META[qs[0].type] : null
              const done = qs.filter(q => isAnswered(answers[q.id])).length
              return (
                <a key={si} href={`#qa-sec-${si}`} className="rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors block">
                  <div className="flex items-center gap-1.5">
                    {m && <m.icon className={cn("h-2.5 w-2.5 shrink-0", m.accent)} />}
                    <p className="text-[8px] font-semibold text-white/35 truncate">{label.replace(/^Section [A-F] — /, "")}</p>
                  </div>
                  <p className="text-[7px] text-white/20 font-mono pl-4">{done}/{qs.length} answered</p>
                </a>
              )
            })}
            <div className="mt-auto pt-3 border-t border-white/[0.04] px-2">
              <p className="text-[7px] text-white/15 leading-relaxed">Answer in any order. Saves automatically.</p>
            </div>
          </nav>
          {/* Questions */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-6 space-y-10 max-w-2xl">
              {sectionMap.map(([label, qs], si) => {
                const m = qs[0] ? SECTION_META[qs[0].type] : null
                const secPts = qs.reduce((s, q) => s + q.points, 0)
                return (
                  <section key={si} id={`qa-sec-${si}`} className="scroll-mt-2 space-y-4">
                    <div className={cn("border-l-2 pl-3 pb-0.5", m ? m.ring : "border-l-white/20")}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {m && <m.icon className={cn("h-3.5 w-3.5", m.accent)} />}
                        <h3 className="text-[11px] font-bold text-white/60">{label}</h3>
                      </div>
                      <p className="text-[8px] text-white/20">{m?.label} · {qs.length} question{qs.length !== 1 ? "s" : ""} · {secPts} pts</p>
                    </div>
                    {qs.map(q => (
                      <QuestionBlock key={q.id} q={q} globalIndex={questions.indexOf(q)} answer={answers[q.id]} onChange={upd => setAnswer(q.id, upd)} />
                    ))}
                  </section>
                )
              })}
              <div className="space-y-3 pb-12 border-t border-white/[0.05] pt-6">
                <p className="text-[9px] text-white/25">
                  {answeredCount} of {questions.length} answered.{" "}
                  {questions.length - answeredCount > 0 ? `${questions.length - answeredCount} unanswered will score 0.` : "All questions answered — ready to submit."}
                </p>
                <button onClick={handleSubmit}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-500/20 transition-all">
                  <CheckCircle2 className="h-4 w-4" />Submit &amp; View Full Rubric
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Results + Full Rubric ─────────────────────────────────────────────────

  const totalPts  = questions.reduce((s, q) => s + q.points, 0)
  const earnedPts = questions.reduce((s, q) => { const a = answers[q.id]; return s + (a ? scoreAnswer(q, a) : 0) }, 0)
  const pct   = Math.round((earnedPts / (totalPts || 1)) * 100)
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B+" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F"
  const gColor = pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"
  const gBorder = pct >= 70 ? "border-emerald-500/20" : pct >= 50 ? "border-amber-500/20" : "border-red-500/20"

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-6 space-y-8 max-w-2xl">
        {/* Grade card */}
        <div className={cn("rounded-2xl border bg-white/[0.015] p-5 space-y-5", gBorder)}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20 mb-0.5">Assessment Complete</p>
              <h2 className="text-[13px] font-bold text-white/70">{topic}</h2>
              <p className="text-[9px] text-white/25">{difficulty} · {questions.length} questions</p>
            </div>
            <button onClick={() => { setPhase("configure"); setQuestions([]); setAnswers({}) }}
              className="text-white/15 hover:text-white/40 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Grade",  val: grade,         color: gColor },
              { label: "Score",  val: `${pct}%`,     color: gColor },
              { label: "Earned", val: `${earnedPts}`, color: "text-white/50" },
              { label: "Total",  val: `${totalPts}`,  color: "text-white/25" },
            ].map(b => (
              <div key={b.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                <p className={cn("text-xl font-bold", b.color)}>{b.val}</p>
                <p className="text-[7px] uppercase tracking-widest text-white/20 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-white/20">By Section</p>
            {(Object.keys(SECTION_META) as QuestionType[]).map(type => {
              const typeQs = questions.filter(q => q.type === type)
              if (!typeQs.length) return null
              const tPts = typeQs.reduce((s, q) => s + q.points, 0)
              const tEarned = typeQs.reduce((s, q) => { const a = answers[q.id]; return s + (a ? scoreAnswer(q, a) : 0) }, 0)
              const tPct = Math.round((tEarned / tPts) * 100)
              const m = SECTION_META[type]
              return (
                <div key={type} className="flex items-center gap-2.5">
                  <span className={cn("text-[7px] font-bold w-8 text-right font-mono shrink-0", m.accent)}>{m.short}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.05]">
                    <div className={cn("h-full rounded-full", tPct >= 70 ? "bg-emerald-500/50" : tPct >= 50 ? "bg-amber-500/50" : "bg-red-500/50")} style={{ width: `${tPct}%` }} />
                  </div>
                  <span className="text-[7px] text-white/25 font-mono w-14 text-right shrink-0">{tEarned}/{tPts} pts · {tPct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Full rubric */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
            <Brain className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Full Answer Rubric</h3>
            <span className="text-[8px] text-white/20 font-mono ml-auto">{questions.length} items</span>
          </div>
          {questions.map((q, idx) => {
            const a = answers[q.id]
            const pts = a ? scoreAnswer(q, a) : 0
            const isCorrect = pts === q.points
            const isPartial = pts > 0 && pts < q.points
            const m = SECTION_META[q.type]
            return (
              <div key={q.id} className={cn("rounded-xl border bg-white/[0.01] overflow-hidden",
                isCorrect ? "border-emerald-500/20" : isPartial ? "border-amber-500/20" : "border-white/[0.06]")}>
                <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                  <span className="text-[8px] text-white/25 font-mono shrink-0 pt-0.5 w-4">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest", m.pill)}>{m.short}</span>
                      <span className="text-[7px] text-white/20 font-mono">{q.points} pts max</span>
                    </div>
                    <p className="text-[12px] text-white/70 leading-relaxed">{q.question}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5 pt-0.5">
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : isPartial ? <div className="h-3.5 w-3.5 rounded-full border-2 border-amber-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500/50" />}
                    <span className={cn("text-[9px] font-bold font-mono", isCorrect ? "text-emerald-400" : isPartial ? "text-amber-400" : "text-white/25")}>{pts}/{q.points}</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-white/20">Your Answer</p>
                    <UserAnswerView q={q} answer={a} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-emerald-400/40">Correct / Model Answer</p>
                    <CorrectAnswerView q={q} />
                  </div>
                  {q.type === "long_answer" && (
                    <div className="space-y-1">
                      <p className="text-[7px] font-bold uppercase tracking-widest text-amber-400/40">Marking Rubric</p>
                      <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] divide-y divide-white/[0.03]">
                        {(q as LongAnswerQ).rubricCriteria.map((c, ci) => (
                          <div key={ci} className="flex items-center justify-between px-3 py-1.5">
                            <span className="text-[9px] text-white/40">{c.criterion}</span>
                            <span className="text-[8px] text-amber-400/50 font-mono shrink-0 ml-3">{c.points}p</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {q.type === "short_answer" && (
                    <div className="space-y-1">
                      <p className="text-[7px] font-bold uppercase tracking-widest text-amber-400/40">Rubric Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {(q as ShortAnswerQ).rubricKeywords.map((kw, ki) => (
                          <span key={ki} className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/[0.05] border border-amber-500/10 text-amber-400/50">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg bg-cyan-500/[0.02] border border-cyan-500/10 px-3 py-2">
                    <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-cyan-400/35 mb-0.5">Examiner Note</p>
                    <p className="text-[10px] text-white/30 leading-relaxed">{(q as any).explanation || "Refer to the model answer above."}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={() => { setPhase("configure"); setQuestions([]); setAnswers({}) }}
          className="w-full flex items-center justify-center gap-2 py-3 mb-8 rounded-xl border border-white/[0.07] bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/55 hover:border-white/10 transition-all">
          <RefreshCw className="h-3.5 w-3.5" />New Assessment
        </button>
      </div>
    </div>
  )
}

// ── Question Block ────────────────────────────────────────────────────────────

function QuestionBlock({ q, globalIndex, answer, onChange }: {
  q: AnyQ; globalIndex: number; answer: Answer | undefined; onChange: (upd: Partial<Answer>) => void
}) {
  const m = SECTION_META[q.type]
  const answered = isAnswered(answer)
  return (
    <div className={cn("rounded-xl border transition-all",
      answered ? "border-white/[0.10] bg-white/[0.012]" : "border-white/[0.05] bg-white/[0.005]")}>
      <div className="flex items-start gap-2.5 px-4 pt-4 pb-2">
        <div className="shrink-0 w-5 h-5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mt-0.5">
          {answered ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <span className="text-[8px] font-bold text-white/20">{globalIndex + 1}</span>}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest", m.pill)}>{m.short}</span>
            <span className="text-[7px] text-white/20 font-mono">{q.points} {q.points === 1 ? "pt" : "pts"}</span>
          </div>
          <p className="text-[12px] text-white/75 leading-relaxed">{q.question}</p>
        </div>
      </div>
      <div className="px-4 pb-4 pl-11 space-y-1.5">
        {q.type === "single_correct" && (q as SingleCorrectQ).options.map((opt, i) => {
          const sel = (answer as AnsScq)?.selectedIndex === i
          return (
            <button key={i} onClick={() => onChange({ selectedIndex: i } as Partial<AnsScq>)}
              className={cn("w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-[12px] leading-relaxed transition-all",
                sel ? "bg-amber-500/8 border-amber-500/25 text-white/75" : "bg-white/[0.02] border-white/[0.05] text-white/40 hover:text-white/60 hover:border-white/10")}>
              <span className={cn("mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center", sel ? "border-amber-400 bg-amber-400/15" : "border-white/15")}>
                {sel && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </span>
              {opt}
            </button>
          )
        })}
        {q.type === "multiple_correct" && (
          <>
            <p className="text-[8px] text-white/20 italic">Select all that apply</p>
            {(q as MultipleCorrectQ).options.map((opt, i) => {
              const sel = ((answer as AnsMcq)?.selectedIndices || []).includes(i)
              return (
                <button key={i} onClick={() => {
                  const prev = (answer as AnsMcq)?.selectedIndices || []
                  onChange({ selectedIndices: sel ? prev.filter(x => x !== i) : [...prev, i] } as Partial<AnsMcq>)
                }}
                  className={cn("w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-[12px] leading-relaxed transition-all",
                    sel ? "bg-purple-500/8 border-purple-500/25 text-white/75" : "bg-white/[0.02] border-white/[0.05] text-white/40 hover:text-white/60 hover:border-white/10")}>
                  <span className={cn("mt-0.5 shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center", sel ? "border-purple-400 bg-purple-400/15" : "border-white/15")}>
                    {sel && <CheckSquare className="h-2.5 w-2.5 text-purple-400" />}
                  </span>
                  {opt}
                </button>
              )
            })}
          </>
        )}
        {q.type === "fill_blank" && (
          <>
            <p className="text-[8px] text-white/20 italic">Fill in each blank from the question above</p>
            {(q as FillBlankQ).blanks.map((_, bi) => (
              <div key={bi} className="flex items-center gap-2">
                <span className="text-[8px] text-white/25 font-mono shrink-0 w-12">Blank {bi + 1}</span>
                <input value={(answer as AnsFib)?.values?.[bi] || ""}
                  onChange={e => {
                    const vals = [...((answer as AnsFib)?.values || Array((q as FillBlankQ).blanks.length).fill(""))]
                    vals[bi] = e.target.value
                    onChange({ values: vals } as Partial<AnsFib>)
                  }}
                  placeholder="Your answer…"
                  className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-1.5 text-[12px] text-white/65 placeholder:text-white/12 focus:outline-none focus:border-amber-500/25 transition-colors" />
              </div>
            ))}
          </>
        )}
        {q.type === "true_false" && (
          <div className="flex gap-2">
            {([true, false] as const).map(val => {
              const sel = (answer as AnsTf)?.value === val
              return (
                <button key={String(val)} onClick={() => onChange({ value: val } as Partial<AnsTf>)}
                  className={cn("flex-1 py-2.5 rounded-lg border font-bold text-[12px] transition-all",
                    sel ? (val ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-red-500/10 border-red-500/25 text-red-400")
                      : "bg-white/[0.02] border-white/[0.05] text-white/25 hover:text-white/50")}>
                  {val ? "True" : "False"}
                </button>
              )
            })}
          </div>
        )}
        {q.type === "short_answer" && (
          <>
            <p className="text-[8px] text-white/20 italic">2–5 sentences</p>
            <textarea value={(answer as AnsText)?.text || ""} onChange={e => onChange({ text: e.target.value } as Partial<AnsText>)}
              placeholder="Your answer…" rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-[12px] text-white/65 placeholder:text-white/12 resize-y focus:outline-none focus:border-amber-500/25 transition-colors font-sans leading-relaxed" />
            <p className="text-[7px] text-white/15 font-mono text-right">{wordCount((answer as AnsText)?.text || "")} words</p>
          </>
        )}
        {q.type === "long_answer" && (
          <>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <p className="text-[7px] font-bold uppercase tracking-widest text-amber-400/35 mb-1">Marking criteria (shown after submit)</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {(q as LongAnswerQ).rubricCriteria.map((c, ci) => (
                  <p key={ci} className="text-[7px] text-white/20">· {c.criterion} ({c.points}p)</p>
                ))}
              </div>
            </div>
            <textarea value={(answer as AnsText)?.text || ""} onChange={e => onChange({ text: e.target.value } as Partial<AnsText>)}
              placeholder="Write your answer here…" rows={10}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-[12px] text-white/65 placeholder:text-white/12 resize-y focus:outline-none focus:border-amber-500/25 transition-colors font-sans leading-relaxed" />
            <p className="text-[7px] text-white/15 font-mono text-right">{wordCount((answer as AnsText)?.text || "")} words</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Rubric helpers ────────────────────────────────────────────────────────────

function UserAnswerView({ q, answer }: { q: AnyQ; answer: Answer | undefined }) {
  if (!answer || !isAnswered(answer))
    return <p className="text-[9px] text-white/15 italic">Not attempted</p>
  switch (q.type) {
    case "single_correct": {
      const idx = (answer as AnsScq).selectedIndex
      if (idx === null) return <p className="text-[9px] text-white/15 italic">Not attempted</p>
      return <p className="text-[10px] text-white/50 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1">{String.fromCharCode(65 + idx)}. {(q as SingleCorrectQ).options[idx]}</p>
    }
    case "multiple_correct": {
      const idxs = (answer as AnsMcq).selectedIndices
      return <div className="flex flex-wrap gap-1">{idxs.map(i => <span key={i} className="text-[9px] text-white/50 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-0.5">{String.fromCharCode(65 + i)}. {(q as MultipleCorrectQ).options[i]}</span>)}</div>
    }
    case "fill_blank": {
      const vals = (answer as AnsFib).values
      return <div className="flex flex-wrap gap-1">{vals.map((v, i) => <span key={i} className="text-[9px] text-white/50 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-0.5 font-mono">Blank {i + 1}: {v || "—"}</span>)}</div>
    }
    case "true_false": {
      const val = (answer as AnsTf).value
      if (val === null) return <p className="text-[9px] text-white/15 italic">Not attempted</p>
      return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", val ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>{val ? "True" : "False"}</span>
    }
    case "short_answer":
    case "long_answer": {
      const text = (answer as AnsText).text
      return <p className="text-[10px] text-white/50 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1 leading-relaxed whitespace-pre-wrap">{text}</p>
    }
  }
}

function CorrectAnswerView({ q }: { q: AnyQ }) {
  switch (q.type) {
    case "single_correct":
      return <p className="text-[10px] text-emerald-400/70 bg-emerald-400/[0.03] border border-emerald-400/12 rounded px-2 py-1">{String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}</p>
    case "multiple_correct":
      return <div className="flex flex-wrap gap-1">{q.correctIndices.map(i => <span key={i} className="text-[9px] text-emerald-400/70 bg-emerald-400/[0.03] border border-emerald-400/12 rounded px-2 py-0.5">{String.fromCharCode(65 + i)}. {q.options[i]}</span>)}</div>
    case "fill_blank":
      return <div className="flex flex-wrap gap-1">{q.blanks.map((b, i) => <span key={i} className="text-[9px] text-emerald-400/70 bg-emerald-400/[0.03] border border-emerald-400/12 rounded px-2 py-0.5 font-mono">Blank {i + 1}: {b}</span>)}</div>
    case "true_false":
      return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", q.correct ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>{q.correct ? "True" : "False"}</span>
    case "short_answer":
    case "long_answer":
      return <p className="text-[10px] text-emerald-400/60 bg-emerald-400/[0.02] border border-emerald-400/08 rounded px-2 py-1 leading-relaxed italic whitespace-pre-wrap">{q.sampleAnswer}</p>
  }
}
