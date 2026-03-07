"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"

// ── Backend types ─────────────────────────────────────────────────────────
interface BackendNode {
  id: string
  label: string
  mastery: number   // 0-100
  domain: string
  difficulty: number
}

interface BackendEdge {
  from: string
  to: string
  strength: number  // 0-1
}

// ── Internal graph types ──────────────────────────────────────────────────
interface GraphNode extends BackendNode {
  x: number
  y: number
}

interface GraphEdge {
  from: string
  to: string
  strong: boolean
}

// ── Transform state for zoom/pan ──────────────────────────────────────────
interface Transform {
  x: number
  y: number
  scale: number
}

// ── Color helper ──────────────────────────────────────────────────────────
function masteryToColor(m: number): string {
  if (m >= 80) return "#34d399"
  if (m >= 60) return "#22d3ee"
  if (m >= 40) return "#f59e0b"
  return "#f87171"
}

// ── Radial layout: group by domain ────────────────────────────────────────
function computeLayout(nodes: BackendNode[], W: number, H: number): GraphNode[] {
  const CX = W / 2
  const CY = H / 2

  const domains = new Map<string, BackendNode[]>()
  for (const n of nodes) {
    const d = n.domain || "general"
    if (!domains.has(d)) domains.set(d, [])
    domains.get(d)!.push(n)
  }

  const domainList = Array.from(domains.entries())
  const numDomains = domainList.length
  const result: GraphNode[] = []

  domainList.forEach(([, dnodes], di) => {
    const domAngle = (di / numDomains) * Math.PI * 2 - Math.PI / 2
    const domRadius = numDomains <= 1 ? 0 : Math.min(W, H) * 0.28
    const cx = CX + Math.cos(domAngle) * domRadius
    const cy = CY + Math.sin(domAngle) * domRadius

    dnodes.forEach((node: BackendNode, ni: number) => {
      const nodeAngle = dnodes.length > 1 ? (ni / dnodes.length) * Math.PI * 2 : 0
      const nodeRadius = dnodes.length > 1 ? Math.min(W, H) * 0.12 : 0
      result.push({
        ...node,
        x: cx + Math.cos(nodeAngle) * nodeRadius,
        y: cy + Math.sin(nodeAngle) * nodeRadius,
      })
    })
  })

  return result
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
  height = 260,
}: LiveKnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgSize, setSvgSize] = useState({ w: 400, h: height })

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [isLive, setIsLive] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  // Zoom/pan transform
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null)

  // Hover tooltip
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  // Pulse tracking (nodeId → 0-1 fade value, managed via state for re-render)
  const pulseRef = useRef<Record<string, number>>({})
  const [, setPulseTick] = useState(0) // force re-renders while pulse is active

  // ── Resize observer ──────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSvgSize({ w: el.offsetWidth, h: height })
    })
    ro.observe(el)
    setSvgSize({ w: el.offsetWidth, h: height })
    return () => ro.disconnect()
  }, [height])

  // ── Fetch personalised graph ─────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(
        `/api/ai-agent/graph?action=user-graph&user_id=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      )
      if (!res.ok) return
      const data = await res.json()
      const backendNodes: BackendNode[] = data.nodes || []
      const backendEdges: BackendEdge[] = data.edges || []
      if (backendNodes.length === 0) {
        setIsEmpty(true)
        setIsLive(true)
        return
      }
      setIsEmpty(false)
      setIsLive(true)
      setNodes(computeLayout(backendNodes, svgSize.w, svgSize.h))
      setEdges(backendEdges.map(e => ({ from: e.from, to: e.to, strong: e.strength >= 0.7 })))
    } catch {
      // Neo4j offline — leave empty/unchanged
    }
  }, [userId, svgSize.w, svgSize.h])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  // Re-layout when SVG size changes and we have nodes
  useEffect(() => {
    if (nodes.length === 0) return
    setNodes(prev => computeLayout(prev.map(n => n as BackendNode), svgSize.w, svgSize.h))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgSize.w, svgSize.h])

  // ── Apply mastery delta + trigger pulse ───────────────────────────────
  useEffect(() => {
    if (!masteryUpdate) return
    const { conceptId, delta } = masteryUpdate
    setNodes(prev => prev.map(n =>
      n.id.toLowerCase() === conceptId.toLowerCase() || n.label.toLowerCase() === conceptId.toLowerCase()
        ? { ...n, mastery: Math.min(100, n.mastery + delta) }
        : n
    ))
    pulseRef.current[conceptId.toLowerCase()] = 1.0
    // Animate pulse fade
    const interval = setInterval(() => {
      const val = pulseRef.current[conceptId.toLowerCase()] ?? 0
      if (val <= 0) { clearInterval(interval); return }
      pulseRef.current[conceptId.toLowerCase()] = Math.max(0, val - 0.04)
      setPulseTick(t => t + 1)
    }, 30)
    const refetchTimer = setTimeout(() => fetchGraph(), 1500)
    return () => { clearInterval(interval); clearTimeout(refetchTimer) }
  }, [masteryUpdate, fetchGraph])

  // ── Zoom: mouse wheel ──────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setTransform(prev => {
      const scaleBy = e.deltaY < 0 ? 1.12 : 0.89
      const newScale = Math.min(4, Math.max(0.3, prev.scale * scaleBy))
      // Zoom toward cursor position
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { ...prev, scale: newScale }
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      return {
        x: mx - (mx - prev.x) * (newScale / prev.scale),
        y: my - (my - prev.y) * (newScale / prev.scale),
        scale: newScale,
      }
    })
  }, [])

  // ── Pan: mouse drag ────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y }
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setTransform(prev => ({ ...prev, x: dragRef.current!.tx + dx, y: dragRef.current!.ty + dy }))
  }, [])

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  // ── Reset zoom on double-click ─────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  // ── Node lookup map ───────────────────────────────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  // ── SVG rendering ─────────────────────────────────────────────────────
  const groupTransform = `translate(${transform.x},${transform.y}) scale(${transform.scale})`

  return (
    <div
      ref={containerRef}
      className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden relative select-none", className)}
      style={{ height }}
    >
      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/20">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          <p className="text-[11px] text-white/25 text-center max-w-[180px] leading-relaxed">
            Ask questions or upload documents to build your knowledge graph
          </p>
        </div>
      )}

      {/* Zoom hint */}
      {!isEmpty && nodes.length > 0 && (
        <div className="absolute bottom-2 right-3 pointer-events-none">
          <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">scroll to zoom · drag to pan · dbl-click to reset</span>
        </div>
      )}

      {/* Live badge */}
      {isLive && !isEmpty && (
        <div className="absolute top-2 left-3 flex items-center gap-1 pointer-events-none">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[7px] font-mono text-emerald-400/60 uppercase tracking-widest">LIVE</span>
        </div>
      )}

      {/* Node count */}
      {nodes.length > 0 && (
        <div className="absolute top-2 right-3 pointer-events-none">
          <span className="text-[8px] font-mono text-white/20">{nodes.length} concepts</span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && (() => {
        const svgRect = svgRef.current?.getBoundingClientRect()
        const nx = hoveredNode.x * transform.scale + transform.x
        const ny = hoveredNode.y * transform.scale + transform.y
        const color = masteryToColor(hoveredNode.mastery)
        return (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ left: nx + 12, top: ny - 10 }}
          >
            <div className="rounded-lg border border-white/10 bg-black/80 backdrop-blur-sm px-2.5 py-1.5 text-left shadow-xl">
              <p className="text-[10px] font-semibold text-white/90 leading-tight">{hoveredNode.label}</p>
              {hoveredNode.domain && (
                <p className="text-[8px] text-white/40 mt-0.5 capitalize">{hoveredNode.domain}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${hoveredNode.mastery}%`, backgroundColor: color }} />
                </div>
                <span className="text-[8px] font-mono" style={{ color }}>{hoveredNode.mastery.toFixed(0)}%</span>
              </div>
              {hoveredNode.difficulty > 1 && (
                <p className="text-[7px] text-white/25 mt-0.5">difficulty {hoveredNode.difficulty}</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width={svgSize.w}
        height={svgSize.h}
        className="block cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.15)" />
          </marker>
          <marker id="arrowhead-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(34,211,238,0.7)" />
          </marker>
        </defs>

        <g transform={groupTransform}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = nodeMap.get(edge.from)
            const to = nodeMap.get(edge.to)
            if (!from || !to) return null
            const activeKey = activeConceptId?.toLowerCase()
            const isActive =
              from.id.toLowerCase() === activeKey ||
              from.label.toLowerCase() === activeKey ||
              to.id.toLowerCase() === activeKey ||
              to.label.toLowerCase() === activeKey
            // Offset line ends so arrow doesn't overlap node circle
            const r = 7
            const dx = to.x - from.x
            const dy = to.y - from.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const ex = to.x - (dx / dist) * (r + 4)
            const ey = to.y - (dy / dist) * (r + 4)
            const sx = from.x + (dx / dist) * (r + 1)
            const sy = from.y + (dy / dist) * (r + 1)
            return (
              <line
                key={i}
                x1={sx} y1={sy} x2={ex} y2={ey}
                stroke={isActive
                  ? (edge.strong ? "rgba(34,211,238,0.55)" : "rgba(34,211,238,0.25)")
                  : (edge.strong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)")}
                strokeWidth={edge.strong ? 1.5 : 0.8}
                markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const activeKey = activeConceptId?.toLowerCase()
            const active =
              node.id.toLowerCase() === activeKey ||
              node.label.toLowerCase() === activeKey
            const color = masteryToColor(node.mastery)
            const r = active ? 9 : 7
            const pulse = pulseRef.current[node.id.toLowerCase()] ?? 0
            const maskId = `mask-${node.id.replace(/\s+/g, "_")}`

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Pulse ring */}
                {pulse > 0 && (
                  <circle
                    r={r + pulse * 14}
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    opacity={pulse * 0.4}
                  />
                )}

                {/* Active glow ring */}
                {active && (
                  <circle r={r + 5} fill="none" stroke={`${color}33`} strokeWidth="3" />
                )}

                {/* Background fill */}
                <circle r={r} fill={`${color}18`} stroke={color} strokeWidth="1.5" />

                {/* Mastery arc via clipPath trick: filled sector */}
                <defs>
                  <clipPath id={maskId}>
                    <circle r={r} />
                  </clipPath>
                </defs>
                {node.mastery > 0 && (() => {
                  const angle = (node.mastery / 100) * Math.PI * 2
                  const x2 = Math.sin(angle) * r
                  const y2 = -Math.cos(angle) * r
                  const largeArc = node.mastery > 50 ? 1 : 0
                  return (
                    <path
                      d={`M0,${-r} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L0,0 Z`}
                      fill={`${color}30`}
                      clipPath={`url(#${maskId})`}
                    />
                  )
                })()}

                {/* Mastery arc stroke */}
                {node.mastery > 0 && (() => {
                  const angle = (node.mastery / 100) * Math.PI * 2
                  const x2 = Math.sin(angle) * r
                  const y2 = -Math.cos(angle) * r
                  const largeArc = node.mastery > 50 ? 1 : 0
                  return (
                    <path
                      d={`M0,${-r} A${r},${r} 0 ${largeArc},1 ${x2},${y2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )
                })()}

                {/* Label */}
                <text
                  y={r + 9}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={active ? color : "rgba(255,255,255,0.45)"}
                >
                  {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
