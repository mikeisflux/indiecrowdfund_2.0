import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notifyPledgeReceived,
  notifyBackerPledgeConfirmed,
  notifyProjectFunded,
} from "@/lib/notifications";
import { processPendingPledgesForProject } from "@/lib/payments/stripe";
import { addToCreatorEmailList } from "@/lib/email";

/**
 * GET /api/webhooks/chain2pay
 *
 * Chain2Pay sends a GET request to the callback_url when payment is successful.
 * Query params from Chain2Pay:
 *   - txid_out: Polygon transaction hash (proof of payment)
 *   - value_coin: Amount paid in USDC
 *   - coin: Crypto used (always polygon_usdc)
 *
 * Our custom query params:
 *   - pledgeId: The pledge ID we appended to the callback URL
 *   - addItems: "true" if this is a payment for additional items on an existing pledge
 *
 * Security Notes:
 * - No credit card data is ever transmitted to this endpoint
 * - Only transaction confirmation data (tx hash, amount) is received
 * - The Polygon tx hash can be independently verified on-chain
 * - Pledge status is only updated to COMPLETED, never creates new payments
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pledgeId = searchParams.get("pledgeId");
    const txidOut = searchParams.get("txid_out");
    const valueCoin = searchParams.get("value_coin");
    const coin = searchParams.get("coin");
    const isAddItems = searchParams.get("addItems") === "true";

    console.log(`[Chain2Pay Webhook] Received: pledgeId=${pledgeId}, txid=${txidOut}, value=${valueCoin}, coin=${coin}${isAddItems ? ", addItems=true" : ""}`);

    if (!pledgeId || !txidOut) {
      console.error("[Chain2Pay Webhook] Missing required params");
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Find the pledge with user and project details for notifications
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            creatorId: true,
            goalAmount: true,
            currentAmount: true,
            fundedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!pledge) {
      console.error(`[Chain2Pay Webhook] Pledge not found: ${pledgeId}`);
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify payment processor
    if (pledge.paymentProcessor !== "CHAIN2PAY") {
      console.error(`[Chain2Pay Webhook] Pledge ${pledgeId} is not CHAIN2PAY processor`);
      return NextResponse.json({ error: "Invalid payment processor" }, { status: 400 });
    }

    // === ADD-ITEMS FLOW: Process additional items for an already-completed pledge ===
    if (isAddItems && pledge.status === "COMPLETED") {
      const pledgeMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
        ? pledge.metadata as Record<string, unknown>
        : {};
      const pendingItems = pledgeMetadata.pendingAdditionalItems as {
        paymentMethod: string;
        addons: { id: string; quantity: number }[];
        amount: number;
      } | undefined;

      if (!pendingItems || pendingItems.addons.length === 0) {
        console.error(`[Chain2Pay Webhook] No pending add-items for pledge ${pledgeId}`);
        return NextResponse.json({ error: "No pending additional items" }, { status: 400 });
      }

      const addItemsAmount = pendingItems.amount;
      const addonsWithQuantity = pendingItems.addons;
      const addonIds = addonsWithQuantity.map(a => a.id);
      const quantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

      // Get the addons (rewards with type ADDON)
      const addons = await db.reward.findMany({
        where: { id: { in: addonIds } },
      });

      await db.$transaction(async (tx) => {
        // Create PledgeAddon records for each addon
        for (const addon of addons) {
          const quantity = quantityMap.get(addon.id) || 1;

          const existingAddon = await tx.pledgeAddon.findFirst({
            where: { pledgeId: pledge.id, addonId: addon.id },
          });

          if (existingAddon) {
            await tx.pledgeAddon.update({
              where: { id: existingAddon.id },
              data: {
                quantity: existingAddon.quantity + quantity,
                amount: (existingAddon.quantity + quantity) * Number(addon.amount),
              },
            });
          } else {
            await tx.pledgeAddon.create({
              data: {
                pledgeId: pledge.id,
                addonId: addon.id,
                quantity,
                amount: Number(addon.amount) * quantity,
              },
            });
          }

          // Atomically claim addon slots
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
          if (addonInfo && addonInfo.quantityAvailable !== null) {
            const available = addonInfo.quantityAvailable - addonInfo.quantityClaimed;
            if (available >= quantity) {
              await tx.reward.update({
                where: { id: addon.id },
                data: { quantityClaimed: { increment: quantity } },
              });
            }
          } else if (addonInfo) {
            // Unlimited quantity - just increment claimed
            await tx.reward.update({
              where: { id: addon.id },
              data: { quantityClaimed: { increment: quantity } },
            });
          }
        }

        // Update pledge amount and clear pending items
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            amount: Number(pledge.amount) + addItemsAmount,
            chain2payTxHash: txidOut,
            metadata: {
              ...pledgeMetadata,
              pendingAdditionalItems: undefined,
              completedAdditionalItems: [
                ...((pledgeMetadata.completedAdditionalItems as unknown[]) || []),
                {
                  paymentMethod: "CHAIN2PAY",
                  txHash: txidOut,
                  addons: addonsWithQuantity,
                  amount: addItemsAmount,
                  completedAt: new Date().toISOString(),
                },
              ],
            },
          },
        });

        // Update project currentAmount (NOT backerCount - they're already a backer)
        await tx.project.update({
          where: { id: pledge.project.id },
          data: { currentAmount: { increment: addItemsAmount } },
        });
      });

      console.log(`[Chain2Pay Webhook] Add-items confirmed for pledge ${pledgeId}: ${addons.length} addons, $${addItemsAmount}, tx=${txidOut}`);
      return NextResponse.json({ success: true });
    }

    // === NORMAL PLEDGE FLOW ===

    // Idempotency: skip if already completed (and not add-items)
    if (pledge.status === "COMPLETED") {
      console.log(`[Chain2Pay Webhook] Pledge ${pledgeId} already completed - skipping`);
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    const amount = Number(pledge.amount);
    const project = pledge.project;
    const goalAmount = Number(project.goalAmount);
    const currentAmount = Number(project.currentAmount);
    const isCampaignFunded = currentAmount >= goalAmount;
    const newCurrentAmount = currentAmount + amount;
    const justReachedGoal = newCurrentAmount >= goalAmount && !isCampaignFunded && !project.fundedAt;

    // Process the payment in a transaction
    await db.$transaction(async (tx) => {
      // Calculate backer number
      const existingBackerCount = await tx.pledge.count({
        where: {
          projectId: project.id,
          backerNumber: { not: null },
        },
      });

      // Update pledge status
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          backerNumber: existingBackerCount + 1,
          chain2payTxHash: txidOut,
          chargedImmediately: isCampaignFunded,
        },
      });

      // Atomically claim reward slot
      if (pledge.rewardId) {
        const rewardRows = await tx.$queryRaw<Array<{
          id: string;
          quantityAvailable: number | null;
          quantityClaimed: number;
        }>>`
          SELECT id, "quantityAvailable", "quantityClaimed"
          FROM "Reward"
          WHERE id = ${pledge.rewardId}
          FOR UPDATE
        `;

        const reward = rewardRows[0];
        if (reward) {
          const canClaim = reward.quantityAvailable === null ||
            reward.quantityClaimed < reward.quantityAvailable;
          if (canClaim) {
            await tx.reward.update({
              where: { id: pledge.rewardId },
              data: { quantityClaimed: { increment: 1 } },
            });
          }
        }
      }

      // Update project funding
      await tx.project.update({
        where: { id: project.id },
        data: {
          currentAmount: { increment: amount },
          backerCount: { increment: 1 },
          ...(justReachedGoal ? { fundedAt: new Date() } : {}),
        },
      });
    });

    console.log(`[Chain2Pay Webhook] Payment confirmed for pledge ${pledgeId}: tx=${txidOut}, amount=${valueCoin} USDC`);

    // === Post-transaction notifications (non-blocking - don't fail webhook) ===

    // Send confirmation email to backer
    try {
      await notifyBackerPledgeConfirmed(pledgeId, isCampaignFunded);
    } catch (emailError) {
      console.error(`[Chain2Pay Webhook] Failed to send confirmation email for pledge ${pledgeId}:`, emailError);
    }

    // Notify creator of new pledge
    try {
      await notifyPledgeReceived(
        project.id,
        project.creatorId,
        pledge.user.name || "A backer",
        amount
      );
    } catch (notifyError) {
      console.error(`[Chain2Pay Webhook] Failed to notify creator for pledge ${pledgeId}:`, notifyError);
    }

    // Auto-add backer to creator's email list
    if (pledge.user.email) {
      try {
        await addToCreatorEmailList({
          creatorId: project.creatorId,
          email: pledge.user.email,
          name: pledge.user.name,
          source: "pledge",
          sourceProjectId: project.id,
        });
      } catch (emailListError) {
        console.error(`[Chain2Pay Webhook] Failed to add backer to email list:`, emailListError);
      }
    }

    // Handle project funding events
    if (justReachedGoal) {
      try {
        await notifyProjectFunded(project.id);
      } catch (fundedError) {
        console.error(`[Chain2Pay Webhook] Failed to notify project funded for ${project.id}:`, fundedError);
      }
    }

    // Process pending Stripe pledges if project is now funded
    if (newCurrentAmount >= goalAmount) {
      try {
        const pendingCount = await db.pledge.count({
          where: {
            projectId: project.id,
            status: "PENDING",
            chargedImmediately: false,
            stripePaymentMethodId: { not: null },
          },
        });
        if (pendingCount > 0) {
          console.log(`[Chain2Pay Webhook] Processing ${pendingCount} pending Stripe pledges for project ${project.id}`);
          await processPendingPledgesForProject(project.id);
        }
      } catch (processError) {
        console.error(`[Chain2Pay Webhook] Failed to process pending pledges for ${project.id}:`, processError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Chain2Pay Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
