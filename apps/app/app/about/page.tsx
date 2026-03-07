import Link from "next/link"
import type { Metadata } from "next"
import {
  ArrowRight,
  BrainCircuit,
  Database,
  Globe,
  Layers,
  Network,
  Terminal,
  Users,
  Zap,
  Cpu,
  Shield,
  BookOpen,
  Atom,
  AlertTriangle,
  Lightbulb,
  Search,
  CheckCircle,
  TrendingUp,
  FlaskConical,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About | ENTROPY",
  description:
    "Entropy — AI-powered adaptive learning platform. 8-layer agentic reasoning, evidence-weighted mastery, live citations via Tavily, Neo4j concept graph. Built by Team planet (optional).",
}

export default function AboutPage() {
  const pipeline = [
    { step: "01", label: "INTENT DETECTION", desc: "Classifies query — DOUBT / EVALUATION / REVISION / EXPLORATION / DEFINITION — routes to correct strategy", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
    { step: "02", label: "CONCEPT LOCK", desc: "Extracts primary concept from the student's question (never from retrieved context — prevents concept drift)", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
    { step: "03", label: "RAG RETRIEVAL", desc: "Pinecone semantic vector search across uploaded documents + course material, formatted as numbered citations", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
    { step: "04", label: "LIVE SEARCH", desc: "Tavily internet search always runs in parallel — adds real-world citations [1][2] to every answer", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
    { step: "05", label: "REASONING ENGINE", desc: "Claude 3 Sonnet (AWS Bedrock) builds the answer with locked concept, dual-source citations, nurturing tone", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
    { step: "06", label: "NLI FACT-CHECK", desc: "Natural Language Inference validates AI claims against retrieved evidence — flags low-confidence assertions", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { step: "07", label: "MASTERY UPDATE", desc: "Updates concept mastery with Bayesian prior + evidence weight (chat=0.2, quiz=0.8, exam=1.0) + time decay", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    { step: "08", label: "COGNITIVE TRACE", desc: "Returns reasoning chain, sources, cognitive load, volatility, exam readiness — fully auditable per response", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  ]

  const architectureLayers = [
    {
      tier: "LAYER 01  INTERFACE",
      items: ["Next.js 14 App Router", "shadcn/ui Components", "Tailwind CSS v3", "NextAuth.js (GitHub + Google)"],
      bar: "from-cyan-500 to-blue-500",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      tier: "LAYER 02  INTELLIGENCE",
      items: ["FastAPI + Python 3.12", "8-Stage Agentic RAG", "Amazon Bedrock (Claude 3 Sonnet)", "Tavily Live Internet Search", "Pinecone Vector DB"],
      bar: "from-purple-500 to-pink-500",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
    },
    {
      tier: "LAYER 03  KNOWLEDGE",
      items: ["Neo4j 5.20 Knowledge Graph", "PostgreSQL 16 + Prisma ORM", "Redis 7 Append-Only Cache", "APOC Extensions + Bolt Protocol"],
      bar: "from-amber-500 to-orange-500",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
    },
  ]

  const kgStats = [
    { label: "Concept Nodes", value: "12K+", unit: "active topics" },
    { label: "Semantic Edges", value: "48K+", unit: "relationships" },
    { label: "Subject Domains", value: "24", unit: "disciplines" },
    { label: "Avg. Path Depth", value: "4.2", unit: "hops / query" },
  ]

  const stack = [
    { label: "Frontend", value: "Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui", icon: Globe },
    { label: "Backend", value: "FastAPI · Python 3.12 · Uvicorn · Pydantic", icon: Terminal },
    { label: "AI / LLM", value: "Amazon Bedrock · Claude 3 Sonnet · Titan Embeddings V2", icon: BrainCircuit },
    { label: "Live Search", value: "Tavily Search API · always-active citations", icon: Search },
    { label: "Knowledge Graph", value: "Neo4j 5.20 · Bolt protocol · APOC extensions", icon: Network },
    { label: "Database", value: "PostgreSQL 16 · Prisma ORM · Pinecone vector DB", icon: Database },
    { label: "Cache / Queue", value: "Redis 7 · append-only persistence · rate limiting", icon: Zap },
    { label: "Infra / Deploy", value: "AWS Lambda · API Gateway · Bedrock · Docker · Vercel", icon: Cpu },
    { label: "Auth", value: "NextAuth.js · GitHub OAuth · Google OAuth", icon: Shield },
  ]

  const problems = [
    {
      icon: AlertTriangle,
      title: "AI chatbots give answers, not understanding",
      desc: "ChatGPT and similar tools generate confident-sounding text without knowing what you already understand or where your gaps are. You get a wall of text, not a learning path.",
      color: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
    },
    {
      icon: AlertTriangle,
      title: "Mastery tracking is just click-counting",
      desc: "Most edtech treats every correct answer equally. No decay over time, no differentiation between a chat answer and an exam result, no Bayesian reasoning about confidence.",
      color: "text-orange-400",
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
    },
    {
      icon: AlertTriangle,
      title: "No real citations — hallucinations go unchecked",
      desc: "AI responses cite nothing or fabricate sources. Students have no way to verify claims. Misinformation compounds in the learning loop.",
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
    },
    {
      icon: AlertTriangle,
      title: "Learning is isolated and ungamified correctly",
      desc: "Students learn in silos. Community Q&A systems lack AI integration. Gamification is trivially exploitable — spamming questions yields the same XP as genuine mastery.",
      color: "text-yellow-400",
      border: "border-yellow-500/20",
      bg: "bg-yellow-500/5",
    },
  ]

  const usps = [
    {
      icon: BrainCircuit,
      title: "8-Layer Agentic RAG, not a chatbot",
      desc: "Every query passes through Intent Detection → Concept Lock → Document RAG → Live Web Search → Claude Reasoning → NLI Fact-Check → Mastery Update → Cognitive Trace. No stage can be skipped.",
      accent: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      icon: TrendingUp,
      title: "Scientifically grounded mastery",
      desc: "Bayesian prior (1 correct out of a virtual 4 baseline) prevents instant 100%. Evidence weights: exam=1.0, quiz=0.8, chat=0.2. Exponential decay exp(−0.03×days) — 80% at 7 days, 40% at 30.",
      accent: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
    },
    {
      icon: Search,
      title: "Dual-source, always-cited answers",
      desc: "Every answer combines Pinecone document retrieval with live Tavily internet search. Sources are rendered as numbered inline citations [1][2] with title, URL, snippet, and web/doc type badge.",
      accent: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
    },
    {
      icon: Network,
      title: "Personal concept graph, built as you learn",
      desc: "Neo4j maps your exact questions to concept nodes and semantic edges. The live knowledge graph shows which topics you've touched, their mastery scores, and prerequisite chains in real time.",
      accent: "text-violet-400",
      border: "border-violet-500/20",
      bg: "bg-violet-500/5",
    },
    {
      icon: CheckCircle,
      title: "NLI fact-checking on every AI response",
      desc: "Natural Language Inference validates each generated claim against retrieved evidence. Low-confidence assertions are flagged in the Cognitive Trace before the student ever reads them.",
      accent: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
    },
    {
      icon: Shield,
      title: "Non-exploitable gamification",
      desc: "XP is trust-weighted and evidence-typed. Spam-chatting yields 0.2× reward. Achievements require real criteria met across actual database records — no client-side reward manipulation possible.",
      accent: "text-pink-400",
      border: "border-pink-500/20",
      bg: "bg-pink-500/5",
    },
  ]

  const systems = [
    {
      label: "Agentic RAG (8-Layer Pipeline)",
      desc: "Not retrieval-augmented generation — agentic RAG. The agent orchestrates dual sources (Pinecone + Tavily), locks the concept before retrieval to prevent drift, then hands a grounded context to Claude 3 Sonnet for chain-of-thought synthesis.",
      icon: Layers,
    },
    {
      label: "Evidence-Weighted Mastery Engine",
      desc: "Mastery is computed from a Bayesian posterior over all events with evidence weights by type. A chat message barely moves your score. An exam pass moves it significantly. Time decay continuously reverts unused knowledge toward the prior.",
      icon: BrainCircuit,
    },
    {
      label: "Live Knowledge Graph",
      desc: "Neo4j 5.20 + APOC tracks every concept you've asked about. Nodes store mastery scores; edges encode prerequisite and semantic relationships. The graph grows as you learn and is visualised live in the chat interface.",
      icon: Network,
    },
    {
      label: "Trust-Scored Community",
      desc: "Community Q&A with threaded doubts, answers, votes. Every user has a trust score computed from contribution quality, NLI pass rates, and vote patterns. Trust multiplies XP reward — high-trust users earn more per contribution.",
      icon: Users,
    },
    {
      label: "Cognitive Trace Per Answer",
      desc: "Every AI response includes an auditable cognitive trace: reasoning steps, concept identified, sources with citations, cognitive load score, exam readiness percentage, and mastery volatility — all computed on the server, none from the LLM.",
      icon: FlaskConical,
    },
    {
      label: "Multi-Mode Learning Interface",
      desc: "Chat Mode (freeform Q&A), Structured Mode (4-step Socratic walk-through), Exam Sim (timed assessment). Language buttons switch between English, Hindi, and Bilingual with no prompt engineering required from the user.",
      icon: BookOpen,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-14 font-mono">

      {/* Hero Banner */}
      <div className="rounded-xl border border-cyan-500/20 bg-[#0d0d14]/80 p-6 shadow-[0_0_40px_rgba(6,182,212,0.08)] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 28px)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENTROPY · COGNITIVE OS · v3.0</span>
            <span className="ml-auto text-cyan-500/40">// ABOUT.tsx</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-3">
            ENTROPY<span className="text-white/10">.</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed mb-5">
            An AI-powered adaptive learning platform built for students who want to genuinely understand, not just get answers.
            Entropy combines an 8-layer agentic reasoning pipeline, real-time Neo4j concept graphs,
            evidence-weighted mastery tracking, and live internet citations to turn every question into a measurable learning event.
          </p>
          <div className="flex flex-wrap gap-2">
            {["AI for Bharat", "2026", "AWS Bedrock · Claude 3", "Agentic RAG", "Team planet (optional)"].map((tag) => (
              <span
                key={tag}
                className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${
                  tag === "Team planet (optional)"
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                    : tag === "AWS Bedrock · Claude 3"
                    ? "border-cyan-500/30 text-cyan-400 bg-cyan-500/5"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* System Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: "8", label: "Reasoning Layers", accent: "text-cyan-400" },
          { value: "3", label: "Database Engines", accent: "text-purple-400" },
          { value: "2", label: "Live AI Sources", accent: "text-amber-400" },
          { value: "19+", label: "Languages Supported", accent: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-[#0d0d14]/60 p-4 text-center hover:border-white/10 transition-colors">
            <div className={`text-3xl font-black ${s.accent} mb-1`}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Problem Statement */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-red-500/60 mb-2">// PROBLEM_STATEMENT</div>
        <div className="text-[11px] text-muted-foreground mb-5">
          The four root problems Entropy is designed to solve — present in every existing edtech and AI-chat tool.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {problems.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className={`rounded-lg border ${p.border} ${p.bg} p-4 flex gap-3`}>
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${p.color}`} />
                <div>
                  <div className={`text-[11px] font-bold mb-1 ${p.color}`}>{p.title}</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">{p.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Solution USPs */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/60 mb-2">// SOLUTION_&_USP</div>
        <div className="text-[11px] text-muted-foreground mb-5">
          Six concrete differentiators — each directly addresses one of the problems above.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {usps.map((u) => {
            const Icon = u.icon
            return (
              <div key={u.title} className={`rounded-lg border ${u.border} ${u.bg} p-4 flex gap-3`}>
                <div className={`shrink-0 mt-0.5 ${u.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className={`text-[11px] font-bold mb-1 ${u.accent}`}>{u.title}</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">{u.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* AI Reasoning Pipeline */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// AGENTIC_RAG_PIPELINE</div>
        <div className="text-[11px] text-muted-foreground mb-5">
          Every query traverses all 8 stages sequentially. No shortcuts, no black boxes.
          The Cognitive Trace card in the UI exposes every stage output.
        </div>
        <div className="space-y-2">
          {pipeline.map((stage) => (
            <div key={stage.step} className="flex items-start gap-3">
              <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-black ${stage.color}`}>
                {stage.step}
              </div>
              <div className="flex-1 rounded-lg border border-white/5 bg-[#0d0d14]/60 px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1 hover:border-white/10 transition-colors">
                <span className={`text-[11px] font-black tracking-[0.15em] uppercase ${stage.color.split(" ")[0]}`}>
                  {stage.label}
                </span>
                <span className="text-[11px] text-muted-foreground">{stage.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mastery formula callout */}
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-400 mb-2">// MASTERY_FORMULA</div>
          <div className="font-mono text-[12px] text-foreground/80 space-y-1">
            <div><span className="text-cyan-400">raw</span> = (correct + <span className="text-amber-400">1</span>) / (total + <span className="text-amber-400">4</span>)  <span className="text-white/30">// Bayesian prior — prevents instant 100%</span></div>
            <div><span className="text-cyan-400">conf_weight</span> = confidence × exp(−0.03 × days_since)  <span className="text-white/30">// time decay</span></div>
            <div><span className="text-cyan-400">delta</span> = (raw × conf_weight − prev_mastery) × evidence_weight</div>
            <div><span className="text-cyan-400">mastery</span> = clamp(0, 1, prev_mastery + delta)</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
            <span className="px-2 py-0.5 rounded border border-white/10 text-muted-foreground">exam · 1.0×</span>
            <span className="px-2 py-0.5 rounded border border-white/10 text-muted-foreground">quiz · 0.8×</span>
            <span className="px-2 py-0.5 rounded border border-white/10 text-muted-foreground">practice · 0.6×</span>
            <span className="px-2 py-0.5 rounded border border-white/10 text-muted-foreground">chat · 0.2×</span>
            <span className="px-2 py-0.5 rounded border border-white/10 text-muted-foreground">80% at 7d · 40% at 30d · 7% at 90d</span>
          </div>
        </div>
      </section>

      {/* System Architecture */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// SYSTEM_ARCHITECTURE</div>
        <div className="text-[11px] text-muted-foreground mb-5">Three-tier layered architecture. Clean separation between interface, intelligence, and knowledge.</div>
        <div className="space-y-3">
          {architectureLayers.map((layer) => (
            <div key={layer.tier} className={`rounded-xl border ${layer.border} ${layer.bg} p-4`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-1 w-24 rounded-full bg-gradient-to-r ${layer.bar}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{layer.tier}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {layer.items.map((item) => (
                  <span key={item} className="text-[11px] bg-white/5 border border-white/[0.08] px-2.5 py-1 rounded-md text-foreground/80">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Knowledge Graph Stats */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// KNOWLEDGE_GRAPH_STATS</div>
        <div className="text-[11px] text-muted-foreground mb-5">Neo4j semantic concept network powering multi-hop reasoning and concept-path navigation.</div>
        <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Network className="h-4 w-4 text-purple-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-purple-400">Live Knowledge Graph · Neo4j 5.20 + APOC</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kgStats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-purple-300 mb-0.5">{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/70">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">{s.unit}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 text-[10px] text-muted-foreground leading-relaxed">
            <span className="text-cyan-400">CALCULUS</span>
            <span className="text-white/20"> ──── </span>
            <span className="text-purple-400">LIMITS</span>
            <span className="text-white/20"> ──── </span>
            <span className="text-blue-400">DERIVATIVES</span>
            <span className="text-white/20"> ──── </span>
            <span className="text-violet-400">INTEGRALS</span>
            <span className="text-white/20"> ──── </span>
            <span className="text-pink-400">SERIES</span>
            <span className="text-white/20 ml-2"> and 11,995 more nodes · each with mastery scores · prerequisite edges · semantic relationships</span>
          </div>
        </div>
      </section>

      {/* Core Systems */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-4">// CORE_SYSTEMS</div>
        <div className="space-y-3">
          {systems.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={i}
                className="rounded-lg border border-white/5 bg-[#0d0d14]/60 p-4 flex gap-4 hover:border-cyan-500/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Team */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// TEAM</div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-5 flex items-center gap-3">
          <Atom className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-400">Team planet (optional)</span>
            <span className="text-[11px] text-muted-foreground ml-2">Experimental Builder Collective</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground hidden md:block">AI · Learning Tech · Dev Infrastructure · Knowledge Systems</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/8 bg-[#0d0d14]/80 p-5 flex flex-col gap-4 hover:border-cyan-500/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-black shadow-[0_0_20px_rgba(6,182,212,0.25)] shrink-0">
                R
              </div>
              <div>
                <h2 className="text-base font-black text-foreground tracking-tight">Rijusmit Biswas</h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[9px] uppercase tracking-[0.15em] border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">Full-Stack Eng</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] border border-purple-500/30 text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">AI / ML Builder</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Architected the complete Entropy stack — Next.js 14 frontend, FastAPI microservice,
              8-layer agentic RAG pipeline, AWS Bedrock (Claude 3 Sonnet) integration, Tavily live search,
              Neo4j knowledge graph, evidence-weighted mastery engine, NLI fact-checking, and
              event-driven gamification. Full system design, backend, AI, and infrastructure.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] pt-1 border-t border-white/5">
              <span className="text-muted-foreground">System Architecture</span>
              <span className="text-white/20">·</span>
              <span className="text-muted-foreground">AI Pipeline</span>
              <span className="text-white/20">·</span>
              <span className="text-muted-foreground">Backend</span>
              <span className="text-white/20">·</span>
              <span className="text-muted-foreground">DevOps</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-[#0d0d14]/80 p-5 flex flex-col gap-4 hover:border-violet-500/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xl font-black shadow-[0_0_20px_rgba(139,92,246,0.25)] shrink-0">
                S
              </div>
              <div>
                <h2 className="text-base font-black text-foreground tracking-tight">Siddhant Bali</h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[9px] uppercase tracking-[0.15em] border border-violet-500/30 text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">Product Dev</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] border border-pink-500/30 text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">Designer</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Owns the product experience and visual design language across Entropy. Defines
              system UI patterns, interaction flows, and the cognitive UX that makes the
              8-layer agentic pipeline feel intuitive and learnable rather than opaque to students.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] pt-1 border-t border-white/5">
              <span className="text-muted-foreground">Product Strategy</span>
              <span className="text-white/20">·</span>
              <span className="text-muted-foreground">UI/UX Design</span>
              <span className="text-white/20">·</span>
              <span className="text-muted-foreground">Interaction Design</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-[#0d0d14]/40 p-4 text-[12px] text-muted-foreground leading-relaxed">
          <span className="text-amber-400 font-bold">planet (optional)</span> is an informal builder collective focused on creating
          experimental tools at the intersection of{" "}
          <span className="text-foreground/70">artificial intelligence</span>,{" "}
          <span className="text-foreground/70">learning technology</span>,{" "}
          <span className="text-foreground/70">developer infrastructure</span>, and{" "}
          <span className="text-foreground/70">knowledge systems</span>.
          Entropy is an experiment in how modern AI can augment human reasoning, learning, and collaboration at scale —
          built specifically for the <span className="text-foreground/70">AI for Bharat</span> ecosystem.
        </div>
      </section>

      {/* Tech Stack */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-4">// TECH_STACK</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stack.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="rounded-lg border border-white/5 bg-[#0d0d14]/60 p-4 flex items-start gap-3 hover:border-cyan-500/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
                  <div className="text-sm text-foreground mt-0.5">{item.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-purple-500/5 p-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 80% 50%, rgba(6,182,212,0.06) 0%, transparent 60%)" }}
        />
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-1">// READY</div>
          <div className="text-lg font-black text-foreground">Experience the Cognitive OS</div>
          <div className="text-xs text-muted-foreground mt-1">
            8-Layer Agentic RAG · Live Citations · Concept Graph · Built by Team planet (optional)
          </div>
        </div>
        <div className="flex gap-3 shrink-0 relative">
          <Button
            asChild
            size="sm"
            className="font-mono text-[11px] uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black"
          >
            <Link href="/">
              Open AI Agent <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="font-mono text-[11px] uppercase tracking-wider border-white/10 hover:border-cyan-500/30"
          >
            <Link href="/ask">Ask a Question</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
