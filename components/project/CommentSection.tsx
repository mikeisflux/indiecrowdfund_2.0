"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Reply, Edit, Trash2, Send } from "lucide-react"

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    avatar: string | null
  }
  _count: {
    replies: number
  }
}

interface CommentSectionProps {
  projectId: string
}

export default function CommentSection({ projectId }: CommentSectionProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [replies, setReplies] = useState<Record<string, Comment[]>>({})
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchComments()
  }, [projectId])

  const fetchComments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch comments")
      }

      setComments(data)
    } catch (error: any) {
      console.error("Failed to fetch comments:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchReplies = async (commentId: string) => {
    if (loadingReplies[commentId] || replies[commentId]) return

    setLoadingReplies({ ...loadingReplies, [commentId]: true })
    try {
      const response = await fetch(
        `/api/projects/${projectId}/comments?parentId=${commentId}`
      )
      const data = await response.json()

      if (response.ok) {
        setReplies({ ...replies, [commentId]: data })
      }
    } catch (error) {
      console.error("Failed to fetch replies:", error)
    } finally {
      setLoadingReplies({ ...loadingReplies, [commentId]: false })
    }
  }

  const postComment = async () => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to comment",
        variant: "destructive",
      })
      return
    }

    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to post comment")
      }

      toast({
        title: "Success",
        description: "Comment posted successfully",
      })

      setNewComment("")
      fetchComments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const postReply = async (parentId: string) => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to reply",
        variant: "destructive",
      })
      return
    }

    if (!replyContent.trim()) {
      toast({
        title: "Error",
        description: "Reply cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to post reply")
      }

      toast({
        title: "Success",
        description: "Reply posted successfully",
      })

      setReplyingTo(null)
      setReplyContent("")

      // Refresh replies
      setReplies({ ...replies, [parentId]: undefined })
      await fetchReplies(parentId)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to post reply",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateComment = async (commentId: string) => {
    if (!editContent.trim()) {
      toast({
        title: "Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update comment")
      }

      toast({
        title: "Success",
        description: "Comment updated successfully",
      })

      setEditingComment(null)
      setEditContent("")
      fetchComments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update comment",
        variant: "destructive",
      })
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete comment")
      }

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      })

      fetchComments()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      })
    }
  }

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isEditing = editingComment === comment.id
    const isOwner = session?.user?.id === comment.user.id

    return (
      <div
        key={comment.id}
        className={`${isReply ? "ml-12 mt-4" : ""} space-y-4`}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            {comment.user.avatar ? (
              <img
                src={comment.user.avatar}
                alt=""
                className="w-full h-full rounded-full"
              />
            ) : (
              <span className="font-bold">
                {comment.user.name?.[0] ||
                  comment.user.username?.[0] ||
                  "U"}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {comment.user.name || comment.user.username}
              </p>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
              {comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateComment(comment.id)}
                    size="sm"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingComment(null)
                      setEditContent("")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

                <div className="flex items-center gap-4 pt-2">
                  {session && !isReply && (
                    <Button
                      onClick={() => {
                        setReplyingTo(comment.id)
                        if (!replies[comment.id]) {
                          fetchReplies(comment.id)
                        }
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Reply
                      {comment._count.replies > 0 && (
                        <span className="ml-2">({comment._count.replies})</span>
                      )}
                    </Button>
                  )}

                  {isOwner && (
                    <>
                      <Button
                        onClick={() => {
                          setEditingComment(comment.id)
                          setEditContent(comment.content)
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteComment(comment.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-4 space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => postReply(comment.id)}
                    disabled={isSubmitting}
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Posting..." : "Post Reply"}
                  </Button>
                  <Button
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent("")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Replies */}
            {replies[comment.id] && replies[comment.id].length > 0 && (
              <div className="mt-4 space-y-4">
                {replies[comment.id].map((reply) => renderComment(reply, true))}
              </div>
            )}

            {/* Load Replies Button */}
            {!isReply &&
              comment._count.replies > 0 &&
              !replies[comment.id] &&
              replyingTo !== comment.id && (
                <Button
                  onClick={() => fetchReplies(comment.id)}
                  size="sm"
                  variant="outline"
                  disabled={loadingReplies[comment.id]}
                >
                  {loadingReplies[comment.id]
                    ? "Loading..."
                    : `View ${comment._count.replies} ${
                        comment._count.replies === 1 ? "reply" : "replies"
                      }`}
                </Button>
              )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <MessageSquare className="w-6 h-6" />
        Comments ({comments.length})
      </h2>

      {/* Comment Form */}
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>Leave a Comment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts about this project..."
                className="min-h-[100px]"
              />
              <Button onClick={postComment} disabled={isSubmitting}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Please log in to leave a comment
            </p>
            <Link href="/login">
              <Button>Log In</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading comments...</p>
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="pt-6">
                {renderComment(comment)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
