"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    BrainCircuit,
    Zap,
    Settings,
    FileText,
    Target,
    Clock,
    Cpu,
    Globe,
    Flame,
    ChevronRight,
    Plus,
    Network,
    Layers,
    Gauge,
    Award,
    Map,
    Microscope,
    FlaskConical,
    Radio,
    ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserDocuments } from "@/app/actions/documents"
import { DocumentList } from "./document-list"
import { DocumentUpload } from "./document-upload"
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts"

const masteryData = [
    { subject: "Calculus", value: 72, fullMark: 100 },
    { subject: "Algebra", value: 58, fullMark: 100 },
    { subject: "Physics", value: 64, fullMark: 100 },
    { subject: "AI/ML", value: 81, fullMark: 100 },
    { subject: "Programming", value: 89, fullMark: 100 },
]

const activeConcepts = [
    { name: "Chain Rule", mastery: 72, trend: "up", volatility: "low" },
    { name: "Derivatives", mastery: 64, trend: "up", volatility: "medium" },
    { name: "Limits", mastery: 51, trend: "stable", volatility: "high" },
    { name: "Recursion", mastery: 89, trend: "up", volatility: "low" },
    { name: "Big O Notation", mastery: 76, trend: "stable", volatility: "low" },
]

const cognitiveTimeline = [
    { time: "09:32", event: "Chain Rule attempt", detail: "partial", color: "yellow" },
    { time: "09:35", event: "Derivative correction", detail: "resolved", color: "cyan" },
    { time: "09:40", event: "Mastery +3%", detail: "Calculus", color: "green" },
    { time: "09:48", event: "Recursion explored", detail: "concept map", color: "purple" },
    { time: "09:55", event: "Exam sim started", detail: "AI/ML", color: "orange" },
]

function masteryColor(val: number) {
    if (val >= 80) return "bg-emerald-500"
    if (val >= 60) return "bg-cyan-500"
    if (val >= 40) return "bg-amber-500"
    return "bg-red-500"
}

function StatusDot({ color }: { color: "cyan" | "purple" | "green" }) {
    const dots: any = {
        cyan: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]",
        purple: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]",
        green: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
    }
    return <div className={cn("w-1 h-1 rounded-full animate-pulse", dots[color])} />
}

function PanelSeparator() {
    return <div className="w-px h-3 bg-white/10" />
}

interface NotebookLayoutProps {
    children: React.ReactNode
    activeTab: string
    onTabChange: (tab: string) => void
    selectedDocId?: string
    onDocSelect: (doc: any | null) => void
}

export function NotebookLayout({
    children,
    activeTab,
    onTabChange,
    selectedDocId,
    onDocSelect
}: NotebookLayoutProps) {
    const { data: session } = useSession()
    const [docCount, setDocCount] = useState(0)
    const [showHeatmap, setShowHeatmap] = useState(false)
    const [activeConceptsExpanded, setActiveConceptsExpanded] = useState(true)
    const [assetsExpanded, setAssetsExpanded] = useState(true)
    const examReadiness = 74
    const volatility = 38
    const cognitiveLoad = 62

    useEffect(() => {
        if (session?.user?.id) {
            getUserDocuments(session.user.id).then(res => {
                if (res.success) setDocCount(res.docs?.length || 0)
            })
        }
    }, [session?.user?.id])

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-[#0a0a0f] overflow-hidden font-mono">

            {/* ── LEFT PANEL: KNOWLEDGE MEMORY ── */}
            <div className="w-72 border-r border-white/[0.06] flex flex-col bg-[#0c0c14]">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-0.5">
                        <BrainCircuit className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Knowledge Memory</span>
                    </div>
                    <p className="text-[9px] text-white/20 tracking-wide">Cognitive loading layer active</p>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-4">

                        {/* Active Concepts */}
                        <div>
                            <button onClick={() => setActiveConceptsExpanded(v => !v)} className="w-full flex items-center gap-1.5 mb-2 group">
                                <ChevronRight className={cn("h-3 w-3 text-white/30 transition-transform", activeConceptsExpanded && "rotate-90")} />
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 group-hover:text-white/60">Active Concepts</span>
                                <span className="ml-auto text-[8px] text-cyan-400 font-bold">{activeConcepts.length}</span>
                            </button>
                            {activeConceptsExpanded && (
                                <div className="space-y-1">
                                    {activeConcepts.map((c) => (
                                        <ConceptRow key={c.name} concept={c} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mastery Heatmap Toggle */}
                        <button
                            onClick={() => setShowHeatmap(v => !v)}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
                                showHeatmap
                                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                                    : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/10"
                            )}
                        >
                            <Map className="h-3 w-3" />
                            Mastery Heatmap
                            <span className="ml-auto text-[8px]">{showHeatmap ? "ON" : "OFF"}</span>
                        </button>

                        {showHeatmap && (
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[9px] text-white/30 mb-2 uppercase tracking-widest">Domain Coverage</p>
                                {masteryData.map((d) => (
                                    <div key={d.subject} className="mb-1.5">
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[9px] text-white/50">{d.subject}</span>
                                            <span className="text-[9px] text-cyan-400 font-bold">{d.value}%</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full">
                                            <div className={cn("h-full rounded-full", masteryColor(d.value))} style={{ width: `${d.value}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Learning Assets */}
                        <div>
                            <button onClick={() => setAssetsExpanded(v => !v)} className="w-full flex items-center gap-1.5 mb-2 group">
                                <ChevronRight className={cn("h-3 w-3 text-white/30 transition-transform", assetsExpanded && "rotate-90")} />
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 group-hover:text-white/60">Learning Assets</span>
                            </button>
                            {assetsExpanded && (
                                <div className="space-y-1">
                                    <DocumentUpload userId={session?.user?.id} />
                                    <DocumentList userId={session?.user?.id} selectedDocId={selectedDocId} onSelect={onDocSelect} />
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="px-4 py-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] text-white/30 uppercase tracking-widest">Asset Storage</span>
                        <span className="text-[9px] font-bold text-cyan-400">{docCount}/10</span>
                    </div>
                    <div className="h-px w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000" style={{ width: `${Math.min((docCount / 10) * 100, 100)}%` }} />
                    </div>
                </div>
            </div>

            {/* ── CENTER PANEL: COGNITIVE ENGINE ── */}
            <div className="flex-1 flex flex-col bg-[#0a0a0f] bg-neural-grid relative border-r border-white/[0.06] min-w-0">
                <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.01] flex-shrink-0 overflow-x-auto">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Layers className="h-3 w-3 text-cyan-400" />
                        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">7-Layer Reasoning</span>
                        <StatusDot color="cyan" />
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Cpu className="h-3 w-3 text-purple-400" />
                        <span className="text-[9px] text-purple-400 uppercase tracking-widest">Hybrid Edge-Cloud</span>
                        <StatusDot color="purple" />
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Globe className="h-3 w-3 text-white/30" />
                        <span className="text-[9px] text-white/30 uppercase tracking-widest">Auto-Lang</span>
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ShieldCheck className="h-3 w-3 text-green-400" />
                        <span className="text-[9px] text-green-400 uppercase tracking-widest">Explainability ON</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 flex-shrink-0">
                        <Zap className="h-2.5 w-2.5 text-amber-400" />
                        <span className="text-[8px] font-bold text-amber-400">⚡ 17ms · INT8</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </div>

            {/* ── RIGHT PANEL: COGNITIVE STUDIO ── */}
            <div className="w-80 flex flex-col bg-cognitive-studio">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Microscope className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">Cognitive Studio</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white/20 hover:text-white/50">
                        <Settings className="h-3 w-3" />
                    </Button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">

                        {/* Mastery Radar */}
                        <StudioSection icon={Radio} label="Mastery Radar" color="purple">
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={masteryData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                                        <PolarGrid stroke="rgba(255,255,255,0.05)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: "monospace" }} />
                                        <Radar name="Mastery" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} strokeWidth={1.5} />
                                        <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 10 }} formatter={(v: any) => [`${v}%`, "Mastery"]} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </StudioSection>

                        {/* Exam Readiness */}
                        <StudioSection icon={Target} label="Exam Readiness Index" color="cyan">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-shrink-0">
                                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                                        <circle cx="32" cy="32" r="26" fill="none" stroke={examReadiness >= 70 ? "#22d3ee" : examReadiness >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="4" strokeDasharray={`${(examReadiness / 100) * 163.4} 163.4`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-bold text-white">{examReadiness}%</span>
                                    </div>
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <ReadinessRow label="Recall" val={81} />
                                    <ReadinessRow label="Reasoning" val={72} />
                                    <ReadinessRow label="Speed" val={65} />
                                    <ReadinessRow label="Accuracy" val={78} />
                                </div>
                            </div>
                        </StudioSection>

                        {/* Volatility + Cognitive Load */}
                        <div className="grid grid-cols-2 gap-2">
                            <MeterCard icon={Flame} label="Volatility" value={volatility} unit="%" color={volatility > 60 ? "red" : volatility > 35 ? "yellow" : "green"} tooltip="Concept instability" />
                            <MeterCard icon={Gauge} label="Cog. Load" value={cognitiveLoad} unit="%" color={cognitiveLoad > 75 ? "red" : cognitiveLoad > 50 ? "yellow" : "green"} tooltip="Working memory pressure" />
                        </div>

                        {/* Edge Acceleration */}
                        <StudioSection icon={Cpu} label="Edge Acceleration" color="amber">
                            <div className="space-y-1.5">
                                <EdgeRow label="Intent Classification" device="AMD NPU" ms={17} active />
                                <EdgeRow label="Concept Mapping" device="GPU" ms={42} active />
                                <EdgeRow label="NLI Validation" device="Cloud" ms={210} active={false} />
                                <EdgeRow label="Trust Scoring" device="AMD NPU" ms={8} active />
                            </div>
                        </StudioSection>

                        {/* Mastery Badges */}
                        <StudioSection icon={Award} label="Mastery Badges" color="violet">
                            <div className="flex flex-wrap gap-1.5">
                                <MasteryBadge label="Recursion" val={89} />
                                <MasteryBadge label="AI/ML" val={81} />
                                <MasteryBadge label="Chain Rule" val={72} unlocked={false} />
                                <MasteryBadge label="Limits" val={51} unlocked={false} />
                            </div>
                        </StudioSection>

                        {/* Cognitive Timeline */}
                        <StudioSection icon={Clock} label="Cognitive Timeline" color="slate">
                            <div className="space-y-2">
                                {cognitiveTimeline.map((item, i) => (
                                    <TimelineRow key={i} item={item} />
                                ))}
                            </div>
                        </StudioSection>

                    </div>
                </ScrollArea>

                <div className="p-3 border-t border-white/[0.06] space-y-2">
                    <button onClick={() => onTabChange("assessments")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all group">
                        <FlaskConical className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Simulate Exam</span>
                        <Zap className="ml-auto h-3 w-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button onClick={() => onTabChange("mindmap")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all group">
                        <Network className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60">Concept Graph</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

function ConceptRow({ concept }: { concept: typeof activeConcepts[0] }) {
    const volDot = concept.volatility === "high" ? "bg-red-400" : concept.volatility === "medium" ? "bg-amber-400" : "bg-emerald-400"
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group">
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", volDot)} />
            <span className="text-[10px] text-white/60 flex-1 truncate group-hover:text-white/80 transition-colors">{concept.name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", masteryColor(concept.mastery))} style={{ width: `${concept.mastery}%` }} />
                </div>
                <span className="text-[9px] font-bold text-white/40 w-7 text-right">{concept.mastery}%</span>
            </div>
        </div>
    )
}

function StudioSection({ icon: Icon, label, color, children }: any) {
    const colors: any = {
        purple: "text-purple-400", cyan: "text-cyan-400", amber: "text-amber-400",
        violet: "text-violet-400", slate: "text-white/30",
    }
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", colors[color])} />
                <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em]", colors[color])}>{label}</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">{children}</div>
        </div>
    )
}

function ReadinessRow({ label, val }: { label: string; val: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[8px] text-white/30 w-14 uppercase tracking-wide flex-shrink-0">{label}</span>
            <div className="flex-1 h-px bg-white/5 rounded-full overflow-hidden">
                <div className={cn("h-full", masteryColor(val))} style={{ width: `${val}%` }} />
            </div>
            <span className="text-[8px] text-white/40 w-5 text-right">{val}</span>
        </div>
    )
}

function MeterCard({ icon: Icon, label, value, unit, color, tooltip }: any) {
    const colors: any = {
        green: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", bar: "bg-emerald-500" },
        yellow: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400", bar: "bg-amber-500" },
        red: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400", bar: "bg-red-500" },
    }
    const c = colors[color]
    return (
        <div className={cn("rounded-xl border p-3 space-y-2", c.bg, c.border)} title={tooltip}>
            <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", c.text)} />
                <span className={cn("text-[8px] font-bold uppercase tracking-widest", c.text)}>{label}</span>
            </div>
            <div className="text-lg font-bold text-white">{value}<span className="text-[10px] text-white/30 ml-0.5">{unit}</span></div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", c.bar)} style={{ width: `${value}%` }} />
            </div>
        </div>
    )
}

function EdgeRow({ label, device, ms, active }: { label: string; device: string; ms: number; active: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", active ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-white/10")} />
            <span className="text-[9px] text-white/40 flex-1 truncate">{label}</span>
            <span className="text-[8px] text-amber-400 font-bold">{device}</span>
            <span className="text-[8px] text-white/20 w-8 text-right">{ms}ms</span>
        </div>
    )
}

function MasteryBadge({ label, val, unlocked = true }: { label: string; val: number; unlocked?: boolean }) {
    return (
        <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full border text-[8px] font-bold",
            unlocked ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "bg-white/[0.02] border-white/[0.06] text-white/20"
        )}>
            <Award className="h-2.5 w-2.5" />
            <span>{label}</span>
            <span className={unlocked ? "text-violet-400" : "text-white/20"}>{val}%</span>
        </div>
    )
}

function TimelineRow({ item }: { item: typeof cognitiveTimeline[0] }) {
    const colors: any = {
        cyan: "bg-cyan-400", green: "bg-emerald-400", yellow: "bg-amber-400",
        purple: "bg-purple-400", orange: "bg-orange-400",
    }
    return (
        <div className="flex items-start gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0", colors[item.color])} />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[8px] text-white/20 font-mono flex-shrink-0">{item.time}</span>
                    <span className="text-[9px] text-white/50 truncate">{item.event}</span>
                </div>
                <span className="text-[8px] text-white/20">{item.detail}</span>
            </div>
        </div>
    )
}
