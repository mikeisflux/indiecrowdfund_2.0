import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesAddItemsLogger = logger.child({ module: "pledges-add-items" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, assignBackerNumber } from "@/lib/payments/stripe";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { loadNmiConfig } from "@/lib/nmi";

export const dynamic = "force-dynamic";

/**
 * Self-healing function to fix pledges stuck in PENDING status
 * This can happen if the Stripe webhook didn't fire or failed
 */
async function healStuckPendingPledge(pledgeId: string, stripePaymentIntentId: string): Promise<boolean> {
  try {
    const stripe = await getStripeInstance();
    if (!stripe) return false;

    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Payment succeeded but webhook didn't update pledge - fix it now
      const paymentMethodId = typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id;

      // Get pledge to check if backer number already assigned
      const pledge = await db.pledge.findFirst({
        where: { id: pledgeId , deletedAt: null },
        select: { projectId: true, backerNumber: true },
      });

      // Assign backer number atomically if not already assigned
      if (!pledge?.backerNumber && pledge?.projectId) {
        await assignBackerNumber(pledge.projectId, pledgeId);
      }

      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          stripePaymentMethodId: paymentMethodId,
        },
      });

      pledgesAddItemsLogger.info(`[AddItems] Self-healed pledge ${pledgeId} - updated to COMPLETED`);
      return true;
    }

    return false;
  } catch (error) {
    pledgesAddItemsLogger.error({ err: String(error) }, `[AddItems] Failed to heal pledge ${pledgeId}:`);
    return false;
  }
}

// POST - Add additional items to a completed pledge
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
    const body = await req.json();
    const { addons, addonIds, amount } = body;

    // Support both new format (addons with quantities) and legacy format (addonIds)
    const addonsWithQuantity: { id: string; quantity: number }[] = addons ||
      (addonIds ? addonIds.map((id: string) => ({ id, quantity: 1 })) : []);

    if (addonsWithQuantity.length === 0) {
      return NextResponse.json(
        { error: "At least one addon is required" },
        { status: 400 }
      );
    }

    const addonIdList = addonsWithQuantity.map(a => a.id);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Get the pledge with project info and creator's Stripe config
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
            status: true,
            endDate: true,
            creatorId: true,
            paymentProcessor: true,
            stripeAccountId: true,
            creator: {
              select: {
                stripeConfig: {
                  select: {
                    stripeAccountId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify pledge is completed
    // If PENDING with a PaymentIntent, try to heal it by checking Stripe
    if (pledge.status !== "COMPLETED") {
      if (pledge.status === "PENDING" && pledge.stripePaymentIntentId) {
        // Try to heal stuck pledge by checking PaymentIntent status in Stripe
        const healed = await healStuckPendingPledge(pledgeId, pledge.stripePaymentIntentId);
        if (!healed) {
          return NextResponse.json(
            { error: "Your pledge payment may still be processing. Please try again in a few moments." },
            { status: 400 }
          );
        }
        // Pledge was healed, continue with adding items
      } else {
        return NextResponse.json(
          { error: "Can only add items to completed pledges" },
          { status: 400 }
        );
      }
    }

    // Verify project is still live and campaign hasn't ended
    // Exception: allow add-on purchases during survey completion (surveys are sent after campaigns close)
    const campaignEnded = pledge.project.endDate && new Date(pledge.project.endDate) < new Date();
    if (pledge.project.status !== "LIVE" || campaignEnded) {
      const isSurveyPurchase = body.source === "survey";
      if (isSurveyPurchase) {
        // Verify there's actually an active survey for this project
        const survey = await db.survey.findUnique({
          where: { projectId: pledge.projectId },
          select: { id: true, status: true },
        });
        if (!survey || survey.status === "DRAFT") {
          return NextResponse.json(
            { error: "No active survey found for this project." },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "This campaign has ended. Adding items is no longer available." },
          { status: 400 }
        );
      }
    }

    // Validate addons exist and belong to this project (addons are rewards with type ADDON)
    const validAddons = await db.reward.findMany({
      where: {
        id: { in: addonIdList },
        projectId: pledge.projectId,
        type: "ADDON",
        isEnded: false,
      },
    });

    if (validAddons.length !== addonIdList.length) {
      return NextResponse.json(
        { error: "Some addons are invalid" },
        { status: 400 }
      );
    }

    // Create a map for quick lookup
    const addonQuantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

    // Check addon availability with quantities
    for (const addon of validAddons) {
      const requestedQty = addonQuantityMap.get(addon.id) || 1;
      if (addon.quantityAvailable !== null) {
        const availableQty = addon.quantityAvailable - addon.quantityClaimed;
        if (requestedQty > availableQty) {
          return NextResponse.json(
            { error: `Only ${availableQty} of ${addon.title} available` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate the expected amount with quantities
    const calculatedAmount = validAddons.reduce((sum: number, addon: { id: string; amount: number }) => {
      const qty = addonQuantityMap.get(addon.id) || 1;
      return sum + (Number(addon.amount) * qty);
    }, 0);

    // Amount must cover addon total; cap excess at $500 to allow for shipping without unbounded overcharge
    if (amount < calculatedAmount) {
      return NextResponse.json(
        { error: "Amount is less than addon total" },
        { status: 400 }
      );
    }
    if (amount > calculatedAmount + 500) {
      return NextResponse.json(
        { error: "Amount exceeds addon total by more than the allowed shipping allowance" },
        { status: 400 }
      );
    }

    const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";

    // ── Claim the "adding items" slot under a row lock ──
    // Two concurrent add-items POSTs for the same pledge (e.g. user double-
    // clicks) would otherwise both create separate PaymentIntents and clobber
    // each other's metadata, leaving the user with a stale PI the webhook can
    // no longer reconcile. Use a FOR UPDATE lock + 60s freshness window so
    // only one add-items flow is in flight at a time. This was flagged as the
    // most critical add-items race in the audit.
    let currentMetadata: Record<string, unknown>;
    try {
      currentMetadata = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledgeId} FOR UPDATE`;
        const latest = await tx.pledge.findUnique({
          where: { id: pledgeId },
          select: { metadata: true },
        });
        const md = (typeof latest?.metadata === "object" && latest?.metadata !== null)
          ? latest.metadata as Record<string, unknown>
          : {};
        const pending = md.pendingAdditionalItems as { createdAt?: string } | undefined;
        if (pending?.createdAt) {
          const ageMs = Date.now() - new Date(pending.createdAt).getTime();
          if (ageMs < 60_000) {
            throw new Error("ADD_ITEMS_IN_PROGRESS");
          }
        }
        // Stamp a reserving marker while the lock is held so any concurrent
        // request sees the fresh timestamp and bails out.
        await tx.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...md,
              pendingAdditionalItems: {
                reserving: true,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });
        return md;
      });
    } catch (lockErr) {
      if (lockErr instanceof Error && lockErr.message === "ADD_ITEMS_IN_PROGRESS") {
        return NextResponse.json(
          { error: "Another add-items request is already in progress. Please wait a moment and try again." },
          { status: 409 }
        );
      }
      throw lockErr;
    }

    // DivinityCoin: create payment intent via DC's API, then store pending items
    if (paymentProcessor === "DIVINITYCOIN") {
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
            amount: Math.round(amount * 100), // cents
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
          pledgesAddItemsLogger.error({ err: String(dcResult) }, "[AddItems DC] Failed to create payment intent:");
          return NextResponse.json(
            { error: dcResult.error || "Failed to initialize payment" },
            { status: 502 }
          );
        }

        // Store pending additional items in pledge metadata. Use the
        // currentMetadata captured under the row lock above (reserving marker
        // already stamped) so no concurrent request can race us here.
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...currentMetadata,
              pendingAdditionalItems: {
                paymentMethod: paymentProcessor,
                paymentIntentId: dcResult.paymentIntentId,
                addons: addonsWithQuantity,
                amount,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });

        pledgesAddItemsLogger.info(`[AddItems DC] Created payment intent for pledge ${pledgeId}: ${addonsWithQuantity.length} addons, $${amount}`);

        return NextResponse.json({
          paymentMethod: paymentProcessor,
          type: "payment_intent",
          clientSecret: dcResult.clientSecret,
          publishableKey: dcResult.publishableKey,
          pledgeId: pledge.id,
        });
      } catch (dcError) {
        const message = dcError instanceof Error ? dcError.message : "Unknown error";
        pledgesAddItemsLogger.error({ err: `${message}: ${dcError}` }, "[AddItems DC] API error:");
        return NextResponse.json(
          { error: `Failed to connect to payment processor: ${message}` },
          { status: 500 }
        );
      }
    }

    // PaymentCloud (NMI): KIA pledges have no vault entry, so we
    // re-prompt for a card via Collect.js and run a fresh
    // saleByPaymentToken when the client comes back to confirm-add-items
    // with the payment_token. Stash the pending items here.
    if (paymentProcessor === "NMI") {
      const nmiConfig = await loadNmiConfig();
      if (!nmiConfig) {
        return NextResponse.json({ error: "Mentom Payments not configured" }, { status: 502 });
      }

      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          metadata: {
            ...currentMetadata,
            pendingAdditionalItems: {
              paymentMethod: "NMI",
              addons: addonsWithQuantity,
              amount,
              createdAt: new Date().toISOString(),
            },
          },
        },
      });

      pledgesAddItemsLogger.info(`[AddItems NMI] Stashed pending items for pledge ${pledgeId}: ${addonsWithQuantity.length} addons, $${amount}`);

      return NextResponse.json({
        paymentMethod: "NMI",
        type: "nmi_collectjs",
        nmiPublicKey: nmiConfig.publicKey,
        pledgeId: pledge.id,
        amount,
      });
    }

    // Stripe: Create PaymentIntent for immediate charge
    const stripe = await getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment system unavailable" },
        { status: 500 }
      );
    }

    // Create the payment intent
    const amountInCents = Math.round(amount * 100);

    const paymentIntentParams: {
      amount: number;
      currency: string;
      automatic_payment_methods: { enabled: boolean };
      metadata: {
        pledgeId: string;
        userId: string;
        projectId: string;
        type: string;
        addons: string;
      };
      application_fee_amount?: number;
      transfer_data?: { destination: string };
    } = {
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        pledgeId: pledge.id,
        userId: session.user.id,
        projectId: pledge.projectId,
        type: "additional_items",
        addons: JSON.stringify(addonsWithQuantity),
      },
    };

    // Get the creator's Stripe account ID (prefer from stripeConfig, fallback to project field)
    const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

    // If creator has Stripe Connect, send funds directly to them
    if (stripeAccountId) {
      const addItemsPlatformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
      const feePercent = addItemsPlatformSettings?.platformFee ? Number(addItemsPlatformSettings.platformFee) / 100 : 0.03;
      const applicationFee = Math.round(amount * 100 * feePercent);
      paymentIntentParams.application_fee_amount = applicationFee;
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    } catch (stripeError: unknown) {
      const message = stripeError instanceof Error ? stripeError.message : "Unknown Stripe error";
      pledgesAddItemsLogger.error({ err: String(message) }, `[AddItems] Stripe PaymentIntent creation failed for pledge ${pledgeId}:`);
      return NextResponse.json(
        { error: `Payment creation failed: ${message}` },
        { status: 502 }
      );
    }

    // Store pending items in metadata for Stripe too (webhook uses PaymentIntent metadata).
    // Reuses the currentMetadata captured under the FOR UPDATE lock above so
    // we don't re-race with concurrent add-items calls here.
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        metadata: {
          ...currentMetadata,
          pendingAdditionalItems: {
            paymentMethod: "STRIPE",
            paymentIntentId: paymentIntent.id,
            addons: addonsWithQuantity,
            amount,
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      paymentMethod: "STRIPE",
      clientSecret: paymentIntent.client_secret,
      type: "payment_intent",
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    pledgesAddItemsLogger.error({ err: `${message}: ${error}` }, "Error adding items to pledge:");
    return NextResponse.json(
      { error: `Failed to add items to pledge: ${message}` },
      { status: 500 }
    );
  }
}
