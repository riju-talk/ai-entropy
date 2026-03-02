"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Send, Sparkles, Upload, FileText, X, Settings, Save, Image as ImageIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ReactMarkdown from 'react-markdown'

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ChatAgentProps {
  contextDoc?: { id: string, title: string } | null
}

export function ChatAgent({ contextDoc }: ChatAgentProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<Array<{ name: string, dataUrl: string }>>([])
  const [systemPrompt, setSystemPrompt] = useState("")
  const [editingPrompt, setEditingPrompt] = useState("")
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [followups, setFollowups] = useState<string[]>([])

  const loadGreeting = async () => {
    try {
      const response = await fetch("/api/ai-agent/qa")
      if (response.ok) {
        const data = await response.json()
        setMessages([{ role: "assistant", content: sanitizeContent(data.greeting) }])
      }
    } catch (error) {
      console.error("Failed to load greeting:", error)
      setMessages([
        {
          role: "assistant",
          content: sanitizeContent("Hi! I'm Spark ⚡ - Ask me anything or upload documents!"),
        },
      ])
    }
  }

  function sanitizeContent(input: string | undefined) {
    if (!input) return ""
    // Remove any <think>...</think> blocks (multiline-safe)
    return input.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  }

  // Load greeting on mount
  useEffect(() => {
    loadGreeting()
    setSystemPrompt("Hi! I'm Spark ⚡ - your AI study buddy!")
    setEditingPrompt("Hi! I'm Spark ⚡ - your AI study buddy!")
  }, [])

  // Core send function, accepts an optional override message (used by follow-up clicks)
  const sendMessage = async (overrideMessage?: string) => {
    const raw = overrideMessage !== undefined ? overrideMessage : input
    const userMessage = (raw || "").toString().trim()
    if (!userMessage) return

    // If user typed the message (no override), clear the input box
    if (overrideMessage === undefined) setInput("")

    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setLoading(true)
    setFollowups([])

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      console.log("📤 Sending Q&A request with system prompt:", systemPrompt?.substring(0, 50))

      const payload: any = {
        question: userMessage,
        userId: session?.user?.id || "anonymous",
        collection_name: "default", // We use namespace=user_id in backend usually
        conversation_history: conversationHistory,
        system_prompt: systemPrompt || undefined,
      }

      // If a specific doc is selected, pass a filter
      if (contextDoc) {
        payload.filter = { source: contextDoc.title }
        // And maybe mention it in system prompt?
        payload.system_prompt = (payload.system_prompt || "") + `\n\nFocus on the document: ${contextDoc.title}`
      }

      const response = await fetch("/api/ai-agent/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()

      console.log("✅ Received response:", {
        mode: data.mode,
        sourcesCount: data.sources?.length || 0,
        qaId: data.qaId,
        followups: data.follow_up_questions?.length ?? data.followUps?.length ?? 0,
      })

      let responseText = data.answer || ""

      if (data.sources && data.sources.length > 0) {
        responseText += `\n\n---\n**📚 ${data.sources.length} source(s) used**`
      }

      responseText += `\n\n*Response mode: ${data.mode === 'rag' ? '📖 RAG (Document-based)' : '💬 Direct Chat'}*`

      // Capture follow-ups separately so we can render clickable buttons
      const receivedFollowups = data.follow_up_questions || data.followUps || []
      if (Array.isArray(receivedFollowups) && receivedFollowups.length > 0) {
        setFollowups(receivedFollowups.map((f: string) => sanitizeContent(f)))
      }

      // Custom friendly greeting for "hi"
      if (userMessage.toLowerCase().trim() === "hi") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: sanitizeContent(
              "Hi Spark! ⚡ How can I help you study today? Need notes explained, tricky concepts broken down, or practice questions? Just let me know! 📚✨\n\nResponse mode: 💬 Direct Chat"
            ),
          },
        ])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: sanitizeContent(responseText) }])
      }

    } catch (error) {
      console.error("❌ Chat error:", error)
      toast({
        title: "Error",
        description: "Failed to get response from Spark",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Keep handleSend for existing keypress and button bindings
  const handleSend = () => sendMessage()

  const handleFollowupClick = (question: string) => {
    // Immediately send the follow-up as a new query
    sendMessage(question)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      // Check if it's an image
      if (file.type.startsWith('image/')) {
        // Handle image upload
        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string
          setUploadedImages((prev) => [...prev, { name: file.name, dataUrl }])
          toast({
            title: "Image uploaded",
            description: `${file.name} ready for analysis`,
          })
        }
        reader.readAsDataURL(file)
      } else {
        // Handle document upload
        const formData = new FormData()
        formData.append("file", file)
        formData.append("collection_name", "default")

        try {
          const response = await fetch("/api/ai-agent/documents/upload", {
            method: "POST",
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            setUploadedFiles((prev) => [...prev, file.name])
            toast({
              title: "Document uploaded",
              description: data.message,
            })
          }
        } catch (error) {
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          })
        }
      }
    }
  }

  const handleSaveSystemPrompt = () => {
    setSystemPrompt(editingPrompt)
    setShowPromptDialog(false)
    toast({
      title: "System prompt saved",
      description: "Spark's personality has been updated!",
    })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Section from Ref */}
      <div className="mb-10 p-8 rounded-[32px] bg-secondary/20 border border-border/10">
        <div className="flex items-start gap-5 mb-5">
          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <Sparkles className="h-7 w-7 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">
              {contextDoc?.title || "Spark AI Workspace"}
            </h1>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {contextDoc ? "Contextual Analysis Active" : "Ready for Inquiries"}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          {contextDoc ? (
            `These documents provide a comprehensive overview of "${contextDoc.title}". I've indexed key concepts and quantitative trends to assist your study. Use the tools in the Studio to generate specialized assets or ask questions below.`
          ) : (
            "Welcome to your AI Study Hub. Upload documents to the left to enable contextual research, or start a general conversation below."
          )}
        </p>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="rounded-full bg-secondary/80 text-[11px] font-bold h-9 px-5 border-border/50 hover:bg-secondary transition-all">
            <Save className="h-3.5 w-3.5 mr-2 text-cyan-400" />
            Save to note
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/50">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-10 pb-10">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex group animate-in fade-in slide-in-from-bottom-2 duration-500",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-[32px] p-7 transition-all",
                message.role === "user"
                  ? "bg-cyan-500/5 border border-cyan-500/10 text-foreground"
                  : "bg-background text-foreground"
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-8 w-8 border border-border/20 shadow-sm">
                  <AvatarFallback className={cn(
                    "text-[10px] font-black tracking-tighter",
                    message.role === "assistant" ? "bg-cyan-500/10 text-cyan-400" : "bg-muted text-muted-foreground"
                  )}>
                    {message.role === "assistant" ? "AI" : "ME"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                  {message.role === "assistant" ? "Spark AI" : "You"}
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-headings:font-bold prose-code:text-cyan-400 text-[14px]">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-4 px-7 py-5 rounded-[32px] bg-muted/10 border border-border/10 shadow-sm">
              <div className="flex gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce"></span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70 italic">Spark is thinking</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Section - Professional Pill style */}
      <div className="sticky bottom-0 bg-background pt-6 pb-2">
        {followups.length > 0 && (
          <div className="flex gap-2.5 mb-5 overflow-x-auto pb-3 px-2 no-scrollbar">
            {followups.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(q)}
                className="rounded-full bg-secondary/30 text-[11px] font-bold h-9 px-5 whitespace-nowrap border-border/50 hover:border-cyan-500/30 hover:bg-secondary/50 transition-all"
              >
                {q}
              </Button>
            ))}
          </div>
        )}

        <div className="relative group">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full min-h-[60px] max-h-[250px] rounded-[28px] bg-secondary/40 border-border/40 focus-visible:ring-1 focus-visible:ring-cyan-500/20 pl-7 pr-16 py-5 text-sm transition-all resize-none shadow-sm placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="absolute right-3.5 bottom-3 h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] font-bold text-center text-muted-foreground mt-4 opacity-40 uppercase tracking-widest">
          NotebookLM can be inaccurate; please double check its responses.
        </p>
      </div>
    </div>
  )
}
