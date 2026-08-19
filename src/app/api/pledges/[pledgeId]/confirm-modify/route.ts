import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const pledgesConfirmModifyLogger = logger.child({ module: "pledges-confirm-modify" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { verifyWhopUpchargePayment } from "@/lib/payments/whop/upcharge";
import { capturePayPalUpchargeOrder } from "@/lib/payments/paypal/upcharge";
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
    await req.json().catch(() => ({}));

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
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

    // Verify payment based on payment method. Each processor stores
    // its own reference in pending.paymentIntentId:
    //   DC:     Stripe-style PaymentIntent ID
    //   WHOP:   Whop checkout configuration ID
    //   PAYPAL: PayPal order ID
    const paymentMethod = pending.paymentMethod || "DIVINITYCOIN";

    if (!pending.paymentIntentId) {
      return NextResponse.json(
        { error: "Missing payment reference" },
        { status: 400 }
      );
    }

    if (paymentMethod === "DIVINITYCOIN") {
      const verifyResult = await callDivinityCoinAPI("verify-payment", {
        paymentIntentId: pending.paymentIntentId,
      });
      if (!verifyResult.success || verifyResult.data?.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    } else if (paymentMethod === "WHOP") {
      const verify = await verifyWhopUpchargePayment(pending.paymentIntentId);
      if (!verify.paid) {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    } else if (paymentMethod === "PAYPAL") {
      const capture = await capturePayPalUpchargeOrder(pending.paymentIntentId);
      if (!capture.captured) {
        return NextResponse.json(
          { error: "Payment capture failed" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported payment method for pledge modification" },
        { status: 400 }
      );
    }

    const addonsWithQuantity = pending.addons || [];
    const addonIdList = addonsWithQuantity.map(a => a.id);
    const rewardId = pending.rewardId;

    // Apply changes in a transaction guarded by an advisory lock keyed to
    // the paymentIntentId. Without this lock two concurrent confirm-modify
    // calls (double-click / retry) would both:
    //   1. Pass the Stripe "succeeded" check above
    //   2. Decrement the old reward's quantityClaimed twice
    //   3. Increment the new reward's quantityClaimed twice (oversell)
    //   4. Delete + re-create addon rows twice (doubled addons survive)
    //   5. Double-increment project.currentAmount by amountDiff
    //
    // Inside the lock we re-read the pledge's metadata and check that
    // pendingModification is still present AND that this paymentIntentId
    // isn't already in completedModifications — either bail-out turns the
    // second confirm into an idempotent no-op. Same pattern as
    // confirm-add-items, which was flagged as the critical add-items race
    // in session 6 of the audit.
    let alreadyProcessed = false;
    try {
      await db.$transaction(async (tx) => {
        if (pending.paymentIntentId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`confirm-modify-${pending.paymentIntentId}`}))`;
        } else {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`confirm-modify-${pledgeId}`}))`;
        }

        // Re-read the pledge inside the lock to see the latest metadata.
        // The first caller to flip pendingModification → completedModifications
        // will cause all subsequent lock acquirers to see the updated
        // state and bail out.
        const freshPledge = await tx.pledge.findFirst({
          where: { id: pledgeId, deletedAt: null },
          select: { metadata: true, rewardId: true, status: true },
        });
        if (!freshPledge) {
          throw new Error("PLEDGE_DISAPPEARED");
        }
        // Defense in depth: refuse to apply a modification if the pledge
        // has been concurrently cancelled / refunded / chargebacked.
        // Vanishingly rare (it would require an admin action mid-modify
        // and the metadata-idempotency check usually catches retries),
        // but if we don't gate on status we'd assign a new reward to a
        // CANCELLED pledge and decrement the old reward's quantityClaimed
        // for a slot that was already returned during the cancellation.
        if (freshPledge.status !== "PENDING" && freshPledge.status !== "COMPLETED") {
          alreadyProcessed = true;
          return;
        }
        const freshMeta = freshPledge.metadata as {
          pendingModification?: unknown;
          completedModifications?: Array<{ paymentIntentId?: string }>;
        } | null;

        const stillPending = !!freshMeta?.pendingModification;
        const alreadyCompleted = pending.paymentIntentId
          ? (freshMeta?.completedModifications || []).some(
              (c) => c?.paymentIntentId === pending.paymentIntentId
            )
          : false;

        if (!stillPending || alreadyCompleted) {
          alreadyProcessed = true;
          return;
        }

        // If changing reward, update claimed counts
        if (freshPledge.rewardId && freshPledge.rewardId !== rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${freshPledge.rewardId}`;
        }

        if (rewardId && rewardId !== "no-reward" && freshPledge.rewardId !== rewardId) {
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
        let newAddonsAmount = 0;
        if (addonsWithQuantity.length > 0) {
          const addonRecords = await tx.reward.findMany({
            where: { id: { in: addonIdList }, type: "ADDON" },
            select: { id: true, amount: true },
          });
          const addonPriceMap = new Map<string, number>(
            addonRecords.map((a: { id: string; amount: number }) => [a.id, Number(a.amount)])
          );

          const addonRows = addonsWithQuantity.map((addon) => ({
            pledgeId,
            addonId: addon.id,
            quantity: addon.quantity,
            amount: (addonPriceMap.get(addon.id) ?? 0) * addon.quantity,
          }));
          newAddonsAmount = addonRows.reduce((sum, a) => sum + a.amount, 0);

          await tx.pledgeAddon.createMany({ data: addonRows });
        }

        // Re-derive the amount breakdown to match the rows we just wrote.
        //
        // This block used to set `amount` alone and leave rewardAmount /
        // addonsAmount / shippingAmount at whatever they were before the
        // modification. They are a denormalized snapshot, not decoration:
        // the IndieKit creator dashboard and the backer CSV export total
        // add-on revenue from `addonsAmount` rather than the PledgeAddon
        // join (deliberately — see compute-stats.ts), and /api/pay/balance
        // derives the balance owed from
        // rewardAmount + addonsAmount + shippingAmount. Leaving them stale
        // under-reported add-on revenue, and in the other direction — a
        // backer downgrading their reward — inflated the derived total and
        // could invent a balance due that nobody actually owed.
        //
        // Shipping is preserved rather than recomputed, matching how the
        // modify route builds newAmount in the first place.
        const modifiedReward =
          rewardId && rewardId !== "no-reward"
            ? await tx.reward.findFirst({ where: { id: rewardId }, select: { amount: true } })
            : null;
        const newRewardAmount = modifiedReward ? Number(modifiedReward.amount) : 0;

        // Update the pledge amount + breakdown and flip pendingModification
        // → completedModifications. That flip is what blocks subsequent lock
        // acquirers from re-processing.
        const currentMetadata = (typeof freshMeta === "object" && freshMeta !== null)
          ? { ...freshMeta as Record<string, unknown> }
          : {};
        delete currentMetadata.pendingModification;

        await tx.pledge.update({
          where: { id: pledgeId },
          data: {
            rewardId: rewardId === "no-reward" ? null : rewardId || null,
            amount: pending.newAmount,
            rewardAmount: newRewardAmount,
            addonsAmount: newAddonsAmount,
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
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === "PLEDGE_DISAPPEARED") {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }
      throw txErr;
    }

    if (alreadyProcessed) {
      return NextResponse.json({
        success: true,
        message: "Modification already processed",
        alreadyProcessed: true,
      });
    }

    pledgesConfirmModifyLogger.info(`[ConfirmModify] Successfully modified pledge ${pledgeId}, amount changed by $${pending.amountDiff}`);

    // Send upcharge notification email
    notifyPledgeModified(pledgeId, pending.oldAmount, pending.newAmount, "upcharge").catch(err =>
      pledgesConfirmModifyLogger.error({ err: String(err) }, "[ConfirmModify] Failed to send notification:")
    );

    return NextResponse.json({
      success: true,
      message: "Pledge modification confirmed",
      newAmount: pending.newAmount,
    });
  } catch (error) {
    pledgesConfirmModifyLogger.error({ err: formatError(error) }, "Failed to confirm pledge modification:");
    return NextResponse.json(
      { error: "Failed to confirm pledge modification" },
      { status: 500 }
    );
  }
}
