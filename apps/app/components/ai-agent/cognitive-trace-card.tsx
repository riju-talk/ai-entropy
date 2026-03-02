"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { BrainCircuit, ChevronDown, Zap, Target, TrendingUp, Layers, Globe } from "lucide-react"

export interface CognitiveTrace {
  intent: string
  concept: string
  difficulty: number        // 0–1
  masteryImpact: number     // e.g. +3
  language: "English" | "Hindi" | "Bilingual"
  inferenceMs: number
  reasoningLayers: number
}

interface CognitiveTraceCardProps {
  trace: CognitiveTrace
  masteryDelta?: number
  className?: string
}

export function CognitiveTraceCard({ trace, className }: CognitiveTraceCardProps) {
  const [open, setOpen] = useState(false)

  const diffColor =
    trace.difficulty >= 0.7 ? "text-red-400" :
    trace.difficulty >= 0.45 ? "text-amber-400" :
    "text-emerald-400"

  const diffLabel =
    trace.difficulty >= 0.7 ? "Hard" :
    trace.difficulty >= 0.45 ? "Medium" :
    "Easy"

  return (
    <div className={cn("mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden", className)}>
      {/* Collapsed row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <BrainCircuit className="h-3 w-3 text-cyan-400 flex-shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-400">Cognitive Trace</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[8px] text-white/30 font-mono">{trace.inferenceMs}ms</span>
          <Zap className="h-2.5 w-2.5 text-amber-400" />
          <ChevronDown className={cn("h-3 w-3 text-white/20 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/[0.05]">
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
            valueClass="text-emerald-400"
          />
          <TraceRow icon={Globe} label="Language" value={trace.language} color="violet" />
          <TraceRow
            icon={Zap}
            label="Reasoning"
            value={`${trace.reasoningLayers}-Layer`}
            color="amber"
            valueClass="text-amber-400"
          />
          {/* Difficulty bar */}
          <div className="col-span-2 mt-1">
            <div className="flex justify-between mb-0.5">
              <span className="text-[7px] uppercase tracking-widest text-white/20">Difficulty gradient</span>
              <span className={cn("text-[7px] font-bold", diffColor)}>{(trace.difficulty * 100).toFixed(0)}%</span>
            </div>
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  trace.difficulty >= 0.7 ? "bg-red-400" : trace.difficulty >= 0.45 ? "bg-amber-400" : "bg-emerald-400"
                )}
                style={{ width: `${trace.difficulty * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TraceRow({
  icon: Icon, label, value, color, valueClass
}: { icon: any; label: string; value: string; color: string; valueClass?: string }) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-400", purple: "text-purple-400", amber: "text-amber-400",
    green: "text-emerald-400", violet: "text-violet-400"
  }
  return (
    <div className="pt-2">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={cn("h-2.5 w-2.5", colors[color])} />
        <span className={cn("text-[7px] font-bold uppercase tracking-widest", colors[color])}>{label}</span>
      </div>
      <span className={cn("text-[9px] text-white/50", valueClass)}>{value}</span>
    </div>
  )
}
