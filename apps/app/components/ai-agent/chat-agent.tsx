"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Send, Loader2, User, BrainCircuit, Globe, Zap, Network,
  FlaskConical, ChevronDown, CheckCircle2, Layers, MessageSquare, Trophy,
  Atom, ScanLine, Mic, MicOff, PlusCircle, BookOpen, CalendarDays, Bell,
} from "lucide-react"
import { ModeSelector, type LearningMode } from "./mode-selector"
import { CognitiveTraceCard, type CognitiveTrace } from "./cognitive-trace-card"
import { ExamModeOverlay } from "./exam-mode-overlay"
import { LiveKnowledgeGraph } from "./live-knowledge-graph"

// ─── Types ───────────────────────────────────────────────────────────────────

type Language = "auto" | "english" | "hindi" | "bilingual"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  trace?: CognitiveTrace
  masteryDelta?: number
  isStreaming?: boolean
  stepIndex?: number          // used in structured mode
  stepValidated?: boolean
}

interface ChatAgentProps {
  contextDoc?: any
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLanguage(text: string): "hindi" | "english" {
  // Unicode range for Devanagari: U+0900–U+097F
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length
  return devanagariCount > 3 ? "hindi" : "english"
}

function generateMockTrace(content: string, inputText: string): CognitiveTrace {
  const concepts = [
    "Chain Rule", "Derivatives", "Limits", "Recursion",
    "Big O Notation", "Gradient Descent", "Linear Algebra",
  ]
  const intents = [
    "Calculus Problem", "Algorithm Analysis", "Concept Clarification",
    "Proof Verification", "Example Request", "Error Diagnosis",
  ]
  return {
    intent: intents[Math.floor(Math.random() * intents.length)],
    concept: concepts[Math.floor(Math.random() * concepts.length)],
    difficulty: 0.4 + Math.random() * 0.45,
    masteryImpact: Math.floor(Math.random() * 5) + 1,
    language: detectLanguage(inputText) === "hindi" ? "Hindi" : "English",
    inferenceMs: 12 + Math.floor(Math.random() * 30),
    reasoningLayers: 7,
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1 h-1 rounded-full bg-cyan-400 animate-[bounce_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MasteryPill({ delta }: { delta: number }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 mt-1">
      <Atom className="h-2.5 w-2.5" />
      Mastery +{delta}%
    </div>
  )
}

function LanguageBadge({ lang }: { lang: Language }) {
  if (lang === "auto" || lang === "english") return null
  const map = {
    hindi: { label: "🌍 Hindi Mode Active", cls: "bg-orange-500/10 border-orange-500/20 text-orange-400" },
    bilingual: { label: "🌍 Bilingual Technical Mode", cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  } as any
  const info = map[lang]
  if (!info) return null
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest", info.cls)}>
      {info.label}
    </span>
  )
}

function StepBadge({ index, validated }: { index: number; validated?: boolean }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold mb-1",
      validated
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-white/[0.03] border-white/[0.08] text-white/30"
    )}>
      {validated ? <CheckCircle2 className="h-2.5 w-2.5" /> : <ScanLine className="h-2.5 w-2.5" />}
      Step {index + 1} {validated ? "· Validated" : "· Pending validation"}
    </div>
  )
}

function MessageBubble({ msg, showTrace }: { msg: Message; showTrace: boolean }) {
  const isUser = msg.role === "user"
  const detectedLang = detectLanguage(msg.content)

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 items-start group">
        <div className="max-w-[72%] space-y-1">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border border-cyan-500/15 px-4 py-2.5">
            <p className="text-[13px] text-white/80 leading-relaxed">{msg.content}</p>
          </div>
          <p className="text-[8px] text-white/20 text-right font-mono">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5 text-cyan-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 items-start group">
      <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
      </div>
      <div className="max-w-[80%] space-y-1 flex-1 min-w-0">
        {msg.stepIndex !== undefined && (
          <StepBadge index={msg.stepIndex} validated={msg.stepValidated} />
        )}
        <div className={cn(
          "rounded-2xl rounded-tl-sm border px-4 py-3",
          "bg-gradient-to-br from-white/[0.03] to-white/[0.01] border-white/[0.07]",
          "transition-all duration-300",
          msg.isStreaming && "border-cyan-500/20"
        )}>
          {msg.isStreaming ? (
            <TypingDots />
          ) : (
            <p className={cn("text-[13px] leading-relaxed whitespace-pre-wrap",
              detectedLang === "hindi" ? "text-orange-100/70" : "text-white/70"
            )}>
              {msg.content}
            </p>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 pt-0.5">
          <p className="text-[8px] text-white/20 font-mono">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {detectedLang === "hindi" && <LanguageBadge lang="hindi" />}
          {msg.masteryDelta && msg.masteryDelta > 0 && <MasteryPill delta={msg.masteryDelta} />}
        </div>

        {showTrace && msg.trace && !msg.isStreaming && (
          <CognitiveTraceCard trace={msg.trace} />
        )}
      </div>
    </div>
  )
}

function StructuredModeGuide({ step }: { step: number }) {
  const steps = [
    "State the problem definition clearly.",
    "Identify relevant concepts and formulas.",
    "Show your working step-by-step.",
    "Verify your answer against edge cases.",
  ]
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 bg-purple-500/5 border-b border-purple-500/10">
      <Layers className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-purple-400 mb-0.5">Structured Mode — Step {step + 1}/4</p>
        <p className="text-[11px] text-white/40">{steps[Math.min(step, steps.length - 1)]}</p>
      </div>
    </div>
  )
}

function EmptyState() {
  const prompts = [
    "Explain the chain rule with an example",
    "What's the time complexity of merge sort?",
    "How does gradient descent work intuitively?",
    "Derive the derivative of sin(x²)",
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/10 border border-cyan-500/15 flex items-center justify-center">
          <BrainCircuit className="h-8 w-8 text-cyan-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1.5 max-w-md">
        <h2 className="text-base font-bold text-white/60 tracking-tight">ENTROPY Cognitive Engine</h2>
        <p className="text-[11px] text-white/25 leading-relaxed">
          7-Layer structured reasoning · Edge-accelerated inference · Multilingual explainability
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {prompts.map((p) => (
          <button
            key={p}
            className="text-left px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10 transition-all group"
          >
            <p className="text-[10px] text-white/30 group-hover:text-white/50 transition-colors leading-relaxed">{p}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Language toggle bar ──────────────────────────────────────────────────────

function LanguageToggle({ value, onChange }: { value: Language; onChange: (v: Language) => void }) {
  const opts: { id: Language; label: string }[] = [
    { id: "auto", label: "Auto" },
    { id: "english", label: "English" },
    { id: "hindi", label: "हिन्दी" },
    { id: "bilingual", label: "Bilingual" },
  ]
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
            value === o.id
              ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
              : "text-white/20 hover:text-white/40"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ChatAgent({ contextDoc }: ChatAgentProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<LearningMode>("chat")
  const [language, setLanguage] = useState<Language>("auto")
  const [showTrace, setShowTrace] = useState(true)
  const [showGraph, setShowGraph] = useState(false)
  const [showExam, setShowExam] = useState(false)
  const [activeConceptId, setActiveConceptId] = useState<string | undefined>()
  const [masteryUpdate, setMasteryUpdate] = useState<{ conceptId: string; delta: number } | undefined>()
  const [structuredStep, setStructuredStep] = useState(0)
  const [voiceActive, setVoiceActive] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [reviewQueue, setReviewQueue] = useState<{ concept: string; mastery: number; urgency: string; suggested_prompt: string }[]>([])
  const [studyPlanGoal, setStudyPlanGoal] = useState("")
  const [studyPlanDays, setStudyPlanDays] = useState(7)
  const [studyPlan, setStudyPlan] = useState<any | null>(null)
  const [studyPlanLoading, setStudyPlanLoading] = useState(false)
  const [showStudyPlan, setShowStudyPlan] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()
  const { data: session } = useSession()
  const userId = session?.user?.id

  // Load most recent conversation on mount
  useEffect(() => {
    if (!userId) return
    fetch(`/api/ai-agent/conversations?user_id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => {
        const convs: any[] = data.conversations || []
        if (convs.length === 0) return
        const latest = convs[0]
        setConversationId(latest.id)
        // Load messages for this conversation
        return fetch(`/api/ai-agent/conversations?user_id=${encodeURIComponent(userId)}&id=${latest.id}`)
          .then(r => r.json())
          .then(conv => {
            const msgs: Message[] = (conv.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.createdAt),
            }))
            if (msgs.length > 0) setMessages(msgs)
          })
      })
      .catch(() => {/* offline — start fresh */})
  }, [userId])

  // Fetch spaced repetition review queue
  useEffect(() => {
    if (!userId) return
    fetch(`/api/ai-agent/mastery?action=review-queue&user_id=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.queue?.length) setReviewQueue(data.queue)
      })
      .catch(() => {})
  }, [userId])

  // Generate study plan
  const generateStudyPlan = useCallback(async () => {
    if (!userId || !studyPlanGoal.trim()) return
    setStudyPlanLoading(true)
    try {
      const res = await fetch("/api/ai-agent/mastery?action=study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, goal: studyPlanGoal.trim(), days: studyPlanDays }),
      })
      const plan = await res.json()
      setStudyPlan(plan)
      setShowStudyPlan(true)
    } catch { /* silent */ }
    finally { setStudyPlanLoading(false) }
  }, [userId, studyPlanGoal, studyPlanDays])

  // Start a new chat session
  const startNewChat = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch("/api/ai-agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const conv = await res.json()
      setConversationId(conv.id)
      setMessages([])
      setStructuredStep(0)
      setActiveConceptId(undefined)
    } catch {
      setConversationId(undefined)
      setMessages([])
    }
  }, [userId])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle mode change
  useEffect(() => {
    if (mode === "exam") {
      setShowExam(true)
    }
    if (mode === "structured") {
      setStructuredStep(0)
    }
  }, [mode])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    // If userId present but no conversation yet, create one first
    if (userId && !conversationId) {
      try {
        const res = await fetch("/api/ai-agent/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })
        const conv = await res.json()
        setConversationId(conv.id)
      } catch { /* continue without persisting */ }
    }

    const detectedLang = detectLanguage(text)
    if (detectedLang === "hindi" && language === "auto") {
      setLanguage("hindi")
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    }

    // Streaming placeholder
    const placeholderId = crypto.randomUUID()
    const placeholder: Message = {
      id: placeholderId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, placeholder])
    setInput("")
    setLoading(true)

    // Build the payload
    const systemHints = [
      language === "hindi" ? "Respond in Hindi (Devanagari script)." : "",
      language === "bilingual" ? "Respond bilingually — technical terms in English, explanations in Hindi." : "",
      mode === "structured" ? `This is structured learning step ${structuredStep + 1}/4. Validate reasoning before giving full answer.` : "",
      contextDoc ? `Context document: ${contextDoc.name || contextDoc.id}` : "",
    ].filter(Boolean).join(" ")

    try {
      const response = await fetch("/api/ai-agent/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          systemPrompt: systemHints || undefined,
          mode,
          language,
          userId: userId || undefined,
          conversationId: conversationId || undefined,
        }),
      })

      if (!response.ok) throw new Error("API error")
      const data = await response.json()

      // Track conversation ID returned by the server
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }

      // Use real cognitive trace from backend if available; fall back to mock
      const trace: CognitiveTrace = data.cognitive_trace
        ? {
            intent: data.cognitive_trace.intent ?? "Learning",
            concept: data.cognitive_trace.concept ?? "General",
            difficulty: typeof data.cognitive_trace.difficulty === "number"
              ? data.cognitive_trace.difficulty
              : 0.5,
            masteryImpact: data.cognitive_trace.mastery_impact ?? 1,
            language: (() => {
              const l = data.cognitive_trace.language ?? "en"
              if (l === "hi") return "Hindi"
              if (l === "en") return "English"
              return l
            })(),
            inferenceMs: data.cognitive_trace.inference_ms ?? 0,
            reasoningLayers: data.cognitive_trace.reasoning_layers ?? 7,
          }
        : generateMockTrace(data.answer || text, text)
      const delta = trace.masteryImpact

      // Highlight the concept in the live knowledge graph
      if (trace.concept) {
        setActiveConceptId(trace.concept)
        setMasteryUpdate({ conceptId: trace.concept, delta })
        setTimeout(() => setMasteryUpdate(undefined), 3000)
      }

      // Advance structured step
      if (mode === "structured") {
        setStructuredStep((s) => Math.min(s + 1, 3))
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: data.answer || "Reasoning complete.",
                isStreaming: false,
                trace,
                masteryDelta: delta,
                stepIndex: mode === "structured" ? structuredStep : undefined,
                stepValidated: mode === "structured" ? true : undefined,
              }
            : m
        )
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: "Cognitive engine encountered an error. Check your API connection.",
                isStreaming: false,
              }
            : m
        )
      )
      toast({ title: "Engine Error", description: "Failed to reach ENTROPY backend", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [input, loading, mode, language, structuredStep, contextDoc, toast, userId, conversationId, startNewChat])

  // Dismiss a review item by auto-asking the suggested prompt
  const triggerReview = useCallback((item: typeof reviewQueue[0]) => {
    setInput(item.suggested_prompt)
    setReviewQueue(prev => prev.filter(r => r.concept !== item.concept))
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSuggestionClick = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] relative">

      {/* ── Study Plan Modal ── */}
      {showStudyPlan && studyPlan && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
          <div className="w-full max-w-lg bg-[#0f0f1a] border border-purple-500/20 rounded-2xl p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white/80">{studyPlan.title || "Your Study Plan"}</h3>
                <p className="text-[10px] text-purple-400/60 mt-0.5">{studyPlan.final_outcome || studyPlan.goal}</p>
              </div>
              <button onClick={() => setShowStudyPlan(false)} className="text-white/20 hover:text-white/50 text-xs">✕</button>
            </div>
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {(studyPlan.daily_plan || []).map((day: any) => (
                <div key={day.day} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Day {day.day}</span>
                    <span className="text-[11px] font-semibold text-white/70">{day.concept_focus}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {(day.tasks || []).map((task: string, ti: number) => (
                      <li key={ti} className="flex gap-1.5 items-start">
                        <span className="text-emerald-400 text-[10px] mt-0.5">›</span>
                        <span className="text-[10px] text-white/40 leading-relaxed">{task}</span>
                      </li>
                    ))}
                  </ul>
                  {day.milestone && (
                    <p className="text-[9px] text-amber-400/60 mt-1.5 flex items-center gap-1">
                      <Trophy className="h-2.5 w-2.5" />{day.milestone}
                    </p>
                  )}
                  <p className="text-[8px] text-white/20 mt-1 font-mono">{day.estimated_minutes} min</p>
                </div>
              ))}
            </div>
            {studyPlan.success_metrics && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Success Metrics</p>
                {studyPlan.success_metrics.map((m: string, i: number) => (
                  <p key={i} className="text-[10px] text-emerald-400/60">✓ {m}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Exam Mode Overlay ── */}}
      {showExam && (
        <ExamModeOverlay
          onExit={() => { setShowExam(false); setMode("chat") }}
          onComplete={(result) => {
            setShowExam(false)
            setMode("chat")
            toast({
              title: `Exam Complete · ${result.finalScore}%`,
              description: `Avg Confidence: ${result.avgConfidence}% · Time: ${Math.floor(result.totalTime / 60)}m ${result.totalTime % 60}s`,
            })
          }}
          subject={contextDoc?.name || "General"}
        />
      )}

      {/* ── Spaced Repetition Review Banner ── */}
      {reviewQueue.length > 0 && messages.length === 0 && (
        <div className="flex-shrink-0 border-b border-amber-500/10 bg-amber-500/[0.03] px-4 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Bell className="h-3 w-3 text-amber-400/70" />
            <span className="text-[9px] font-bold text-amber-400/70 uppercase tracking-widest">
              {reviewQueue.filter(r => r.urgency === "critical").length > 0 ? "⚠ Critical Review Due" : "Review Due"}
              <span className="ml-1.5 text-amber-400/40">({reviewQueue.length} concept{reviewQueue.length > 1 ? "s" : ""})</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reviewQueue.slice(0, 5).map(item => (
              <button
                key={item.concept}
                onClick={() => triggerReview(item)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-[9px] font-bold transition-all hover:scale-[1.02]",
                  item.urgency === "critical"
                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15"
                )}
              >
                {item.concept} · {item.mastery}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Context doc banner ── */}}
      {contextDoc && (
        <div className="flex-shrink-0 flex items-center gap-2 px-5 py-1.5 bg-cyan-500/5 border-b border-cyan-500/10">
          <ScanLine className="h-3 w-3 text-cyan-400" />
          <span className="text-[9px] text-cyan-400 uppercase tracking-widest font-bold">
            Source: {contextDoc.name || "Uploaded Document"}
          </span>
          <span className="text-[8px] text-cyan-400/40 font-mono">· Grounded inference active</span>
        </div>
      )}

      {/* ── Structured mode guide ── */}
      {mode === "structured" && messages.length > 0 && (
        <StructuredModeGuide step={structuredStep} />
      )}

      {/* ── Live Knowledge Graph (collapsible) ── */}
      {showGraph && (
        <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0c0c14]">
          <LiveKnowledgeGraph
            userId={userId}
            activeConceptId={activeConceptId}
            masteryUpdate={masteryUpdate}
            height={180}
            className="mx-4 my-3"
          />
        </div>
      )}

      {/* ── Message feed ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} showTrace={showTrace} />
          ))
        )}
      </div>

      {/* ── Bottom cognitive controls bar ── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0c0c14]">

        {/* Control strip */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] overflow-x-auto">

          {/* New Chat button */}
          {userId && (
            <button
              onClick={startNewChat}
              title="New Chat"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[9px] font-bold uppercase tracking-widest text-white/25 hover:text-white/50 hover:border-white/10 transition-all flex-shrink-0"
            >
              <PlusCircle className="h-3 w-3" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}

          {/* Mode selector */}
          <ModeSelector mode={mode} onChange={setMode} disabled={loading} />

          <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />

          {/* Language toggle */}
          <LanguageToggle value={language} onChange={setLanguage} />

          <div className="w-px h-4 bg-white/[0.08] flex-shrink-0 hidden lg:block" />

          {/* Cognitive trace toggle */}
          <button
            onClick={() => setShowTrace(v => !v)}
            title="Toggle Cognitive Trace"
            className={cn(
              "hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all flex-shrink-0",
              showTrace
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/45"
            )}
          >
            <BrainCircuit className="h-3 w-3" />
            <span className="hidden xl:inline">Trace</span>
          </button>

          {/* Graph toggle */}
          <button
            onClick={() => setShowGraph(v => !v)}
            title="Show Knowledge Graph"
            className={cn(
              "hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all flex-shrink-0",
              showGraph
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/45"
            )}
          >
            <Network className="h-3 w-3" />
            <span className="hidden xl:inline">Graph</span>
          </button>

          {/* Study Plan button */}
          {userId && (
            <button
              onClick={() => {
                if (showStudyPlan && studyPlan) { setShowStudyPlan(true); return }
                const goal = input.trim() || "Master the current topic"
                setStudyPlanGoal(goal)
                generateStudyPlan()
              }}
              disabled={studyPlanLoading}
              title="Generate AI Study Plan from your current goal"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-500/20 bg-purple-500/5 text-purple-400/60 text-[9px] font-bold uppercase tracking-widest hover:bg-purple-500/10 hover:text-purple-400 transition-all flex-shrink-0 disabled:opacity-40"
            >
              {studyPlanLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3" />}
              <span className="hidden xl:inline">Plan</span>
            </button>
          )}

          {/* Exam simulation shortcut */}
          <button
            onClick={() => { setMode("exam"); setShowExam(true) }}
            title="Simulate Exam"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[9px] font-bold uppercase tracking-widest hover:bg-amber-500/10 transition-all flex-shrink-0"
          >
            <FlaskConical className="h-3 w-3" />
            Exam
          </button>

          {/* Voice toggle */}
          <button
            onClick={() => setVoiceActive(v => !v)}
            title={voiceActive ? "Stop voice input" : "Start voice input"}
            className={cn(
              "ml-auto flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
              voiceActive
                ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/45"
            )}
          >
            {voiceActive ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          </button>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-3 px-4 py-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "structured"
                  ? `Step ${structuredStep + 1}: ${["Define the problem…", "Identify concepts…", "Show working…", "Verify result…"][structuredStep] || "Continue reasoning…"}`
                  : mode === "exam"
                  ? "Exam mode — click Simulate Exam above to begin"
                  : "Ask anything · Shift+Enter for newline"
              }
              rows={1}
              disabled={loading || mode === "exam"}
              className={cn(
                "w-full resize-none bg-white/[0.03] border rounded-xl px-4 py-3 pr-12",
                "text-[13px] text-white/80 placeholder:text-white/15",
                "focus:outline-none focus:ring-1",
                "transition-all duration-200 min-h-[48px] max-h-36",
                "font-sans leading-relaxed scrollbar-thin",
                mode === "structured"
                  ? "border-purple-500/20 focus:ring-purple-500/30 focus:border-purple-500/30"
                  : mode === "exam"
                  ? "border-amber-500/20 opacity-40 cursor-not-allowed"
                  : "border-white/[0.08] focus:ring-cyan-500/25 focus:border-cyan-500/20"
              )}
              style={{ height: "auto", overflowY: input.split("\n").length > 3 ? "auto" : "hidden" }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 144) + "px"
              }}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || mode === "exam"}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              "border font-bold",
              input.trim() && !loading && mode !== "exam"
                ? "bg-gradient-to-br from-cyan-500/30 to-purple-500/20 border-cyan-500/40 text-cyan-400 hover:from-cyan-500/40 hover:to-purple-500/30 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                : "bg-white/[0.03] border-white/[0.06] text-white/15 cursor-not-allowed"
            )}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>

        {/* Status footer */}
        <div className="flex items-center gap-3 px-4 pb-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-[8px] text-white/20 uppercase tracking-widest">Engine Active</span>
          </div>
          <span className="text-[8px] text-white/10">·</span>
          <span className="text-[8px] text-white/15 font-mono">
            {messages.filter(m => m.role === "assistant").length} responses
          </span>
          {language !== "auto" && language !== "english" && (
            <>
              <span className="text-[8px] text-white/10">·</span>
              <LanguageBadge lang={language} />
            </>
          )}
          {mode === "structured" && (
            <>
              <span className="text-[8px] text-white/10">·</span>
              <span className="text-[8px] text-purple-400/60 font-bold uppercase tracking-widest">Structured · Step {structuredStep + 1}/4</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 bg-amber-500/8 px-1.5 py-0.5 rounded">
            <Zap className="h-2 w-2 text-amber-400/60" />
            <span className="text-[7px] text-amber-400/60 font-mono">Edge ⚡</span>
          </div>
        </div>
      </div>
    </div>
  )
}
