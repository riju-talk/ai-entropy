"use client"

import { useEffect, useState, useCallback } from "react"
import { getUserDocuments, deleteDocuments } from "@/app/actions/documents"
import { Button } from "@/components/ui/button"
import { FileText, File, Trash2, Loader2, CheckSquare, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { DocumentUpload } from "./document-upload"

interface DocumentListProps {
    userId?: string
    selectedDocId?: string
    onSelect: (doc: any | null) => void
    refreshKey?: number
}

const DOC_ICON: Record<string, string> = {
    PDF: "text-destructive",
    DOCX: "text-primary",
    TXT: "text-muted-foreground",
    PPTX: "text-warning",
}

export function DocumentList({ userId, selectedDocId, onSelect, refreshKey }: DocumentListProps) {
    const [docs, setDocs]                 = useState<any[]>([])
    const [loading, setLoading]           = useState(true)
    const [checked, setChecked]           = useState<Set<string>>(new Set())
    const [selectMode, setSelectMode]     = useState(false)
    const [deleting, setDeleting]         = useState(false)
    const [localRefresh, setLocalRefresh] = useState(0)
    const { toast } = useToast()

    const fetchDocs = useCallback(async () => {
        if (!userId) { setLoading(false); return }
        const res = await getUserDocuments(userId)
        if (res.success) setDocs(res.docs || [])
        setLoading(false)
    }, [userId])

    useEffect(() => {
        setLoading(true)
        fetchDocs()
        const interval = setInterval(fetchDocs, 5000)
        return () => clearInterval(interval)
    }, [fetchDocs])

    useEffect(() => {
        if (refreshKey !== undefined || localRefresh > 0) fetchDocs()
    }, [refreshKey, localRefresh, fetchDocs])

    const toggleCheck = (id: string) => {
        setChecked(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const exitSelectMode = () => {
        setSelectMode(false)
        setChecked(new Set())
    }

    const handleDeleteSelected = async () => {
        if (checked.size === 0) return
        const toDelete = docs.filter(d => checked.has(d.id))
        if (!confirm(`Remove ${toDelete.length} source${toDelete.length > 1 ? "s" : ""}? This cannot be undone.`)) return

        setDeleting(true)
        if (checked.has(selectedDocId ?? "")) onSelect(null)
        setDocs(prev => prev.filter(d => !checked.has(d.id)))
        exitSelectMode()

        const res = await deleteDocuments(
            toDelete.map(d => ({ id: d.id, title: d.title, url: d.url ?? undefined })),
            userId!,
        )
        if (!res.success) {
            toast({ title: "Delete failed", description: "Some sources could not be removed.", variant: "destructive" })
            fetchDocs()
        } else {
            toast({ title: `${res.deleted} source${res.deleted !== 1 ? "s" : ""} removed`, description: "Vectors and graph entries cleaned up." })
        }
        setDeleting(false)
    }

    if (loading) {
        return (
            <div className="space-y-1.5 mt-1">
                <Skeleton className="h-9 w-full rounded bg-card" />
                <Skeleton className="h-11 w-full rounded bg-card" />
                <Skeleton className="h-11 w-full rounded bg-card" />
            </div>
        )
    }

    const allChecked  = docs.length > 0 && checked.size === docs.length
    const someChecked = checked.size > 0

    return (
        <div className="flex flex-col gap-1.5 w-full overflow-hidden">

            {/* ── Upload CTA ─────────────────────────────────────────────── */}
            <DocumentUpload userId={userId} onUploaded={() => setLocalRefresh(k => k + 1)} />

            {/* ── Source count + Select toggle ───────────────────────────── */}
            {docs.length > 0 && (
                <div className="flex items-center justify-between px-0.5 mt-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                        {docs.length} source{docs.length !== 1 ? "s" : ""}
                    </span>
                    {selectMode ? (
                        <button
                            onClick={exitSelectMode}
                            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-2.5 w-2.5" /> Cancel
                        </button>
                    ) : (
                        <button
                            onClick={() => setSelectMode(true)}
                            className="text-[9px] text-muted-foreground hover:text-muted-foreground transition-colors uppercase tracking-widest"
                        >
                            Select
                        </button>
                    )}
                </div>
            )}

            {/* ── Bulk delete bar ─────────────────────────────────────────── */}
            {selectMode && someChecked && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-destructive/[0.07] border border-destructive/20">
                    <span className="text-[9px] font-bold text-destructive flex-1 truncate">
                        {checked.size} selected
                    </span>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-[9px] font-bold shrink-0"
                        disabled={deleting}
                        onClick={handleDeleteSelected}
                    >
                        {deleting
                            ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                            : <Trash2 className="h-2.5 w-2.5 mr-1" />
                        }
                        Remove
                    </Button>
                </div>
            )}

            {/* ── Select all ─────────────────────────────────────────────── */}
            {selectMode && docs.length > 0 && (
                <button
                    onClick={() => setChecked(allChecked ? new Set() : new Set(docs.map(d => d.id)))}
                    className="flex items-center gap-2 px-2.5 py-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                >
                    {allChecked
                        ? <CheckSquare className="h-2.5 w-2.5 text-primary shrink-0" />
                        : <Square className="h-2.5 w-2.5 shrink-0" />
                    }
                    <span className="uppercase tracking-widest">
                        {allChecked ? "Deselect all" : "Select all"}
                    </span>
                </button>
            )}

            {/* ── Document cards ──────────────────────────────────────────── */}
            {docs.length === 0 ? (
                <div className="text-center py-8 px-2">
                    <div className="w-10 h-10 rounded bg-card border border-border flex items-center justify-center mx-auto mb-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">No sources yet</p>
                    <p className="text-[9px] text-muted-foreground mt-1">PDF · DOCX · TXT · PPTX</p>
                </div>
            ) : (
                <div className="space-y-1 w-full">
                    {docs.map((doc) => {
                        const isChecked = checked.has(doc.id)
                        const isActive  = selectedDocId === doc.id
                        const typeKey   = (doc.type || "").toUpperCase()
                        const iconColor = DOC_ICON[typeKey] ?? "text-muted-foreground"

                        return (
                            <div
                                key={doc.id}
                                onClick={() => selectMode ? toggleCheck(doc.id) : onSelect(isActive ? null : doc)}
                                className={cn(
                                    "group flex items-center gap-2.5 px-2.5 py-2.5 rounded cursor-pointer transition-all border w-full min-w-0 overflow-hidden",
                                    isActive && !selectMode
                                        ? "bg-primary/[0.07] border-primary/25"
                                        : isChecked
                                            ? "bg-destructive/[0.06] border-destructive/20"
                                            : "bg-card border-border hover:bg-accent hover:border-border"
                                )}
                            >
                                {/* Icon / checkbox */}
                                {selectMode ? (
                                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                                        {isChecked
                                            ? <CheckSquare className="h-3.5 w-3.5 text-destructive" />
                                            : <Square className="h-3.5 w-3.5 text-muted-foreground" />
                                        }
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "h-7 w-7 rounded flex items-center justify-center shrink-0",
                                        isActive ? "bg-primary/15" : "bg-accent"
                                    )}>
                                        <File className={cn("h-3.5 w-3.5", isActive ? "text-primary" : iconColor)} />
                                    </div>
                                )}

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-[11px] font-medium leading-snug truncate",
                                        isActive && !selectMode ? "text-primary" : "text-foreground"
                                    )}>
                                        {doc.title}
                                    </p>
                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">
                                        {doc.type || "Document"}
                                    </p>
                                </div>

                                {/* Active pulse dot */}
                                {!selectMode && isActive && (
                                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
