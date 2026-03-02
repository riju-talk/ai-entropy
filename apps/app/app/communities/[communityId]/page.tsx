"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { MessageSquare, ThumbsUp, Send, Plus, Loader2, UserPlus, UserMinus, Crown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Post {
  id: string
  title: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  likes: number
  commentCount: number
  isLiked: boolean
}

interface Comment {
  id: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  likes: number
  isLiked: boolean
}

interface Community {
  id: string
  name: string
  description: string
}

interface MembershipStatus {
  isMember: boolean
  role: string | null
}

export default function CommunityPage({ params }: { params: { communityId: string } }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session
  const { open: openAuthModal } = useAuthModal()
  const { toast } = useToast()
  
  const [community, setCommunity] = useState<Community | null>(null)
  // legacy posts state removed in favor of paginated `postsItems`
  // paginated posts state
  const [postsPage, setPostsPage] = useState(1)
  const [postsItems, setPostsItems] = useState<Post[]>([])
  const [postsHasMore, setPostsHasMore] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const postsSentinelRef = useRef<HTMLDivElement | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  // paginated comments state for selected post
  const [commentsPage, setCommentsPage] = useState(1)
  const [commentsItems, setCommentsItems] = useState<Comment[]>([])
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)
  const commentsSentinelRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  
  const [newPostTitle, setNewPostTitle] = useState("")
  const [newPostContent, setNewPostContent] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>({ isMember: false, role: null })
  const [memberCount, setMemberCount] = useState(0)
  const [joiningLoading, setJoiningLoading] = useState(false)

  useEffect(() => {
    fetchCommunity()
    // initialize posts paginated
    setPostsPage(1)
    setPostsItems([])
    loadPostsPage(1)
    fetchMembershipStatus()
  }, [params.communityId])

  const fetchCommunity = async () => {
    try {
      const response = await fetch(`/api/communities/${params.communityId}`)
      if (response.ok) {
        const data = await response.json()
        setCommunity(data)
        setMemberCount(data._count?.members || 0)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load community",
        variant: "destructive",
      })
    }
  }

  async function loadPostsPage(page: number) {
    if (postsLoadingMore) return
    setPostsLoadingMore(true)
    try {
      const res = await fetch(`/api/communities/${params.communityId}/posts?limit=5&page=${page}`)
      if (res.ok) {
        const json = await res.json()
        const items = json.posts || []
        setPostsItems((prev) => (page === 1 ? items : [...prev, ...items]))
        setPostsHasMore(json.hasMore ?? false)
        setPostsPage(page)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      })
    } finally {
      setPostsLoadingMore(false)
      setLoading(false)
    }
  }

  async function loadCommentsPage(postId: string, page: number) {
    if (commentsLoadingMore) return
    setCommentsLoadingMore(true)
    try {
      const res = await fetch(`/api/communities/${params.communityId}/posts/${postId}/comments?limit=7&page=${page}`)
      if (res.ok) {
        const json = await res.json()
        const items = json.comments || []
        setCommentsItems((prev) => (page === 1 ? items : [...prev, ...items]))
        setCommentsHasMore(json.hasMore ?? false)
        setCommentsPage(page)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      })
    } finally {
      setCommentsLoadingMore(false)
    }
  }

  // observe posts sentinel for lazy-loading
  useEffect(() => {
    const node = postsSentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && postsHasMore && !postsLoadingMore) {
          loadPostsPage(postsPage + 1)
        }
      })
    }, { root: null, rootMargin: "200px", threshold: 0.1 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [postsHasMore, postsLoadingMore, postsPage])

  // observe comments sentinel for lazy-loading
  useEffect(() => {
    const node = commentsSentinelRef.current
    if (!node || !selectedPost) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && commentsHasMore && !commentsLoadingMore) {
          loadCommentsPage(selectedPost.id, commentsPage + 1)
        }
      })
    }, { root: null, rootMargin: "200px", threshold: 0.1 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [commentsHasMore, commentsLoadingMore, commentsPage, selectedPost])

  const fetchMembershipStatus = async () => {
    if (!isAuthenticated) return
    
    try {
      const response = await fetch(`/api/communities/${params.communityId}/membership`)
      if (response.ok) {
        const data = await response.json()
        setMembershipStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch membership status:", error)
    }
  }

  const handleCreatePost = async () => {
    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide both title and content",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/communities/${params.communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newPostTitle, 
          content: newPostContent,
          subject: "OTHER" // Default subject
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || "Failed to create post")
      }

      const result = await response.json()
      
      toast({ 
        title: "Success", 
        description: "Post created! You earned 1 credit 🎉" 
      })
      
      setNewPostTitle("")
      setNewPostContent("")
      setShowNewPost(false)
      // refresh posts (reload first page)
      setPostsPage(1)
      loadPostsPage(1)
    } catch (error) {
      console.error("Error creating post:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create post",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddComment = async (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/communities/${params.communityId}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      })

        if (response.ok) {
        setNewComment("")
        // reload comments and refresh posts
        setCommentsPage(1)
        loadCommentsPage(postId, 1)
        setPostsPage(1)
        loadPostsPage(1)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleLikePost = async (postId: string) => {
    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    try {
      await fetch(`/api/communities/${params.communityId}/posts/${postId}/like`, {
        method: "POST",
      })
      // refresh posts view
      setPostsPage(1)
      loadPostsPage(1)
    } catch (error) {
      console.error("Failed to like post")
    }
  }

  const handleViewPost = (post: Post) => {
    setSelectedPost(post)
    // initialize comments for selected post
    setCommentsPage(1)
    setCommentsItems([])
    loadCommentsPage(post.id, 1)
  }

  const handleJoinCommunity = async () => {
    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    setJoiningLoading(true)
    try {
      const response = await fetch(`/api/communities/${params.communityId}/membership`, {
        method: "POST",
      })

      if (response.ok) {
        toast({ 
          title: "Success", 
          description: "You've joined the community!" 
        })
        setMembershipStatus({ isMember: true, role: "MEMBER" })
        setMemberCount(prev => prev + 1)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to join")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join community",
        variant: "destructive",
      })
    } finally {
      setJoiningLoading(false)
    }
  }

  const handleLeaveCommunity = async () => {
    setJoiningLoading(true)
    try {
      const response = await fetch(`/api/communities/${params.communityId}/membership`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({ 
          title: "Success", 
          description: "You've left the community" 
        })
        setMembershipStatus({ isMember: false, role: null })
        setMemberCount(prev => prev - 1)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to leave")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave community",
        variant: "destructive",
      })
    } finally {
      setJoiningLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Community Header */}
      {community && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-3xl">{community.name}</CardTitle>
                  {membershipStatus.role === "ADMIN" && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-2">{community.description}</CardDescription>
                <div className="flex items-center gap-4 mt-3">
                  <Badge variant="secondary">
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                  </Badge>
                  {community.subject && (
                    <Badge variant="outline">{community.subject}</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {membershipStatus.isMember ? (
                  <>
                    <Button onClick={() => setShowNewPost(!showNewPost)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Post
                    </Button>
                    {membershipStatus.role !== "ADMIN" && (
                      <Button 
                        variant="outline" 
                        onClick={handleLeaveCommunity}
                        disabled={joiningLoading}
                      >
                        {joiningLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="mr-2 h-4 w-4" />
                        )}
                        Leave
                      </Button>
                    )}
                  </>
                ) : (
                  <Button onClick={handleJoinCommunity} disabled={joiningLoading}>
                    {joiningLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Join Community
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts List */}
        <div className="lg:col-span-2 space-y-4">
          {showNewPost && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Post</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Post title..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
                <Textarea
                  placeholder="What's on your mind?"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreatePost} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Post
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewPost(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {postsItems.map((post) => (
            <Card key={post.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader onClick={() => handleViewPost(post)}>
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={post.author.image} />
                    <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{post.author.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <CardTitle className="mt-2">{post.title}</CardTitle>
                    <p className="mt-2 text-muted-foreground line-clamp-3">{post.content}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLikePost(post.id)
                    }}
                  >
                    <ThumbsUp className={`mr-2 h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} />
                    {post.likes}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleViewPost(post)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {post.commentCount}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {postsItems.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No posts yet. Be the first to post!</p>
              </CardContent>
            </Card>
          )}
          {/* sentinel for posts lazy-loading */}
          <div ref={postsSentinelRef} className="h-2" aria-hidden />
        </div>

        {/* Thread View */}
        <div className="lg:col-span-1">
          {selectedPost ? (
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Thread</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)}>
                  Close
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
                <div>
                  <h3 className="font-semibold">{selectedPost.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{selectedPost.content}</p>
                </div>
                
                <Separator />

                <div className="space-y-3">
                  {commentsItems.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author.image} />
                          <AvatarFallback>{comment.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{comment.author.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {commentsItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                )}

                {/* sentinel for comments lazy-loading */}
                <div ref={commentsSentinelRef} className="h-2" aria-hidden />

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleAddComment(selectedPost.id)}
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="sticky top-4">
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a post to view comments</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
