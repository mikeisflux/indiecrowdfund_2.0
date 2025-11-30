import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createUpdateSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
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
    const project = await db.project.findUnique({
      where: { id: data.projectId },
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
    console.error("Create update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
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
    console.error("Get updates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
