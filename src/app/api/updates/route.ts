import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const updatesLogger = logger.child({ module: "updates" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createUpdateSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(100000),
  visibility: z.enum(["PUBLIC", "BACKERS_ONLY"]).default("PUBLIC"),
  publish: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createUpdateSchema.parse(body);

    // Verify project ownership
    const project = await db.project.findFirst({
      where: { id: data.projectId, deletedAt: null },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const update = await db.update.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        content: data.content,
        visibility: data.visibility,
        status: data.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: data.publish ? new Date() : null,
      },
    });

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    updatesLogger.error({ err: String(error) }, "Create update error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create update" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const includesDrafts = searchParams.get("drafts") === "true";

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    // Check if user owns project (for drafts access)
    let canSeeDrafts = false;
    if (includesDrafts) {
      const session = await auth();
      if (session?.user?.id) {
        const project = await db.project.findUnique({
          where: { id: projectId },
          select: { creatorId: true },
        });
        canSeeDrafts = project?.creatorId === session.user.id;
      }
    }

    const updates = await db.update.findMany({
      where: {
        projectId,
        ...(canSeeDrafts ? {} : { status: "PUBLISHED" }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ updates });
  } catch (error) {
    updatesLogger.error({ err: String(error) }, "Get updates error:");
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
