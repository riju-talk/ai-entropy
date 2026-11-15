"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Network, Layers, GitBranch, Database } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { cn } from "@/lib/utils"

interface Discipline {
  name: string
  concepts: number
  avg_difficulty: number
  max_difficulty: number
  internal_links: number
  cross_links: number
  learner: { studied: number; mastered: number; avg_mastery: number }
}
interface Bridge { from: string; to: string; links: number }
interface DisciplinesPayload {
  disciplines: Discipline[]
  bridges: Bridge[]
  totals: { concepts: number; disciplines: number; relationships: number }
  source?: "neo4j" | "local"
}
interface GNode { id: string; label: string; mastery: number; domain: string; difficulty: number }
interface GEdge { from: string; to: string; strength: number }
interface GraphPayload { nodes: GNode[]; edges: GEdge[]; source?: string }

const masteryColor = (m: number) => (m >= 70 ? "#34d399" : m >= 40 ? "#f59e0b" : m > 0 ? "#f87171" : "hsl(var(--muted-foreground))")

export function KnowledgeAtlas() {
  const [disc, setDisc] = useState<DisciplinesPayload | null>(null)
  const [graph, setGraph] = useState<GraphPayload | null>(null)
  const [selected, setSelected] = useState<string>("")
  const [hover, setHover] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [d, g] = await Promise.all([
        fetch("/api/ai-agent/graph?action=disciplines").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`disciplines ${r.status}`)))),
        fetch("/api/ai-agent/graph?action=nodes").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`graph ${r.status}`)))),
      ])
      setDisc(d)
      setGraph(g)
      setSelected((cur) => cur || d.disciplines?.[0]?.name || "")
    } catch (e: any) {
      setError(e?.message || "Could not load the knowledge graph")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const current = disc?.disciplines.find((d) => d.name === selected)

  // Prerequisite map of the selected discipline: columns = difficulty (foundations on the left); concepts that
  // belong to other disciplines but touch this one are shown dimmed so the cross-discipline links are visible.
  const map = useMemo(() => {
    if (!graph || !selected) return null
    const inDomain = new Map(graph.nodes.filter((n) => n.domain === selected).map((n) => [n.id, n]))
    const edges = graph.edges.filter((e) => inDomain.has(e.from) || inDomain.has(e.to))
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    const nodes: (GNode & { foreign: boolean })[] = [...inDomain.values()].map((n) => ({ ...n, foreign: false }))
    for (const e of edges) {
      for (const id of [e.from, e.to]) {
        const n = byId.get(id)
        if (n && !inDomain.has(id) && !nodes.some((x) => x.id === id)) nodes.push({ ...n, foreign: true })
      }
    }
    const cols = new Map<number, typeof nodes>()
    for (const n of nodes) {
      const c = Math.min(Math.max(n.difficulty || 1, 1), 8)
      cols.set(c, [...(cols.get(c) || []), n])
    }
    const colKeys = [...cols.keys()].sort((a, b) => a - b)
    const COLW = 150, ROWH = 34, PAD = 24
    const pos = new Map<string, { x: number; y: number }>()
    let maxRows = 1
    colKeys.forEach((c, ci) => {
      const col = cols.get(c)!.sort((a, b) => Number(a.foreign) - Number(b.foreign) || a.label.localeCompare(b.label))
      maxRows = Math.max(maxRows, col.length)
      col.forEach((n, ri) => pos.set(n.id, { x: PAD + ci * COLW + 60, y: PAD + ri * ROWH }))
    })
    return {
      nodes, pos, edges: edges.filter((e) => pos.has(e.from) && pos.has(e.to)),
      width: PAD * 2 + colKeys.length * COLW, height: PAD * 2 + maxRows * ROWH, levels: colKeys,
    }
  }, [graph, selected])

  if (loading && !disc) {
    return <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }
  if (error || !disc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>{error || "No knowledge graph data"}</p>
        <button onClick={load} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-card">Retry</button>
      </div>
    )
  }

  const chartData = disc.disciplines.map((d) => ({ name: d.name, concepts: d.concepts, mastery: d.learner.avg_mastery }))
  const hasLearner = disc.disciplines.some((d) => d.learner.studied > 0)

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Knowledge Atlas</h2>
            <p className="text-xs text-muted-foreground">
              Every discipline the tutor knows, how deep each goes, and how they depend on each other.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground" title="Which store answered">
              <Database className="h-3 w-3" />{disc.source === "neo4j" ? "Neo4j AuraDB" : "Built-in map"}
            </span>
            <button onClick={load} className="rounded border border-border p-1.5 text-muted-foreground hover:bg-card" title="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Layers} label="Disciplines" value={disc.totals.disciplines} />
          <Stat icon={Network} label="Concepts" value={disc.totals.concepts} />
          <Stat icon={GitBranch} label="Relationships" value={disc.totals.relationships} />
          <Stat icon={GitBranch} label="Cross-discipline links" value={disc.bridges.reduce((a, b) => a + b.links, 0)} />
        </div>

        <section className="rounded border border-border bg-card p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Concepts per discipline</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {hasLearner ? "Bar colour shows your average mastery. Click a bar to open that discipline." : "Click a bar to open that discipline."}
          </p>
          <div style={{ height: Math.max(220, chartData.length * 22) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
                  formatter={(v: any, _n: any, p: any) => [`${v} concepts${hasLearner ? ` · ${p.payload.mastery}% mastery` : ""}`, p.payload.name]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="concepts" radius={[0, 3, 3, 0]} onClick={(d: any) => setSelected(d.name)} cursor="pointer">
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.name === selected ? "hsl(var(--primary))" : hasLearner ? masteryColor(d.mastery) : "hsl(var(--primary) / 0.45)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded border border-border bg-card p-4 lg:col-span-1">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Strongest bridges</h3>
            <ul className="space-y-2">
              {disc.bridges.slice(0, 10).map((b) => (
                <li key={`${b.from}-${b.to}`}>
                  <button onClick={() => setSelected(b.to)} className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-accent/40">
                    <span className="min-w-0 truncate text-foreground">{b.from} <span className="text-muted-foreground">→</span> {b.to}</span>
                    <span className="flex-shrink-0 text-muted-foreground">{b.links}</span>
                  </button>
                </li>
              ))}
              {disc.bridges.length === 0 && <li className="text-xs text-muted-foreground">No cross-discipline links yet.</li>}
            </ul>
          </section>

          <section className="rounded border border-border bg-card p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{selected || "Pick a discipline"}</h3>
              {current && (
                <p className="text-[11px] text-muted-foreground">
                  {current.concepts} concepts · depth {current.max_difficulty} · {current.internal_links} internal / {current.cross_links} cross links
                  {current.learner.studied > 0 && ` · you: ${current.learner.mastered}/${current.learner.studied} mastered`}
                </p>
              )}
            </div>
            {map && map.nodes.length > 0 ? (
              <div className="overflow-auto rounded border border-border bg-background">
                <svg width={map.width} height={map.height} role="img" aria-label={`Prerequisite map for ${selected}`}>
                  <defs>
                    <marker id="atlas-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--muted-foreground))" />
                    </marker>
                  </defs>
                  {map.levels.map((lv, i) => (
                    <text key={lv} x={24 + i * 150 + 60} y={12} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">LEVEL {lv}</text>
                  ))}
                  {map.edges.map((e, i) => {
                    const a = map.pos.get(e.from)!, b = map.pos.get(e.to)!
                    const active = hover && (hover === e.from || hover === e.to)
                    return (
                      <path
                        key={i}
                        d={`M${a.x + 55},${a.y + 14} C${a.x + 100},${a.y + 14} ${b.x - 100},${b.y + 14} ${b.x - 55},${b.y + 14}`}
                        fill="none" markerEnd="url(#atlas-arrow)"
                        stroke={active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                        strokeOpacity={hover ? (active ? 0.95 : 0.1) : 0.35} strokeWidth={active ? 1.6 : 1}
                      />
                    )
                  })}
                  {map.nodes.map((n) => {
                    const p = map.pos.get(n.id)!
                    return (
                      <g key={n.id} transform={`translate(${p.x - 55},${p.y})`} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover("")}
                         opacity={n.foreign ? 0.55 : 1} className={n.foreign ? "cursor-pointer" : ""}
                         onClick={() => n.foreign && setSelected(n.domain)}>
                        <title>{`${n.label} · ${n.domain || "general"} · level ${n.difficulty}${n.mastery ? ` · ${n.mastery}% mastery` : ""}`}</title>
                        <rect width={110} height={28} rx={5} fill="hsl(var(--card))" stroke={n.mastery ? masteryColor(n.mastery) : n.foreign ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"} strokeDasharray={n.foreign ? "3 3" : undefined} />
                        <text x={55} y={18} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))">{n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label}</text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No concepts in this discipline yet.</p>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">Arrows point from a prerequisite to what it unlocks. Dashed boxes belong to other disciplines; click one to jump there.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  )
}
