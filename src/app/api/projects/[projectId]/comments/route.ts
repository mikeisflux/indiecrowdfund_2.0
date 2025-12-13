import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";

// GET /api/projects/[projectId]/comments - Fetch comments for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const comments = await db.comment.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get project to check for creator
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    // Get superbacker status for each commenter
    const formattedComments = await Promise.all(
      comments.map(async (comment) => {
        // Check if user is superbacker (backed 25+ projects)
        const backedProjectsCount = await db.pledge.count({
          where: {
            userId: comment.userId,
            status: "COMPLETED",
          },
        });

        return {
          id: comment.id,
          author: comment.user.name || "Anonymous",
          avatarUrl: comment.user.image,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          isCreator: comment.userId === project?.creatorId,
          isSuperbacker: backedProjectsCount >= 25,
          isPinned: false, // TODO: Add pinned field to Comment model if needed
        };
      })
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

// POST /api/projects/[projectId]/comments - Create a new comment (backers only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to comment" },
        { status: 401 }
      );
    }

    const { projectId } = await params;
    const { content } = await request.json();

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

    // Check if user is a backer OR the project creator
    const isCreator = project.creatorId === session.userId;

    if (!isCreator) {
      const pledge = await db.pledge.findFirst({
        where: {
          userId: session.userId,
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

    // Create the comment
    const comment = await db.comment.create({
      data: {
        projectId,
        userId: session.userId,
        content: content.trim(),
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
        userId: session.userId,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      id: comment.id,
      author: comment.user.name || "Anonymous",
      avatarUrl: comment.user.image,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      isCreator,
      isSuperbacker: backedProjectsCount >= 25,
      isPinned: false,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
