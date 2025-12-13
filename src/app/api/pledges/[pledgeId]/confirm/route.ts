import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail } from "@/lib/email";
import {
  notifyPledgeReceived,
  notifyProjectFunded,
} from "@/lib/notifications";
import { processPendingPledgesForProject } from "@/lib/payments/stripe";

/**
 * POST /api/pledges/[pledgeId]/confirm
 *
 * Called by the frontend after successful checkout to:
 * 1. Confirm the pledge was completed (update project stats)
 * 2. Send the confirmation email (if not already sent)
 * 3. Notify creator of new pledge
 *
 * Stats are ONLY updated here, not in the webhook, to ensure
 * incomplete checkouts (user closed browser) don't count.
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
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            currency: true,
            goalAmount: true,
            currentAmount: true,
            creatorId: true,
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
            id: true,
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

    // Verify payment method was saved (checkout actually completed)
    if (!pledge.stripePaymentMethodId && !pledge.chargedImmediately) {
      return NextResponse.json({
        success: false,
        error: "Payment method not saved - checkout incomplete",
      }, { status: 400 });
    }

    // Check if already confirmed (prevent double-counting stats)
    if (pledge.confirmationEmailSent) {
      return NextResponse.json({
        success: true,
        message: "Pledge already confirmed",
        alreadyConfirmed: true,
      });
    }

    // Update project stats (only for SetupIntent pledges - PaymentIntent pledges update stats in webhook)
    let updatedProject = pledge.project;
    if (!pledge.chargedImmediately) {
      // This is a SetupIntent pledge - update stats now that checkout is confirmed
      updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: pledge.amount },
          backerCount: { increment: 1 },
        },
      });

      // Update reward quantity if limited
      if (pledge.reward?.id) {
        await db.reward.update({
          where: { id: pledge.reward.id },
          data: {
            quantityClaimed: { increment: 1 },
          },
        });
      }

      // Notify creator of new pledge
      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user.name || "A backer",
        pledge.amount
      );

      console.log(`[Confirm] Updated project stats for pledge ${pledgeId}: +$${pledge.amount}`);

      // Check if project just reached funding goal
      const projectIsFunded = updatedProject.currentAmount >= updatedProject.goalAmount;
      const justReachedGoal = projectIsFunded &&
        updatedProject.currentAmount - pledge.amount < updatedProject.goalAmount;

      if (justReachedGoal) {
        await notifyProjectFunded(pledge.projectId);
      }

      // Process any pending pledges if project is funded
      if (projectIsFunded) {
        const pendingPledgeCount = await db.pledge.count({
          where: {
            projectId: pledge.projectId,
            status: "PENDING",
            chargedImmediately: false,
            stripePaymentMethodId: { not: null },
            confirmationEmailSent: true, // Only process confirmed pledges
          },
        });

        if (pendingPledgeCount > 0) {
          await processPendingPledgesForProject(pledge.projectId);
        }
      }
    }

    // Mark as confirmed and send email
    await db.pledge.update({
      where: { id: pledgeId },
      data: { confirmationEmailSent: true },
    });

    // Send confirmation email if user has email
    let emailSent = false;
    if (pledge.user.email) {
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
      emailSent = emailResult.success;

      if (emailResult.success) {
        console.log(`[Confirm] Sent confirmation email for pledge ${pledgeId} to ${pledge.user.email}`);
      } else {
        console.error(`[Confirm] Failed to send confirmation email for pledge ${pledgeId}:`, emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      statsUpdated: !pledge.chargedImmediately,
      message: "Pledge confirmed successfully",
    });
  } catch (error) {
    console.error("Failed to confirm pledge:", error);
    return NextResponse.json(
      { error: "Failed to confirm pledge" },
      { status: 500 }
    );
  }
}
