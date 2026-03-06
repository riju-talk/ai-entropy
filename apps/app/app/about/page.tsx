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
} from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About | ENTROPY",
  description:
    "Entropy — Experimental AI learning platform by Team Planet. Built by Rijusmit Biswas & Siddhant Bali.",
}

export default function AboutPage() {
  const pipeline = [
    { step: "01", label: "RETRIEVAL", desc: "Neo4j + pgvector semantic search across concept graph", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
    { step: "02", label: "REASONING", desc: "Multi-hop chain-of-thought via Gemini Flash", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
    { step: "03", label: "SYNTHESIS", desc: "Cross-domain knowledge fusion & summarisation", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
    { step: "04", label: "CRITIQUE", desc: "Self-adversarial validation & contradiction detection", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
    { step: "05", label: "INTEGRATION", desc: "Context-window compression & multi-source merge", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
    { step: "06", label: "META-COGNITION", desc: "Confidence scoring, gap detection & uncertainty flags", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { step: "07", label: "ADAPTATION", desc: "Mastery delta computation + response calibration", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
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
      items: ["FastAPI + Python 3.12", "7-Stage Reasoning Pipeline", "Google Gemini  AWS Bedrock (Claude 3)", "pgvector Similarity Search"],
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
    { label: "Frontend", value: "Next.js 14  TypeScript  Tailwind CSS  shadcn/ui", icon: Globe },
    { label: "Backend", value: "FastAPI  Python 3.12  Uvicorn  Pydantic", icon: Terminal },
    { label: "AI Engine", value: "Google Gemini  Amazon Bedrock (Claude 3 Sonnet)", icon: BrainCircuit },
    { label: "Knowledge Graph", value: "Neo4j 5.20  Bolt protocol  APOC extensions", icon: Network },
    { label: "Database", value: "PostgreSQL 16  Prisma ORM  pgvector", icon: Database },
    { label: "Cache / Queue", value: "Redis 7  Append-only persistence", icon: Zap },
    { label: "Infra", value: "AWS Lambda  AWS Bedrock  Vercel  Docker", icon: Cpu },
    { label: "Auth", value: "NextAuth.js  GitHub OAuth  Google OAuth", icon: Shield },
  ]

  const systems = [
    {
      label: "7-Layer AI Reasoning",
      desc: "Retrieval to Reasoning to Synthesis to Critique to Integration to Meta-cognition to Adaptation. Each query passes through all seven stages for measurably deeper answers.",
      icon: Layers,
    },
    {
      label: "Adaptive Learning Engine",
      desc: "Dynamic mastery tracking with volatility detection. The engine adjusts difficulty, spacing, and topic order in real time based on your cognitive performance.",
      icon: BrainCircuit,
    },
    {
      label: "Live Knowledge Graph",
      desc: "Neo4j-powered concept network that maps semantic relationships between topics, enabling concept-path navigation and multi-hop reasoning across subjects.",
      icon: Network,
    },
    {
      label: "Community Platform",
      desc: "Threaded Q&A, subject-based communities, mentorship, gamified XP + credits, achievement system, and leaderboards all wired into the AI reasoning layer.",
      icon: Users,
    },
    {
      label: "Cognitive Studio",
      desc: "Three-mode interface: Learning (mastery radar), Assessment (exam readiness gauge), Graphing (concept map) giving a full cognitive profile of every session.",
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
            <span>ENTROPY  COGNITIVE OS  v2.0</span>
            <span className="ml-auto text-cyan-500/40">// ABOUT.tsx</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 mb-3">
            ENTROPY<span className="text-white/10">.</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed mb-5">
            An experimental AI-powered adaptive learning platform combining a 7-layer reasoning
            engine, real-time Neo4j knowledge graphs, and a community-first approach
            to make STEM education more intelligent, measurable, and deeply personalised.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Independent Research Project", "2026", "Experimental AI Platform", "Open Stack", "Team Planet"].map((tag) => (
              <span
                key={tag}
                className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${
                  tag === "Team Planet"
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
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
          { value: "7", label: "Reasoning Layers", accent: "text-cyan-400" },
          { value: "3", label: "Database Engines", accent: "text-purple-400" },
          { value: "72h", label: "Build Sprint", accent: "text-amber-400" },
          { value: "2+", label: "AI Providers", accent: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-[#0d0d14]/60 p-4 text-center hover:border-white/10 transition-colors">
            <div className={`text-3xl font-black ${s.accent} mb-1`}>{s.value}</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Reasoning Pipeline */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// AI_REASONING_PIPELINE</div>
        <div className="text-[11px] text-muted-foreground mb-5">Every query traverses all 7 stages. No shortcuts, no hallucination shortcuts.</div>
        <div className="space-y-2">
          {pipeline.map((stage, i) => (
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
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-purple-400">Live Knowledge Graph  Neo4j 5.20</span>
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
            <span className="text-white/20"> ---- </span>
            <span className="text-purple-400">LIMITS</span>
            <span className="text-white/20"> ---- </span>
            <span className="text-blue-400">DERIVATIVES</span>
            <span className="text-white/20"> ---- </span>
            <span className="text-violet-400">INTEGRALS</span>
            <span className="text-white/20"> ---- </span>
            <span className="text-pink-400">SERIES</span>
            <span className="text-white/20 ml-2"> and 11,995 more nodes</span>
          </div>
        </div>
      </section>

      {/* Team */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/60 mb-2">// TEAM</div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-5 flex items-center gap-3">
          <Atom className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-400">Team Planet</span>
            <span className="text-[11px] text-muted-foreground ml-2">Experimental Builder Collective</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground hidden md:block">AI  Learning Tech  Dev Infrastructure  Knowledge Systems</span>
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
              Architected the complete Entropy stack including Next.js 14 frontend, FastAPI microservice,
              multi-provider LLM routing (Gemini + AWS Bedrock), Neo4j knowledge graph, and the
              7-layer reasoning pipeline. Full system design, backend engineering, and AI integration.
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
              7-layer AI engine feel intuitive and learnable rather than opaque.
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
          <span className="text-amber-400 font-bold">Planet</span> is an informal builder collective focused on creating
          experimental tools at the intersection of{" "}
          <span className="text-foreground/70">artificial intelligence</span>,{" "}
          <span className="text-foreground/70">learning technology</span>,{" "}
          <span className="text-foreground/70">developer infrastructure</span>, and{" "}
          <span className="text-foreground/70">knowledge systems</span>.
          Entropy is one experiment in how modern AI can augment human reasoning, learning, and collaboration at scale.
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
            7-layer AI  Knowledge Graph  Live Community  Built by Team Planet
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
