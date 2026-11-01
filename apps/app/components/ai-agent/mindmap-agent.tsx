// Full rewritten MindMapAgent component with dark terminal UI

"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import mermaid from "mermaid"
import {
  Loader2, RefreshCw, ZoomIn, ZoomOut, Download, Copy,
  FileText, Network, ChevronDown, Layers, Cpu, Zap,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const DIAGRAM_TYPES = [
  { value: "mindmap",  label: "Mind Map",        color: "text-primary" },
  { value: "flowchart", label: "Flowchart",       color: "text-primary" },
  { value: "er",       label: "ER Diagram",       color: "text-warning" },
  { value: "sequence", label: "Sequence Diagram", color: "text-success" },
  { value: "class",    label: "Class Diagram",    color: "text-primary" },
]

interface MindMapAgentProps {
  contextDoc?: { id: string; title: string } | null
}

export function MindMapAgent({ contextDoc }: MindMapAgentProps) {
  const { data: session } = useSession()
  const [topic, setTopic] = useState(contextDoc?.title || "")
  const [diagramType, setDiagramType] = useState("mindmap")
  const [depth, setDepth] = useState(3)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [mermaidCode, setMermaidCode] = useState<string>("")
  const [renderedSvg, setRenderedSvg] = useState<string>("")
  const [zoom, setZoom] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<"preview" | "source">("preview")
  const { toast } = useToast()

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" })
  }, [])

  useEffect(() => {
    if (contextDoc?.title) setTopic(contextDoc.title)
  }, [contextDoc])

  useEffect(() => {
    if (!mermaidCode) return
    const render = async () => {
      try {
        const { svg } = await mermaid.render("generatedDiagram", mermaidCode)
        setRenderedSvg(svg)
      } catch (err) {
        console.error("Mermaid render error:", err)
        setRenderedSvg("")
      }
    }
    render()
  }, [mermaidCode])

  // ── helpers ──────────────────────────────────────────────
  const copyToClipboard = async (text: string, msg = "Copied") => {
    try { await navigator.clipboard.writeText(text); toast({ title: msg }) }
    catch { toast({ title: "Clipboard failed", variant: "destructive" }) }
  }

  const parseMermaidToCSV = (code: string) => {
    if (!code) return ""
    const lines = code.split(/\r?\n/).map(l => l.replace(/```/g, "").trim()).filter(l => l && !/^mindmap/i.test(l))
    const rows: string[] = []
    const stack: string[] = []
    for (const raw of lines) {
      const level = Math.max(0, Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2))
      let label = raw
      const m = raw.match(/\(\((.*?)\)\)/)
      if (m) label = m[1]
      else label = raw.replace(/-->|->|<-|\[|\]|\(|\)|:/g, "").replace(/^\w+\s+/, "").trim()
      stack[level] = label; stack.length = level + 1
      const parent = level > 0 ? stack[level - 1] : ""
      rows.push([parent, label, String(level)].map(v => `"${v.replace(/"/g, '""')}"`).join(","))
    }
    return ["parent,child,level", ...rows].join("\n")
  }

  const handleExportCSV = async () => {
    if (!mermaidCode) return toast({ title: "No code", variant: "destructive" })
    const csv = parseMermaidToCSV(mermaidCode)
    await copyToClipboard(csv, "CSV copied")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${(topic || "diagram").replace(/\s+/g, "_")}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  const handleDownloadSVG = () => {
    if (!renderedSvg) return toast({ title: "No SVG", variant: "destructive" })
    const blob = new Blob([renderedSvg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${(topic || "diagram").replace(/\s+/g, "_")}.svg`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    toast({ title: "SVG downloaded" })
  }

  const generateDiagram = async () => {
    if (!topic.trim()) return toast({ title: "Enter a topic first", variant: "destructive" })
    setLoading(true)
    try {
      const res = await fetch("/api/ai-agent/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          diagram_type: diagramType,
          detail_level: depth,
          systemPrompt,
          collection_name: contextDoc?.id ?? "default",
          userId: session?.user?.id ?? "anonymous",
        }),
      })
      const data = await res.json()
      if (!data.mermaid_code) throw new Error("No mermaid_code returned")
      setMermaidCode(data.mermaid_code)
      setActiveView("preview")
      toast({ title: "Diagram generated" })
    } catch {
      toast({ title: "Generation failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = DIAGRAM_TYPES.find(d => d.value === diagramType)

  return (
    <div className="h-full flex flex-col font-mono bg-background overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card flex-shrink-0">
        <Network className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Concept Graph Generator</span>
        <div className="ml-auto flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
          <Zap className="h-2.5 w-2.5 text-primary" />
          <span className="text-[8px] font-bold text-primary uppercase tracking-widest">Mermaid Engine</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Config sidebar ──────────────────────────────── */}
        <div className="w-64 border-r border-border flex flex-col bg-background flex-shrink-0">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">

            {/* Topic input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"></label>
              <textarea
                rows={3}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Gradient Descent, Neural Networks…"
                className="w-full bg-card border border-border rounded px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/40 focus:bg-accent transition-all"
              />
            </div>

            {/* Diagram type */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Diagram type</label>
              <div className="space-y-1">
                {DIAGRAM_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    onClick={() => setDiagramType(dt.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded text-[10px] border transition-all text-left",
                      diagramType === dt.value
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", diagramType === dt.value ? "bg-primary" : "bg-accent")} />
                    <span className={diagramType === dt.value ? dt.color : ""}>{dt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Depth */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"></label>
                <span className="text-[9px] font-bold text-primary">{depth}</span>
              </div>
              <input
                type="range" min={1} max={5} value={depth}
                onChange={e => setDepth(Number(e.target.value))}
                className="w-full accent-primary h-1"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground">
                <span>Shallow</span><span>Deep</span>
              </div>
            </div>

            {/* Custom instructions */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"></label>
              <textarea
                rows={2}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Optional custom instructions…"
                className="w-full bg-card border border-border rounded px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/40 transition-all"
              />
            </div>
          </div>

          {/* Generate button */}
          <div className="p-4 border-t border-border">
            <button
              onClick={generateDiagram}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-primary/40 hover:border-primary/70 text-[11px] font-bold uppercase tracking-widest text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                : <><RefreshCw className="h-3.5 w-3.5" /> Generate</>
              }
            </button>
          </div>
        </div>

        {/* ── Main canvas ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Canvas toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0">
            {/* View toggle */}
            <div className="flex rounded overflow-hidden border border-border">
              <button
                onClick={() => setActiveView("preview")}
                className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all",
                  activeView === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveView("source")}
                className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all border-l border-border",
                  activeView === "source" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                Source
              </button>
            </div>

            <div className="flex-1" />

            {/* Zoom controls (preview only) */}
            {activeView === "preview" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
                  <ZoomOut className="h-3 w-3" />
                </button>
                <span className="text-[9px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
                  <ZoomIn className="h-3 w-3" />
                </button>
                <button onClick={() => setZoom(1)} className="px-2 h-6 text-[8px] uppercase tracking-widest border border-border rounded text-muted-foreground hover:text-foreground transition-colors">
                  1:1
                </button>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <button onClick={() => mermaidCode && copyToClipboard(mermaidCode, "Mermaid source copied")} title="Copy source" className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary transition-colors">
                <Copy className="h-3 w-3" />
              </button>
              <button onClick={handleExportCSV} title="Export CSV" className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary transition-colors">
                <FileText className="h-3 w-3" />
              </button>
              <button onClick={handleDownloadSVG} title="Download SVG" className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary transition-colors">
                <Download className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Canvas body */}
          <div className="flex-1 overflow-auto bg-background relative">
            {activeView === "preview" ? (
              renderedSvg ? (
                <div
                  className="min-h-full flex items-center justify-center p-6"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center top" }}
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="w-16 h-16 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Network className="h-7 w-7 text-primary/50" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">No graph yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Enter a topic and click Generate</p>
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 text-primary/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-[10px] uppercase tracking-widest">Reasoning…</span>
                    </div>
                  )}
                </div>
              )
            ) : (
              mermaidCode ? (
                <pre className="p-6 text-[11px] font-mono text-primary/70 whitespace-pre leading-relaxed">
                  {mermaidCode}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">No source code yet</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

