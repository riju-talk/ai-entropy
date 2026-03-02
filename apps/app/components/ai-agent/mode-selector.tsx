"use client"

import { cn } from "@/lib/utils"
import { MessageSquare, Layers, Trophy } from "lucide-react"

export type LearningMode = "chat" | "structured" | "exam"

interface ModeSelectorProps {
  mode: LearningMode
  onChange: (mode: LearningMode) => void
  disabled?: boolean
}

const modes: { id: LearningMode; label: string; icon: any; desc: string; accent: string }[] = [
  {
    id: "chat",
    label: "Chat Mode",
    icon: MessageSquare,
    desc: "Free-form conversation",
    accent: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  },
  {
    id: "structured",
    label: "Structured",
    icon: Layers,
    desc: "Step validation required",
    accent: "border-purple-500/40 text-purple-400 bg-purple-500/10",
  },
  {
    id: "exam",
    label: "Exam Sim",
    icon: Trophy,
    desc: "Timed · No hints",
    accent: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  },
]

export function ModeSelector({ mode, onChange, disabled = false }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {modes.map((m) => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            title={m.desc}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.15em] transition-all",
              active ? m.accent : "text-white/25 hover:text-white/50 hover:bg-white/[0.03]",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
