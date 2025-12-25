import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import {
  notifyPledgeReceived,
  notifyProjectFunded,
} from "@/lib/notifications";
import { processPendingPledgesForProject, getStripeInstance } from "@/lib/payments/stripe";

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

    // Get the pledge with project, user, addons, and shipping info
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
            creator: { select: { vanityUrl: true } },
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
        addons: {
          select: {
            quantity: true,
            addon: { select: { title: true, amount: true } },
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

    // Check if already confirmed (prevent double-counting stats)
    if (pledge.confirmationEmailSent) {
      return NextResponse.json({
        success: true,
        message: "Pledge already confirmed",
        alreadyConfirmed: true,
      });
    }

    // If payment method not saved yet (webhook hasn't run), try to fetch from Stripe
    let paymentMethodId = pledge.stripePaymentMethodId;
    if (!paymentMethodId && !pledge.chargedImmediately && pledge.stripeSetupIntentId) {
      try {
        const stripeClient = await getStripeInstance();
        const setupIntent = await stripeClient.setupIntents.retrieve(pledge.stripeSetupIntentId);

        if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
          paymentMethodId = typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

          // Save the payment method to the pledge
          await db.pledge.update({
            where: { id: pledgeId },
            data: { stripePaymentMethodId: paymentMethodId },
          });

          console.log(`[Confirm] Fetched payment method from Stripe for pledge ${pledgeId}`);
        }
      } catch (err) {
        console.error(`[Confirm] Failed to fetch SetupIntent from Stripe:`, err);
      }
    }

    // Verify payment method was saved (checkout actually completed)
    if (!paymentMethodId && !pledge.chargedImmediately) {
      return NextResponse.json({
        success: false,
        error: "Payment method not saved - checkout incomplete. Please try again.",
      }, { status: 400 });
    }

    // Mark as confirmed FIRST (before updating stats)
    // This ensures this pledge is included when checking for pending pledges to process
    await db.pledge.update({
      where: { id: pledgeId },
      data: { confirmationEmailSent: true },
    });

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
      const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
      const justReachedGoal = projectIsFunded &&
        Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

      if (justReachedGoal) {
        await notifyProjectFunded(pledge.projectId);
      }

      // Process all pending pledges if project is funded (charge saved cards)
      if (projectIsFunded) {
        console.log(`[Confirm] Project ${pledge.projectId} is funded, processing pending pledges...`);
        const chargeResults = await processPendingPledgesForProject(pledge.projectId);
        console.log(`[Confirm] Charged ${chargeResults.successful}/${chargeResults.total} pledges`);
      }
    }

    // Send confirmation email if user has email and feature is enabled
    // (pledge was already marked as confirmed above)
    let emailSent = false;
    const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");

    if (pledge.user.email && pledgeEmailEnabled) {
      // Format addons for the email - convert Decimal amounts to numbers
      const addons = pledge.addons?.map((addonEntry: { quantity: number; addon: { title: string; amount: unknown } }) => ({
        title: addonEntry.addon.title,
        quantity: addonEntry.quantity,
        amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
      })) || [];

      // Get shipping info from pledge
      const shippingInfo = {
        name: pledge.shippingName || null,
        address: pledge.shippingAddress || null,
        city: pledge.shippingCity || null,
        state: pledge.shippingState || null,
        postalCode: pledge.shippingPostalCode || null,
        country: pledge.shippingCountry || null,
      };

      // Build project URL with vanity URL if available
      const projectUrlPath = pledge.project.creator?.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : undefined;

      const emailResult = await sendPledgeConfirmationEmail(
        pledge.user.email,
        pledge.user.name || "Backer",
        pledge.project.title,
        pledge.project.slug,
        pledge.amount,
        pledge.reward?.title || null,
        pledge.chargedImmediately,
        pledge.project.imageUrl,
        pledge.project.currency || "USD",
        addons,
        shippingInfo,
        projectUrlPath
      );
      emailSent = emailResult.success;

      if (emailResult.success) {
        console.log(`[Confirm] Sent confirmation email for pledge ${pledgeId} to ${pledge.user.email}`);
      } else {
        console.error(`[Confirm] Failed to send confirmation email for pledge ${pledgeId}:`, emailResult.error);
      }
    } else if (!pledgeEmailEnabled) {
      console.log(`[Confirm] Pledge confirmation emails are disabled in settings`);
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
