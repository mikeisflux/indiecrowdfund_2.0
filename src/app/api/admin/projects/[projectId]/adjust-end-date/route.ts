import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminProjectsAdjustEndDateLogger = logger.child({ module: "admin-projects-adjust-end-date" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/projects/[projectId]/adjust-end-date
 *
 * Adjust the end date of a project. Accepts exact date+time ISO string.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const { endDate } = body;

    if (!endDate) {
      return NextResponse.json({ error: "endDate is required" }, { status: 400 });
    }

    const parsedDate = new Date(endDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, endDate: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update end date
    const updated = await db.project.update({
      where: { id: projectId },
      data: { endDate: parsedDate },
      select: { id: true, title: true, endDate: true },
    });

    adminProjectsAdjustEndDateLogger.info(`[Admin] End date adjusted for project "${project.title}" (${projectId}): ${project.endDate?.toISOString() || "none"} → ${parsedDate.toISOString()} by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      project: {
        id: updated.id,
        title: updated.title,
        endDate: updated.endDate?.toISOString(),
      },
    });
  } catch (error) {
    adminProjectsAdjustEndDateLogger.error({ err: String(error) }, "Error adjusting end date:");
    return NextResponse.json({ error: "Failed to adjust end date" }, { status: 500 });
  }
}
