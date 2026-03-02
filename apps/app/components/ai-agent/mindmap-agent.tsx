// Full rewritten MindMapAgent component with improved UI/UX

"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import mermaid from "mermaid"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select"
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Download, Copy, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MindMapAgentProps {
  contextDoc?: { id: string, title: string } | null
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
  const { toast } = useToast()

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" })
  }, [])

  useEffect(() => {
    if (contextDoc?.title) {
      setTopic(contextDoc.title)
    }
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

  const copyToClipboard = async (text: string, successMsg = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: successMsg })
    } catch (err) {
      toast({ title: "Clipboard failed", variant: "destructive" })
    }
  }

  const parseMermaidToCSV = (code: string) => {
    if (!code) return ""
    const lines = code
      .split(/\r?\n/)
      .map((l) => l.replace(/```/g, "").replace(/^\s+|\s+$/g, ""))
      .filter((l) => l && !/^mindmap/i.test(l))

    const rows: string[] = []
    const stack: string[] = []

    for (const raw of lines) {
      const leading = raw.match(/^\s*/)?.[0].length ?? 0
      const level = Math.max(0, Math.floor(leading / 2))
      let label = raw
      const m = raw.match(/\(\((.*?)\)\)/)
      if (m) label = m[1]
      else label = raw.replace(/-->|->|<-|\[|\]|\(|\)|:/g, "").replace(/^\w+\s+/, "").trim()
      stack[level] = label
      stack.length = level + 1
      const parent = level > 0 ? stack[level - 1] : ""
      rows.push([parent, label, String(level)].map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    }

    return ["parent,child,level", ...rows].join("\n")
  }

  const handleCopyMermaid = () => mermaidCode ? copyToClipboard(mermaidCode, "Mermaid source copied") : toast({ title: "No code", variant: "destructive" })
  const handleExportCSV = async () => {
    if (!mermaidCode) return toast({ title: "No code", variant: "destructive" })
    const csv = parseMermaidToCSV(mermaidCode)
    await copyToClipboard(csv, "CSV copied")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(topic || "diagram").replace(/\s+/g, "_")}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleDownloadSVG = () => {
    if (!renderedSvg) return toast({ title: "No SVG", variant: "destructive" })
    try {
      const blob = new Blob([renderedSvg], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(topic || "diagram").replace(/\s+/g, "_")}.svg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: "SVG downloaded" })
    } catch (err) {
      toast({ title: "Download failed", variant: "destructive" })
    }
  }

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))
  const zoomOut = () => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))
  const resetZoom = () => setZoom(1)

  const generateDiagram = async () => {
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
          collection_name: contextDoc?.id ? contextDoc.id : "default",
          userId: session?.user?.id || "anonymous"
        })
      })
      const data = await res.json()
      if (!data.mermaid_code) throw new Error("No mermaid_code returned")
      setMermaidCode(data.mermaid_code)
      toast({ title: "Diagram generated" })
    } catch {
      toast({ title: "Generation failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <RefreshCw className={`h-5 w-5 text-purple-400 ${loading ? "animate-spin" : ""}`} />
          AI Diagram Generator
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Topic</Label>
          <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Diagram Type</Label>
            <Select value={diagramType} onValueChange={setDiagramType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mindmap">Mindmap</SelectItem>
                <SelectItem value="flowchart">Flowchart</SelectItem>
                <SelectItem value="er">ER Diagram</SelectItem>
                <SelectItem value="sequence">Sequence Diagram</SelectItem>
                <SelectItem value="class">Class Diagram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Depth</Label>
            <Select value={String(depth)} onValueChange={(v: string) => setDepth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Custom Instructions</Label>
            <Textarea rows={1} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          </div>
        </div>

        <Button
          onClick={generateDiagram}
          disabled={loading}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Generate Diagram
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card className="flex flex-col border-border/50 bg-background/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/10">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Diagram Preview</CardTitle>
            </CardHeader>

            <CardContent className="relative p-0 flex-1">

              {/* Floating buttons */}
              <div className="absolute top-2 right-2 flex gap-2 z-20">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyMermaid}
                  className="h-8"
                  title="Copy Mermaid source"
                  aria-label="Copy Mermaid source"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="h-8"
                  title="Export as CSV"
                  aria-label="Export as CSV"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadSVG}
                  className="h-8"
                  title="Download SVG"
                  aria-label="Download SVG"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Scrollable Diagram */}
              <div className="h-80 overflow-auto p-4 bg-muted/20 dark:bg-slate-900/50">
                {renderedSvg ? (
                  <div
                    className="flex items-center justify-center min-h-full"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No diagram generated yet</div>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-2 left-2 flex gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-md z-20">
                <Button size="sm" variant="outline" onClick={zoomOut} className="h-8 w-8 p-0"><ZoomOut className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={resetZoom} className="h-8 text-xs">Reset</Button>
                <Button size="sm" variant="outline" onClick={zoomIn} className="h-8 w-8 p-0"><ZoomIn className="h-4 w-4" /></Button>
              </div>

            </CardContent>
          </Card>

          <Card className="flex flex-col border-border/50 bg-background/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/10">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mermaid Source Code</CardTitle>
            </CardHeader>

            <CardContent className="p-0 flex-1">
              <div className="h-80 overflow-auto bg-muted/20 dark:bg-slate-900/50">
                {mermaidCode ? (
                  <pre className="p-4 text-[10px] font-mono whitespace-pre text-muted-foreground">{mermaidCode}</pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">No code available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
