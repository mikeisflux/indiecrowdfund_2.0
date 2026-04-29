import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesConfirmAddItemsLogger = logger.child({ module: "pledges-confirm-add-items" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { loadNmiConfig, saleByPaymentToken } from "@/lib/nmi";

/**
 * POST /api/pledges/[pledgeId]/confirm-add-items
 *
 * Called by the frontend after successful payment for additional items.
 * This endpoint:
 * 1. Verifies the payment was successful
 * 2. Creates addon associations
 * 3. Updates addon claimed counts
 * 4. Updates project currentAmount (but NOT backerCount)
 * 5. Updates the pledge total amount
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

    // Get the pledge with metadata
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

    // Verify the pledge belongs to the current user
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pending additional items from metadata
    const metadata = pledge.metadata as {
      pendingAdditionalItems?: {
        paymentMethod?: string;
        paymentIntentId?: string;
        addons?: { id: string; quantity: number }[]; // New format with quantities
        addonIds?: string[]; // Legacy format
        amount: number;
        createdAt: string;
      };
    } | null;

    const pendingItems = metadata?.pendingAdditionalItems;

    if (!pendingItems) {
      // For DivinityCoin, items may already be processed by webhook/pay endpoint
      // Return success if no pending items remain
      return NextResponse.json({
        success: true,
        message: "Additional items already processed",
      });
    }

    // Support both new format (addons with quantities) and legacy format (addonIds)
    const addonsWithQuantity: { id: string; quantity: number }[] = pendingItems.addons ||
      (pendingItems.addonIds ? pendingItems.addonIds.map(id => ({ id, quantity: 1 })) : []);

    if (addonsWithQuantity.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No addons to process",
      });
    }

    const addonIds = addonsWithQuantity.map(a => a.id);
    const quantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

    // Verify payment based on payment method
    const paymentMethod = pendingItems.paymentMethod || "STRIPE";

    if (paymentMethod === "STRIPE") {
      const stripe = await getStripeInstance();
      if (!stripe) {
        return NextResponse.json(
          { error: "Payment system unavailable" },
          { status: 500 }
        );
      }

      if (!pendingItems.paymentIntentId) {
        return NextResponse.json(
          { error: "Missing payment intent ID" },
          { status: 400 }
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(pendingItems.paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    } else if (paymentMethod === "DIVINITYCOIN") {
      if (!pendingItems.paymentIntentId) {
        return NextResponse.json(
          { error: "Missing payment intent ID" },
          { status: 400 }
        );
      }

      const verifyResult = await callDivinityCoinAPI("verify-payment", {
        paymentIntentId: pendingItems.paymentIntentId,
      });

      if (!verifyResult.success || verifyResult.data?.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not yet completed" },
          { status: 400 }
        );
      }
    } else if (paymentMethod === "NMI") {
      // PaymentCloud add-items: run the upcharge sale right here using
      // the payment_token the client just got from Collect.js. We stash
      // the resulting transaction id into pendingItems.paymentIntentId
      // so the downstream advisory-lock dedup keys still work.
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
          amount: pendingItems.amount,
          paymentToken,
          orderid: `${pledgeId}-additems-${Date.now()}`,
          orderdescription: `Additional items for pledge to ${pledge.project.title}`,
          email: userRecord?.email || undefined,
        });
      } catch (err) {
        pledgesConfirmAddItemsLogger.error(
          { pledgeId, err: err instanceof Error ? err.message : String(err) },
          "[ConfirmAddItems NMI] Sale error"
        );
        return NextResponse.json(
          { error: "Failed to charge card. Please try again or contact support." },
          { status: 502 }
        );
      }

      if (saleResp.response !== "1" || !saleResp.transactionid) {
        pledgesConfirmAddItemsLogger.warn(
          { pledgeId, response: saleResp.response, text: saleResp.responsetext },
          "[ConfirmAddItems NMI] Sale declined"
        );
        return NextResponse.json(
          { error: saleResp.responsetext || "Card was declined. Please try a different card." },
          { status: 400 }
        );
      }

      // Stash the transaction id back into the pending block so the
      // advisory-lock dedup below has a stable key, and so the
      // completedAdditionalItems audit trail records the txn id.
      pendingItems.paymentIntentId = saleResp.transactionid;
    }

    // Get the addons, scoped to the pledge's project for defense in depth
    const addons = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
        projectId: pledge.projectId,
      },
    });

    // Calculate total quantity for logging
    const totalQuantity = addonsWithQuantity.reduce((sum, a) => sum + a.quantity, 0);

    // Perform all updates inside a transaction guarded by an advisory
    // lock keyed to the paymentIntentId. Without this lock, two concurrent
    // confirm-add-items calls (double-click, retry) would both:
    //   1. Pass the Stripe "succeeded" check
    //   2. Create or double-up PledgeAddon rows
    //   3. Double-increment Reward.quantityClaimed (overselling limited addons)
    //   4. Double-increment Pledge.amount
    //   5. Double-increment Project.currentAmount
    // Inside the lock we also re-check that pendingAdditionalItems is
    // still on the pledge, and that this paymentIntentId hasn't already
    // been recorded in completedAdditionalItems — either bail-out turns
    // the second confirm into a no-op success.
    let alreadyProcessed = false;
    try {
      await db.$transaction(async (tx) => {
        if (pendingItems.paymentIntentId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`confirm-additems-${pendingItems.paymentIntentId}`}))`;
        } else {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`confirm-additems-${pledgeId}`}))`;
        }

        // Re-read the pledge inside the lock to see the latest metadata.
        // The first call to flip pendingAdditionalItems → completedAdditionalItems
        // will cause all subsequent lock acquirers to see the updated
        // state and bail out.
        const freshPledge = await tx.pledge.findFirst({
          where: { id: pledgeId, deletedAt: null },
          select: { metadata: true, amount: true },
        });
        if (!freshPledge) {
          throw new Error("PLEDGE_DISAPPEARED");
        }
        const freshMeta = freshPledge.metadata as {
          pendingAdditionalItems?: unknown;
          completedAdditionalItems?: Array<{ paymentIntentId?: string }>;
        } | null;

        const stillPending = !!freshMeta?.pendingAdditionalItems;
        const alreadyCompleted = pendingItems.paymentIntentId
          ? (freshMeta?.completedAdditionalItems || []).some(
              (c) => c?.paymentIntentId === pendingItems.paymentIntentId
            )
          : false;

        if (!stillPending || alreadyCompleted) {
          alreadyProcessed = true;
          return;
        }

        // Create PledgeAddon records for each addon with quantity
        for (const addon of addons) {
          const quantity = quantityMap.get(addon.id) || 1;

          // Check if this addon already exists for this pledge
          const existingAddon = await tx.pledgeAddon.findFirst({
            where: {
              pledgeId: pledge.id,
              addonId: addon.id,
            },
          });

          if (existingAddon) {
            // Increment quantity
            await tx.pledgeAddon.update({
              where: { id: existingAddon.id },
              data: {
                quantity: existingAddon.quantity + quantity,
                amount: (existingAddon.quantity + quantity) * Number(addon.amount),
              },
            });
          } else {
            // Create new
            await tx.pledgeAddon.create({
              data: {
                pledgeId: pledge.id,
                addonId: addon.id,
                quantity,
                amount: Number(addon.amount) * quantity,
              },
            });
          }

          // Atomically claim addon slots (prevents overselling)
          // Lock the row and check availability within this transaction
          const addonRows = await tx.$queryRaw<Array<{
            id: string;
            quantityAvailable: number | null;
            quantityClaimed: number;
          }>>`
            SELECT id, "quantityAvailable", "quantityClaimed"
            FROM "Reward"
            WHERE id = ${addon.id}
            FOR UPDATE
          `;

          const addonInfo = addonRows[0];
          if (addonInfo) {
            // Check if enough slots available (null means unlimited)
            const availableSlots = addonInfo.quantityAvailable === null
              ? Infinity
              : addonInfo.quantityAvailable - addonInfo.quantityClaimed;

            if (availableSlots >= quantity) {
              await tx.reward.update({
                where: { id: addon.id },
                data: { quantityClaimed: { increment: quantity } },
              });
            } else {
              pledgesConfirmAddItemsLogger.warn(`[ConfirmAddItems] Addon ${addon.id} has only ${availableSlots} available but ${quantity} requested`);
              throw new Error(`Not enough ${addon.title || 'addon'} available`);
            }
          }
        }

        // Update pledge amount and flip pendingAdditionalItems →
        // completedAdditionalItems. This is what blocks subsequent
        // lock acquirers from re-processing (they see stillPending === false).
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            amount: Number(freshPledge.amount) + pendingItems.amount,
            metadata: {
              ...(typeof freshMeta === "object" && freshMeta !== null
                ? { ...freshMeta, pendingAdditionalItems: undefined }
                : {}),
              completedAdditionalItems: [
                ...(freshMeta?.completedAdditionalItems || []),
                {
                  paymentIntentId: pendingItems.paymentIntentId,
                  addons: addonsWithQuantity,
                  amount: pendingItems.amount,
                  completedAt: new Date().toISOString(),
                },
              ],
            },
          },
        });

        // Update project currentAmount (but NOT backerCount!)
        await tx.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: pendingItems.amount },
          },
        });
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
        message: "Additional items already processed",
        alreadyProcessed: true,
      });
    }

    pledgesConfirmAddItemsLogger.info(`[ConfirmAddItems] Successfully added ${totalQuantity} items (${addons.length} unique) to pledge ${pledgeId}, amount: $${pendingItems.amount}`);

    return NextResponse.json({
      success: true,
      message: "Additional items added successfully",
      addedAmount: pendingItems.amount,
      addedItems: addons.map((a: { title: string }) => a.title),
    });
  } catch (error) {
    pledgesConfirmAddItemsLogger.error({ err: String(error) }, "Failed to confirm additional items:");
    return NextResponse.json(
      { error: "Failed to confirm additional items" },
      { status: 500 }
    );
  }
}
