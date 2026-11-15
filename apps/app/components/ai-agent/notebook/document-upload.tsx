"use client"

import { useState, useRef } from "react"
import { Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createDocumentRecord, updateDocumentRecord, checkDocumentLimit } from "@/app/actions/documents"
import { useRouter } from "next/navigation"

/** multipart POST that reports upload progress (fetch cannot). Resolves with the parsed JSON body. */
function postWithProgress(url: string, body: FormData, onProgress: (pct: number) => void): Promise<any> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", url)
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
        xhr.upload.onload = () => onProgress(100)
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`HTTP ${xhr.status}`))
            try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({}) }
        }
        xhr.onerror = () => reject(new Error("network error"))
        xhr.send(body)
    })
}

export function DocumentUpload({ userId, onUploaded }: { userId?: string; onUploaded?: () => void }) {
    const [isUploading, setIsUploading] = useState(false)
    const [stage, setStage] = useState<"uploading" | "chunking">("uploading")
    const [progress, setProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()
    const router = useRouter()

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!userId) {
            toast({ title: "Sign in required", description: "Please sign in to upload documents.", variant: "destructive" })
            return
        }

        setIsUploading(true)
        let docId: string | null = null
        try {
            // 1. Check limit
            const limitCheck = await checkDocumentLimit(userId)
            if (!limitCheck.allowed) {
                toast({
                    title: "Limit Reached",
                    description: `You have reached your limit of ${limitCheck.limit} documents. Upgrade for unlimited.`,
                    variant: "destructive"
                })
                setIsUploading(false)
                return
            }

            // 2. Save metadata record NOW (before the slow embedding call).
            //    This ensures the document appears in the list even if the upload
            //    request times out while Pinecone/S3 processing continues in the background.
            const dbRes = await createDocumentRecord({
                title: file.name,
                type: file.type.split("/")[1]?.toUpperCase() || "UNKNOWN",
                size: file.size,
                userId: userId,
            })
            if (dbRes.success && dbRes.doc) {
                docId = dbRes.doc.id
                onUploaded?.() // show in list immediately
            }

            // 3. Prepare Form Data for FastAPI
            const formData = new FormData()
            formData.append("files", file)
            formData.append("user_id", userId)

            // 4. Upload to AI Backend — this can take several minutes for large docs.
            //    We fire-and-forget with a generous timeout so the UI stays responsive.
            let s3Key: string | undefined
            let namespace: string | undefined
            let processed = false
            setStage("uploading")
            try {
                const aiData = await postWithProgress("/api/ai-agent/documents", formData, (pct) => {
                    setProgress(pct)
                    if (pct >= 100) setStage("chunking") // bytes are with the server; it is now reading, chunking and embedding
                })
                s3Key     = aiData?.s3_uploads?.[0]?.s3_key
                namespace = aiData?.namespace
                processed = (aiData?.count ?? 0) > 0
            } catch {
                // Backend may still be processing: the record is already saved, so this is reported below, not thrown
            }

            // 5. Update the record with s3/pinecone info if we got it back in time
            if (docId && (s3Key || namespace)) {
                await updateDocumentRecord(docId, {
                    ...(s3Key     ? { url: s3Key }          : {}),
                    ...(namespace ? { pineconeId: namespace } : {}),
                })
            }

            if (processed) toast({ title: "Ready", description: `${file.name} is chunked and searchable.` })
            else toast({ title: "Still processing", description: "The server did not confirm yet. The document will appear once indexing finishes.", variant: "destructive" })
            onUploaded?.()
            router.refresh()

        } catch (error) {
            console.error(error)
            toast({ title: "Upload Failed", description: "Could not upload document.", variant: "destructive" })
        } finally {
            setIsUploading(false)
            setProgress(0)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    return (
        <div className="w-full">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.txt,.docx,.md,.pptx"
                onChange={handleFileChange}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                    "w-full flex items-center justify-center gap-2 h-9 rounded",
                    "border border-dashed border-border bg-card",
                    "text-[10px] font-bold uppercase tracking-widest text-muted-foreground",
                    "hover:border-primary/40 hover:bg-primary/[0.05] hover:text-primary",
                    "transition-all duration-200 cursor-pointer",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
            >
                {isUploading
                    ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    : <Plus className="h-3 w-3 text-primary" />
                }
                {isUploading
                    ? stage === "uploading" ? `Uploading ${progress}%` : "Chunking & indexing..."
                    : "Add Source"}
            </button>
            {isUploading && (
                <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-accent" role="progressbar" aria-label={stage === "uploading" ? "Uploading" : "Chunking and indexing"}>
                    <div
                        className={cn("h-full rounded-full bg-primary transition-all", stage === "chunking" && "w-1/3 animate-pulse")}
                        style={stage === "uploading" ? { width: `${progress}%` } : undefined}
                    />
                </div>
            )}
        </div>
    )
}
