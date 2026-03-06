"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { MessageSquare, X, Plus, Send, Terminal } from "lucide-react"

export default function AskPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [subject, setSubject] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 5) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleSubmit = async () => {
    // Improved validation - only title and description are mandatory
    const errors: string[] = []
    
    if (!title.trim()) {
      errors.push("Question title is required")
    }
    
    if (!description.trim()) {
      errors.push("Question details are required")
    }

    if (errors.length > 0) {
      alert(errors.join("\n"))
      return
    }

    setIsSubmitting(true)
    try {
      // Prepare content
      const fullContent = description

      // Send to API - subject, tags, and isAnonymous are optional
      const response = await fetch("/api/doubts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          content: fullContent,
          subject: subject || "OTHER",
          tags: tags.length > 0 ? tags : [],
          isAnonymous: isAnonymous,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to post question")
      }

      router.push(`/`)
    } catch (error) {
      console.error("Error creating doubt:", error)
      alert(error instanceof Error ? error.message : "Failed to post question. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAttachmentIcon = () => {
    return null
  }

  return (
    <main className="font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENTROPY · QUERY_SUBMISSION</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Ask a Question
          </h1>
          <p className="text-xs text-muted-foreground">
            Submit a query to the community — get answers reviewed by peers and Entropy AI
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0d0d14]/80 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          {/* Card Header */}
          <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">New Question</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Fill in the fields below
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Question title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                placeholder="What's your question about?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 bg-white/3 border-white/8 focus:border-cyan-500/40 focus:ring-cyan-500/20 font-mono text-sm placeholder:text-muted-foreground/40"
              />
              <p className="text-[10px] text-muted-foreground/60">
                Be specific and clear about what you're asking
              </p>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Subject{" "}
                <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
              </Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-10 bg-white/3 border-white/8 focus:border-cyan-500/40 font-mono text-sm">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f1a] border-white/10 font-mono text-sm">
                  <SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
                  <SelectItem value="MATHEMATICS">Mathematics</SelectItem>
                  <SelectItem value="PHYSICS">Physics</SelectItem>
                  <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                  <SelectItem value="BIOLOGY">Biology</SelectItem>
                  <SelectItem value="ENGINEERING">Engineering</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Question details <span className="text-red-400">*</span>
              </Label>
              <Textarea
                placeholder="Describe your question in detail. Include code, equations, or any context that helps others understand and answer..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[180px] resize-none bg-white/3 border-white/8 focus:border-cyan-500/40 font-mono text-sm placeholder:text-muted-foreground/40"
              />
              <p className="text-[10px] text-muted-foreground/60">
                Be thorough — better context = better answers
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Tags{" "}
                <span className="text-muted-foreground/50 normal-case tracking-normal">(up to 5)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g. recursion, binary-tree"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  className="h-9 bg-white/3 border-white/8 focus:border-cyan-500/40 font-mono text-sm placeholder:text-muted-foreground/40"
                />
                <Button
                  type="button"
                  onClick={handleAddTag}
                  variant="outline"
                  size="sm"
                  className="h-9 border-white/8 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider border-cyan-500/30 text-cyan-400 bg-cyan-500/5 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        className="ml-1 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Anonymous */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked: boolean) => setIsAnonymous(checked)}
                className="border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
              />
              <Label
                htmlFor="anonymous"
                className="cursor-pointer text-xs text-muted-foreground uppercase tracking-[0.12em]"
              >
                Post anonymously
              </Label>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                className="font-mono text-[11px] uppercase tracking-wider border-white/10 hover:border-white/20"
              >
                Save Draft
              </Button>
              <Button
                onClick={handleSubmit}
                size="sm"
                disabled={isSubmitting}
                className="font-mono text-[11px] uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-black" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Post Question
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
