"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createDocumentRecord, checkDocumentLimit } from "@/app/actions/documents"
import { useRouter } from "next/navigation"

export function DocumentUpload({ userId }: { userId?: string }) {
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

            // 2. Prepare Form Data for FastAPI
            const formData = new FormData()
            formData.append("files", file)
            formData.append("user_id", userId)

            // 3. Upload to AI Backend via Next.js proxy route (avoids CORS issues)
            // The Next.js route at /api/ai-agent/documents forwards to FastAPI at port 8000.
            const res = await fetch("/api/ai-agent/documents", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) {
                throw new Error("Failed to process document embeddings.")
            }
            const aiData = await res.json()

            // 4. Create Metadata Record in NextJS DB
            const dbRes = await createDocumentRecord({
                title: file.name,
                type: file.type.split("/")[1]?.toUpperCase() || "UNKNOWN",
                size: file.size,
                userId: userId
            })

            if (!dbRes.success) {
                toast({ title: "Warning", description: "Document embedded but metadata save failed.", variant: "warning" })
            } else {
                toast({ title: "Success", description: "Document uploaded and processed!" })
                router.refresh()
            }

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
                accept=".pdf,.txt,.docx,.md"
                onChange={handleFileChange}
            />
            <Button
                variant="outline"
                className="w-full rounded-full border-border/50 bg-secondary/30 hover:bg-secondary/50 text-[11px] font-bold h-9 uppercase tracking-wider"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
            >
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                {isUploading ? "Uploading..." : "Add sources"}
            </Button>
        </div>
    )
}
