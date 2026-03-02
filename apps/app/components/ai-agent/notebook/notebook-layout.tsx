"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Plus,
    MessageSquare,
    BrainCircuit,
    Files,
    Zap,
    Settings,
    ChevronRight,
    Loader2,
    FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserDocuments } from "@/app/actions/documents"
import { DocumentList } from "./document-list"
import { DocumentUpload } from "./document-upload"

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [docCount, setDocCount] = useState(0)

    useEffect(() => {
        if (session?.user?.id) {
            getUserDocuments(session.user.id).then(res => {
                if (res.success) setDocCount(res.docs?.length || 0)
            })
        }
    }, [session?.user?.id])

    const progress = Math.min((docCount / 10) * 100, 100)

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
            {/* Left Pane: Sources */}
            <div className="w-80 border-r border-border/50 flex flex-col bg-muted/5">
                <div className="p-4 border-b border-border/50">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Sources</h2>
                    <DocumentUpload userId={session?.user?.id} />
                </div>

                <div className="p-4 space-y-4">
                    <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-3 w-3 text-cyan-400" />
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Enhanced Search</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Try Deep Research for an in-depth report and new sources!
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search sources..."
                            className="w-full bg-secondary/50 border-border/50 rounded-lg py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 px-2">
                    <DocumentList
                        userId={session?.user?.id}
                        selectedDocId={selectedDocId}
                        onSelect={onDocSelect}
                    />
                </ScrollArea>

                <div className="p-4 border-t border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Storage</span>
                        <span className="text-[10px] font-bold text-cyan-400">{docCount}/10</span>
                    </div>
                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-cyan-500 transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Middle Pane: Main Workspace (Chat/Notes) */}
            <div className="flex-1 flex flex-col bg-background relative border-r border-border/50">
                <ScrollArea className="flex-1">
                    <div className="max-w-3xl mx-auto p-8 w-full">
                        {children}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Pane: Studio */}
            <div className="w-96 flex flex-col bg-muted/5">
                <div className="p-4 border-b border-border/50 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Studio</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                            <StudioItem 
                                icon={Plus} 
                                label="Audio Overview" 
                                color="cyan" 
                                onClick={() => alert("🚧 Coming Soon! Audio overview feature is currently in development.")} 
                            />
                            <StudioItem 
                                icon={BrainCircuit} 
                                label="Video Overview" 
                                color="purple" 
                                onClick={() => alert("🚧 Coming Soon! Video overview feature is currently in development.")} 
                            />
                            <StudioItem icon={BrainCircuit} label="Mind Map" color="orange" onClick={() => onTabChange("mindmap")} />
                            <StudioItem icon={Files} label="Quizzes" color="blue" onClick={() => onTabChange("assessments")} />
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Notebook Assets</p>
                            <div className="space-y-1">
                                <AssetItem label="Strategic Quiz Dive" type="Explainer" time="2h ago" />
                                <AssetItem label="Exam Manual Summary" type="Guide" time="3h ago" />
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Audio Player placeholder matching ref */}
                <div className="p-4 border-t border-border/50 bg-cyan-500/5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-cyan-500 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">Study Audio Overview</p>
                            <p className="text-[10px] text-muted-foreground truncate">Generating summary...</p>
                        </div>
                    </div>
                    <div className="h-1 w-full bg-muted rounded-full">
                        <div className="h-full bg-cyan-500 w-2/3"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StudioItem({ icon: Icon, label, color, onClick }: any) {
    const colorClasses: any = {
        cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20"
    }
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]",
                colorClasses[color] || colorClasses.cyan
            )}
        >
            <Icon className="h-5 w-5 mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-center">{label}</span>
        </button>
    )
}

function AssetItem({ label, type, time }: any) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors border border-transparent hover:border-border/50 group cursor-pointer">
            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-muted-foreground group-hover:text-cyan-400 transition-colors">
                <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground">{type} • {time}</p>
            </div>
        </div>
    )
}

function NavButton({ icon: Icon, label, isActive, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative group",
                isActive
                    ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.1)] border border-cyan-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
        >
            <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-cyan-400" : "text-muted-foreground")} />
            <span className="tracking-tight">{label}</span>
            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
        </button>
    )
}
