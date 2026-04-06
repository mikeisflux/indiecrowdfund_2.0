import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claimRewardSlot, assignBackerNumber } from "@/lib/payments/stripe";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { logger } from "@/lib/logger";

const whopConfirmLogger = logger.child({ module: "whop-confirm" });

export const dynamic = "force-dynamic";

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
    if (!pledgeId) {
      return NextResponse.json({ error: "Pledge ID required" }, { status: 400 });
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
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
        user: { select: { id: true, email: true, name: true } },
        reward: { select: { id: true, title: true, amount: true } },
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

    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (pledge.status === "COMPLETED") {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    if (pledge.status !== "PENDING") {
      return NextResponse.json({ error: "Pledge is not in a confirmable state" }, { status: 400 });
    }

    if (pledge.paymentProcessor !== "WHOP") {
      return NextResponse.json({ error: "Not a Whop pledge" }, { status: 400 });
    }

    // Atomically mark as completed (webhook may also do this — idempotent)
    const result = await db.pledge.updateMany({
      where: { id: pledgeId, confirmationEmailSent: false },
      data: { status: "COMPLETED", confirmationEmailSent: true },
    });

    if (result.count === 0) {
      // Already processed (webhook beat us to it) — still return success
      return NextResponse.json({ success: true });
    }

    const updatedProject = await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: Number(pledge.amount) },
        backerCount: { increment: 1 },
      },
    });

    if (pledge.rewardId) {
      await claimRewardSlot(pledge.rewardId).catch(err =>
        whopConfirmLogger.error({ err: String(err) }, "claimRewardSlot failed")
      );
    }

    const whopBackerNumber = await assignBackerNumber(pledge.projectId, pledge.id).catch(err => {
      whopConfirmLogger.error({ err: String(err) }, "assignBackerNumber failed");
      return null;
    });

    await notifyPledgeReceived(pledge.projectId, pledge.project.creatorId, pledge.user.name || "A backer", Number(pledge.amount)).catch(
      err => whopConfirmLogger.error({ err: String(err) }, "notifyPledgeReceived failed")
    );

    const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
    const justReachedGoal =
      projectIsFunded &&
      Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

    if (justReachedGoal) {
      await notifyProjectFunded(pledge.projectId).catch(err =>
        whopConfirmLogger.error({ err: String(err) }, "notifyProjectFunded failed")
      );
    }

    // Send confirmation email
    try {
      const pledgeConfirmEnabled = await isEmailTypeEnabled("pledgeConfirmation");
      if (pledgeConfirmEnabled && pledge.user.email) {
        const shippingData = pledge.shippingAddress
          ? (pledge.shippingAddress as Record<string, string>)
          : null;

        await sendPledgeConfirmationEmail(
          pledge.user.email,
          pledge.user.name || "Backer",
          pledge.project.title,
          pledge.project.slug,
          Number(pledge.amount),
          pledge.reward?.title || null,
          true, // chargedImmediately
          pledge.project.imageUrl,
          pledge.project.currency || "USD",
          [],
          shippingData
            ? {
                name: shippingData.name || null,
                address: shippingData.line1 || shippingData.address || null,
                city: shippingData.city || null,
                state: shippingData.state || null,
                postalCode: shippingData.postalCode || shippingData.zip || null,
                country: shippingData.country || null,
              }
            : null,
          pledge.project.creator.vanityUrl
            ? `/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
            : undefined,
          undefined,
          undefined,
          "PAYPAL", // closest analog for Whop (card payment)
          whopBackerNumber ?? undefined
        );

        await db.emailLog.create({
          data: {
            type: "PLEDGE_CONFIRMATION",
            recipientEmail: pledge.user.email,
            subject: `Your pledge to "${pledge.project.title}" is confirmed!`,
            userId: pledge.userId,
            projectId: pledge.project.id,
            pledgeId: pledge.id,
          },
        });
      }
    } catch (emailErr) {
      whopConfirmLogger.error({ err: String(emailErr) }, "Failed to send Whop confirmation email");
    }

    whopConfirmLogger.info({ pledgeId }, "Whop pledge confirmed successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    whopConfirmLogger.error({ err: String(error) }, "Error confirming Whop pledge");
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
