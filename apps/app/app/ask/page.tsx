"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { MessageSquare, X, Plus, Send } from "lucide-react"

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
    <main>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold">Ask a question</h1>
          <p className="text-muted-foreground">Get help from the community with text, code, images, and more</p>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <div>
                <CardTitle>Create your question</CardTitle>
                <CardDescription>Fill in the details below to post your question</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">
                Question title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="What's your question about?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Be specific and clear about what you&apos;re asking</p>
            </div>

            {/* Subject - Now optional with better label */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-base font-medium">
                Subject <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a subject (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPUTER_SCIENCE">Computer science</SelectItem>
                  <SelectItem value="MATHEMATICS">Mathematics</SelectItem>
                  <SelectItem value="PHYSICS">Physics</SelectItem>
                  <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                  <SelectItem value="BIOLOGY">Biology</SelectItem>
                  <SelectItem value="ENGINEERING">Engineering</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Help others find your question by selecting a subject</p>
            </div>

            {/* Question Details - Text Only */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Question details <span className="text-destructive">*</span>
              </Label>

              <Textarea
                placeholder="Describe your question in detail. Include all relevant information to help others understand and answer your question."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <p className="text-xs text-muted-foreground">Be thorough and clear in your explanation</p>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  className="h-10"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Add up to 5 tags to help others find your question</p>
            </div>

            {/* Anonymous option */}
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked: boolean) => setIsAnonymous(checked)}
              />
              <Label htmlFor="anonymous" className="cursor-pointer flex-1">
                Post anonymously
              </Label>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" disabled={isSubmitting}>
                Save draft
              </Button>
              <Button onClick={handleSubmit} className="gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Post question
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
