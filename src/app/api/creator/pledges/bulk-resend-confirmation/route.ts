import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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
 * notifyBackerPledgeConfirmed() guards on the PLEDGE_CONFIRMATION
 * EmailLog (not the confirmationEmailSent flag), so it's safe to call
 * for every eligible pledge — already-delivered ones are skipped and
 * only genuinely-missed sends actually go out.
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

    // Guard against empty/malformed JSON bodies — req.json() throws
    // on these, which used to surface as a generic 500 without any
    // hint of what the actual problem was.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 }
      );
    }

    const projectId = body?.projectId;

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

    // Load all eligible pledges. Eligible = status is COMPLETED OR has a
    // saved payment method on file: stripePaymentMethodId (legacy Stripe
    // SetupIntent flow) OR divinityCoinPaymentMethodId (the DivinityCoin
    // AoN saved-card flow — those pledges stay PENDING until the
    // funded-campaign cron charges them, but they're committed and
    // should still get a confirmation email). We use `NOT: { field: null }`
    // instead of `{ field: { not: null } }` because Prisma 7's runtime
    // validator rejects the latter (despite TS types saying it's legal)
    // with "Argument `not` must not be null" — recurs on any nullable
    // string filter.
    const eligiblePledges = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { status: "COMPLETED" },
          { NOT: { stripePaymentMethodId: null } },
          { NOT: { divinityCoinPaymentMethodId: null } },
        ],
      },
      select: {
        id: true,
        chargedImmediately: true,
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
      { err: formatError(error) },
      "Error bulk-resending confirmation emails"
    );
    return NextResponse.json(
      { error: "Failed to bulk-resend confirmation emails" },
      { status: 500 }
    );
  }
}
