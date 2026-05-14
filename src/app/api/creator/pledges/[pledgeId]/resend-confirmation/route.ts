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
 * fail to deliver. notifyBackerPledgeConfirmed() guards on the
 * PLEDGE_CONFIRMATION EmailLog (the source of truth for "actually
 * delivered"), so calling it here re-sends only when the email never
 * went out and is a harmless no-op when it did.
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
        stripePaymentMethodId: true,
        divinityCoinPaymentMethodId: true,
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
    // method, are eligible for a confirmation email. The saved card
    // lives in stripePaymentMethodId (legacy Stripe SetupIntent flow) or
    // divinityCoinPaymentMethodId (the DivinityCoin AoN saved-card flow,
    // which stays PENDING until the funded-campaign cron charges it).
    if (
      pledge.status !== "COMPLETED" &&
      !pledge.stripePaymentMethodId &&
      !pledge.divinityCoinPaymentMethodId
    ) {
      return NextResponse.json(
        {
          error:
            "Pledge is not complete and does not have a saved payment method",
        },
        { status: 400 }
      );
    }

    // notifyBackerPledgeConfirmed guards on the PLEDGE_CONFIRMATION
    // EmailLog, not the confirmationEmailSent flag — it re-sends only
    // when the email genuinely never went out. We must NOT clear the
    // flag here: for DC saved-card pledges it doubles as the
    // counts-toward-goal marker, and clearing it on a send that then
    // fails would drop the pledge from the project total.
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
