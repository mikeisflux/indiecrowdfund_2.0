import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesConfirmModifyLogger = logger.child({ module: "pledges-confirm-modify" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { notifyPledgeModified } from "@/lib/notifications/pledge-notifications";
import { loadNmiConfig, saleByPaymentToken } from "@/lib/nmi";

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
    const body = await req.json().catch(() => ({}));
    const paymentToken: string | undefined = typeof body?.paymentToken === "string" ? body.paymentToken : undefined;

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
        // For NMI: stamped after the saleByPaymentToken sale completes
        // so a retry that fails inside the apply transaction doesn't
        // re-charge the user. Presence here means "money was already
        // taken; just retry the apply, do not re-tokenize".
        nmiTransactionId?: string;
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
    } else if (pending.paymentMethod === "NMI") {
      // PaymentCloud modify-upcharge: charge the delta against a fresh
      // Collect.js payment_token. CRITICAL: we may be retrying a
      // previous attempt that ran the sale but crashed before the
      // apply transaction committed. In that case pending.nmiTransactionId
      // is already set — DO NOT re-charge; just retry the apply below.
      if (pending.nmiTransactionId) {
        // Sale already completed on a prior attempt. Treat the txn id
        // as the dedup key for the advisory lock + completedModifications
        // audit row, and skip the sale entirely.
        pending.paymentIntentId = pending.nmiTransactionId;
        pledgesConfirmModifyLogger.info(
          { pledgeId, nmiTransactionId: pending.nmiTransactionId },
          "[ConfirmModify NMI] Sale already ran on prior attempt; retrying apply only"
        );
      } else {
        if (!paymentToken) {
          return NextResponse.json(
            { error: "Missing payment token" },
            { status: 400 }
          );
        }
        const nmiConfig = await loadNmiConfig();
        if (!nmiConfig) {
          return NextResponse.json({ error: "PaymentCloud not configured" }, { status: 502 });
        }

        const userRecord = await db.user.findFirst({
          where: { id: session.user.id, deletedAt: null },
          select: { email: true, name: true },
        });

        let saleResp;
        try {
          saleResp = await saleByPaymentToken(nmiConfig, {
            amount: pending.amountDiff,
            paymentToken,
            orderid: `${pledgeId}-modify-${Date.now()}`,
            orderdescription: `Pledge modification upcharge for ${pledge.project.title}`,
            email: userRecord?.email || undefined,
          });
        } catch (err) {
          pledgesConfirmModifyLogger.error(
            { pledgeId, err: err instanceof Error ? err.message : String(err) },
            "[ConfirmModify NMI] Sale error"
          );
          return NextResponse.json(
            { error: "Failed to charge card. Please try again or contact support." },
            { status: 502 }
          );
        }

        if (saleResp.response !== "1" || !saleResp.transactionid) {
          pledgesConfirmModifyLogger.warn(
            { pledgeId, response: saleResp.response, text: saleResp.responsetext },
            "[ConfirmModify NMI] Sale declined"
          );
          return NextResponse.json(
            { error: saleResp.responsetext || "Card was declined. Please try a different card." },
            { status: 400 }
          );
        }

        // Persist the txn id IMMEDIATELY so a crash before the apply
        // transaction commits doesn't lose it. Without this the next
        // request would re-tokenize and re-charge the user.
        const metadataForStamp = (typeof pledge.metadata === "object" && pledge.metadata !== null)
          ? pledge.metadata as Record<string, unknown>
          : {};
        const stampedPending = { ...pending, nmiTransactionId: saleResp.transactionid, paymentIntentId: saleResp.transactionid };
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...metadataForStamp,
              pendingModification: stampedPending,
            },
          },
        });
        pending.nmiTransactionId = saleResp.transactionid;
        pending.paymentIntentId = saleResp.transactionid;
      }
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
          select: { metadata: true, rewardId: true },
        });
        if (!freshPledge) {
          throw new Error("PLEDGE_DISAPPEARED");
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

        // Update the pledge amount and flip pendingModification →
        // completedModifications. This is what blocks subsequent lock
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
    pledgesConfirmModifyLogger.error({ err: String(error) }, "Failed to confirm pledge modification:");
    return NextResponse.json(
      { error: "Failed to confirm pledge modification" },
      { status: 500 }
    );
  }
}
