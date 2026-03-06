"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

// ── Backend types (from /api/graph/nodes) ─────────────────────────────────
interface BackendNode {
  id: string
  label: string
  mastery: number      // 0-100
  domain: string
  difficulty: number
}

interface BackendEdge {
  from: string
  to: string
  strength: number     // 0-1 float
}

// ── Internal canvas types ─────────────────────────────────────────────────
interface GraphNode {
  id: string
  label: string
  mastery: number
  x: number
  y: number
}

interface GraphEdge {
  from: string
  to: string
  strength: "strong" | "weak"
}

// ── Static fallback (shown when Neo4j is offline or empty) ───────────────
const FALLBACK_NODES: GraphNode[] = [
  { id: "calculus",    label: "Calculus",    mastery: 72, x: 50,  y: 30 },
  { id: "derivatives", label: "Derivatives", mastery: 64, x: 25,  y: 60 },
  { id: "limits",      label: "Limits",      mastery: 51, x: 50,  y: 70 },
  { id: "chain_rule",  label: "Chain Rule",  mastery: 72, x: 75,  y: 60 },
  { id: "algebra",     label: "Algebra",     mastery: 58, x: 15,  y: 35 },
  { id: "functions",   label: "Functions",   mastery: 76, x: 35,  y: 20 },
  { id: "aiml",        label: "AI/ML",       mastery: 81, x: 80,  y: 25 },
]

const FALLBACK_EDGES: GraphEdge[] = [
  { from: "algebra",     to: "functions",   strength: "strong" },
  { from: "functions",   to: "calculus",    strength: "strong" },
  { from: "calculus",    to: "derivatives", strength: "strong" },
  { from: "calculus",    to: "limits",      strength: "strong" },
  { from: "derivatives", to: "chain_rule",  strength: "strong" },
  { from: "limits",      to: "chain_rule",  strength: "weak"   },
  { from: "functions",   to: "aiml",        strength: "weak"   },
]

// ── Layout: group by domain → radial arrangement ─────────────────────────
function computeLayout(backendNodes: BackendNode[]): GraphNode[] {
  if (backendNodes.length === 0) return FALLBACK_NODES

  // Group nodes by domain
  const domains = new Map<string, BackendNode[]>()
  for (const n of backendNodes) {
    const d = n.domain || "general"
    if (!domains.has(d)) domains.set(d, [])
    domains.get(d)!.push(n)
  }

  const domainList = [...domains.entries()]
  const numDomains = domainList.length
  const result: GraphNode[] = []

  domainList.forEach(([, dnodes], di) => {
    const domainAngle = (di / numDomains) * Math.PI * 2 - Math.PI / 2
    const domainRadius = numDomains === 1 ? 0 : 27
    const cx = 50 + Math.cos(domainAngle) * domainRadius
    const cy = 45 + Math.sin(domainAngle) * domainRadius

    dnodes.forEach((node, ni) => {
      const nodeAngle = dnodes.length > 1 ? (ni / dnodes.length) * Math.PI * 2 : 0
      const nodeRadius = dnodes.length > 1 ? 13 : 0
      result.push({
        id: node.id,
        label: node.label,
        mastery: node.mastery,
        x: Math.max(8, Math.min(90, cx + Math.cos(nodeAngle) * nodeRadius)),
        y: Math.max(8, Math.min(87, cy + Math.sin(nodeAngle) * nodeRadius)),
      })
    })
  })

  return result
}

function convertEdges(backendEdges: BackendEdge[]): GraphEdge[] {
  return backendEdges.map(e => ({
    from: e.from,
    to: e.to,
    strength: e.strength >= 0.7 ? "strong" : "weak",
  }))
}

// ── Color helper ──────────────────────────────────────────────────────────
function masteryToColor(m: number): string {
  if (m >= 80) return "#34d399"
  if (m >= 60) return "#22d3ee"
  if (m >= 40) return "#f59e0b"
  return "#f87171"
}

// ── Resolve active node: match by id OR label (case-insensitive) ──────────
function isActiveNode(node: GraphNode, activeConceptId?: string): boolean {
  if (!activeConceptId) return false
  const key = activeConceptId.toLowerCase()
  return node.id.toLowerCase() === key || node.label.toLowerCase() === key
}

interface LiveKnowledgeGraphProps {
  userId?: string
  activeConceptId?: string
  masteryUpdate?: { conceptId: string; delta: number }
  className?: string
  height?: number
}

export function LiveKnowledgeGraph({
  userId,
  activeConceptId,
  masteryUpdate,
  className,
  height = 220,
}: LiveKnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>(FALLBACK_NODES)
  const [edges, setEdges] = useState<GraphEdge[]>(FALLBACK_EDGES)
  const [isLive, setIsLive] = useState(false)
  const animRef = useRef<number>()
  const pulseRef = useRef<Record<string, number>>({})

  // ── Fetch live graph data from /api/ai-agent/graph ────────────────────
  const fetchGraph = useCallback(async () => {
    try {
      const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : ""
      const res = await fetch(`/api/ai-agent/graph${qs}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      const backendNodes: BackendNode[] = data.nodes || []
      const backendEdges: BackendEdge[] = data.edges || []
      if (backendNodes.length > 0) {
        setNodes(computeLayout(backendNodes))
        setEdges(convertEdges(backendEdges))
        setIsLive(true)
      }
    } catch {
      // Neo4j offline — keep fallback
    }
  }, [userId])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  // Apply local pulse + re-fetch after mastery update
  useEffect(() => {
    if (!masteryUpdate) return
    const { conceptId, delta } = masteryUpdate
    setNodes(prev => prev.map(n =>
      n.id.toLowerCase() === conceptId.toLowerCase() || n.label.toLowerCase() === conceptId.toLowerCase()
        ? { ...n, mastery: Math.min(100, n.mastery + delta) }
        : n
    ))
    pulseRef.current[conceptId] = 1.0
    const timer = setTimeout(() => fetchGraph(), 1500)
    return () => clearTimeout(timer)
  }, [masteryUpdate, fetchGraph])

  // ── Canvas draw loop ──────────────────────────────────────────────────
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
      for (const edge of edges) {
        const from = nodes.find(n => n.id === edge.from)
        const to   = nodes.find(n => n.id === edge.to)
        if (!from || !to) continue

        const x1 = (from.x / 100) * W
        const y1 = (from.y / 100) * H
        const x2 = (to.x / 100) * W
        const y2 = (to.y / 100) * H

        const flowProgress = (t * 0.4) % 1
        const isActive = isActiveNode(from, activeConceptId) || isActiveNode(to, activeConceptId)

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isActive
          ? edge.strength === "strong" ? "rgba(34,211,238,0.5)" : "rgba(34,211,238,0.2)"
          : edge.strength === "strong" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"
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
        const active = isActiveNode(node, activeConceptId)
        const r = active ? 7 : 5.5
        const color = masteryToColor(node.mastery)
        const pulse = pulseRef.current[node.id] ?? pulseRef.current[node.label] ?? 0

        // Pulse ring
        if (pulse > 0) {
          ctx.beginPath()
          ctx.arc(x, y, r + pulse * 12, 0, Math.PI * 2)
          ctx.strokeStyle = `${color}${Math.round(pulse * 0.6 * 255).toString(16).padStart(2, "0")}`
          ctx.lineWidth = 1.5
          ctx.stroke()
          pulseRef.current[node.id] = Math.max(0, pulse - 0.02)
        }

        // Active glow
        if (active) {
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
        ctx.fillStyle = active ? color : "rgba(255,255,255,0.45)"
        ctx.fillText(node.label, x, y + r + 2)
      }

      // Live indicator dot (top-right corner)
      if (isLive) {
        const blink = 0.5 + 0.5 * Math.sin(t * 2)
        ctx.beginPath()
        ctx.arc(W - 8, 8, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(52,211,153,${0.4 + blink * 0.5})`
        ctx.fill()
      }

      t += 0.016
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [nodes, edges, activeConceptId, isLive])

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
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden relative", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        className="block"
      />
      {isLive && (
        <div className="absolute top-2 left-3">
          <span className="text-[7px] font-mono text-emerald-400/60 uppercase tracking-widest">LIVE</span>
        </div>
      )}
    </div>
  )
}
