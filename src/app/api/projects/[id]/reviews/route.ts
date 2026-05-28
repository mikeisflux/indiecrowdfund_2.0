import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsReviewsLogger = logger.child({ module: "projects-reviews" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Get review history for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;

    // Get the project to verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: { id: true, creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only allow creator or admin to see review history
    // In production, also check for admin role
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get review history
    const reviews = await db.projectReview.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        previousStatus: true,
        newStatus: true,
        notes: true,
        rejectionReason: true,
        flagsRaised: true,
        aiConfidenceScore: true,
        createdAt: true,
        // Don't expose internal notes to creators
        // internalNotes: true,
      },
    });

    return NextResponse.json({
      projectId,
      currentStatus: project.status,
      reviews,
    });
  } catch (error) {
    projectsReviewsLogger.error({ err: formatError(error) }, "Error fetching project reviews:");
    return NextResponse.json(
      { error: "Failed to fetch review history" },
      { status: 500 }
    );
  }
}
