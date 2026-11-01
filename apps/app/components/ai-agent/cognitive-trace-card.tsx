"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { BrainCircuit, ChevronDown, Zap, Target, TrendingUp, Layers, Globe, ExternalLink, BookOpen, Activity } from "lucide-react"

export interface SourceCitation {
  index: number
  title: string
  url: string
  snippet: string
  type: "web" | "document"
}

export interface CognitiveTrace {
  intent: string
  concept: string
  difficulty: number        // 0–1
  masteryImpact: number     // e.g. +3
  language: "English" | "Hindi" | "Bilingual"
  inferenceMs: number
  reasoningLayers: number
  // Algorithmic metrics (never LLM-guessed)
  cognitiveLoad?: number    // 0–1  difficulty − mastery
  volatility?: number       // std-dev of last 10 attempts
  examReadiness?: number    // 0–1 composite
  // Citations
  sources?: SourceCitation[]
}

interface CognitiveTraceCardProps {
  trace: CognitiveTrace
  masteryDelta?: number
  className?: string
}

export function CognitiveTraceCard({ trace, className }: CognitiveTraceCardProps) {
  const [open, setOpen] = useState(false)

  const diffColor =
    trace.difficulty >= 0.7 ? "text-destructive" :
    trace.difficulty >= 0.45 ? "text-warning" :
    "text-success"

  const diffLabel =
    trace.difficulty >= 0.7 ? "Hard" :
    trace.difficulty >= 0.45 ? "Medium" :
    "Easy"

  return (
    <div className={cn("mt-3 rounded border border-border bg-card overflow-hidden", className)}>
      {/* Collapsed row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-card transition-colors"
      >
        <BrainCircuit className="h-3 w-3 text-primary flex-shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Cognitive Trace</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[8px] text-muted-foreground font-mono">{trace.inferenceMs}ms</span>
          <Zap className="h-2.5 w-2.5 text-warning" />
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-3 pb-3 border-t border-border">
          {/* Core trace rows */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5">
            <TraceRow icon={Target} label="Intent" value={trace.intent} color="cyan" />
            <TraceRow icon={Layers} label="Concept" value={trace.concept} color="purple" />
            <TraceRow
              icon={BrainCircuit}
              label="Difficulty"
              value={`${diffLabel} (${(trace.difficulty * 100).toFixed(0)}%)`}
              color="amber"
              valueClass={diffColor}
            />
            <TraceRow
              icon={TrendingUp}
              label="Mastery Δ"
              value={`+${trace.masteryImpact}%`}
              color="green"
              valueClass="text-success"
            />
            <TraceRow icon={Globe} label="Language" value={trace.language} color="violet" />
            <TraceRow
              icon={Zap}
              label="Reasoning"
              value={`${trace.reasoningLayers}-Layer`}
              color="amber"
              valueClass="text-warning"
            />
          </div>

          {/* Difficulty gradient bar */}
          <div className="mt-2.5">
            <div className="flex justify-between mb-0.5">
              <span className="text-[7px] uppercase tracking-widest text-muted-foreground">Difficulty gradient</span>
              <span className={cn("text-[7px] font-bold", diffColor)}>{(trace.difficulty * 100).toFixed(0)}%</span>
            </div>
            <div className="h-0.5 bg-accent rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  trace.difficulty >= 0.7 ? "bg-destructive" : trace.difficulty >= 0.45 ? "bg-warning" : "bg-success"
                )}
                style={{ width: `${trace.difficulty * 100}%` }}
              />
            </div>
          </div>

          {/* Algorithmic metrics */}
          {(trace.cognitiveLoad !== undefined || trace.examReadiness !== undefined || trace.volatility !== undefined) && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <div className="flex items-center gap-1 mb-2">
                <Activity className="h-2.5 w-2.5 text-primary" />
                <span className="text-[7px] font-bold uppercase tracking-widest text-primary">Learning Metrics</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {trace.cognitiveLoad !== undefined && (
                  <MetricBar
                    label="Cog. Load"
                    value={trace.cognitiveLoad}
                    color={trace.cognitiveLoad > 0.5 ? "bg-destructive" : trace.cognitiveLoad > 0.2 ? "bg-warning" : "bg-success"}
                  />
                )}
                {trace.examReadiness !== undefined && (
                  <MetricBar label="Exam Ready" value={trace.examReadiness} color="bg-primary" />
                )}
                {trace.volatility !== undefined && (
                  <MetricBar
                    label="Stability"
                    value={Math.max(0, 1 - trace.volatility * 3)}
                    color="bg-primary"
                  />
                )}
              </div>
            </div>
          )}

          {/* Sources / Citations */}
          {trace.sources && trace.sources.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <div className="flex items-center gap-1 mb-2">
                <BookOpen className="h-2.5 w-2.5 text-primary" />
                <span className="text-[7px] font-bold uppercase tracking-widest text-primary">
                  Sources ({trace.sources.length})
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {trace.sources.map((src) => (
                  <div
                    key={src.index}
                    className="rounded border border-border bg-card px-2.5 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0 text-[7px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5">
                        [{src.index}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-[9px] font-semibold text-foreground truncate">{src.title}</p>
                          <span className={cn(
                            "flex-shrink-0 text-[6px] px-1 rounded font-bold uppercase",
                            src.type === "web" ? "text-primary bg-primary/10" : "text-primary bg-primary/10"
                          )}>
                            {src.type === "web" ? "web" : "doc"}
                          </span>
                        </div>
                        {src.snippet && (
                          <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-2">{src.snippet}</p>
                        )}
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 mt-1 text-[7px] text-primary/70 hover:text-primary transition-colors truncate"
                          >
                            <ExternalLink className="h-2 w-2 flex-shrink-0" />
                            <span className="truncate">{src.url}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TraceRow({
  icon: Icon, label, value, color, valueClass
}: { icon: any; label: string; value: string; color: string; valueClass?: string }) {
  const colors: Record<string, string> = {
    cyan: "text-primary", purple: "text-primary", amber: "text-warning",
    green: "text-success", violet: "text-primary"
  }
  return (
    <div className="pt-2">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={cn("h-2.5 w-2.5", colors[color])} />
        <span className={cn("text-[7px] font-bold uppercase tracking-widest", colors[color])}>{label}</span>
      </div>
      <span className={cn("text-[9px] text-muted-foreground", valueClass)}>{value}</span>
    </div>
  )
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[7px] text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-[7px] text-muted-foreground font-mono">{pct}%</span>
      </div>
      <div className="h-0.5 bg-accent rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
