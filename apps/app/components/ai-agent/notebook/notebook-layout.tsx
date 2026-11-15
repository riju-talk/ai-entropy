"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    BrainCircuit,
    Zap,
    Settings,
    FileText,
    Target,
    Cpu,
    Globe,
    Flame,
    ChevronRight,
    Plus,
    Network,
    Layers,
    Gauge,
    Map,
    Microscope,
    FlaskConical,
    Radio,
    ShieldCheck,
    RefreshCw,
    Trash2,
    Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserDocuments } from "@/app/actions/documents"
import { getCognitiveProfile, type CognitiveProfile, type ConceptRecord } from "@/app/actions/cognitive"
import { DocumentList } from "./document-list"
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts"

// ── helpers ────────────────────────────────────────────────

function conceptsToRadarData(concepts: ConceptRecord[]) {
    if (!concepts.length) return [
        { subject: "No Data", value: 0, fullMark: 100 },
    ]
    // Use top-5 concepts by mastery as radar axes
    const top5 = [...concepts]
        .sort((a, b) => b.mastery_score - a.mastery_score)
        .slice(0, 5)
    return top5.map(c => ({
        subject: c.concept.length > 12 ? c.concept.slice(0, 11) + "…" : c.concept,
        value: Math.round(c.mastery_score * 100),
        fullMark: 100,
    }))
}

function conceptsToActiveList(concepts: ConceptRecord[], weakSet: Set<string>, limit = 5) {
    return [...concepts]
        .sort((a, b) => b.mastery_score - a.mastery_score)
        .slice(0, limit)
        .map(c => {
            const pct = Math.round(c.mastery_score * 100)
            const vol = weakSet.has(c.concept) ? "high"
                : c.confidence_weight < 0.7 ? "medium"
                : "low"
            const trend = c.correct_attempts > c.total_attempts / 2 ? "up" : "stable"
            return { name: c.concept, mastery: pct, trend, volatility: vol }
        })
}


function masteryColor(val: number) {
    if (val >= 80) return "bg-success"
    if (val >= 60) return "bg-primary"
    if (val >= 40) return "bg-warning"
    return "bg-destructive"
}

function StatusDot({ color }: { color: "cyan" | "purple" | "green" }) {
    const dots: any = {
        cyan: "bg-primary",
        purple: "bg-primary",
        green: "bg-success",
    }
    return <div className={cn("w-1 h-1 rounded-full animate-pulse", dots[color])} />
}

function PanelSeparator() {
    return <div className="w-px h-3 bg-accent" />
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
    const [docRefreshKey, setDocRefreshKey] = useState(0)
    const [showHeatmap, setShowHeatmap] = useState(false)
    const [activeConceptsExpanded, setActiveConceptsExpanded] = useState(true)
    const [assetsExpanded, setAssetsExpanded] = useState(true)
    const [studioMode, setStudioMode] = useState<"learning" | "assessment" | "graphing">("learning")

    // ── Live cognitive data ──────────────────────────────
    const [profile, setProfile] = useState<CognitiveProfile | null>(null)
    const [profileLoading, setProfileLoading] = useState(false)
    const [deletingConcept, setDeletingConcept] = useState<string | null>(null)

    const fetchProfile = useCallback(async () => {
        if (!session?.user?.id) return
        setProfileLoading(true)
        const res = await getCognitiveProfile(session.user.id)
        if (res.success && res.data) setProfile(res.data)
        setProfileLoading(false)
    }, [session?.user?.id])

    useEffect(() => {
        if (session?.user?.id) {
            getUserDocuments(session.user.id).then(res => {
                if (res.success) setDocCount(res.docs?.length || 0)
            })
            fetchProfile()
        }
    }, [session?.user?.id, fetchProfile])

    // Sync docCount from backend profile
    useEffect(() => {
        if (profile) setDocCount(profile.doc_count)
    }, [profile])

    const handleDeleteConcept = useCallback(async (conceptName: string) => {
        if (!session?.user?.id) return
        setDeletingConcept(conceptName)
        try {
            await fetch(
                `/api/ai-agent/mastery?user_id=${encodeURIComponent(session.user.id)}&concept=${encodeURIComponent(conceptName)}`,
                { method: "DELETE" }
            )
            await fetchProfile()
            window.dispatchEvent(new CustomEvent("mastery-updated"))
        } finally {
            setDeletingConcept(null)
        }
    }, [session?.user?.id, fetchProfile])

    // ── Real-time Cognitive Studio refresh ──────────────────────────────
    // Polls every 10 s; also fires on 'mastery-updated' browser events
    // that ChatAgent dispatches after each successful AI response.
    useEffect(() => {
        if (!session?.user?.id) return
        const iv = setInterval(fetchProfile, 10_000)
        const onUpdate = () => fetchProfile()
        window.addEventListener("mastery-updated", onUpdate)
        return () => {
            clearInterval(iv)
            window.removeEventListener("mastery-updated", onUpdate)
        }
    }, [session?.user?.id, fetchProfile])

    // ── Derived display values ───────────────────────────
    const masteryData = profile ? conceptsToRadarData(profile.concepts) : []
    const weakSet = new Set(profile?.weak_concepts ?? [])
    const activeConcepts = profile ? conceptsToActiveList(profile.concepts, weakSet) : []
    const allConcepts = profile ? conceptsToActiveList(profile.concepts, weakSet, 100) : []
    const examReadiness = profile?.exam_readiness ?? 0
    const volatility = profile?.volatility ?? 0
    const cognitiveLoad = profile?.cognitive_load ?? 0
    const recall = profile?.recall ?? 0
    const reasoning = profile?.reasoning ?? 0
    const speed = profile?.speed ?? 0
    const accuracy = profile?.accuracy ?? 0
    // NOTE: split from `(?? 0) > 0` — SWC TSX parser misreads `>` as JSX
    const conceptLen = profile?.concepts?.length ?? 0
    const hasData = conceptLen > 0

    return (
        <div className="flex h-full bg-background overflow-hidden font-mono">

            {/* ── LEFT PANEL: KNOWLEDGE MEMORY ── */}
            <div className="w-60 shrink-0 border-r border-border flex flex-col bg-background overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 mb-0.5">
                        <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Knowledge Memory</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground tracking-wide">Cognitive loading layer active</p>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
                    <div className="p-3 space-y-4 w-full min-w-0">

                        {/* Active Concepts */}
                        <div>
                            <button onClick={() => setActiveConceptsExpanded(v => !v)} className="w-full flex items-center gap-1.5 mb-2 group">
                                <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", activeConceptsExpanded && "rotate-90")} />
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground">Active Concepts</span>
                                <span className="ml-auto text-[8px] text-primary font-bold">
                                    {profileLoading ? "…" : activeConcepts.length}
                                </span>
                            </button>
                            {activeConceptsExpanded && (
                                <div className="space-y-1">
                                    {activeConcepts.length > 0
                                        ? activeConcepts.map((c) => <ConceptRow key={c.name} concept={c} />)
                                        : <p className="text-[9px] text-muted-foreground text-center py-2">No concepts tracked yet</p>
                                    }
                                </div>
                            )}
                        </div>

                        {/* Mastery Heatmap Toggle */}
                        <button
                            onClick={() => setShowHeatmap(v => !v)}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 rounded border text-[10px] font-bold uppercase tracking-widest transition-all",
                                showHeatmap
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-card border-border text-muted-foreground hover:text-muted-foreground hover:border-border"
                            )}
                        >
                            <Map className="h-3 w-3" />
                            Mastery Heatmap
                            <span className="ml-auto text-[8px]">{showHeatmap ? "ON" : "OFF"}</span>
                        </button>

                        {showHeatmap && (
                            <div className="rounded border border-border bg-card p-3">
                                <p className="text-[9px] text-muted-foreground mb-2 uppercase tracking-widest">Domain Coverage</p>
                                {masteryData.length > 0
                                    ? masteryData.map((d) => (
                                        <div key={d.subject} className="mb-1.5">
                                            <div className="flex justify-between mb-0.5">
                                                <span className="text-[9px] text-muted-foreground">{d.subject}</span>
                                                <span className="text-[9px] text-primary font-bold">{d.value}%</span>
                                            </div>
                                            <div className="h-1 bg-accent rounded-full">
                                                <div className={cn("h-full rounded-full", masteryColor(d.value))} style={{ width: `${d.value}%` }} />
                                            </div>
                                        </div>
                                    ))
                                    : <p className="text-[9px] text-muted-foreground text-center py-1">Ask questions to build your heatmap</p>
                                }
                            </div>
                        )}

                        {/* Learning Assets */}
                        <div>
                            <button onClick={() => setAssetsExpanded(v => !v)} className="w-full flex items-center gap-1.5 mb-2 group">
                                <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", assetsExpanded && "rotate-90")} />
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground">Learning Assets</span>
                            </button>
                            {assetsExpanded && (
                                <div className="min-w-0 overflow-hidden">
                                    <DocumentList userId={session?.user?.id} selectedDocId={selectedDocId} onSelect={onDocSelect} refreshKey={docRefreshKey} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 border-t border-border">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Asset Storage</span>
                        <span className="text-[9px] font-bold text-primary">{docCount}/10</span>
                    </div>
                    <div className="h-px w-full bg-accent rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-1000" style={{ width: `${Math.min((docCount / 10) * 100, 100)}%` }} />
                    </div>
                </div>
            </div>

            {/* ── CENTER PANEL: COGNITIVE ENGINE ── */}
            <div className="flex-1 flex flex-col bg-background bg-neural-grid relative border-r border-border min-w-0">
                <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card flex-shrink-0 overflow-x-auto">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Layers className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-bold text-primary uppercase tracking-widest">7-Layer Reasoning</span>
                        <StatusDot color="cyan" />
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Cpu className="h-3 w-3 text-primary" />
                        <span className="text-[9px] text-primary uppercase tracking-widest">Hybrid Edge-Cloud</span>
                        <StatusDot color="purple" />
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Auto-Lang</span>
                    </div>
                    <PanelSeparator />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ShieldCheck className="h-3 w-3 text-success" />
                        <span className="text-[9px] text-success uppercase tracking-widest">Explainability ON</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 bg-warning/10 border border-warning/20 rounded px-2 py-0.5 flex-shrink-0">
                        <Zap className="h-2.5 w-2.5 text-warning" />
                        <span className="text-[8px] font-bold text-warning">⚡ 17ms · INT8</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </div>

            {/* ── RIGHT PANEL: COGNITIVE STUDIO ── */}
            <div className="w-72 shrink-0 flex flex-col bg-background overflow-hidden border-l border-border">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Microscope className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Cognitive Studio</span>
                    </div>
                    <button
                        onClick={fetchProfile}
                        disabled={profileLoading}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-muted-foreground transition-colors rounded"
                        title="Refresh cognitive data"
                    >
                        <RefreshCw className={cn("h-3 w-3", profileLoading && "animate-spin")} />
                    </button>
                </div>

                {/* ── Mode Tabs ── */}
                <div className="flex border-b border-border flex-shrink-0">
                    <ModeTab icon={BrainCircuit} label="Learning" active={studioMode === "learning"} onClick={() => setStudioMode("learning")} activeColor="cyan" />
                    <ModeTab icon={FlaskConical} label="Assess" active={studioMode === "assessment"} onClick={() => setStudioMode("assessment")} activeColor="amber" />
                    <ModeTab icon={Network} label="Graphing" active={studioMode === "graphing"} onClick={() => setStudioMode("graphing")} activeColor="purple" />
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">

                        {/* ── Learning Mode ── */}
                        {studioMode === "learning" && (
                            <>
                                <StudioSection icon={Radio} label="Mastery Radar" color="purple">
                                    {hasData ? (
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart data={masteryData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                                                    <PolarGrid stroke="hsl(var(--foreground) / 0.20)" />
                                                    <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground) / 0.68)", fontSize: 9, fontFamily: "monospace" }} />
                                                    <Radar name="Mastery" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} strokeWidth={1.5} />
                                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.25)", borderRadius: 8, fontSize: 10 }} formatter={(v: any) => [`${v}%`, "Mastery"]} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-44 flex items-center justify-center">
                                            <p className="text-[9px] text-muted-foreground text-center">Start asking questions<br/>to build your radar</p>
                                        </div>
                                    )}
                                </StudioSection>
                                <div className="grid grid-cols-2 gap-2">
                                    <MeterCard icon={Flame} label="Volatility" value={volatility} unit="%" color={volatility > 60 ? "red" : volatility > 35 ? "yellow" : "green"} tooltip="Concept instability" />
                                    <MeterCard icon={Gauge} label="Cog. Load" value={cognitiveLoad} unit="%" color={cognitiveLoad > 75 ? "red" : cognitiveLoad > 50 ? "yellow" : "green"} tooltip="Working memory pressure" />
                                </div>
                                <StudioSection icon={Cpu} label="Edge Acceleration" color="amber">
                                    <div className="space-y-1.5">
                                        <EdgeRow label="Intent Classification" device="AMD NPU" ms={17} active />
                                        <EdgeRow label="Concept Mapping" device="GPU" ms={42} active />
                                        <EdgeRow label="NLI Validation" device="Cloud" ms={210} active={false} />
                                        <EdgeRow label="Trust Scoring" device="AMD NPU" ms={8} active />
                                    </div>
                                </StudioSection>
                            </>
                        )}

                        {/* ── Assessment Mode ── */}
                        {studioMode === "assessment" && (
                            <>
                                <button
                                    onClick={() => { setStudioMode("learning"); onTabChange("qa") }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded bg-primary/[0.07] border border-primary/25 hover:bg-primary/[0.12] hover:border-primary/50 transition-all group"
                                >
                                    <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex-1 text-left">← Back to Chat</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                </button>
                                <StudioSection icon={Target} label="Exam Readiness Index" color="cyan">
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-shrink-0">
                                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                                <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--foreground) / 0.20)" strokeWidth="4" />
                                                <circle cx="32" cy="32" r="26" fill="none" stroke={examReadiness >= 70 ? "#22d3ee" : examReadiness >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="4" strokeDasharray={`${(examReadiness / 100) * 163.4} 163.4`} strokeLinecap="round" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-sm font-bold text-foreground">{examReadiness}%</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <ReadinessRow label="Recall" val={recall} />
                                            <ReadinessRow label="Reasoning" val={reasoning} />
                                            <ReadinessRow label="Speed" val={speed} />
                                            <ReadinessRow label="Accuracy" val={accuracy} />
                                        </div>
                                    </div>
                                </StudioSection>
                                <div className="grid grid-cols-2 gap-2">
                                    <MeterCard icon={Flame} label="Volatility" value={volatility} unit="%" color={volatility > 60 ? "red" : volatility > 35 ? "yellow" : "green"} tooltip="Concept instability" />
                                    <MeterCard icon={Gauge} label="Cog. Load" value={cognitiveLoad} unit="%" color={cognitiveLoad > 75 ? "red" : cognitiveLoad > 50 ? "yellow" : "green"} tooltip="Working memory pressure" />
                                </div>
                                <button
                                    onClick={() => onTabChange("assessments")}
                                    className="w-full flex items-center gap-2 px-3 py-3 rounded border border-primary/20 hover:border-primary/40 transition-all group"
                                >
                                    <FlaskConical className="h-4 w-4 text-primary" />
                                    <div className="flex-1 text-left">
                                        <div className="text-[10px] font-bold text-primary uppercase tracking-widest">Simulate Exam</div>
                                        <div className="text-[8px] text-muted-foreground">Full adaptive assessment</div>
                                    </div>
                                    <Zap className="h-3 w-3 text-primary group-hover:scale-110 transition-transform" />
                                </button>
                            </>
                        )}

                        {/* ── Graphing Mode ── */}
                        {studioMode === "graphing" && (
                            <>
                                <button
                                    onClick={() => { setStudioMode("learning"); onTabChange("qa") }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded bg-primary/[0.07] border border-primary/25 hover:bg-primary/[0.12] hover:border-primary/50 transition-all group"
                                >
                                    <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex-1 text-left">← Back to Chat</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                </button>
                                <StudioSection icon={Layers} label={`Active Concepts (${allConcepts.length})`} color="purple">
                                    <div className="space-y-1">
                                        {allConcepts.length > 0
                                            ? allConcepts.map((c) => (
                                                <ConceptRow
                                                    key={c.name}
                                                    concept={c}
                                                    onDelete={session?.user?.id ? handleDeleteConcept : undefined}
                                                    deleting={deletingConcept === c.name}
                                                />
                                            ))
                                            : <p className="text-[9px] text-muted-foreground text-center py-2">No concepts tracked yet</p>
                                        }
                                    </div>
                                </StudioSection>
                                <StudioSection icon={Radio} label="Domain Coverage" color="cyan">
                                    <div className="h-44">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart data={masteryData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                                                <PolarGrid stroke="hsl(var(--foreground) / 0.20)" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground) / 0.68)", fontSize: 9, fontFamily: "monospace" }} />
                                                <Radar name="Coverage" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.12} strokeWidth={1.5} />
                                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.25)", borderRadius: 8, fontSize: 10 }} formatter={(v: any) => [`${v}%`, "Coverage"]} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </StudioSection>
                                <button
                                    onClick={() => onTabChange("knowledge")}
                                    className="w-full flex items-center gap-2 px-3 py-3 rounded bg-card border border-primary/20 hover:border-primary/40 transition-all group"
                                >
                                    <Layers className="h-4 w-4 text-primary" />
                                    <div className="flex-1 text-left">
                                        <div className="text-[10px] font-bold text-primary uppercase tracking-widest">Knowledge Atlas</div>
                                        <div className="text-[8px] text-muted-foreground">All disciplines and how they connect</div>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button
                                    onClick={() => onTabChange("mindmap")}
                                    className="w-full flex items-center gap-2 px-3 py-3 rounded bg-card border border-primary/20 hover:border-primary/40 transition-all group"
                                >
                                    <Network className="h-4 w-4 text-primary" />
                                    <div className="flex-1 text-left">
                                        <div className="text-[10px] font-bold text-primary uppercase tracking-widest">Open Concept Graph</div>
                                        <div className="text-[8px] text-muted-foreground">Visual knowledge map</div>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </>
                        )}

                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}

function ConceptRow({
    concept,
    onDelete,
    deleting,
}: {
    concept: { name: string; mastery: number; trend: string; volatility: string }
    onDelete?: (name: string) => void
    deleting?: boolean
}) {
    const volDot = concept.volatility === "high" ? "bg-destructive" : concept.volatility === "medium" ? "bg-warning" : "bg-success"
    return (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-card transition-colors group">
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", volDot)} />
            <span
                className="text-[10px] text-foreground flex-1 min-w-0 truncate group-hover:text-foreground transition-colors"
                title={concept.name}
            >{concept.name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-10 h-1 bg-accent rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", masteryColor(concept.mastery))} style={{ width: `${concept.mastery}%` }} />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground w-7 text-right">{concept.mastery}%</span>
            </div>
            {onDelete && (
                <button
                    onClick={() => onDelete(concept.name)}
                    disabled={deleting}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 ml-0.5 disabled:cursor-not-allowed"
                    title={`Remove "${concept.name}"`}
                >
                    {deleting
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : <Trash2 className="h-2.5 w-2.5" />}
                </button>
            )}
        </div>
    )
}

function StudioSection({ icon: Icon, label, color, children }: any) {
    const colors: any = {
        purple: "text-primary", cyan: "text-primary", amber: "text-warning",
        violet: "text-primary", slate: "text-muted-foreground",
    }
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", colors[color])} />
                <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em]", colors[color])}>{label}</span>
            </div>
            <div className="rounded border border-border bg-card p-3">{children}</div>
        </div>
    )
}

function ReadinessRow({ label, val }: { label: string; val: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[8px] text-muted-foreground w-14 uppercase tracking-wide flex-shrink-0">{label}</span>
            <div className="flex-1 h-px bg-accent rounded-full overflow-hidden">
                <div className={cn("h-full", masteryColor(val))} style={{ width: `${val}%` }} />
            </div>
            <span className="text-[8px] text-muted-foreground w-5 text-right">{val}</span>
        </div>
    )
}

function MeterCard({ icon: Icon, label, value, unit, color, tooltip }: any) {
    const colors: any = {
        green: { bg: "bg-success/5", border: "border-success/20", text: "text-success", bar: "bg-success" },
        yellow: { bg: "bg-warning/5", border: "border-warning/20", text: "text-warning", bar: "bg-warning" },
        red: { bg: "bg-destructive/5", border: "border-destructive/20", text: "text-destructive", bar: "bg-destructive" },
    }
    const c = colors[color]
    return (
        <div className={cn("rounded border p-3 space-y-2", c.bg, c.border)} title={tooltip}>
            <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", c.text)} />
                <span className={cn("text-[8px] font-bold uppercase tracking-widest", c.text)}>{label}</span>
            </div>
            <div className="text-lg font-bold text-foreground">{value}<span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span></div>
            <div className="h-1 bg-accent rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", c.bar)} style={{ width: `${value}%` }} />
            </div>
        </div>
    )
}

function EdgeRow({ label, device, ms, active }: { label: string; device: string; ms: number; active: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", active ? "bg-success" : "bg-accent")} />
            <span className="text-[9px] text-muted-foreground flex-1 truncate">{label}</span>
            <span className="text-[8px] text-warning font-bold">{device}</span>
            <span className="text-[8px] text-muted-foreground w-8 text-right">{ms}ms</span>
        </div>
    )
}

function ModeTab({ icon: Icon, label, active, onClick, activeColor }: { icon: any; label: string; active: boolean; onClick: () => void; activeColor: string }) {
    const colors: any = {
        cyan: "border-primary text-primary",
        amber: "border-warning text-warning",
        purple: "border-primary text-primary",
    }
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 flex items-center justify-center gap-1 py-2 border-b-2 text-[8px] font-bold uppercase tracking-widest transition-all",
                active ? colors[activeColor] : "border-transparent text-muted-foreground hover:text-muted-foreground"
            )}
        >
            <Icon className="h-2.5 w-2.5" />
            {label}
        </button>
    )
}
