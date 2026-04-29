import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesLogger = logger.child({ module: "pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";
import { callDivinityCoinAPI, getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { notifyPledgeModified, notifyPledgeCancelled } from "@/lib/notifications/pledge-notifications";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { getWhopClient } from "@/lib/payments/whop";
import { loadNmiConfig, refund as nmiRefund, deleteVaultCustomer } from "@/lib/nmi";

export const dynamic = "force-dynamic";

// Helper to apply modification changes (reward swap, addon swap, amount update)
async function applyModificationChanges(
  pledgeId: string,
  pledge: { rewardId: string | null; projectId: string; amount: number | { toNumber?: () => number } },
  rewardId: string | undefined,
  addonsWithQuantity: { id: string; quantity: number }[],
  addonIdList: string[],
  newAmount: number,
  amountDiff: number
) {
  // If changing reward, update claimed counts
  if (pledge.rewardId && pledge.rewardId !== rewardId) {
    await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
  }

  if (rewardId && rewardId !== "no-reward" && pledge.rewardId !== rewardId) {
    await db.reward.update({
      where: { id: rewardId },
      data: { quantityClaimed: { increment: 1 } },
    });
  }

  // Delete old addon associations
  await db.pledgeAddon.deleteMany({
    where: { pledgeId },
  });

  // Create new addon associations with quantities
  if (addonsWithQuantity.length > 0) {
    const addonRecords = await db.reward.findMany({
      where: { id: { in: addonIdList }, type: "ADDON" },
      select: { id: true, amount: true },
    });
    const addonPriceMap = new Map<string, number>(
      addonRecords.map((a: { id: string; amount: number }) => [a.id, Number(a.amount)])
    );

    await db.pledgeAddon.createMany({
      data: addonsWithQuantity.map((addon) => ({
        pledgeId,
        addonId: addon.id,
        quantity: addon.quantity,
        amount: (addonPriceMap.get(addon.id) ?? 0) * addon.quantity,
      })),
    });
  }

  // Update the pledge
  await db.pledge.update({
    where: { id: pledgeId },
    data: {
      rewardId: rewardId === "no-reward" ? null : rewardId || null,
      amount: newAmount,
    },
  });

  // Update project current amount
  if (amountDiff !== 0) {
    await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: amountDiff },
      },
    });
  }
}

// GET - Get pledge details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        deletedAt: null,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            endDate: true,
            currentAmount: true,
            goalAmount: true,
            creatorId: true,
            creator: {
              select: {
                id: true,
                name: true,
                vanityUrl: true,
              },
            },
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        addons: {
          include: {
            addon: {
              select: {
                id: true,
                title: true,
                amount: true,
              },
            },
          },
        },
        refundRequest: {
          select: { id: true, status: true, reason: true, creatorNote: true, createdAt: true, processedAt: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";
    // A campaign is "closed" if its status has been flipped OR its endDate has
    // passed (the hourly cron may not have run yet). Backers must not be able
    // to process an immediate refund once the campaign has ended — they must
    // go through the refund-request flow which requires creator approval.
    const endDatePassed = !!(pledge.project.endDate && new Date(pledge.project.endDate) < new Date());
    const campaignClosed = ["FUNDED", "FAILED", "CANCELLED"].includes(pledge.project.status) || endDatePassed;
    const campaignActive = pledge.project.status === "LIVE" && !endDatePassed;

    // Build project URL with vanity URL if available
    const projectUrl = pledge.project.creator.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        status: pledge.status,
        createdAt: pledge.createdAt,
        backerNumber: pledge.backerNumber,
        project: {
          id: pledge.project.id,
          title: pledge.project.title,
          slug: pledge.project.slug,
          status: pledge.project.status,
          currentAmount: Number(pledge.project.currentAmount),
          goalAmount: Number(pledge.project.goalAmount),
          projectUrl,
          creatorId: pledge.project.creatorId,
          creatorName: pledge.project.creator.name,
        },
        reward: pledge.reward ? {
          id: pledge.reward.id,
          title: pledge.reward.title,
          amount: Number(pledge.reward.amount),
        } : null,
        addons: pledge.addons.map((a: { addon: { id: string; title: string; amount: number }; quantity: number }) => ({
          id: a.addon.id,
          title: a.addon.title,
          amount: Number(a.addon.amount),
          quantity: a.quantity,
        })),
        canCancel: (!isFunded && pledge.status === "PENDING") || (pledge.status === "COMPLETED" && !campaignClosed),
        canRefund: pledge.status === "COMPLETED" && !campaignClosed,
        canRequestRefund: pledge.status === "COMPLETED" && campaignClosed && !pledge.refundRequest,
        canModify: campaignActive && (pledge.status === "PENDING" || pledge.status === "COMPLETED"),
        canIncrease: campaignActive,
        isFunded,
        campaignClosed,
        refundRequest: pledge.refundRequest ?? null,
      },
    });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Get pledge error:");
    return NextResponse.json(
      { error: "Failed to fetch pledge" },
      { status: 500 }
    );
  }
}

// PATCH - Update pledge (increase amount or cancel)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const body = await req.json();
    const { action, amount } = body;

    // Get pledge with project info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        deletedAt: null,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            endDate: true,
            currentAmount: true,
            goalAmount: true,
            paymentProcessor: true,
            stripeAccountId: true,
            creator: {
              include: {
                stripeConfig: true,
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";
    const campaignEnded = !!(pledge.project.endDate && new Date(pledge.project.endDate) < new Date());
    // A campaign is "closed" for refund-gating purposes if its status has been
    // flipped OR its endDate has passed. Without the endDate check, backers can
    // exploit the hourly window between campaign end and the cron running to
    // process an immediate refund that should have required creator approval.
    const campaignClosed = ["FUNDED", "FAILED", "CANCELLED"].includes(pledge.project.status) || campaignEnded;
    if (action === "cancel") {
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";

      // COMPLETED pledges: for closed campaigns, create a refund request (requires creator approval)
      // For live campaigns, process the refund immediately
      if (pledge.status === "COMPLETED") {
        if (campaignClosed) {
          // Check if a refund request already exists
          const existing = await db.refundRequest.findUnique({ where: { pledgeId: pledge.id } });
          if (existing) {
            return NextResponse.json(
              { error: existing.status === "DENIED" ? "Your refund request was denied by the creator." : "A refund request has already been submitted for this pledge." },
              { status: 400 }
            );
          }

          await db.refundRequest.create({
            data: {
              pledgeId: pledge.id,
              userId: session.user.id,
              projectId: pledge.projectId,
              reason: body.reason || "Backer requested refund",
            },
          });

          return NextResponse.json({
            success: true,
            refundRequested: true,
            message: "Refund request submitted. The creator will review it and you'll be notified of their decision.",
          });
        }

        // Live campaign — process refund immediately
        if (paymentProcessor === "DIVINITYCOIN") {
          if (!pledge.divinityCoinPaymentId) {
            return NextResponse.json({ error: "DivinityCoin payment ID not found for this pledge" }, { status: 400 });
          }
          try {
            const dcResult = await callDivinityCoinAPI("refund", {
              pledgeId: pledge.id,
              paymentId: pledge.divinityCoinPaymentId,
              amount: Math.round(Number(pledge.amount) * 100),
              reason: body.reason || "Cancelled by backer",
              requestedBy: "user",
            });

            if (!dcResult.success) {
              return NextResponse.json(
                { error: dcResult.error || "Refund failed" },
                { status: 400 }
              );
            }
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "DivinityCoin refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 500 }
            );
          }
        } else if (paymentProcessor === "PAYPAL") {
          // PayPal: fetch order to get capture ID, then refund
          // If pledge was authorized but not captured (AUTHORIZE intent), void the authorization instead
          try {
            if (pledge.paypalAuthorizationId && !pledge.chargedImmediately) {
              // Void the authorization (no capture happened yet)
              const ppConfig = await getPayPalConfig();
              const ppToken = await getPayPalAccessToken();
              const voidRes = await fetch(
                `${ppConfig.baseUrl}/v2/payments/authorizations/${pledge.paypalAuthorizationId}/void`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${ppToken}`,
                    "Content-Type": "application/json",
                    "PayPal-Request-Id": `void_${pledge.id}`,
                  },
                }
              );
              if (!voidRes.ok && voidRes.status !== 422) {
                const errBody = await voidRes.text();
                pledgesLogger.error({ pledgeId: pledge.id, err: errBody }, "PayPal void failed");
                return NextResponse.json({ error: "Failed to void PayPal authorization." }, { status: 502 });
              }
            } else if (pledge.paypalOrderId) {
              // Captured order — issue a refund
              const ppConfig = await getPayPalConfig();
              const ppToken = await getPayPalAccessToken();
              const orderRes = await fetch(`${ppConfig.baseUrl}/v2/checkout/orders/${pledge.paypalOrderId}`, {
                headers: { Authorization: `Bearer ${ppToken}` },
              });
              if (!orderRes.ok) throw new Error("Failed to fetch PayPal order");
              const orderData = await orderRes.json();
              const captureId = orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined;
              if (!captureId) {
                return NextResponse.json({ error: "PayPal payment capture not found." }, { status: 400 });
              }
              const refundRes = await fetch(`${ppConfig.baseUrl}/v2/payments/captures/${captureId}/refund`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ppToken}`,
                  "Content-Type": "application/json",
                  "PayPal-Request-Id": `refund_backer_${pledge.id}`,
                },
                body: JSON.stringify({ note_to_payer: body.reason || "Refund requested by backer" }),
              });
              if (!refundRes.ok) {
                const errBody = await refundRes.text();
                pledgesLogger.error({ pledgeId: pledge.id, err: errBody }, "PayPal refund failed");
                return NextResponse.json({ error: "Failed to process PayPal refund." }, { status: 502 });
              }
            } else {
              return NextResponse.json({ error: "No PayPal payment found to refund." }, { status: 400 });
            }
          } catch (ppError) {
            pledgesLogger.error({ err: String(ppError) }, "PayPal refund/void error");
            return NextResponse.json({ error: "Failed to process refund." }, { status: 500 });
          }
        } else if (paymentProcessor === "WHOP") {
          // Whop: use SDK to refund the payment
          if (!pledge.whopPaymentId) {
            return NextResponse.json(
              { error: "Whop payment ID not found. Please contact support to request a refund." },
              { status: 400 }
            );
          }
          try {
            const whopClient = await getWhopClient();
            await whopClient.payments.refund(pledge.whopPaymentId);
          } catch (whopError) {
            pledgesLogger.error({ err: String(whopError) }, "Whop refund error");
            return NextResponse.json({ error: "Failed to process Whop refund." }, { status: 500 });
          }
        } else if (paymentProcessor === "NMI") {
          // PaymentCloud (NMI): KIA pledges have nmiTransactionId set by
          // confirm-nmi; AoN pledges have nmiCustomerVaultId only (no
          // sale yet — but COMPLETED + AoN means the charge-on-success
          // cron already ran a sale, so nmiTransactionId should be set).
          if (!pledge.nmiTransactionId) {
            return NextResponse.json(
              { error: "No PaymentCloud transaction found to refund. Please contact support." },
              { status: 400 }
            );
          }
          try {
            const nmiConfig = await loadNmiConfig();
            if (!nmiConfig) {
              return NextResponse.json({ error: "PaymentCloud not configured" }, { status: 502 });
            }
            const refundResp = await nmiRefund(nmiConfig, pledge.nmiTransactionId);
            if (refundResp.response !== "1") {
              pledgesLogger.error(
                { pledgeId: pledge.id, response: refundResp.response, text: refundResp.responsetext },
                "PaymentCloud refund declined"
              );
              return NextResponse.json(
                { error: refundResp.responsetext || "Refund failed" },
                { status: 400 }
              );
            }
            // Best-effort: delete the vault entry too (AoN only — KIA
            // never created one). Ignore failures, refund already ran.
            if (pledge.nmiCustomerVaultId) {
              await deleteVaultCustomer(nmiConfig, pledge.nmiCustomerVaultId).catch(() => null);
            }
          } catch (nmiError) {
            pledgesLogger.error({ err: String(nmiError) }, "PaymentCloud refund error");
            return NextResponse.json({ error: "Failed to process PaymentCloud refund." }, { status: 500 });
          }
        } else {
          // Stripe refund
          if (!pledge.stripePaymentIntentId) {
            return NextResponse.json(
              { error: "No payment found to refund" },
              { status: 400 }
            );
          }

          try {
            const stripe = await getStripeInstance();
            await stripe.refunds.create({
              payment_intent: pledge.stripePaymentIntentId,
              reason: "requested_by_customer",
              metadata: {
                pledgeId: pledge.id,
                cancelledBy: session.user.id,
                reason: body.reason || "Cancelled by backer",
              },
            });
          } catch (stripeError) {
            pledgesLogger.error({ err: String(stripeError) }, "Stripe refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 400 }
            );
          }
        }

        // Atomic CAS from COMPLETED → REFUNDED. Without this, a
        // double-click on the Cancel button (fast retries, flaky
        // network replaying the POST, or a race with the Stripe
        // charge.refunded webhook) would both pass the earlier
        // `pledge.status === "COMPLETED"` check and both decrement
        // project stats — a double-decrement of backerCount and
        // currentAmount.
        //
        // The upstream provider refund (Stripe/PayPal/Whop/DC) has
        // already been issued at this point. Providers have their own
        // idempotency (we check Stripe for existing refunds; PayPal
        // returns the existing refund on retry; DC's API dedups), so
        // a lost CAS just means we skip the decrement — the provider
        // refund itself isn't double-applied.
        const refundCas = await db.pledge.updateMany({
          where: { id: pledgeId, status: "COMPLETED", deletedAt: null },
          data: {
            status: "REFUNDED",
            lastFailureReason: body.reason || "Cancelled by backer",
          },
        });

        if (refundCas.count === 0) {
          return NextResponse.json({
            success: true,
            refunded: true,
            message: "Pledge was already refunded by a concurrent request",
            alreadyRefunded: true,
          });
        }

        // Decrement project stats (only if pledge was counted)
        if (pledge.confirmationEmailSent) {
          await db.project.update({
            where: { id: pledge.projectId },
            data: {
              backerCount: { decrement: 1 },
              currentAmount: { decrement: Number(pledge.amount) },
            },
          });
        }

        // Release reward slot so it can be claimed by another backer
        // Only if the pledge was confirmed (slot was actually claimed)
        if (pledge.confirmationEmailSent && pledge.rewardId) {
          db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`
            .catch(err => pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to decrement reward quantity"));
        }

        // Send cancellation + refund notification (async, don't block response)
        notifyPledgeCancelled(pledgeId, true).catch(err =>
          pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to send refund notification:")
        );

        return NextResponse.json({
          success: true,
          refunded: true,
          message: "Pledge cancelled and refund processed",
        });
      }

      // PENDING pledges: cancel (no charge has been made)
      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending or completed pledges" },
          { status: 400 }
        );
      }

      if (isFunded) {
        return NextResponse.json(
          { error: "Cannot cancel pending pledge after project is funded. Your payment is being processed." },
          { status: 400 }
        );
      }

      // Cancel any Stripe intents (safely checks status first)
      const stripe = await getStripeInstance();
      if (pledge.stripeSetupIntentId) {
        await safeCancelSetupIntent(stripe, pledge.stripeSetupIntentId);
      }
      if (pledge.stripePaymentIntentId) {
        await safeCancelPaymentIntent(stripe, pledge.stripePaymentIntentId);
      }

      // Tear down any PaymentCloud vault entry left over from an AoN
      // pledge so we don't leak stored cards on cancel.
      if (pledge.nmiCustomerVaultId) {
        const nmiConfig = await loadNmiConfig();
        if (nmiConfig) {
          await deleteVaultCustomer(nmiConfig, pledge.nmiCustomerVaultId).catch(() => null);
        }
      }

      // Atomic CAS from PENDING → CANCELLED. Guards against
      // double-clicks and concurrent calls from multiple tabs. If
      // we lose the race the pledge was either already cancelled or
      // became COMPLETED mid-flight — either way the subsequent
      // decrement would be incorrect.
      const cancelCas = await db.pledge.updateMany({
        where: { id: pledgeId, status: "PENDING", deletedAt: null },
        data: { status: "CANCELLED" },
      });

      if (cancelCas.count === 0) {
        return NextResponse.json({
          success: true,
          refunded: false,
          message: "Pledge was already cancelled or processed by a concurrent request",
          alreadyCancelled: true,
        });
      }

      // Only decrement project stats if pledge was actually confirmed
      if (pledge.confirmationEmailSent) {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: Number(pledge.amount) },
          },
        });
      }

      // Release reward slot only if the pledge was confirmed (slot was actually claimed)
      if (pledge.confirmationEmailSent && pledge.rewardId) {
        db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`
          .catch(err => pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to decrement reward quantity"));
      }

      // Send cancellation notification (async, don't block response)
      notifyPledgeCancelled(pledgeId, false).catch(err =>
        pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to send cancellation notification:")
      );

      return NextResponse.json({
        success: true,
        refunded: false,
        message: "Pledge cancelled successfully",
      });
    }

    if (action === "modify") {
      // Auto-supersede any abandoned prior modification. The previous behavior
      // was to 409 if pendingModification existed, forcing the user to wait for
      // a manual cleanup. In practice users abandon the Stripe form (close tab,
      // bail on card entry, network glitch) and there's no path that clears
      // the flag — so every retry hit the 409 wall. Now: if the prior PI is
      // still open we cancel it (Stripe) or let it expire on DC's side, drop
      // pendingModification, and proceed with the new attempt.
      const existingMeta = (typeof pledge.metadata === "object" && pledge.metadata !== null)
        ? pledge.metadata as Record<string, unknown>
        : {};
      if (existingMeta.pendingModification) {
        const prior = existingMeta.pendingModification as {
          paymentMethod?: string;
          paymentIntentId?: string;
        };
        try {
          if (prior.paymentMethod === "STRIPE" && prior.paymentIntentId) {
            const stripe = await getStripeInstance();
            if (stripe) {
              await safeCancelPaymentIntent(stripe, prior.paymentIntentId);
            }
          }
          // DC payment intents have no platform-level cancel action — the
          // underlying Stripe PI auto-expires after ~24h if it stays in
          // requires_payment_method. Creating a fresh DC intent below
          // supersedes it; the orphan one never charges anything.
        } catch (cancelErr) {
          // Don't let a cancel failure block the new modify — just log it.
          pledgesLogger.warn(
            { err: String(cancelErr), pledgeId, priorIntentId: prior.paymentIntentId },
            "[Modify] Failed to cancel superseded payment intent; proceeding with new attempt"
          );
        }
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: Object.fromEntries(
              Object.entries(existingMeta).filter(([k]) => k !== "pendingModification")
            ),
          },
        });
        pledgesLogger.info(
          { pledgeId, supersededIntentId: prior.paymentIntentId, paymentMethod: prior.paymentMethod },
          "[Modify] Superseded abandoned pendingModification"
        );
      }

      // Can only modify while project is live and campaign hasn't ended
      if (pledge.project.status !== "LIVE" || campaignEnded) {
        return NextResponse.json(
          { error: "This campaign has ended. Pledge modifications are no longer available." },
          { status: 400 }
        );
      }

      // Allow modify for PENDING (unfunded) and COMPLETED pledges
      if (pledge.status !== "PENDING" && pledge.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Can only modify pending or completed pledges" },
          { status: 400 }
        );
      }

      const { rewardId, addonIds, addons, newAmount } = body;

      // Validate newAmount
      if (newAmount !== undefined && newAmount !== null) {
        if (typeof newAmount !== "number" || isNaN(newAmount) || newAmount <= 0) {
          return NextResponse.json({ error: "Invalid pledge amount" }, { status: 400 });
        }
      }

      // Support both new format (addons with quantities) and legacy format (addonIds)
      const addonsWithQuantity: { id: string; quantity: number }[] = addons ||
        (addonIds ? addonIds.map((id: string) => ({ id, quantity: 1 })) : []);
      const addonIdList = addonsWithQuantity.map(a => a.id);

      // Validate new reward if provided
      let newReward = null;
      if (rewardId && rewardId !== "no-reward") {
        newReward = await db.reward.findUnique({
          where: { id: rewardId },
        });

        if (!newReward || newReward.projectId !== pledge.projectId) {
          return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
        }

        // Check availability (but allow if it's the same reward)
        if (newReward.quantityAvailable !== null &&
            newReward.quantityClaimed >= newReward.quantityAvailable &&
            pledge.rewardId !== rewardId) {
          return NextResponse.json({ error: "Reward sold out" }, { status: 400 });
        }
      }

      // Validate addons if provided (only active, non-ended addons)
      if (addonIdList.length > 0) {
        const validAddons = await db.reward.findMany({
          where: {
            id: { in: addonIdList },
            projectId: pledge.projectId,
            type: "ADDON",
            isEnded: false,
          },
        });

        if (validAddons.length !== addonIdList.length) {
          return NextResponse.json({ error: "Invalid addons" }, { status: 400 });
        }
      }

      // Calculate price difference
      const oldAmount = Number(pledge.amount);

      // Server-recompute the expected new total from reward + addons + EXISTING shipping.
      // Shipping is preserved across modifications — backers can't unintentionally refund
      // shipping by switching to a no-shipping reward, and the client's newAmount is
      // informational only. Without this guard, a modify that sends newAmount=reward+addons
      // (omitting shipping) causes the refund branch below to claw back the shipping portion
      // that the creator needs for fulfillment.
      const newRewardAmount = newReward ? Number(newReward.amount) : 0;
      let newAddonsAmount = 0;
      if (addonIdList.length > 0) {
        const addonRecords = await db.reward.findMany({
          where: { id: { in: addonIdList }, type: "ADDON" },
          select: { id: true, amount: true },
        });
        const priceMap = new Map<string, number>(
          addonRecords.map((a: { id: string; amount: unknown }) => [a.id, Number(a.amount)])
        );
        newAddonsAmount = addonsWithQuantity.reduce(
          (sum, a) => sum + (priceMap.get(a.id) ?? 0) * a.quantity,
          0
        );
      }
      const preservedShipping = Number(pledge.shippingAmount || 0);
      const computedNewAmount = newRewardAmount + newAddonsAmount + preservedShipping;

      const effectiveNewAmount: number = computedNewAmount;
      const amountDiff = effectiveNewAmount - oldAmount;
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";
      const isAlreadyCharged = pledge.status === "COMPLETED";

      // If pledge is already charged (COMPLETED) and price changed, handle payment diff
      if (isAlreadyCharged && amountDiff > 0) {
        // Price went UP - need to collect additional payment
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

        if (paymentProcessor === "NMI") {
          // PaymentCloud upcharge: KIA pledges have no vault entry
          // (skipped at original pledge time to avoid the per-txn
          // Vault fee), so we re-prompt the user for their card via
          // Collect.js and run a fresh saleByPaymentToken for the
          // delta. We stash the pending modification on the pledge
          // and let confirm-modify finish the work once the client
          // POSTs back with a payment_token.
          const nmiConfigCheck = await loadNmiConfig();
          if (!nmiConfigCheck) {
            return NextResponse.json({ error: "PaymentCloud not configured" }, { status: 502 });
          }

          const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
            ? pledge.metadata as Record<string, unknown>
            : {};

          await db.pledge.update({
            where: { id: pledgeId },
            data: {
              metadata: {
                ...currentMetadata,
                pendingModification: {
                  paymentMethod: "NMI",
                  rewardId: rewardId || null,
                  addons: addonsWithQuantity,
                  newAmount,
                  oldAmount,
                  amountDiff,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          });

          return NextResponse.json({
            success: true,
            requiresPayment: true,
            paymentMethod: "NMI",
            nmiPublicKey: nmiConfigCheck.publicKey,
            amountDiff,
            message: `Additional $${amountDiff.toFixed(2)} payment required`,
            newAmount: effectiveNewAmount,
          });
        }

        if (paymentProcessor === "DIVINITYCOIN") {
          // Call DC's create-payment-intent for the upcharge amount
          try {
            const dcConfig = await getDivinityCoinConfig();
            const userRecord = await db.user.findFirst({
              where: { id: session.user.id, deletedAt: null },
              select: { email: true, name: true },
            });

            const dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${dcConfig.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                amount: Math.round(amountDiff * 100), // difference in cents
                currency: "usd",
                platformUserId: session.user.id,
                email: userRecord?.email || "",
                name: userRecord?.name || "",
                pledgeId: pledge.id,
                projectId: pledge.projectId,
                type: "upcharge",
                originalPaymentId: pledge.divinityCoinPaymentId,
              }),
            });

            const dcResult = await dcResponse.json();
            if (!dcResponse.ok || !dcResult.success) {
              pledgesLogger.error({ err: String(dcResult) }, "[DivinityCoin Modify] Failed to create upcharge payment intent:");
              return NextResponse.json(
                { error: dcResult.error || "Failed to initialize upcharge payment" },
                { status: 502 }
              );
            }

            // Store pending modification in metadata (DON'T apply changes yet - wait for payment)
            const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
              ? pledge.metadata as Record<string, unknown>
              : {};

            await db.pledge.update({
              where: { id: pledgeId },
              data: {
                metadata: {
                  ...currentMetadata,
                  pendingModification: {
                    paymentMethod: "DIVINITYCOIN",
                    paymentIntentId: dcResult.paymentIntentId,
                    rewardId: rewardId || null,
                    addons: addonsWithQuantity,
                    newAmount,
                    oldAmount,
                    amountDiff,
                    createdAt: new Date().toISOString(),
                  },
                },
              },
            });

            return NextResponse.json({
              success: true,
              requiresPayment: true,
              clientSecret: dcResult.clientSecret,
              publishableKey: dcResult.publishableKey,
              message: `Additional $${amountDiff.toFixed(2)} payment required`,
              newAmount: effectiveNewAmount,
            });
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "[DivinityCoin Modify] API error:");
            return NextResponse.json(
              { error: "Failed to connect to payment processor" },
              { status: 500 }
            );
          }
        }

        // Stripe: Create PaymentIntent for the difference
        const stripe = await getStripeInstance();
        if (!stripe) {
          return NextResponse.json({ error: "Payment system unavailable" }, { status: 500 });
        }

        const amountInCents = Math.round(amountDiff * 100);
        const pledgeModPlatformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
        const pledgeModFeeRate = pledgeModPlatformSettings?.platformFee ? Number(pledgeModPlatformSettings.platformFee) / 100 : 0.03;
        const platformFee = Math.round(amountDiff * pledgeModFeeRate * 100);

        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: amountInCents,
          currency: "usd",
          metadata: {
            pledgeId: pledge.id,
            projectId: pledge.projectId,
            userId: session.user.id,
            type: "pledge_modification_upcharge",
            rewardId: rewardId || "",
            addons: JSON.stringify(addonsWithQuantity),
            newAmount: String(newAmount),
          },
        };

        if (stripeAccountId) {
          paymentIntentParams.application_fee_amount = platformFee;
          paymentIntentParams.transfer_data = { destination: stripeAccountId };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        // Store pending modification in metadata
        const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
          ? pledge.metadata as Record<string, unknown>
          : {};

        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...currentMetadata,
              pendingModification: {
                paymentMethod: "STRIPE",
                paymentIntentId: paymentIntent.id,
                rewardId: rewardId || null,
                addons: addonsWithQuantity,
                newAmount,
                oldAmount,
                amountDiff,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });

        return NextResponse.json({
          success: true,
          requiresPayment: true,
          clientSecret: paymentIntent.client_secret,
          message: `Additional $${amountDiff.toFixed(2)} payment required`,
          newAmount: effectiveNewAmount,
        });
      }

      if (isAlreadyCharged && amountDiff < 0) {
        // Price went DOWN - issue a refund for the difference
        const refundAmount = Math.abs(amountDiff);
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

        if (paymentProcessor === "DIVINITYCOIN") {
          if (!pledge.divinityCoinPaymentId) {
            return NextResponse.json({ error: "DivinityCoin payment ID not found for this pledge" }, { status: 400 });
          }
          try {
            const dcResult = await callDivinityCoinAPI("refund", {
              pledgeId: pledge.id,
              paymentId: pledge.divinityCoinPaymentId,
              amount: Math.round(refundAmount * 100),
              reason: "Pledge modification - price decreased",
              requestedBy: "user",
              partial: true,
            });

            if (!dcResult.success) {
              return NextResponse.json(
                { error: dcResult.error || "Refund failed" },
                { status: 400 }
              );
            }

            // Log the refund to DivinityCoinTransaction so it's auditable in-platform.
            // Without this row, the only record of the refund is on Stripe and admins
            // can't see it in the backer/pledge views.
            await db.divinityCoinTransaction.create({
              data: {
                userId: pledge.userId,
                pledgeId: pledge.id,
                amount: -refundAmount,
                type: "REFUND",
                description: `Partial refund ($${refundAmount.toFixed(2)}) from pledge modification on "${pledge.project.title}"`,
                metadata: JSON.stringify({
                  requestedBy: "user",
                  userId: session.user.id,
                  projectId: pledge.projectId,
                  divinityCoinPaymentId: pledge.divinityCoinPaymentId,
                  dcRefundResult: dcResult.data ?? null,
                  refundAmount,
                  oldAmount,
                  newAmount: effectiveNewAmount,
                  source: "pledge_modification",
                  processedAt: new Date().toISOString(),
                }),
              },
            });
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "DivinityCoin partial refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 500 }
            );
          }
        } else if (paymentProcessor === "NMI") {
          // PaymentCloud partial refund against the original sale.
          if (!pledge.nmiTransactionId) {
            return NextResponse.json(
              { error: "No PaymentCloud transaction found to refund. Please contact support." },
              { status: 400 }
            );
          }
          try {
            const nmiConfig = await loadNmiConfig();
            if (!nmiConfig) {
              return NextResponse.json({ error: "PaymentCloud not configured" }, { status: 502 });
            }
            const refundResp = await nmiRefund(nmiConfig, pledge.nmiTransactionId, refundAmount);
            if (refundResp.response !== "1") {
              pledgesLogger.error(
                { pledgeId: pledge.id, response: refundResp.response, text: refundResp.responsetext },
                "PaymentCloud partial refund declined"
              );
              return NextResponse.json(
                { error: refundResp.responsetext || "Refund failed" },
                { status: 400 }
              );
            }
          } catch (nmiError) {
            pledgesLogger.error({ err: String(nmiError) }, "PaymentCloud partial refund error");
            return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
          }
        } else {
          // Stripe partial refund
          if (!pledge.stripePaymentIntentId) {
            return NextResponse.json(
              { error: "No payment found to refund" },
              { status: 400 }
            );
          }

          try {
            const stripe = await getStripeInstance();
            await stripe.refunds.create({
              payment_intent: pledge.stripePaymentIntentId,
              amount: Math.round(refundAmount * 100), // Partial refund in cents
              reason: "requested_by_customer",
              metadata: {
                pledgeId: pledge.id,
                type: "pledge_modification_refund",
                stripeAccountId: stripeAccountId || "",
              },
            });
          } catch (stripeError) {
            pledgesLogger.error({ err: String(stripeError) }, "Stripe partial refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 400 }
            );
          }
        }

        // Apply the modification changes (addons, rewards, amounts)
        await applyModificationChanges(pledgeId, pledge, rewardId, addonsWithQuantity, addonIdList, effectiveNewAmount, amountDiff);

        // Send refund notification
        notifyPledgeModified(pledgeId, oldAmount, effectiveNewAmount, "refund").catch(err =>
          pledgesLogger.error({ err: String(err) }, "[Modify] Failed to send refund notification:")
        );

        return NextResponse.json({
          success: true,
          requiresPayment: false,
          refundAmount,
          message: `Pledge updated. $${refundAmount.toFixed(2)} has been refunded.`,
          newAmount: effectiveNewAmount,
        });
      }

      // No price change, or PENDING pledge (not yet charged) - just update directly
      await applyModificationChanges(pledgeId, pledge, rewardId, addonsWithQuantity, addonIdList, effectiveNewAmount, amountDiff);

      // Send modification notification
      notifyPledgeModified(pledgeId, oldAmount, effectiveNewAmount, "no_change").catch(err =>
        pledgesLogger.error({ err: String(err) }, "[Modify] Failed to send modification notification:")
      );

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: "Pledge modified successfully",
        newAmount: effectiveNewAmount,
      });
    }

    if (action === "increase") {
      // Can only increase pledge amount while project is live and campaign hasn't ended
      if (pledge.project.status !== "LIVE" || campaignEnded) {
        return NextResponse.json(
          { error: "This campaign has ended. Pledge increases are no longer available." },
          { status: 400 }
        );
      }

      const additionalAmount = typeof amount === "number" ? amount : parseFloat(amount);
      if (!additionalAmount || isNaN(additionalAmount) || additionalAmount <= 0) {
        return NextResponse.json(
          { error: "Additional amount must be a positive number" },
          { status: 400 }
        );
      }
      const newTotal = Number(pledge.amount) + additionalAmount;
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";
      const isCharged = pledge.status === "COMPLETED";

      // If pledge is already charged, collect the additional amount
      if (isCharged) {
        if (paymentProcessor === "DIVINITYCOIN") {
          // DC pledges require a payment form for upcharges - the dashboard doesn't have one.
          // Direct users to "Change Reward or Add-ons" which has full payment support.
          return NextResponse.json(
            { error: "To increase your pledge amount, please use 'Change Reward or Add-ons' from your pledge dashboard." },
            { status: 400 }
          );
        }

        if (paymentProcessor === "NMI") {
          // Same reasoning as DC: KIA NMI pledges have no vault entry,
          // so increasing the amount requires re-prompting for a card
          // via Collect.js. The dashboard quick-increase form doesn't
          // host that flow; route the user through Change Reward or
          // Add-ons instead.
          return NextResponse.json(
            { error: "To increase your pledge amount, please use 'Change Reward or Add-ons' from your pledge dashboard." },
            { status: 400 }
          );
        }

        // Stripe: charge immediately if creator has Stripe Connect
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;
        if (stripeAccountId) {
          const amountInCents = Math.round(additionalAmount * 100);
          const platformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
          const platformFeeRate = platformSettings?.platformFee ? Number(platformSettings.platformFee) / 100 : 0.03;
          const platformFee = Math.round(additionalAmount * platformFeeRate * 100);

          try {
            const stripeClient = await getStripeInstance();
            const paymentIntent = await stripeClient.paymentIntents.create({
              amount: amountInCents,
              currency: "usd",
              customer: pledge.stripeCustomerId || undefined,
              payment_method: pledge.stripePaymentMethodId || undefined,
              confirm: !!pledge.stripePaymentMethodId,
              application_fee_amount: platformFee,
              transfer_data: {
                destination: stripeAccountId,
              },
              metadata: {
                pledgeId: pledge.id,
                projectId: pledge.projectId,
                userId: session.user.id,
                type: "pledge_increase",
              },
            });

            if (paymentIntent.status === "succeeded") {
              // Update pledge amount
              await db.pledge.update({
                where: { id: pledgeId },
                data: { amount: newTotal },
              });

              // Update project current amount
              await db.project.update({
                where: { id: pledge.projectId },
                data: {
                  currentAmount: { increment: additionalAmount },
                },
              });

              return NextResponse.json({
                success: true,
                message: `Pledge increased by $${additionalAmount.toFixed(2)}`,
                newTotal,
                charged: true,
              });
            } else {
              return NextResponse.json({
                success: false,
                requiresAction: true,
                clientSecret: paymentIntent.client_secret,
                message: "Payment requires additional action",
              });
            }
          } catch (stripeError) {
            pledgesLogger.error({ err: String(stripeError) }, "Stripe error:");
            return NextResponse.json(
              { error: "Payment failed" },
              { status: 400 }
            );
          }
        }

        // No payment method available for upcharge on completed pledges
        return NextResponse.json(
          { error: "To increase your pledge amount, please use 'Change Reward or Add-ons' from your pledge dashboard." },
          { status: 400 }
        );
      }

      // Not yet charged (PENDING) - just update the pledge amount
      await db.pledge.update({
        where: { id: pledgeId },
        data: { amount: newTotal },
      });

      // Only update project current amount if pledge was already confirmed
      // (unconfirmed pledges will have their full new amount counted at confirmation)
      if (pledge.confirmationEmailSent) {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: additionalAmount },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Pledge increased to $${newTotal.toFixed(2)}`,
        newTotal,
        charged: false,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Update pledge error:");
    return NextResponse.json(
      { error: "Failed to update pledge" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel pledge (alias for PATCH cancel)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge with project info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        deletedAt: null,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            currentAmount: true,
            goalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";

    if (isFunded) {
      return NextResponse.json(
        { error: "Cannot cancel pledge after project is funded" },
        { status: 400 }
      );
    }

    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only cancel pending pledges" },
        { status: 400 }
      );
    }

    // Cancel any Stripe intents (safely checks status first)
    const stripe = await getStripeInstance();
    if (pledge.stripeSetupIntentId) {
      await safeCancelSetupIntent(stripe, pledge.stripeSetupIntentId);
    }
    if (pledge.stripePaymentIntentId) {
      await safeCancelPaymentIntent(stripe, pledge.stripePaymentIntentId);
    }

    // Tear down any PaymentCloud vault entry left over from an AoN
    // pledge so we don't leak stored cards on cancel. KIA pledges
    // never get a vault entry; this is a no-op for them.
    if (pledge.nmiCustomerVaultId) {
      const nmiConfig = await loadNmiConfig();
      if (nmiConfig) {
        await deleteVaultCustomer(nmiConfig, pledge.nmiCustomerVaultId).catch(() => null);
      }
    }

    // Atomic CAS from PENDING → CANCELLED (same guard as the PATCH
    // branch above at ~line 515). Prevents double-click / race
    // double-decrements of project stats.
    const cancelCas = await db.pledge.updateMany({
      where: { id: pledgeId, status: "PENDING", deletedAt: null },
      data: { status: "CANCELLED" },
    });

    if (cancelCas.count === 0) {
      return NextResponse.json({
        success: true,
        message: "Pledge was already cancelled or processed by a concurrent request",
        alreadyCancelled: true,
      });
    }

    // Only decrement project stats if pledge was actually confirmed
    // (stats are only incremented when confirmationEmailSent = true)
    // This prevents negative values from incomplete checkouts being cancelled
    if (pledge.confirmationEmailSent) {
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: Number(pledge.amount) },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Pledge cancelled successfully",
    });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Cancel pledge error:");
    return NextResponse.json(
      { error: "Failed to cancel pledge" },
      { status: 500 }
    );
  }
}
