"use client"

import { useTransition } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Award, MessageCircle, Share } from "lucide-react"
import { formatTimeAgo } from "@/lib/utils"
import VoteButtons from "./VoteButtons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { markCommentAsAccepted } from "@/app/actions/comments"
import { useToast } from "@/hooks/use-toast"

interface CommentCardProps {
  comment: any
  currentUser?: any
  doubtAuthorId?: string | null
}

export default function CommentCard({ comment, currentUser, doubtAuthorId }: CommentCardProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleMarkAsAccepted = () => {
    startTransition(async () => {
      try {
        await markCommentAsAccepted(comment.id)
        toast({
          title: "Success!",
          description: "Answer marked as accepted.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to mark answer as accepted.",
          variant: "destructive",
        })
      }
    })
  }

  const canMarkAsAccepted = currentUser?.id === doubtAuthorId && !comment.isAccepted

  return (
    <Card className={comment.isAccepted ? "border-green-200 bg-green-50/50" : ""}>
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Vote buttons */}
          <VoteButtons itemId={comment.id} itemType="comment" votes={comment.votes} className="flex-shrink-0" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              {comment.author ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.author.image || ""} />
                    <AvatarFallback className="text-xs">{comment.author.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{comment.author.name}</span>
                  {comment.author.role === "TEACHER" && (
                    <Badge variant="outline" className="text-xs">
                      Teacher
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="font-medium">Anonymous</span>
              )}

              <span className="text-sm text-muted-foreground">• {formatTimeAgo(new Date(comment.createdAt))}</span>

              {comment.isAccepted && (
                <Badge className="bg-green-100 text-green-700 ml-auto">
                  <Award className="h-3 w-3 mr-1" />
                  Accepted Answer
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none mb-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                Reply
              </Button>
              <Button variant="ghost" size="sm">
                <Share className="h-4 w-4 mr-1" />
                Share
              </Button>

              {canMarkAsAccepted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAsAccepted}
                  disabled={isPending}
                  className="ml-auto bg-transparent"
                >
                  <Award className="h-4 w-4 mr-1" />
                  {isPending ? "Marking..." : "Mark as Accepted"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
