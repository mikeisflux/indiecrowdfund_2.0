import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { notifyProjectUpdate } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Update schema
const updateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  visibility: z.enum(["public", "backers_only"]).default("public"),
  publish: z.boolean().default(false),
});

// GET - List updates for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const updates = await db.update.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { comments: true },
        },
      },
    });

    // Map to frontend format
    const formattedUpdates = updates.map((update) => ({
      id: update.id,
      title: update.title,
      content: update.content,
      visibility: update.visibility.toLowerCase() as "public" | "backers_only",
      status: update.status === "PUBLISHED" ? "published" : "draft",
      isPublished: update.status === "PUBLISHED",
      publishedAt: update.publishedAt?.toISOString() || null,
      createdAt: update.createdAt.toISOString(),
      updatedAt: update.updatedAt.toISOString(),
      commentsCount: update._count.comments,
      viewsCount: update.likes, // Using likes as view count placeholder
    }));

    return NextResponse.json({ updates: formattedUpdates });
  } catch (error) {
    console.error("IndieKit updates fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}

// POST - Create or manage updates
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, updateId, ...updateData } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Handle publish/unpublish actions
    if (action === "publish" && updateId) {
      const update = await db.update.update({
        where: { id: updateId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      // Send notifications to all backers and followers
      try {
        await notifyProjectUpdate(projectId, update.title, update.content, update.id);
      } catch (notifyError) {
        console.error("Failed to send update notifications:", notifyError);
        // Don't fail the request if notifications fail
      }

      return NextResponse.json({ update });
    }

    if (action === "unpublish" && updateId) {
      const update = await db.update.update({
        where: { id: updateId },
        data: {
          status: "DRAFT",
          publishedAt: null,
        },
      });
      return NextResponse.json({ update });
    }

    // Create new update
    const validatedData = updateSchema.parse(updateData);

    const update = await db.update.create({
      data: {
        projectId,
        title: validatedData.title,
        content: validatedData.content,
        visibility: validatedData.visibility === "backers_only" ? "BACKERS_ONLY" : "PUBLIC",
        status: validatedData.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: validatedData.publish ? new Date() : null,
      },
    });

    // If publishing immediately, send notifications to all backers and followers
    if (validatedData.publish) {
      try {
        await notifyProjectUpdate(projectId, update.title, update.content, update.id);
      } catch (notifyError) {
        console.error("Failed to send update notifications:", notifyError);
        // Don't fail the request if notifications fail
      }
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit update create error:", error);
    return NextResponse.json(
      { error: "Failed to create update" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing update
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, updateId, ...updateData } = body;

    if (!projectId || !updateId) {
      return NextResponse.json({ error: "Project ID and Update ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const validatedData = updateSchema.partial().parse(updateData);

    // Get current update status to check if we're newly publishing
    const existingUpdate = await db.update.findUnique({
      where: { id: updateId },
      select: { status: true },
    });
    const wasPublished = existingUpdate?.status === "PUBLISHED";

    const update = await db.update.update({
      where: { id: updateId },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.content && { content: validatedData.content }),
        ...(validatedData.visibility && {
          visibility: validatedData.visibility === "backers_only" ? "BACKERS_ONLY" : "PUBLIC",
        }),
        ...(validatedData.publish !== undefined && {
          status: validatedData.publish ? "PUBLISHED" : "DRAFT",
          publishedAt: validatedData.publish ? new Date() : null,
        }),
      },
    });

    // Send notifications only when newly publishing (DRAFT -> PUBLISHED)
    if (validatedData.publish && !wasPublished) {
      try {
        await notifyProjectUpdate(projectId, update.title, update.content, update.id);
      } catch (notifyError) {
        console.error("Failed to send update notifications:", notifyError);
        // Don't fail the request if notifications fail
      }
    }

    return NextResponse.json({ update });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit update patch error:", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an update
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const updateId = searchParams.get("updateId");

    if (!projectId || !updateId) {
      return NextResponse.json({ error: "Project ID and Update ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    await db.update.delete({
      where: { id: updateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("IndieKit update delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete update" },
      { status: 500 }
    );
  }
}
