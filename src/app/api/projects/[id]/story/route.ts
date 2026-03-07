import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsStoryLogger = logger.child({ module: "projects-story" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

const storySchema = z.object({
  description: z.string().optional(),
  risks: z.string().optional(),
  usesAI: z.boolean().optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
});

// POST - Update project story
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    // Story can be edited even on launched projects

    const body = await req.json();
    const data = storySchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.description !== undefined) updateData.description = data.description;
    if (data.risks !== undefined) updateData.risks = data.risks;
    if (data.usesAI !== undefined) updateData.usesAI = data.usesAI;
    if (data.faqs !== undefined) updateData.faqs = data.faqs;

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        description: true,
        risks: true,
        usesAI: true,
        faqs: true,
      },
    });

    projectsStoryLogger.info(`Project story updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    projectsStoryLogger.error({ err: String(error) }, "Update story error:");

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update project story" },
      { status: 500 }
    );
  }
}

// GET - Get project story
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        description: true,
        risks: true,
        usesAI: true,
        faqs: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    projectsStoryLogger.error({ err: String(error) }, "Get story error:");
    return NextResponse.json(
      { error: "Failed to get project story" },
      { status: 500 }
    );
  }
}
