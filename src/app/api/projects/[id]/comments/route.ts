import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";
import { notifyCommentReply } from "@/lib/notifications";

type CommentWithUser = {
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
};

// Batch fetch superbacker status for multiple users (fixes N+1 query)
async function getSuperbakerStatus(userIds: string[]): Promise<Map<string, boolean>> {
  const uniqueUserIds = Array.from(new Set(userIds));

  // Count completed pledges per user in a single query
  const pledgeCounts = await db.pledge.groupBy({
    by: ['userId'],
    where: {
      userId: { in: uniqueUserIds },
      status: "COMPLETED",
    },
    _count: { id: true },
  });

  const statusMap = new Map<string, boolean>();
  for (const userId of uniqueUserIds) {
    const count = pledgeCounts.find(p => p.userId === userId)?._count.id || 0;
    statusMap.set(userId, count >= 25);
  }
  return statusMap;
}

// Helper to format a comment with user info (using pre-fetched superbacker status)
function formatComment(
  comment: CommentWithUser,
  creatorId: string,
  superbackerMap: Map<string, boolean>
) {
  const formatted: {
    id: string;
    userId: string;
    author: string;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
    isCreator: boolean;
    isSuperbacker: boolean;
    isPinned: boolean;
    replies?: Array<{
      id: string;
      userId: string;
      author: string;
      avatarUrl: string | null;
      content: string;
      createdAt: string;
      isCreator: boolean;
      isSuperbacker: boolean;
    }>;
  } = {
    id: comment.id,
    userId: comment.userId,
    author: comment.user.name || "Anonymous",
    avatarUrl: comment.user.image,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    isCreator: comment.userId === creatorId,
    isSuperbacker: superbackerMap.get(comment.userId) || false,
    isPinned: false,
  };

  // Format replies if present
  if (comment.replies && comment.replies.length > 0) {
    formatted.replies = comment.replies.map((reply) => ({
      id: reply.id,
      userId: reply.userId,
      author: reply.user.name || "Anonymous",
      avatarUrl: reply.user.image,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
      isCreator: reply.userId === creatorId,
      isSuperbacker: superbackerMap.get(reply.userId) || false,
    }));
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

    // Collect all user IDs from comments and replies for batch superbacker lookup
    const allUserIds: string[] = [];
    for (const comment of comments) {
      allUserIds.push(comment.userId);
      if (comment.replies) {
        for (const reply of comment.replies) {
          allUserIds.push(reply.userId);
        }
      }
    }

    // Batch fetch superbacker status (single query instead of N+1)
    const superbackerMap = await getSuperbakerStatus(allUserIds);

    // Format all comments with their replies
    const formattedComments = comments.map((comment) =>
      formatComment(comment, project.creatorId, superbackerMap)
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
    let parentComment: { id: string; userId: string; parentId: string | null } | null = null;
    let rootCommentUserId: string | null = null;

    // If this is a reply (has parentId)
    if (parentId) {
      // Verify parent comment exists and belongs to this project
      parentComment = await db.comment.findFirst({
        where: {
          id: parentId,
          projectId,
        },
        select: {
          id: true,
          userId: true,
          parentId: true,
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      // Determine the root comment (top-level comment in the thread)
      let rootComment = parentComment;
      if (parentComment.parentId) {
        // This is a reply to a reply - find the root comment
        const root = await db.comment.findFirst({
          where: {
            id: parentComment.parentId,
            projectId,
          },
          select: {
            id: true,
            userId: true,
            parentId: true,
          },
        });
        if (root) {
          rootComment = root;
        }
      }
      rootCommentUserId = rootComment.userId;

      // Permission check for replies:
      // - Creators can reply to any comment
      // - Backers can reply if they are the original commenter (continuing conversation)
      // - Backers can reply if they have backed the project (joining discussion)
      if (!isCreator) {
        const isOriginalCommenter = rootCommentUserId === session.user.id;

        if (!isOriginalCommenter) {
          // Check if they're a backer
          const pledge = await db.pledge.findFirst({
            where: {
              userId: session.user.id,
              projectId,
              status: "COMPLETED",
            },
          });

          if (!pledge) {
            return NextResponse.json(
              { error: "Only backers can reply to comments" },
              { status: 403 }
            );
          }
        }
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

    // When replying to a reply, flatten it under the root comment
    // This keeps all replies at one level of nesting for easier display
    let actualParentId = parentId || null;
    if (parentComment && parentComment.parentId) {
      // This is a reply to a reply - use the root comment as parent
      actualParentId = parentComment.parentId;
    }

    // Create the comment/reply
    const comment = await db.comment.create({
      data: {
        projectId,
        userId: session.user.id,
        content: content.trim(),
        parentId: actualParentId,
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
        select: {
          title: true,
          slug: true,
          creator: { select: { vanityUrl: true } },
        },
      });

      if (projectDetails) {
        // Build project URL with vanity URL if available
        const projectUrlPath = projectDetails.creator?.vanityUrl
          ? `/projects/${projectDetails.creator.vanityUrl}/${projectDetails.slug}`
          : undefined;

        // Non-blocking notification - don't fail the request if notification fails
        notifyCommentReply(
          parentComment.userId,
          session.user.name || "The creator",
          projectId,
          projectDetails.title,
          projectDetails.slug,
          content.trim(),
          projectUrlPath
        ).catch((err) => {
          console.error("Failed to send comment reply notification:", err);
        });
      }
    }

    return NextResponse.json({
      id: comment.id,
      userId: session.user.id,
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
