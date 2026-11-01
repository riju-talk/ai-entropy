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
    accent: "border-primary/40 text-primary bg-primary/10",
  },
  {
    id: "structured",
    label: "Structured",
    icon: Layers,
    desc: "Step validation required",
    accent: "border-primary/40 text-primary bg-primary/10",
  },
  {
    id: "exam",
    label: "Exam Sim",
    icon: Trophy,
    desc: "Timed · No hints",
    accent: "border-warning/40 text-warning bg-warning/10",
  },
]

export function ModeSelector({ mode, onChange, disabled = false }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded bg-card border border-border">
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
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-[0.15em] transition-all",
              active ? m.accent : "text-muted-foreground hover:text-muted-foreground hover:bg-card",
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
