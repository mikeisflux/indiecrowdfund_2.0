import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminProjectsBackfillBackerNumbersLogger = logger.child({ module: "admin-projects-backfill-backer-numbers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/projects/[projectId]/backfill-backer-numbers
 *
 * Backfill backer numbers for a specific project's pledges.
 * Assigns numbers based on createdAt order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Verify project exists
    const project = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all confirmed pledges for this project, ordered by createdAt
    // This includes COMPLETED pledges and PENDING pledges with saved payment method
    const pledges = await db.pledge.findMany({
      where: {
        projectId,
        OR: [
          { status: "COMPLETED" },
          {
            status: "PENDING",
            stripePaymentMethodId: { not: null },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, backerNumber: true },
    });

    // Assign backer numbers in order
    let backerNum = 1;
    let updated = 0;
    let alreadyHad = 0;

    for (const pledge of pledges) {
      if (pledge.backerNumber === null) {
        await db.pledge.update({
          where: { id: pledge.id },
          data: { backerNumber: backerNum },
        });
        updated++;
      } else {
        alreadyHad++;
      }
      backerNum++;
    }

    return NextResponse.json({
      success: true,
      projectId,
      projectTitle: project.title,
      totalPledges: pledges.length,
      updated,
      alreadyHad,
      message: updated > 0
        ? `Assigned backer numbers to ${updated} pledges`
        : "All pledges already have backer numbers",
    });
  } catch (error) {
    adminProjectsBackfillBackerNumbersLogger.error({ err: String(error) }, "Backfill backer numbers error:");
    return NextResponse.json(
      { error: "Failed to backfill backer numbers" },
      { status: 500 }
    );
  }
}
