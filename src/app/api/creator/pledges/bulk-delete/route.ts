import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorPledgesBulkDeleteLogger = logger.child({ module: "creator-pledges-bulk-delete" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeIds } = body;

    if (!pledgeIds || !Array.isArray(pledgeIds) || pledgeIds.length === 0) {
      return NextResponse.json(
        { error: "No pledge IDs provided" },
        { status: 400 }
      );
    }

    if (pledgeIds.length > 100) {
      return NextResponse.json(
        { error: "Cannot delete more than 100 pledges at once" },
        { status: 400 }
      );
    }

    // Verify all pledges belong to projects owned by this user and are PENDING
    const pledges = await db.pledge.findMany({
      where: {
        id: { in: pledgeIds },
        status: "PENDING", // Only allow deleting PENDING pledges
        deletedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    });

    // Filter to only pledges where user is the project creator
    const validPledgeIds = pledges
      .filter((pledge) => pledge.project.creatorId === session.user.id)
      .map((pledge) => pledge.id);

    if (validPledgeIds.length === 0) {
      return NextResponse.json(
        { error: "No valid pledges to delete" },
        { status: 400 }
      );
    }

    // Delete in a transaction to handle related records that don't have cascade delete
    const deleteResult = await db.$transaction(async (tx) => {
      // Delete related DivinityCoinTransactions
      await tx.divinityCoinTransaction.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Delete related EmailLogs
      await tx.emailLog.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Delete related SurveyResponses
      await tx.surveyResponse.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Delete related DigitalDistributions
      await tx.digitalDistribution.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Delete related BackerNotes
      await tx.backerNote.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Unlink EmailCampaignClicks
      await tx.emailCampaignClick.updateMany({
        where: { pledgeId: { in: validPledgeIds } },
        data: { pledgeId: null },
      });

      // Delete related FulfillmentActivities
      await tx.fulfillmentActivity.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Delete PledgeAddons explicitly (has cascade but being safe)
      await tx.pledgeAddon.deleteMany({
        where: { pledgeId: { in: validPledgeIds } },
      });

      // Now delete the pledges
      return tx.pledge.deleteMany({
        where: {
          id: { in: validPledgeIds },
          status: "PENDING",
        },
      });
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      message: `${deleteResult.count} pending pledge(s) deleted successfully`,
    });
  } catch (error) {
    creatorPledgesBulkDeleteLogger.error({ err: String(error) }, "Bulk delete pledges error:");
    return NextResponse.json(
      { error: "Failed to delete pledges" },
      { status: 500 }
    );
  }
}
