import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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

    // Get all projects that have pledges without backer numbers.
    // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields
    // at runtime — use `NOT: { field: null }` wrapper syntax instead.
    const projectsNeedingBackfill = await db.project.findMany({
      where: {
        pledges: {
          some: {
            backerNumber: null,
            OR: [
              { status: "COMPLETED" },
              {
                status: "PENDING",
                NOT: { stripePaymentMethodId: null },
              },
            ],
          },
        },
      },
      select: { id: true, title: true },
    });

    const results: { projectId: string; title: string; updated: number }[] = [];

    for (const project of projectsNeedingBackfill) {
      // Run the backfill inside a transaction that acquires the same
      // SELECT FOR UPDATE lock on the Project row that
      // assignBackerNumber() uses in src/lib/payments/stripe/rewards.ts.
      // Without the shared lock, a new pledge being confirmed mid-
      // backfill could call assignBackerNumber() in parallel and
      // assign the same number we're about to write, creating
      // duplicate backer numbers for the project.
      const updatedCount = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${project.id} FOR UPDATE`;

        const pledges = await tx.pledge.findMany({
          where: {
            projectId: project.id,
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

        // Start from 1 above the highest existing backer number
        const maxExisting = pledges.reduce(
          (max, p) => (p.backerNumber !== null ? Math.max(max, p.backerNumber) : max),
          0
        );
        let backerNum = maxExisting + 1;
        let updated = 0;

        for (const pledge of pledges) {
          if (pledge.backerNumber === null) {
            await tx.pledge.update({
              where: { id: pledge.id },
              data: { backerNumber: backerNum },
            });
            backerNum++;
            updated++;
          }
        }

        return updated;
      });

      if (updatedCount > 0) {
        results.push({
          projectId: project.id,
          title: project.title,
          updated: updatedCount,
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
    adminBackfillBackerNumbersLogger.error({ err: formatError(error) }, "Backfill backer numbers error:");
    return NextResponse.json(
      { error: "Failed to backfill backer numbers" },
      { status: 500 }
    );
  }
}
