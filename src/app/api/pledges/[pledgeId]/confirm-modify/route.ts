import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { notifyPledgeModified } from "@/lib/notifications/pledge-notifications";

/**
 * POST /api/pledges/[pledgeId]/confirm-modify
 *
 * Called after successful payment for a pledge modification upcharge.
 * Verifies the payment succeeded, then applies the pending modification.
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

    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            currentAmount: true,
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

    // Get pending modification from metadata
    const metadata = pledge.metadata as {
      pendingModification?: {
        paymentMethod?: string;
        paymentIntentId?: string;
        rewardId?: string | null;
        addons?: { id: string; quantity: number }[];
        newAmount: number;
        oldAmount: number;
        amountDiff: number;
        createdAt: string;
      };
    } | null;

    const pending = metadata?.pendingModification;

    if (!pending) {
      return NextResponse.json({
        success: true,
        message: "Modification already processed",
      });
    }

    // Verify payment based on payment method
    if (pending.paymentMethod === "STRIPE") {
      const stripe = await getStripeInstance();
      if (!stripe) {
        return NextResponse.json(
          { error: "Payment system unavailable" },
          { status: 500 }
        );
      }

      if (!pending.paymentIntentId) {
        return NextResponse.json(
          { error: "Missing payment intent ID" },
          { status: 400 }
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(pending.paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    } else if (pending.paymentMethod === "DIVINITYCOIN") {
      if (!pending.paymentIntentId) {
        return NextResponse.json(
          { error: "Missing payment intent ID" },
          { status: 400 }
        );
      }

      const verifyResult = await callDivinityCoinAPI("verify-payment", {
        paymentIntentId: pending.paymentIntentId,
      });

      if (!verifyResult.success || verifyResult.data?.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    }

    const addonsWithQuantity = pending.addons || [];
    const addonIdList = addonsWithQuantity.map(a => a.id);
    const rewardId = pending.rewardId;

    // Apply changes in a transaction
    await db.$transaction(async (tx) => {
      // If changing reward, update claimed counts
      if (pledge.rewardId && pledge.rewardId !== rewardId) {
        await tx.reward.update({
          where: { id: pledge.rewardId },
          data: { quantityClaimed: { decrement: 1 } },
        });
      }

      if (rewardId && rewardId !== "no-reward" && pledge.rewardId !== rewardId) {
        await tx.reward.update({
          where: { id: rewardId },
          data: { quantityClaimed: { increment: 1 } },
        });
      }

      // Delete old addon associations
      await tx.pledgeAddon.deleteMany({
        where: { pledgeId },
      });

      // Create new addon associations
      if (addonsWithQuantity.length > 0) {
        const addonRecords = await tx.reward.findMany({
          where: { id: { in: addonIdList }, type: "ADDON" },
          select: { id: true, amount: true },
        });
        const addonPriceMap = new Map<string, number>(
          addonRecords.map((a: { id: string; amount: number }) => [a.id, Number(a.amount)])
        );

        await tx.pledgeAddon.createMany({
          data: addonsWithQuantity.map((addon) => ({
            pledgeId,
            addonId: addon.id,
            quantity: addon.quantity,
            amount: (addonPriceMap.get(addon.id) ?? 0) * addon.quantity,
          })),
        });
      }

      // Update the pledge amount and clear pending modification
      const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
        ? { ...pledge.metadata as Record<string, unknown> }
        : {};
      delete currentMetadata.pendingModification;

      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          rewardId: rewardId === "no-reward" ? null : rewardId || null,
          amount: pending.newAmount,
          metadata: {
            ...currentMetadata,
            completedModifications: [
              ...((currentMetadata.completedModifications as unknown[]) || []),
              {
                paymentIntentId: pending.paymentIntentId,
                rewardId,
                addons: addonsWithQuantity,
                oldAmount: pending.oldAmount,
                newAmount: pending.newAmount,
                amountDiff: pending.amountDiff,
                completedAt: new Date().toISOString(),
              },
            ],
          },
        },
      });

      // Update project current amount
      if (pending.amountDiff !== 0) {
        await tx.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: pending.amountDiff },
          },
        });
      }
    });

    console.log(`[ConfirmModify] Successfully modified pledge ${pledgeId}, amount changed by $${pending.amountDiff}`);

    // Send upcharge notification email
    notifyPledgeModified(pledgeId, pending.oldAmount, pending.newAmount, "upcharge").catch(err =>
      console.error("[ConfirmModify] Failed to send notification:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Pledge modification confirmed",
      newAmount: pending.newAmount,
    });
  } catch (error) {
    console.error("Failed to confirm pledge modification:", error);
    return NextResponse.json(
      { error: "Failed to confirm pledge modification" },
      { status: 500 }
    );
  }
}
