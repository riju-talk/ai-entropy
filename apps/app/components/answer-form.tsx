"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Send, Lock, Sparkles } from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface AnswerFormProps {
  doubtId: string
  onAnswerAdded: () => void
}

export function AnswerForm({ doubtId, onAnswerAdded }: AnswerFormProps) {
  const { data: session, status } = useSession()
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isAiAssisted, setIsAiAssisted] = useState(false)
  const { toast } = useToast()

  const isAuthenticated = status === "authenticated"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check authentication
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please write your answer",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doubtId,
          content: content.trim(),
          isAiAssisted,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to post answer")
      }

      toast({
        title: "Success!",
        description: "Your answer has been posted",
      })

      setContent("")
      setIsAiAssisted(false)
      onAnswerAdded()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post answer",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTextareaClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder={
            isAuthenticated
              ? "Write your answer here... You can use Markdown formatting."
              : "Sign in to post an answer"
          }
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onClick={handleTextareaClick}
          rows={8}
          className="resize-none"
          disabled={!isAuthenticated}
        />
        <div className="flex items-center space-x-4 p-4 rounded-xl bg-secondary/20 border border-white/5">
          <div className="flex-1 space-y-1">
            <Label htmlFor="ai-assist" className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              AI Assistance
            </Label>
            <p className="text-xs text-muted-foreground">
              Did you use AI to help generate this answer?
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Switch
              id="ai-assist"
              checked={isAiAssisted}
              onCheckedChange={setIsAiAssisted}
              disabled={!isAuthenticated || isSubmitting}
            />
            {!isAiAssisted && isAuthenticated && (
              <Badge variant="outline" className="text-[10px] font-bold bg-green-500/10 text-green-500 border-green-500/20 animate-pulse">
                1.5x XP RIGOR BONUS
              </Badge>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {isAuthenticated
              ? "Be respectful and constructive in your answer"
              : "You need to sign in to post an answer"}
          </p>
          <Button type="submit" disabled={isSubmitting || !content.trim() || !isAuthenticated}>
            {!isAuthenticated ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Sign in to Answer
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Post Answer
              </>
            )}
          </Button>
        </div>
      </form>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  )
}
