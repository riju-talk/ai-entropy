"use client"

import { QAStreamError, streamQA, type ToolEvent } from "@/lib/stream-qa"
import { AgentTimeline, VerificationBadge, applyStage, applyTool, type TimelineStep } from "./agent-timeline"
import React, { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Send, Loader2, User, BrainCircuit, Globe, Zap, Network,
  FlaskConical, ChevronDown, CheckCircle2, Layers, MessageSquare, Trophy,
  Atom, ScanLine, Mic, MicOff, PlusCircle, BookOpen, CalendarDays, Bell,
  X, Link2, Tag, AlignLeft, ExternalLink, Square, RotateCcw,
} from "lucide-react"
import dynamic from "next/dynamic"
import type ReactMarkdownPreview from "@uiw/react-markdown-preview"
import { ModeSelector, type LearningMode } from "./mode-selector"
import { CognitiveTraceCard, type CognitiveTrace } from "./cognitive-trace-card"
import { ExamModeOverlay } from "./exam-mode-overlay"

// Markdown renderer — loaded client-side only (SSR disabled)
const MDPreview = dynamic<React.ComponentProps<typeof ReactMarkdownPreview>>(
  () => import("@uiw/react-markdown-preview"),
  { ssr: false }
)

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
  steps?: TimelineStep[]      // live activity timeline (server-supplied, student-safe summaries)
  tools?: ToolEvent[]
  continuations?: number
  totalMs?: number
  verification?: { verdict: string; supportedRatio: number | null; note: string }
  truncated?: boolean         // the model hit its length limit even after automatic continuation
  incomplete?: boolean        // the connection dropped before the answer finished
  stopped?: boolean           // the student pressed Stop
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

/** Map UI language selection to ISO-639 codes for the Python backend */
function toLangCode(lang: Language): string {
  if (lang === "hindi") return "hi"
  if (lang === "bilingual") return "bilingual"
  // AUTO and ENGLISH both request an English response.
  // The backend will still understand Hindi questions by auto-detecting and translating the input.
  return "en"
}

/** Strip Unicode emoji characters from AI responses */
function stripEmojis(text: string): string {
  return text
    // Extended_Pictographic covers all emoji; also strip ZWJ, variation selectors, and flag sequences
    .replace(/\p{Extended_Pictographic}(\u{FE0F}|\u{20E3})?(\u{200D}\p{Extended_Pictographic}(\u{FE0F}|\u{20E3})?)*[\u{1F1E0}-\u{1F1FF}]*/gu, "")
    .trim()
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
          className="w-1 h-1 rounded-full bg-primary animate-[bounce_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MasteryPill({ delta }: { delta: number }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-[8px] font-bold text-success mt-1">
      <Atom className="h-2.5 w-2.5" />
      Mastery +{delta}%
    </div>
  )
}

function LanguageBadge({ lang }: { lang: Language }) {
  if (lang === "auto" || lang === "english") return null
  const map = {
    hindi: { label: "🌍 Hindi Mode Active", cls: "bg-warning/10 border-warning/20 text-warning" },
    bilingual: { label: "🌍 Bilingual Technical Mode", cls: "bg-primary/10 border-primary/20 text-primary" },
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
        ? "bg-success/10 border-success/20 text-success"
        : "bg-card border-border text-muted-foreground"
    )}>
      {validated ? <CheckCircle2 className="h-2.5 w-2.5" /> : <ScanLine className="h-2.5 w-2.5" />}
      Step {index + 1} {validated ? "· Validated" : "· Pending validation"}
    </div>
  )
}

function MessageBubble({ msg, showTrace, selectedLanguage, onContinue }: { msg: Message; showTrace: boolean; selectedLanguage: Language; onContinue?: () => void }) {
  const isUser = msg.role === "user"
  const detectedLang = detectLanguage(msg.content)

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 items-start group">
        <div className="max-w-[72%] space-y-1">
          <div className="rounded rounded-tr-sm border border-primary/15 px-4 py-2.5">
            <p className="text-[13px] text-foreground leading-relaxed">{msg.content}</p>
          </div>
          <p className="text-[8px] text-muted-foreground text-right font-mono">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 items-start group">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <BrainCircuit className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="max-w-[80%] space-y-1 flex-1 min-w-0">
        {msg.stepIndex !== undefined && (
          <StepBadge index={msg.stepIndex} validated={msg.stepValidated} />
        )}
        {(msg.steps?.length || msg.tools?.length) ? (
          <AgentTimeline steps={msg.steps ?? []} tools={msg.tools ?? []} live={!!msg.isStreaming} totalMs={msg.totalMs} continuations={msg.continuations} />
        ) : null}
        <div className={cn(
          "rounded rounded-tl-sm border px-4 py-3",
          "border-border",
          "transition-all duration-300",
          msg.isStreaming && "border-primary/20"
        )}>
          {msg.isStreaming && !msg.content ? (
            <TypingDots />
          ) : (
            <div className={cn(
              "ai-markdown-response",
              detectedLang === "hindi" && "hindi-response"
            )}>
              <MDPreview
                source={stripEmojis(msg.content)}
                wrapperElement={{ "data-color-mode": "dark" } as any}
                style={{ backgroundColor: "transparent" }}
                components={{
                  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                  ),
                }}
              />
            </div>
          )}
        </div>

        {!msg.isStreaming && msg.verification && (
          <VerificationBadge verdict={msg.verification.verdict} supportedRatio={msg.verification.supportedRatio} note={msg.verification.note} />
        )}
        {(msg.truncated || msg.incomplete || msg.stopped) && !msg.isStreaming && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded border border-warning/30 bg-warning/5 px-3 py-1.5 text-[11px] text-foreground">
            <span>
              {msg.stopped
                ? "You stopped this answer. What you see is everything written so far."
                : msg.incomplete
                  ? "The connection dropped before this answer finished, so it may be incomplete."
                  : "This answer reached the length limit and may be incomplete."}
            </span>
            {onContinue && (msg.truncated || msg.incomplete || msg.stopped) && (
              <button type="button" onClick={onContinue} className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-0.5 text-primary hover:bg-primary/10">
                <RotateCcw className="h-3 w-3" /> Continue
              </button>
            )}
          </div>
        )}

        <div className="flex items-center flex-wrap gap-2 pt-0.5">
          <p className="text-[8px] text-muted-foreground font-mono">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {selectedLanguage === "hindi" && <LanguageBadge lang="hindi" />}
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
    <div className="flex items-start gap-2 px-4 py-2.5 bg-primary/5 border-b border-primary/10">
      <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary mb-0.5">Structured Mode — Step {step + 1}/4</p>
        <p className="text-[11px] text-muted-foreground">{steps[Math.min(step, steps.length - 1)]}</p>
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
        <div className="w-16 h-16 rounded border border-primary/15 flex items-center justify-center">
          <BrainCircuit className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success/20 border border-success/40 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1.5 max-w-md">
        <h2 className="text-base font-bold text-foreground tracking-tight">ENTROPY Cognitive Engine</h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          7-Layer structured reasoning · Edge-accelerated inference · Multilingual explainability
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {prompts.map((p) => (
          <button
            key={p}
            className="text-left px-3 py-2.5 rounded bg-card border border-border hover:bg-accent hover:border-border transition-all group"
          >
            <p className="text-[10px] text-muted-foreground group-hover:text-muted-foreground transition-colors leading-relaxed">{p}</p>
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
    <div className="flex items-center gap-0.5 p-0.5 rounded bg-card border border-border">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
            value === o.id
              ? "bg-warning/20 border border-warning/30 text-warning"
              : "text-muted-foreground hover:text-muted-foreground"
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
  const [showTracePanel, setShowTracePanel] = useState(false)
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
  const abortRef = useRef<AbortController | null>(null)
  const inFlight = useRef(false) // synchronous guard: two rapid sends can never start two answers
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

  const stopStreaming = useCallback(() => abortRef.current?.abort(), [])

  const sendMessage = useCallback(async (override?: string) => {
    const text = (typeof override === "string" ? override : input).trim()
    if (!text || loading || inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller

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
    // Compute the language to use for THIS request without permanently changing the selector.
    // "auto" resolves to the detected language; explicit selections are honoured as-is.
    const effectiveLang: Language = language === "auto"
      ? (detectedLang === "hindi" ? "hindi" : "english")
      : language

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
      "Do not use any emojis in your response. Write with clear, professional academic text only.",
      effectiveLang === "hindi" ? "Respond in Hindi (Devanagari script)." : "",
      effectiveLang === "english" ? "Respond in English only, regardless of any previous messages." : "",
      effectiveLang === "bilingual" ? "Respond bilingually — explain concepts in Hindi, write code/formulas in English." : "",
      mode === "structured" ? `This is structured learning step ${structuredStep + 1}/4. Validate reasoning before giving full answer.` : "",
      contextDoc ? `Context document: ${contextDoc.name || contextDoc.id}` : "",
    ].filter(Boolean).join(" ")

    let pending = ""
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const flushTokens = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = null
      if (!pending) return
      const chunk = pending
      pending = ""
      setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, content: m.content + chunk } : m)))
    }
    const startedAt = Date.now()

    try {
      // Stream the answer: tokens appear as they are generated; the final event carries the full result
      const data = await streamQA(
        {
          question: text,
          systemPrompt: systemHints || undefined,
          mode,
          language: toLangCode(effectiveLang),
          conversationId: conversationId || undefined,
        },
        {
          signal: controller.signal,
          // Tokens arrive far faster than the Markdown renderer can repaint: batch them into one update per ~60 ms.
          token: (t) => {
            pending += t
            if (!flushTimer) {
              flushTimer = setTimeout(flushTokens, 60)
            }
          },
          stage: (e) => setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, steps: applyStage(m.steps ?? [], e) } : m))),
          tool: (e) => setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, tools: applyTool(m.tools ?? [], e) } : m))),
          continuation: (n) => setMessages((prev) => prev.map((m) => (m.id === placeholderId ? { ...m, continuations: n } : m))),
        }
      )
      flushTokens()

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
            // Algorithmic metrics
            cognitiveLoad: data.cognitive_trace.cognitive_load,
            volatility: data.cognitive_trace.volatility,
            examReadiness: data.cognitive_trace.exam_readiness,
            // Normalised sources for citation panel
            sources: (data.cognitive_trace.sources ?? []).map((s: any, i: number) => ({
              index: s.index ?? i + 1,
              title: s.title ?? s.metadata?.source ?? `Source ${i + 1}`,
              url: s.url ?? s.metadata?.url ?? s.metadata?.source ?? "",
              snippet: s.snippet ?? s.content ?? "",
              type: (s.type === "web" ? "web" : "document") as "web" | "document",
            })),
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
                totalMs: Date.now() - startedAt,
                truncated: !!data.completion?.truncated,
                verification: data.nli?.verdict
                  ? { verdict: data.nli.verdict, supportedRatio: data.nli.supported_ratio ?? null, note: data.answer_note || data.nli.qualification || "" }
                  : undefined,
                masteryDelta: delta,
                stepIndex: mode === "structured" ? structuredStep : undefined,
                stepValidated: mode === "structured" ? true : undefined,
              }
            : m
        )
      )

      // Notify Cognitive Studio panels to refresh mastery data in real time
      window.dispatchEvent(new CustomEvent("mastery-updated"))
    } catch (err) {
      flushTokens()
      const e = err instanceof QAStreamError ? err : null
      const code = e?.code
      // Keep whatever the student already read; only replace the bubble when nothing arrived.
      const kept = (e?.partial ?? "").trim()
      const fallback =
        code === "rate_limited"
          ? `${e?.message}${e?.retryAfter ? ` (try again in about ${e.retryAfter}s)` : ""}`
          : e?.message || "The AI tutor ran into a problem. Please try again."
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: m.content.trim() ? m.content : kept || fallback,
                isStreaming: false,
                stopped: code === "aborted" && !!(m.content.trim() || kept),
                incomplete: (code === "interrupted" || code === "incomplete") && !!(m.content.trim() || kept),
                totalMs: Date.now() - startedAt,
              }
            : m
        )
      )
      if (code !== "aborted") {
        toast({
          title: code === "rate_limited" ? "Slow down a little" : "AI tutor unavailable",
          description: e?.message || "Could not reach the AI service.",
          variant: "destructive",
        })
      }
    } finally {
      if (flushTimer) clearTimeout(flushTimer)
      abortRef.current = null
      inFlight.current = false
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
    <div className="flex flex-col h-full bg-background relative">

      {/* ── Study Plan Modal ── */}
      {showStudyPlan && studyPlan && (
        <div className="absolute inset-0 z-50 bg-background flex items-start justify-center overflow-y-auto p-4">
          <div className="w-full max-w-lg bg-background border border-primary/20 rounded p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">{studyPlan.title || "Your Study Plan"}</h3>
                <p className="text-[10px] text-primary/60 mt-0.5">{studyPlan.final_outcome || studyPlan.goal}</p>
              </div>
              <button onClick={() => setShowStudyPlan(false)} className="text-muted-foreground hover:text-muted-foreground text-xs">✕</button>
            </div>
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {(studyPlan.daily_plan || []).map((day: any) => (
                <div key={day.day} className="rounded border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Day {day.day}</span>
                    <span className="text-[11px] font-semibold text-foreground">{day.concept_focus}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {(day.tasks || []).map((task: string, ti: number) => (
                      <li key={ti} className="flex gap-1.5 items-start">
                        <span className="text-success text-[10px] mt-0.5">›</span>
                        <span className="text-[10px] text-muted-foreground leading-relaxed">{task}</span>
                      </li>
                    ))}
                  </ul>
                  {day.milestone && (
                    <p className="text-[9px] text-warning/60 mt-1.5 flex items-center gap-1">
                      <Trophy className="h-2.5 w-2.5" />{day.milestone}
                    </p>
                  )}
                  <p className="text-[8px] text-muted-foreground mt-1 font-mono">{day.estimated_minutes} min</p>
                </div>
              ))}
            </div>
            {studyPlan.success_metrics && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Success Metrics</p>
                {studyPlan.success_metrics.map((m: string, i: number) => (
                  <p key={i} className="text-[10px] text-success/60">✓ {m}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Exam Mode Overlay ── */}
      {showExam && (
        <ExamModeOverlay
          onExit={() => { setShowExam(false); setMode("chat") }}
          onComplete={(result) => {
            setShowExam(false)
            setMode("chat")
            // Dispatch event so sidebar cognitive panel refreshes immediately
            window.dispatchEvent(new CustomEvent("mastery-updated"))
            toast({
              title: `Exam Complete · ${result.finalScore}%`,
              description: `${result.questions.filter((q: any) => q.userAnswer === q.correctAnswer).length}/${result.questions.length} correct · Time: ${Math.floor(result.totalTime / 60)}m ${result.totalTime % 60}s`,
            })
          }}
          subject={contextDoc?.name || "General"}
        />
      )}

      {/* ── Spaced Repetition Review Banner ── */}
      {reviewQueue.length > 0 && messages.length === 0 && (
        <div className="flex-shrink-0 border-b border-warning/10 bg-warning/[0.03] px-4 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Bell className="h-3 w-3 text-warning/70" />
            <span className="text-[9px] font-bold text-warning/70 uppercase tracking-widest">
              {reviewQueue.filter(r => r.urgency === "critical").length > 0 ? "⚠ Critical Review Due" : "Review Due"}
              <span className="ml-1.5 text-warning/40">({reviewQueue.length} concept{reviewQueue.length > 1 ? "s" : ""})</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reviewQueue.slice(0, 5).map(item => (
              <button
                key={item.concept}
                onClick={() => triggerReview(item)}
                className={cn(
                  "px-2.5 py-1 rounded border text-[9px] font-bold transition-all hover:scale-[1.02]",
                  item.urgency === "critical"
                    ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/15"
                    : "bg-warning/10 border-warning/20 text-warning hover:bg-warning/15"
                )}
              >
                {item.concept} · {item.mastery}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Context doc banner ── */}
      {contextDoc && (
        <div className="flex-shrink-0 flex items-center gap-2 px-5 py-1.5 bg-primary/5 border-b border-primary/10">
          <ScanLine className="h-3 w-3 text-primary" />
          <span className="text-[9px] text-primary uppercase tracking-widest font-bold">
            Source: {contextDoc.name || "Uploaded Document"}
          </span>
          <span className="text-[8px] text-primary/40 font-mono">· Grounded inference active</span>
        </div>
      )}

      {/* ── Structured mode guide ── */}
      {mode === "structured" && messages.length > 0 && (
        <StructuredModeGuide step={structuredStep} />
      )}

      {/* ── Chat Concept Graph (collapsible) ── */}
      {showGraph && (
        <div className="flex-shrink-0 border-b border-border bg-background">
          <ChatConceptGraph messages={messages} className="mx-4 my-3" />
        </div>
      )}

      {/* ── Trace Panel overlay ── */}
      {showTracePanel && (
        <TracePanel messages={messages} contextDoc={contextDoc} onClose={() => setShowTracePanel(false)} />
      )}

      {/* ── Message feed ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              showTrace={showTrace}
              selectedLanguage={language}
              onContinue={msg.id === messages[messages.length - 1]?.id && !loading ? () => sendMessage("Please continue your previous answer from exactly where it stopped. Do not repeat what you already wrote.") : undefined}
            />
          ))
        )}
      </div>

      {/* ── Bottom cognitive controls bar ── */}
      <div className="flex-shrink-0 border-t border-border bg-background">

        {/* Control strip */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">

          {/* New Chat button — under progress */}
          {userId && (
            <button
              onClick={() => toast({ title: "New Chat", description: "New session management is still under progress — coming soon." })}
              title="New Chat"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-muted-foreground hover:border-border transition-all flex-shrink-0"
            >
              <PlusCircle className="h-3 w-3" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}

          {/* Mode selector */}
          <ModeSelector mode={mode} onChange={setMode} disabled={loading} />

          <div className="w-px h-4 bg-accent flex-shrink-0" />

          {/* Language toggle */}
          <LanguageToggle value={language} onChange={setLanguage} />

          <div className="w-px h-4 bg-accent flex-shrink-0 hidden lg:block" />

          {/* Trace panel button — shows all references of the current chat */}
          <button
            onClick={() => setShowTracePanel(v => !v)}
            title="Show all references and reasoning traces for this chat"
            className={cn(
              "hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest transition-all flex-shrink-0",
              showTracePanel
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-muted-foreground"
            )}
          >
            <BrainCircuit className="h-3 w-3" />
            <span className="hidden xl:inline">Trace</span>
          </button>

          {/* Graph toggle — concept graph of current chat */}
          <button
            onClick={() => setShowGraph(v => !v)}
            title="Show concept graph of this conversation"
            className={cn(
              "hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest transition-all flex-shrink-0",
              showGraph
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-muted-foreground"
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
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary/20 bg-primary/5 text-primary/60 text-[9px] font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all flex-shrink-0 disabled:opacity-40"
            >
              {studyPlanLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3" />}
              <span className="hidden xl:inline">Plan</span>
            </button>
          )}

          {/* Exam simulation — opens setup+exam flow */}
          <button
            onClick={() => { setMode("exam"); setShowExam(true) }}
            title="Simulate Exam"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded border border-warning/20 bg-warning/5 text-warning text-[9px] font-bold uppercase tracking-widest hover:bg-warning/10 transition-all flex-shrink-0"
          >
            <FlaskConical className="h-3 w-3" />
            Exam
          </button>

          {/* Voice toggle */}
          <button
            onClick={() => setVoiceActive(v => !v)}
            title={voiceActive ? "Stop voice input" : "Start voice input"}
            className={cn(
              "ml-auto flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest transition-all",
              voiceActive
                ? "bg-destructive/10 border-destructive/30 text-destructive animate-pulse"
                : "bg-card border-border text-muted-foreground hover:text-muted-foreground"
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
                "w-full resize-none bg-card border rounded px-4 py-3 pr-12",
                "text-[13px] text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1",
                "transition-all duration-200 min-h-[48px] max-h-36",
                "font-sans leading-relaxed scrollbar-thin",
                mode === "structured"
                  ? "border-primary/20 focus:ring-primary/30 focus:border-primary/30"
                  : mode === "exam"
                  ? "border-warning/20 opacity-40 cursor-not-allowed"
                  : "border-border focus:ring-primary/25 focus:border-primary/20"
              )}
              style={{ height: "auto", overflowY: input.split("\n").length > 3 ? "auto" : "hidden" }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 144) + "px"
              }}
            />
          </div>

          {loading && (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Stop generating"
              title="Stop generating"
              className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center border border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          )}
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || mode === "exam"}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded flex items-center justify-center transition-all",
              "border font-bold",
              input.trim() && !loading && mode !== "exam"
                ? "border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground cursor-not-allowed"
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
            <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
            <span className="text-[8px] text-muted-foreground uppercase tracking-widest">Engine Active</span>
          </div>
          <span className="text-[8px] text-muted-foreground">·</span>
          <span className="text-[8px] text-muted-foreground font-mono">
            {messages.filter(m => m.role === "assistant").length} responses
          </span>
          {language !== "auto" && language !== "english" && (
            <>
              <span className="text-[8px] text-muted-foreground">·</span>
              <LanguageBadge lang={language} />
            </>
          )}
          {mode === "structured" && (
            <>
              <span className="text-[8px] text-muted-foreground">·</span>
              <span className="text-[8px] text-primary/60 font-bold uppercase tracking-widest">Structured · Step {structuredStep + 1}/4</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 bg-warning/8 px-1.5 py-0.5 rounded">
            <Zap className="h-2 w-2 text-warning/60" />
            <span className="text-[7px] text-warning/60 font-mono">Edge ⚡</span>
          </div>
        </div>
      </div>
    </div>
  )
}
// ─── TracePanel — all references & reasoning traces from current chat ─────────

function TracePanel({ messages, contextDoc, onClose }: { messages: Message[]; contextDoc?: any; onClose: () => void }) {
  const assistantMsgs = messages.filter(m => m.role === "assistant" && !m.isStreaming && m.content)

  // Aggregate unique concepts with frequency
  const conceptMap = new Map<string, { count: number; totalImpact: number; intents: string[] }>()
  assistantMsgs.forEach(m => {
    if (!m.trace) return
    const key = m.trace.concept
    const existing = conceptMap.get(key) || { count: 0, totalImpact: 0, intents: [] }
    existing.count += 1
    existing.totalImpact += m.trace.masteryImpact
    if (m.trace.intent && !existing.intents.includes(m.trace.intent)) existing.intents.push(m.trace.intent)
    conceptMap.set(key, existing)
  })
  const concepts = Array.from(conceptMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)

  const intents = Array.from(new Set(assistantMsgs.map(m => m.trace?.intent).filter(Boolean)))
  const avgMs = assistantMsgs.filter(m => m.trace).length
    ? Math.round(assistantMsgs.filter(m => m.trace).reduce((s, m) => s + (m.trace?.inferenceMs ?? 0), 0) / assistantMsgs.filter(m => m.trace).length)
    : 0

  // Collect sources: first from trace metadata, then parse ## Sources from markdown content
  const sourceMap = new Map<string, { index: number; title: string; url: string; snippet: string; type: "web" | "document" }>()
  assistantMsgs.forEach(m => {
    // 1. Structured trace sources
    m.trace?.sources?.forEach(s => {
      const key = s.url || s.title
      if (key && !sourceMap.has(key)) sourceMap.set(key, s)
    })
    // 2. Parse ## Sources section out of markdown text as fallback
    const sourcesMatch = m.content.match(/##\s+Sources\s*\n([\s\S]*?)(?:\n##|$)/i)
    if (sourcesMatch) {
      const lines = sourcesMatch[1].split("\n").filter(l => l.trim())
      lines.forEach((line, i) => {
        const urlMatch = line.match(/https?:\/\/[^\s\)>]+/)
        if (!urlMatch) return
        const url = urlMatch[0]
        if (sourceMap.has(url)) return
        const title = line.replace(/^\d+\.\s*|\[.*?\]\s*|https?:\/\/[^\s\)>]+/g, "").trim() || url
        sourceMap.set(url, { index: sourceMap.size + 1, title: title || url, url, snippet: "", type: "web" })
      })
    }
  })
  const allSources = Array.from(sourceMap.values())

  return (
    <div className="absolute inset-0 z-40 bg-background/95 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-primary/15 bg-primary/[0.03] flex-shrink-0">
        <BrainCircuit className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Conversation References</span>
        <span className="text-[9px] text-muted-foreground font-mono ml-1">
          {assistantMsgs.length} reasoning traces · {concepts.length} concepts
        </span>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-muted-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Source doc */}
        {contextDoc && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3 w-3 text-primary/60" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Source Document</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded bg-primary/[0.04] border border-primary/15">
              <AlignLeft className="h-3.5 w-3.5 text-primary/50 shrink-0" />
              <span className="text-[11px] text-foreground truncate">{contextDoc.name || contextDoc.title || "Uploaded document"}</span>
              <span className="text-[8px] text-primary/40 font-mono ml-auto shrink-0">Grounded</span>
            </div>
          </section>
        )}

      {/* Sources from all traces */}
        {allSources.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-primary/60" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Sources</span>
              <span className="ml-auto text-[8px] text-muted-foreground">{allSources.length} references</span>
            </div>
            <div className="space-y-1.5">
              {allSources.map((src, i) => (
                <div key={i} className="rounded bg-card border border-border px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[7px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5">[{i + 1}]</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-semibold text-foreground truncate">{src.title}</p>
                        <span className={cn(
                          "flex-shrink-0 text-[6px] px-1 rounded font-bold uppercase",
                          src.type === "web" ? "text-primary bg-primary/10" : "text-primary bg-primary/10"
                        )}>{src.type === "web" ? "web" : "doc"}</span>
                      </div>
                      {src.snippet && <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-2">{src.snippet}</p>}
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-0.5 mt-1 text-[8px] text-primary/70 hover:text-primary transition-colors truncate">
                          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="truncate">{src.url}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Concepts referenced */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 text-primary/60" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Concepts Referenced</span>
            <span className="ml-auto text-[8px] text-muted-foreground">{concepts.length} unique</span>
          </div>
          {concepts.length === 0
            ? <p className="text-[9px] text-muted-foreground py-2">No concepts tracked yet — ask a question to start</p>
            : (
              <div className="space-y-1.5">
                {concepts.map(c => (
                  <div key={c.name} className="flex items-center gap-3 px-3 py-2 rounded bg-card border border-border hover:bg-accent transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-[11px] text-foreground flex-1 truncate">{c.name}</span>
                    <span className="text-[8px] text-primary/50 font-mono shrink-0">×{c.count}</span>
                    <span className="text-[8px] text-success/50 font-mono shrink-0">+{c.totalImpact}%</span>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* Reasoning intents */}
        {intents.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-warning/60" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-warning/60">Query Intents Detected</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {intents.map(intent => (
                <span key={intent} className="px-2.5 py-1 rounded-full bg-warning/[0.06] border border-warning/15 text-[9px] text-warning/70 font-mono">
                  {intent}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Per-message trace timeline */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlignLeft className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Reasoning Timeline</span>
            {avgMs > 0 && <span className="ml-auto text-[8px] text-muted-foreground font-mono">avg {avgMs}ms</span>}
          </div>
          {assistantMsgs.length === 0
            ? <p className="text-[9px] text-muted-foreground py-2">No responses yet — ask a question to see the reasoning timeline</p>
            : (
              <div className="space-y-1.5">
                {assistantMsgs.map((m, i) => (
                  <div key={m.id} className="flex gap-3 px-3 py-2.5 rounded bg-card border border-border">
                    <span className="text-[8px] text-muted-foreground font-mono w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold text-primary/70">{m.trace?.concept}</span>
                        <span className="text-[8px] text-muted-foreground">·</span>
                        <span className="text-[8px] text-muted-foreground">{m.trace?.intent}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {m.content.slice(0, 120)}{m.content.length > 120 ? "…" : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[8px] text-primary/50 font-mono">+{m.trace?.masteryImpact}%</span>
                      <span className="text-[7px] text-muted-foreground font-mono">{m.trace?.inferenceMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>
      </div>
    </div>
  )
}

// ─── ChatConceptGraph — concept graph built from current chat traces ──────────

function ChatConceptGraph({ messages, className }: { messages: Message[]; className?: string }) {
  // Extract concepts from all assistant traces
  const conceptFreq = new Map<string, number>()
  const pairs: [string, string][] = []
  const traceList = messages.filter(m => m.role === "assistant" && m.trace?.concept).map(m => m.trace!.concept)

  traceList.forEach((c, i) => {
    conceptFreq.set(c, (conceptFreq.get(c) || 0) + 1)
    if (i > 0 && traceList[i - 1] !== c) pairs.push([traceList[i - 1], c])
  })

  const nodes = Array.from(conceptFreq.entries()).map(([label, freq], idx) => ({ id: label, label, freq, idx }))
  const uniquePairs = Array.from(new Set(pairs.map(p => [p[0], p[1]].sort().join("|||")))).map(s => s.split("|||") as [string, string])

  if (nodes.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-28 gap-2", className)}>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10">
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          <span className="text-[7px] font-bold uppercase tracking-[0.18em] text-warning">Beta</span>
        </div>
        <p className="text-[9px] text-muted-foreground text-center">Start asking questions to build the concept graph</p>
      </div>
    )
  }

  // Circular layout
  const W = 500; const H = 140; const CX = W / 2; const CY = H / 2; const R = Math.min(CX, CY) * 0.72
  const nodePos = nodes.map((n, i) => {
    const angle = nodes.length === 1 ? 0 : (i / nodes.length) * Math.PI * 2 - Math.PI / 2
    const r = nodes.length === 1 ? 0 : R
    return { ...n, x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r }
  })
  const posMap = new Map(nodePos.map(n => [n.id, { x: n.x, y: n.y }]))
  const nodeColors = ["#22d3ee", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#fb923c", "#e879f9"]

  return (
    <div className={cn("rounded border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <Network className="h-3 w-3 text-primary/60" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Chat Concept Graph</span>
        <span className="ml-auto text-[8px] text-muted-foreground font-mono">{nodes.length} concepts · {uniquePairs.length} links</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
        {/* Edges */}
        {uniquePairs.map(([a, b], i) => {
          const pa = posMap.get(a); const pb = posMap.get(b)
          if (!pa || !pb) return null
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} />
        })}
        {/* Nodes */}
        {nodePos.map((n, i) => {
          const r = 4 + Math.min(n.freq * 2, 8)
          const color = nodeColors[i % nodeColors.length]
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r + 4} fill={color} fillOpacity={0.06} />
              <circle cx={n.x} cy={n.y} r={r} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
              <text
                x={n.x} y={n.y + r + 9}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize={8}
                fontFamily="monospace"
              >
                {n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}