"use client"

import type React from "react"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import CommentCard from "./CommentCard"
import { createComment } from "@/app/actions/comments"
import { useToast } from "@/hooks/use-toast"

interface CommentSectionProps {
  doubtId: string
  comments: any[]
  currentUser?: any
  doubtAuthorId?: string | null
}

export default function CommentSection({ doubtId, comments, currentUser, doubtAuthorId }: CommentSectionProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [content, setContent] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("content", content)
      formData.append("doubtId", doubtId)
      formData.append("isAnonymous", isAnonymous.toString())

      await createComment(formData)
      setContent("")
      setIsAnonymous(false)
      toast({
        title: "Success!",
        description: "Your answer has been posted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post your answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle>{comments.length} Answers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No answers yet. Be the first to help!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} currentUser={currentUser} doubtAuthorId={doubtAuthorId} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Answer form */}
      <Card>
        <CardHeader>
          <CardTitle>Your Answer</CardTitle>
        </CardHeader>
        <CardContent>
          {session ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your answer here... You can use markdown formatting."
                className="min-h-[150px]"
                disabled={isSubmitting}
                required
              />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="anonymous-answer"
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                  disabled={isSubmitting}
                />
                <Label htmlFor="anonymous-answer">Post anonymously</Label>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Use markdown for formatting. Be specific and helpful.</p>
                <Button type="submit" disabled={isSubmitting || !content.trim()}>
                  {isSubmitting ? "Posting..." : "Post Answer"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Sign in to post an answer</p>
              <Button asChild>
                <a href="/auth/signin">Sign In</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
