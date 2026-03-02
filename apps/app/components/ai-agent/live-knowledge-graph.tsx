"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface GraphNode {
  id: string
  label: string
  mastery: number
  x: number
  y: number
  pulse?: boolean
}

interface GraphEdge {
  from: string
  to: string
  strength: "strong" | "weak"
}

const defaultNodes: GraphNode[] = [
  { id: "calculus",    label: "Calculus",    mastery: 72, x: 50,  y: 30  },
  { id: "derivatives", label: "Derivatives", mastery: 64, x: 25,  y: 60  },
  { id: "limits",      label: "Limits",      mastery: 51, x: 50,  y: 70  },
  { id: "chain_rule",  label: "Chain Rule",  mastery: 72, x: 75,  y: 60  },
  { id: "algebra",     label: "Algebra",     mastery: 58, x: 15,  y: 35  },
  { id: "functions",   label: "Functions",   mastery: 76, x: 35,  y: 20  },
  { id: "aiml",        label: "AI/ML",       mastery: 81, x: 80,  y: 25  },
]

const defaultEdges: GraphEdge[] = [
  { from: "algebra",     to: "functions",   strength: "strong" },
  { from: "functions",   to: "calculus",    strength: "strong" },
  { from: "calculus",    to: "derivatives", strength: "strong" },
  { from: "calculus",    to: "limits",      strength: "strong" },
  { from: "derivatives", to: "chain_rule",  strength: "strong" },
  { from: "limits",      to: "chain_rule",  strength: "weak"   },
  { from: "functions",   to: "aiml",        strength: "weak"   },
]

interface LiveKnowledgeGraphProps {
  activeConceptId?: string
  masteryUpdate?: { conceptId: string; delta: number }
  className?: string
  height?: number
}

function masteryToColor(m: number): string {
  if (m >= 80) return "#34d399" // emerald
  if (m >= 60) return "#22d3ee" // cyan
  if (m >= 40) return "#f59e0b" // amber
  return "#f87171"              // red
}

export function LiveKnowledgeGraph({
  activeConceptId,
  masteryUpdate,
  className,
  height = 220,
}: LiveKnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>(defaultNodes)
  const animRef = useRef<number>()
  const pulseRef = useRef<Record<string, number>>({}) // nodeId → pulse factor 0-1

  // When a mastery update arrives, trigger a pulse
  useEffect(() => {
    if (!masteryUpdate) return
    setNodes(prev => prev.map(n =>
      n.id === masteryUpdate.conceptId
        ? { ...n, mastery: Math.min(100, n.mastery + masteryUpdate.delta), pulse: true }
        : n
    ))
    pulseRef.current[masteryUpdate.conceptId] = 1.0
  }, [masteryUpdate])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let t = 0
    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Draw edges
      for (const edge of defaultEdges) {
        const from = nodes.find(n => n.id === edge.from)
        const to   = nodes.find(n => n.id === edge.to)
        if (!from || !to) continue

        const x1 = (from.x / 100) * W
        const y1 = (from.y / 100) * H
        const x2 = (to.x / 100) * W
        const y2 = (to.y / 100) * H

        // Animate edge flow
        const flowProgress = (t * 0.4) % 1
        const isActive =
          from.id === activeConceptId || to.id === activeConceptId ||
          from.id === masteryUpdate?.conceptId || to.id === masteryUpdate?.conceptId

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isActive
          ? edge.strength === "strong"
            ? "rgba(34,211,238,0.5)"
            : "rgba(34,211,238,0.2)"
          : edge.strength === "strong"
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.03)"
        ctx.lineWidth = edge.strength === "strong" ? 1.5 : 0.8
        ctx.stroke()

        // Flow dot on active edges
        if (isActive) {
          const dotX = x1 + (x2 - x1) * flowProgress
          const dotY = y1 + (y2 - y1) * flowProgress
          ctx.beginPath()
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(34,211,238,0.9)"
          ctx.fill()
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const x = (node.x / 100) * W
        const y = (node.y / 100) * H
        const r = node.id === activeConceptId ? 7 : 5.5
        const color = masteryToColor(node.mastery)
        const pulse = pulseRef.current[node.id] ?? 0

        // Pulse ring
        if (pulse > 0) {
          ctx.beginPath()
          ctx.arc(x, y, r + pulse * 12, 0, Math.PI * 2)
          ctx.strokeStyle = color.replace(")", `, ${pulse * 0.6})`).replace("rgb(", "rgba(")
          ctx.lineWidth = 1.5
          ctx.stroke()
          pulseRef.current[node.id] = Math.max(0, pulse - 0.02)
        }

        // Active glow
        if (node.id === activeConceptId) {
          ctx.beginPath()
          ctx.arc(x, y, r + 4 + Math.sin(t * 3) * 2, 0, Math.PI * 2)
          ctx.strokeStyle = `${color}44`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = `${color}22`
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Mastery fill arc
        ctx.beginPath()
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (node.mastery / 100) * Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()

        // Label
        ctx.font = `bold 7px monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = node.id === activeConceptId ? color : "rgba(255,255,255,0.45)"
        ctx.fillText(node.label, x, y + r + 2)
      }

      t += 0.016
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [nodes, activeConceptId, masteryUpdate])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = height
    })
    ro.observe(canvas)
    canvas.width  = canvas.offsetWidth
    canvas.height = height
    return () => ro.disconnect()
  }, [height])

  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        className="block"
      />
    </div>
  )
}
