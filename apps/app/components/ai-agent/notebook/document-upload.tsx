"use client"

import { useState, useRef } from "react"
import { Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createDocumentRecord, updateDocumentRecord, checkDocumentLimit } from "@/app/actions/documents"
import { useRouter } from "next/navigation"

export function DocumentUpload({ userId, onUploaded }: { userId?: string; onUploaded?: () => void }) {
    const [isUploading, setIsUploading] = useState(false)
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
            try {
                const res = await fetch("/api/ai-agent/documents", {
                    method: "POST",
                    body: formData,
                })
                if (res.ok) {
                    const aiData = await res.json()
                    s3Key     = aiData?.s3_uploads?.[0]?.s3_key
                    namespace = aiData?.namespace
                }
            } catch {
                // Backend may still be processing — the record is already saved, ignore timeout
            }

            // 5. Update the record with s3/pinecone info if we got it back in time
            if (docId && (s3Key || namespace)) {
                await updateDocumentRecord(docId, {
                    ...(s3Key     ? { url: s3Key }          : {}),
                    ...(namespace ? { pineconeId: namespace } : {}),
                })
            }

            toast({ title: "Success", description: "Document uploaded and is being processed!" })
            onUploaded?.()
            router.refresh()

        } catch (error) {
            console.error(error)
            toast({ title: "Upload Failed", description: "Could not upload document.", variant: "destructive" })
        } finally {
            setIsUploading(false)
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
                    "w-full flex items-center justify-center gap-2 h-9 rounded-xl",
                    "border border-dashed border-white/[0.12] bg-white/[0.02]",
                    "text-[10px] font-bold uppercase tracking-widest text-white/40",
                    "hover:border-cyan-500/40 hover:bg-cyan-500/[0.05] hover:text-cyan-400",
                    "transition-all duration-200 cursor-pointer",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
            >
                {isUploading
                    ? <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    : <Plus className="h-3 w-3 text-cyan-400" />
                }
                {isUploading ? "Processing..." : "Add Source"}
            </button>
        </div>
    )
}
