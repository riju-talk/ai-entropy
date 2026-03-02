"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Label } from "./ui/label"
import { Checkbox } from "./ui/checkbox"
import { X, Plus } from "lucide-react"
import { createDoubt } from "@/app/actions/doubts"
import { useToast } from "@/hooks/use-toast"

interface AskDoubtFormProps {
  user?: any
}

export default function AskDoubtForm({ user }: AskDoubtFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 5) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = (formData: FormData) => {
    formData.append("tags", JSON.stringify(tags))
    formData.append("isAnonymous", isAnonymous.toString())

    startTransition(async () => {
      try {
        await createDoubt(formData)
        toast({
          title: "Success!",
          description: "Your doubt has been posted successfully.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to post your doubt. Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Card className="border-white/5 bg-card/60 backdrop-blur-sm">
      <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
        <CardTitle className="text-xl sm:text-2xl">Share Your Doubt</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <form action={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm sm:text-base">Title *</Label>
            <Input 
              id="title" 
              name="title" 
              placeholder="What's your specific question?" 
              required 
              disabled={isPending}
              className="text-sm sm:text-base"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Be specific and imagine you're asking a question to another person
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm sm:text-base">Subject *</Label>
            <Select name="subject" required disabled={isPending}>
              <SelectTrigger className="text-sm sm:text-base">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
                <SelectItem value="MATHEMATICS">Mathematics</SelectItem>
                <SelectItem value="PHYSICS">Physics</SelectItem>
                <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                <SelectItem value="BIOLOGY">Biology</SelectItem>
                <SelectItem value="ENGINEERING">Engineering</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
                <SelectItem value="LITERATURE">Literature</SelectItem>
                <SelectItem value="HISTORY">History</SelectItem>
                <SelectItem value="PSYCHOLOGY">Psychology</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm sm:text-base">Description *</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Describe your problem in detail. Include what you've tried, error messages, and expected behavior."
              className="min-h-[120px] sm:min-h-[150px] text-sm sm:text-base"
              required
              disabled={isPending}
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              You can use markdown formatting. Include code snippets and what you've already tried.
            </p>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl" className="text-sm sm:text-base">Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              disabled={isPending}
              className="text-sm sm:text-base"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Tags</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                disabled={isPending}
                className="text-sm sm:text-base flex-1"
              />
              <Button 
                type="button" 
                onClick={handleAddTag} 
                variant="outline" 
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs sm:text-sm">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                    disabled={isPending}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Add up to 5 tags to help others find your question</p>
          </div>

          {/* Anonymous option */}
          <div className="flex items-center space-x-2">
            <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} disabled={isPending} />
            <Label htmlFor="anonymous" className="text-sm sm:text-base">Post anonymously</Label>
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()} 
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? "Posting..." : "Post Doubt"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
