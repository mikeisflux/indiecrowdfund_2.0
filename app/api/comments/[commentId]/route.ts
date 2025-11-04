import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
    })

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Only comment author can edit
    if (comment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      )
    }

    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      )
    }

    const updated = await prisma.comment.update({
      where: { id: params.commentId },
      data: {
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Comment update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update comment" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { commentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: {
        project: {
          select: {
            creatorId: true,
          },
        },
      },
    })

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Comment author or project creator can delete
    const canDelete =
      comment.userId === session.user.id ||
      comment.project.creatorId === session.user.id ||
      session.user.role === "ADMIN"

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this comment" },
        { status: 403 }
      )
    }

    // Soft delete
    await prisma.comment.update({
      where: { id: params.commentId },
      data: {
        isDeleted: true,
        content: "[Comment deleted]",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Comment deletion error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete comment" },
      { status: 500 }
    )
  }
}
