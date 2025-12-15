import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";
import { notifyCommentReply } from "@/lib/notifications";

// Helper to format a comment with user info
async function formatComment(
  comment: {
    id: string;
    userId: string;
    content: string;
    createdAt: Date;
    user: { id: string; name: string | null; image: string | null };
    replies?: Array<{
      id: string;
      userId: string;
      content: string;
      createdAt: Date;
      user: { id: string; name: string | null; image: string | null };
    }>;
  },
  creatorId: string
) {
  // Check if user is superbacker (backed 25+ projects)
  const backedProjectsCount = await db.pledge.count({
    where: {
      userId: comment.userId,
      status: "COMPLETED",
    },
  });

  const formatted: {
    id: string;
    author: string;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
    isCreator: boolean;
    isSuperbacker: boolean;
    isPinned: boolean;
    replies?: Array<{
      id: string;
      author: string;
      avatarUrl: string | null;
      content: string;
      createdAt: string;
      isCreator: boolean;
      isSuperbacker: boolean;
    }>;
  } = {
    id: comment.id,
    author: comment.user.name || "Anonymous",
    avatarUrl: comment.user.image,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    isCreator: comment.userId === creatorId,
    isSuperbacker: backedProjectsCount >= 25,
    isPinned: false,
  };

  // Format replies if present
  if (comment.replies && comment.replies.length > 0) {
    formatted.replies = await Promise.all(
      comment.replies.map(async (reply) => {
        const replyBackedCount = await db.pledge.count({
          where: {
            userId: reply.userId,
            status: "COMPLETED",
          },
        });

        return {
          id: reply.id,
          author: reply.user.name || "Anonymous",
          avatarUrl: reply.user.image,
          content: reply.content,
          createdAt: reply.createdAt.toISOString(),
          isCreator: reply.userId === creatorId,
          isSuperbacker: replyBackedCount >= 25,
        };
      })
    );
  }

  return formatted;
}

// GET /api/projects/[id]/comments - Fetch comments for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Fetch only top-level comments (no parentId), include replies
    const comments = await db.comment.findMany({
      where: {
        projectId,
        parentId: null, // Only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get project to check for creator
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json([]);
    }

    // Format all comments with their replies
    const formattedComments = await Promise.all(
      comments.map((comment) => formatComment(comment, project.creatorId))
    );

    return NextResponse.json(formattedComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/comments - Create a new comment or reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to comment" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const { content, parentId } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Check if project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, creatorId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isCreator = project.creatorId === session.user.id;

    // Store parent comment for notification later
    let parentComment: { id: string; userId: string } | null = null;

    // If this is a reply (has parentId), only creators can reply
    if (parentId) {
      if (!isCreator) {
        return NextResponse.json(
          { error: "Only the project creator can reply to comments" },
          { status: 403 }
        );
      }

      // Verify parent comment exists and belongs to this project
      parentComment = await db.comment.findFirst({
        where: {
          id: parentId,
          projectId,
          parentId: null, // Can only reply to top-level comments
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    } else {
      // For top-level comments, must be backer or creator
      if (!isCreator) {
        const pledge = await db.pledge.findFirst({
          where: {
            userId: session.user.id,
            projectId,
            status: "COMPLETED",
          },
        });

        if (!pledge) {
          return NextResponse.json(
            { error: "Only backers can comment on this project" },
            { status: 403 }
          );
        }
      }
    }

    // Create the comment/reply
    const comment = await db.comment.create({
      data: {
        projectId,
        userId: session.user.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Get superbacker status
    const backedProjectsCount = await db.pledge.count({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
    });

    // Send notification to the original commenter if this is a reply
    if (parentComment && parentComment.userId !== session.user.id) {
      // Get project details for the notification
      const projectDetails = await db.project.findUnique({
        where: { id: projectId },
        select: { title: true, slug: true },
      });

      if (projectDetails) {
        // Non-blocking notification - don't fail the request if notification fails
        notifyCommentReply(
          parentComment.userId,
          session.user.name || "The creator",
          projectId,
          projectDetails.title,
          projectDetails.slug,
          content.trim()
        ).catch((err) => {
          console.error("Failed to send comment reply notification:", err);
        });
      }
    }

    return NextResponse.json({
      id: comment.id,
      author: comment.user.name || "Anonymous",
      avatarUrl: comment.user.image,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      isCreator,
      isSuperbacker: backedProjectsCount >= 25,
      isPinned: false,
      parentId: comment.parentId,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
