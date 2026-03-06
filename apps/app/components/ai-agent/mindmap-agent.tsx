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
  { value: "mindmap",  label: "Mind Map",        color: "text-purple-400" },
  { value: "flowchart", label: "Flowchart",       color: "text-cyan-400" },
  { value: "er",       label: "ER Diagram",       color: "text-amber-400" },
  { value: "sequence", label: "Sequence Diagram", color: "text-green-400" },
  { value: "class",    label: "Class Diagram",    color: "text-blue-400" },
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
    <div className="h-full flex flex-col font-mono bg-[#0a0a0f] overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.01] flex-shrink-0">
        <Network className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">Concept Graph Generator</span>
        <div className="ml-auto flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 rounded px-2 py-0.5">
          <Zap className="h-2.5 w-2.5 text-purple-400" />
          <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Mermaid Engine</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Config sidebar ──────────────────────────────── */}
        <div className="w-64 border-r border-white/[0.06] flex flex-col bg-[#0c0c14] flex-shrink-0">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">

            {/* Topic input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">// TOPIC</label>
              <textarea
                rows={3}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Gradient Descent, Neural Networks…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all"
              />
            </div>

            {/* Diagram type */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">// DIAGRAM TYPE</label>
              <div className="space-y-1">
                {DIAGRAM_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    onClick={() => setDiagramType(dt.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] border transition-all text-left",
                      diagramType === dt.value
                        ? "bg-purple-500/10 border-purple-500/30 text-white"
                        : "bg-white/[0.01] border-white/[0.05] text-white/35 hover:text-white/60 hover:border-white/10"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", diagramType === dt.value ? "bg-purple-400" : "bg-white/15")} />
                    <span className={diagramType === dt.value ? dt.color : ""}>{dt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Depth */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">// DEPTH</label>
                <span className="text-[9px] font-bold text-purple-400">{depth}</span>
              </div>
              <input
                type="range" min={1} max={5} value={depth}
                onChange={e => setDepth(Number(e.target.value))}
                className="w-full accent-purple-500 h-1"
              />
              <div className="flex justify-between text-[8px] text-white/20">
                <span>Shallow</span><span>Deep</span>
              </div>
            </div>

            {/* Custom instructions */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">// INSTRUCTIONS</label>
              <textarea
                rows={2}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Optional custom instructions…"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-purple-500/40 transition-all"
              />
            </div>
          </div>

          {/* Generate button */}
          <div className="p-4 border-t border-white/[0.06]">
            <button
              onClick={generateDiagram}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 hover:from-purple-500/30 hover:to-indigo-500/30 hover:border-purple-500/70 text-[11px] font-bold uppercase tracking-widest text-purple-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(168,85,247,0.1)]"
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
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex-shrink-0">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
              <button
                onClick={() => setActiveView("preview")}
                className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all",
                  activeView === "preview" ? "bg-purple-500/15 text-purple-400" : "text-white/30 hover:text-white/50"
                )}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveView("source")}
                className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all border-l border-white/[0.08]",
                  activeView === "source" ? "bg-purple-500/15 text-purple-400" : "text-white/30 hover:text-white/50"
                )}
              >
                Source
              </button>
            </div>

            <div className="flex-1" />

            {/* Zoom controls (preview only) */}
            {activeView === "preview" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded border border-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                  <ZoomOut className="h-3 w-3" />
                </button>
                <span className="text-[9px] text-white/30 w-8 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded border border-white/[0.08] text-white/30 hover:text-white/60 transition-colors">
                  <ZoomIn className="h-3 w-3" />
                </button>
                <button onClick={() => setZoom(1)} className="px-2 h-6 text-[8px] uppercase tracking-widest border border-white/[0.08] rounded text-white/30 hover:text-white/60 transition-colors">
                  1:1
                </button>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <button onClick={() => mermaidCode && copyToClipboard(mermaidCode, "Mermaid source copied")} title="Copy source" className="w-6 h-6 flex items-center justify-center rounded border border-white/[0.08] text-white/30 hover:text-purple-400 transition-colors">
                <Copy className="h-3 w-3" />
              </button>
              <button onClick={handleExportCSV} title="Export CSV" className="w-6 h-6 flex items-center justify-center rounded border border-white/[0.08] text-white/30 hover:text-purple-400 transition-colors">
                <FileText className="h-3 w-3" />
              </button>
              <button onClick={handleDownloadSVG} title="Download SVG" className="w-6 h-6 flex items-center justify-center rounded border border-white/[0.08] text-white/30 hover:text-purple-400 transition-colors">
                <Download className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Canvas body */}
          <div className="flex-1 overflow-auto bg-[#08080f] relative">
            {activeView === "preview" ? (
              renderedSvg ? (
                <div
                  className="min-h-full flex items-center justify-center p-6"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center top" }}
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Network className="h-7 w-7 text-purple-400/50" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">No graph yet</p>
                    <p className="text-[10px] text-white/15 mt-1">Enter a topic and click Generate</p>
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 text-purple-400/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-[10px] uppercase tracking-widest">Reasoning…</span>
                    </div>
                  )}
                </div>
              )
            ) : (
              mermaidCode ? (
                <pre className="p-6 text-[11px] font-mono text-purple-300/70 whitespace-pre leading-relaxed">
                  {mermaidCode}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest">No source code yet</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

