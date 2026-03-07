import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminBackfillBackerNumbersLogger = logger.child({ module: "admin-backfill-backer-numbers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backfill-backer-numbers
 *
 * Backfill backer numbers for all existing pledges that don't have one.
 * Assigns numbers based on createdAt order within each project.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all projects that have pledges without backer numbers
    const projectsNeedingBackfill = await db.project.findMany({
      where: {
        pledges: {
          some: {
            backerNumber: null,
            OR: [
              { status: "COMPLETED" },
              {
                status: "PENDING",
                stripePaymentMethodId: { not: null },
              },
            ],
          },
        },
      },
      select: { id: true, title: true },
    });

    const results: { projectId: string; title: string; updated: number }[] = [];

    for (const project of projectsNeedingBackfill) {
      // Get all confirmed pledges for this project, ordered by createdAt
      // This includes COMPLETED pledges and PENDING pledges with saved payment method
      const pledges = await db.pledge.findMany({
        where: {
          projectId: project.id,
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

      for (const pledge of pledges) {
        if (pledge.backerNumber === null) {
          await db.pledge.update({
            where: { id: pledge.id },
            data: { backerNumber: backerNum },
          });
          updated++;
        }
        backerNum++;
      }

      if (updated > 0) {
        results.push({
          projectId: project.id,
          title: project.title,
          updated,
        });
      }
    }

    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

    return NextResponse.json({
      success: true,
      message: `Backfilled ${totalUpdated} pledges across ${results.length} projects`,
      details: results,
    });
  } catch (error) {
    adminBackfillBackerNumbersLogger.error({ err: String(error) }, "Backfill backer numbers error:");
    return NextResponse.json(
      { error: "Failed to backfill backer numbers" },
      { status: 500 }
    );
  }
}
