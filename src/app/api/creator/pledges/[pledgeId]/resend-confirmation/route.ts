import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBackerPledgeConfirmed } from "@/lib/notifications";

const resendLogger = logger.child({
  module: "creator-pledge-resend-confirmation",
});

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/pledges/[pledgeId]/resend-confirmation
 *
 * Resend the pledge confirmation email for a single pledge. Creator of
 * the pledge's project (or an accepted collaborator) may call this.
 *
 * Why this endpoint exists: pledge confirmation emails can silently
 * fail to deliver — the confirm route atomically sets
 * `confirmationEmailSent: true` BEFORE actually calling sendEmail
 * (to prevent double-counting project stats under concurrent webhooks),
 * so if the email provider call itself fails, the flag is already set
 * and no retry ever happens. The `notifyBackerPledgeConfirmed()`
 * helper also short-circuits when the flag is true. This endpoint
 * resets the flag and forces a re-send.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Verify the caller owns the project the pledge belongs to (or is an
    // accepted collaborator). Same auth pattern as
    // /api/creator/pledges/[pledgeId].
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        status: true,
        chargedImmediately: true,
        confirmationEmailSent: true,
        stripePaymentMethodId: true,
        user: { select: { email: true } },
        project: {
          select: {
            creatorId: true,
            collaborators: {
              where: { userId: session.user.id, status: "ACCEPTED" },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isOwner = pledge.project.creatorId === session.user.id;
    const isCollaborator = pledge.project.collaborators.length > 0;
    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!pledge.user?.email) {
      return NextResponse.json(
        { error: "Backer has no email address on file" },
        { status: 400 }
      );
    }

    // Only COMPLETED pledges, or PENDING pledges with a saved payment
    // method (chargedImmediately deferred-charge pledges), are eligible
    // for a confirmation email. Same gate as the admin resend endpoint.
    if (pledge.status !== "COMPLETED" && !pledge.stripePaymentMethodId) {
      return NextResponse.json(
        {
          error:
            "Pledge is not complete and does not have a saved payment method",
        },
        { status: 400 }
      );
    }

    // Reset the flag so notifyBackerPledgeConfirmed actually sends.
    // The flag will be re-set to true by notifyBackerPledgeConfirmed
    // after a successful send.
    if (pledge.confirmationEmailSent) {
      await db.pledge.update({
        where: { id: pledgeId },
        data: { confirmationEmailSent: false },
      });
    }

    await notifyBackerPledgeConfirmed(pledgeId, pledge.chargedImmediately);

    resendLogger.info(
      { pledgeId, creatorId: session.user.id },
      "[Resend] Pledge confirmation email resent"
    );

    return NextResponse.json({
      success: true,
      message: "Confirmation email resent",
    });
  } catch (error) {
    resendLogger.error(
      { err: String(error) },
      "Error resending pledge confirmation email"
    );
    return NextResponse.json(
      { error: "Failed to resend confirmation email" },
      { status: 500 }
    );
  }
}
