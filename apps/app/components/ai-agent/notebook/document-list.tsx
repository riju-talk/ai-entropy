"use client"

import { useEffect, useState } from "react"
import { getUserDocuments } from "@/app/actions/documents"
import { Button } from "@/components/ui/button"
import { FileText, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface DocumentListProps {
    userId?: string
    selectedDocId?: string
    onSelect: (doc: any | null) => void
}

export function DocumentList({ userId, selectedDocId, onSelect }: DocumentListProps) {
    const [docs, setDocs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const fetchDocs = async () => {
            const res = await getUserDocuments(userId)
            if (res.success) {
                setDocs(res.docs || [])
            }
            setLoading(false)
        }

        fetchDocs()
        const interval = setInterval(fetchDocs, 5000)
        return () => clearInterval(interval)
    }, [userId])

    if (loading) {
        return (
            <div className="space-y-2 mt-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    if (docs.length === 0) {
        return (
            <div className="text-center py-8 px-4 opacity-50">
                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-[10px] text-muted-foreground uppercase font-black">No sources</p>
            </div>
        )
    }

    return (
        <div className="space-y-1 mt-2">
            {docs.map((doc) => (
                <div
                    key={doc.id}
                    onClick={() => onSelect(doc)}
                    className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all cursor-pointer border-l-2",
                        selectedDocId === doc.id
                            ? "bg-muted/50 border-cyan-500 shadow-sm"
                            : "border-transparent hover:bg-muted/30"
                    )}
                >
                    <input
                        type="checkbox"
                        checked={selectedDocId === doc.id}
                        readOnly
                        className="h-3 w-3 rounded border-border bg-background text-cyan-500 focus:ring-cyan-500/20 shadow-sm"
                    />

                    <div className="h-7 w-7 rounded bg-red-500/10 flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className={cn(
                            "font-semibold truncate",
                            selectedDocId === doc.id ? "text-cyan-400" : "text-muted-foreground"
                        )}>
                            {doc.title}
                        </p>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <MoreVertical className="h-3 w-3 text-muted-foreground" />
                    </Button>
                </div>
            ))}
        </div>
    )
}
