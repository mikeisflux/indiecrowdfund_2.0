import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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

    // Run the backfill inside a transaction that acquires the same
    // SELECT FOR UPDATE lock on the Project row that assignBackerNumber()
    // uses. Without the shared lock a new pledge being confirmed mid-
    // backfill would race us and potentially pick an overlapping number.
    const { updated, alreadyHad, totalPledges } = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;

      // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields
      // at runtime — use `NOT: { field: null }` wrapper syntax instead.
      const pledges = await tx.pledge.findMany({
        where: {
          projectId,
          OR: [
            { status: "COMPLETED" },
            {
              status: "PENDING",
              NOT: { stripePaymentMethodId: null },
            },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, backerNumber: true },
      });

      // Start past the current max backer number so we don't collide
      // with pledges that already have numbers assigned.
      const maxExisting = pledges.reduce(
        (max, p) => (p.backerNumber !== null ? Math.max(max, p.backerNumber) : max),
        0
      );
      let backerNum = maxExisting + 1;
      let updatedCount = 0;
      let alreadyHadCount = 0;

      for (const pledge of pledges) {
        if (pledge.backerNumber === null) {
          await tx.pledge.update({
            where: { id: pledge.id },
            data: { backerNumber: backerNum },
          });
          updatedCount++;
          backerNum++;
        } else {
          alreadyHadCount++;
        }
      }

      return {
        updated: updatedCount,
        alreadyHad: alreadyHadCount,
        totalPledges: pledges.length,
      };
    });

    return NextResponse.json({
      success: true,
      projectId,
      projectTitle: project.title,
      totalPledges,
      updated,
      alreadyHad,
      message: updated > 0
        ? `Assigned backer numbers to ${updated} pledges`
        : "All pledges already have backer numbers",
    });
  } catch (error) {
    adminProjectsBackfillBackerNumbersLogger.error({ err: formatError(error) }, "Backfill backer numbers error:");
    return NextResponse.json(
      { error: "Failed to backfill backer numbers" },
      { status: 500 }
    );
  }
}
