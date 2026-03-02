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

            // 3. Upload to AI Backend (Embeddings)
            // Proxy through NextJS API route or call directly if CORS allowed?
            // Config said "ALLOWED_ORIGINS" so direct call is potentially okay IF localhost is set up right.
            // But for safety, let's assume we might need a proxy. For now, try direct relative path '/api/documents/upload' 
            // IF we set up a rewrite in next.config.mjs or assume they are on same origin.
            // Wait, app/ai-agent is FastAPI on port 8000. app/app is NextJS on 3000.
            // We need a proxy in next.config.mjs OR call absolute URL (localhost:8000). 
            // Production usually unified. 
            // Let's try the relative path assuming rewrites are in place or will be added. 
            // If not, we fall back to absolute localhost:8000 for dev.
            // *CHECK* page.tsx used `/api/ai-agent/health`. This implies a rewrite exists or route handler.

            // Actually earlier page.tsx has: fetch("/api/ai-agent/health")
            // If that worked, then rewrites are likely handled OR it's a NextJS route that calls backend.
            // Let's look at `apps/app/next.config.js` if I could, but I'll assume `/api/documents/upload` might NOT serve FastAPI directly.
            // I will use a direct fetch to the AI_BACKEND_URL pattern if possible, or just try to proxy.
            // Let's IMPLEMENT A CLIENT-SIDE FETCH to the known endpoint pattern.

            // TEMPORARY: Assume backend is at localhost:8000 for dev, or proxied at /api/proxy/ai-agent...
            // Safest bet for "Investor Ready" demo on one machine:
            // Use a Proxy Route in NextJS to forward to FastAPI.
            // I'll assume for this step, we post to `/api/proxy/ai/upload`. 
            // WAIT, I haven't built that proxy.
            // I'll stick to calling the Server Action to do the upload? No, streaming file is hard in actions.

            // Let's assume a direct fetch to http://localhost:8000/api/documents/upload for now 
            // (with CORS enabled on backend, which I saw in main.py).

            const backendUrl = "http://localhost:8000/api/documents/upload"

            const res = await fetch(backendUrl, {
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
