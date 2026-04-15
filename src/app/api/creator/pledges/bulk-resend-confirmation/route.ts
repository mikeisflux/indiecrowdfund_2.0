import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBackerPledgeConfirmed } from "@/lib/notifications";

const bulkResendLogger = logger.child({
  module: "creator-pledge-bulk-resend-confirmation",
});

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — big projects can have a lot of backers

/**
 * POST /api/creator/pledges/bulk-resend-confirmation
 *
 * Body: { projectId: string }
 *
 * Resend the pledge confirmation email for EVERY eligible pledge on a
 * project. Creator of the project (or an accepted collaborator) may
 * call this. Used by the "Resend Confirmation Emails" button on the
 * Creator Dashboard → Backers tab.
 *
 * "Eligible" = pledge is COMPLETED (or PENDING with a saved payment
 * method) AND has a user with an email address AND is not soft-deleted.
 *
 * Resets `confirmationEmailSent: false` on each eligible pledge before
 * calling notifyBackerPledgeConfirmed(), which re-sends and then sets
 * the flag back to true on successful send.
 *
 * Processes sequentially with a tiny delay between sends so we don't
 * hammer the email provider (Mailgun/SendGrid have per-second rate
 * limits at the provider level, plus we have our own queue for retries).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify the caller owns or collaborates on the project.
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        creatorId: true,
        collaborators: {
          where: { userId: session.user.id, status: "ACCEPTED" },
          select: { id: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const isCollaborator = project.collaborators.length > 0;
    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load all eligible pledges. Eligible = status is COMPLETED OR has
    // a saved payment method (deferred charge). We don't filter by
    // `user.email != null` at the Prisma level because Prisma 7 rejects
    // `{ not: null }` on nullable string filters at runtime with
    // "Argument `not` must not be null." The downstream
    // notifyBackerPledgeConfirmed() function already short-circuits on
    // pledges whose user has no email, so fetching a few extra rows here
    // is safe — they'll be no-ops rather than errors.
    const eligiblePledges = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { status: "COMPLETED" },
          { stripePaymentMethodId: { not: null } },
        ],
      },
      select: {
        id: true,
        chargedImmediately: true,
        confirmationEmailSent: true,
      },
    });

    if (eligiblePledges.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible pledges to resend to",
        total: 0,
        sent: 0,
        failed: 0,
      });
    }

    // Reset the flag on all eligible pledges in one query so
    // notifyBackerPledgeConfirmed won't short-circuit.
    await db.pledge.updateMany({
      where: {
        id: { in: eligiblePledges.map((p) => p.id) },
        confirmationEmailSent: true,
      },
      data: { confirmationEmailSent: false },
    });

    // Send sequentially with a small delay. 150ms ≈ 6/sec which is well
    // under Mailgun's 10/sec free tier rate and SendGrid's generous rate.
    const DELAY_BETWEEN_SENDS_MS = 150;
    let sent = 0;
    let failed = 0;

    for (const pledge of eligiblePledges) {
      try {
        await notifyBackerPledgeConfirmed(pledge.id, pledge.chargedImmediately);
        sent++;
      } catch (sendError) {
        failed++;
        bulkResendLogger.error(
          { err: String(sendError), pledgeId: pledge.id },
          "[Bulk Resend] Failed to send for pledge"
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_SENDS_MS)
      );
    }

    bulkResendLogger.info(
      {
        projectId,
        creatorId: session.user.id,
        total: eligiblePledges.length,
        sent,
        failed,
      },
      "[Bulk Resend] Completed"
    );

    return NextResponse.json({
      success: true,
      message: `Resent ${sent} confirmation email${sent === 1 ? "" : "s"}${
        failed > 0 ? ` (${failed} failed)` : ""
      }`,
      total: eligiblePledges.length,
      sent,
      failed,
    });
  } catch (error) {
    bulkResendLogger.error(
      { err: String(error) },
      "Error bulk-resending confirmation emails"
    );
    return NextResponse.json(
      { error: "Failed to bulk-resend confirmation emails" },
      { status: 500 }
    );
  }
}
