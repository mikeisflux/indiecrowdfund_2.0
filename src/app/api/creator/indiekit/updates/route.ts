import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitUpdatesLogger = logger.child({ module: "creator-indiekit-updates" });
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
        deletedAt: null,
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
    creatorIndiekitUpdatesLogger.error({ err: String(error) }, "IndieKit updates fetch error:");
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
        deletedAt: null,
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
      // CAS on status: DRAFT → PUBLISHED. Without the status predicate,
      // two concurrent publish clicks would both succeed and both fire
      // notifyProjectUpdate → duplicate update notifications to every
      // backer and follower.
      const publishResult = await db.update.updateMany({
        where: { id: updateId, projectId, status: "DRAFT" },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      if (publishResult.count === 0) {
        // Either not found, or already published — return the current row
        const existing = await db.update.findFirst({ where: { id: updateId, projectId } });
        if (!existing) {
          return NextResponse.json({ error: "Update not found or access denied" }, { status: 403 });
        }
        return NextResponse.json({ update: existing, alreadyPublished: true });
      }

      const update = await db.update.findFirst({ where: { id: updateId } });

      // Send notifications to all backers and followers — only runs
      // on the call that actually flipped DRAFT → PUBLISHED.
      try {
        await notifyProjectUpdate(projectId, update.title, update.content, update.id);
      } catch (notifyError) {
        creatorIndiekitUpdatesLogger.error({ err: String(notifyError) }, "Failed to send update notifications:");
        // Don't fail the request if notifications fail
      }

      return NextResponse.json({ update });
    }

    if (action === "unpublish" && updateId) {
      const unpublishResult = await db.update.updateMany({
        where: { id: updateId, projectId },
        data: {
          status: "DRAFT",
          publishedAt: null,
        },
      });

      if (unpublishResult.count === 0) {
        return NextResponse.json({ error: "Update not found or access denied" }, { status: 403 });
      }

      const update = await db.update.findFirst({ where: { id: updateId } });
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
        creatorIndiekitUpdatesLogger.error({ err: String(notifyError) }, "Failed to send update notifications:");
        // Don't fail the request if notifications fail
      }
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    creatorIndiekitUpdatesLogger.error({ err: String(error) }, "IndieKit update create error:");
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
        deletedAt: null,
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
        creatorIndiekitUpdatesLogger.error({ err: String(notifyError) }, "Failed to send update notifications:");
        // Don't fail the request if notifications fail
      }
    }

    return NextResponse.json({ update });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    creatorIndiekitUpdatesLogger.error({ err: String(error) }, "IndieKit update patch error:");
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
        deletedAt: null,
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

    const deleteResult = await db.update.deleteMany({
      where: { id: updateId, projectId },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: "Update not found or access denied" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitUpdatesLogger.error({ err: String(error) }, "IndieKit update delete error:");
    return NextResponse.json(
      { error: "Failed to delete update" },
      { status: 500 }
    );
  }
}
