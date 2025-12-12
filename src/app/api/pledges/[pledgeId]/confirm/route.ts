import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail } from "@/lib/email";

/**
 * POST /api/pledges/[pledgeId]/confirm
 *
 * Called by the frontend after successful checkout to:
 * 1. Confirm the pledge was completed
 * 2. Send the confirmation email (if not already sent)
 *
 * This is a fallback for when Stripe webhooks fail or are delayed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get the pledge with project and user info
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            title: true,
            slug: true,
            imageUrl: true,
            currency: true,
            goalAmount: true,
            currentAmount: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reward: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify the pledge belongs to the current user
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if confirmation email was already sent
    if (pledge.confirmationEmailSent) {
      return NextResponse.json({
        success: true,
        message: "Confirmation email already sent",
        alreadySent: true,
      });
    }

    // Ensure user has an email address
    if (!pledge.user.email) {
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: "Pledge confirmed but user has no email address",
      });
    }

    // Send the confirmation email
    const emailResult = await sendPledgeConfirmationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      pledge.project.slug,
      pledge.amount,
      pledge.reward?.title || null,
      pledge.chargedImmediately,
      pledge.project.imageUrl,
      pledge.project.currency || "USD"
    );

    if (emailResult.success) {
      // Mark confirmation email as sent
      await db.pledge.update({
        where: { id: pledgeId },
        data: { confirmationEmailSent: true },
      });

      console.log(`[Confirm] Sent confirmation email for pledge ${pledgeId} to ${pledge.user.email}`);
    } else {
      console.error(`[Confirm] Failed to send confirmation email for pledge ${pledgeId}:`, emailResult.error);
    }

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      message: emailResult.success
        ? "Confirmation email sent successfully"
        : "Pledge confirmed but email failed to send",
    });
  } catch (error) {
    console.error("Failed to confirm pledge:", error);
    return NextResponse.json(
      { error: "Failed to confirm pledge" },
      { status: 500 }
    );
  }
}
