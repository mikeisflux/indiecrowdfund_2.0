import { db } from "@/lib/db";
import { getStripeInstance } from "./config";
import { getOrCreateStripeCustomer } from "./customers";
import { safeCancelSetupIntent, safeCancelPaymentIntent } from "./intents";

interface AddonWithQuantity {
  id: string;
  quantity: number;
}

interface CreatePaymentParams {
  projectId: string;
  rewardId: string | null | undefined; // Optional for "pledge without reward"
  addons: AddonWithQuantity[]; // Addons with quantities
  amount: number;
  userId: string;
  sourceCampaignId?: string; // Campaign that led to this pledge (for conversion tracking)
  shippingAmount?: number; // Shipping cost
  shippingCountry?: string; // Country code for shipping
  // Default shipping address resolved by /api/pledges from the user's
  // saved profile address. Attached to the Pledge row for fulfillment.
  shippingAddress?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
}

/**
 * Main payment creation function
 * - If campaign is NOT funded: Creates SetupIntent to save card (charge later when funded)
 * - If campaign IS funded: Creates PaymentIntent with immediate capture
 */
export async function createStripePayment({
  projectId,
  rewardId,
  addons,
  amount,
  userId,
  sourceCampaignId,
  shippingAmount = 0,
  shippingAddress,
}: CreatePaymentParams) {
  const stripeClient = await getStripeInstance();

  // Get project and creator's Stripe account
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
    include: {
      creator: {
        include: {
          stripeConfig: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.creator.stripeConfig?.stripeAccountId) {
    throw new Error("Creator has not connected Stripe");
  }

  // Get user email for Stripe customer
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // Check if campaign is already funded
  const isCampaignFunded = Number(project.currentAmount) >= Number(project.goalAmount);

  // Read platform fee from settings (consistent with charges.ts deferred-charge path)
  const platformSettings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { platformFee: true },
  }).catch(() => null);
  const platformFeeRate = platformSettings?.platformFee
    ? Number(platformSettings.platformFee) / 100
    : 0.03; // default 3%

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    stripeClient,
    userId,
    user?.email || ""
  );

  // Check for ANY existing pledge for this user/project to prevent duplicates
  // Users can only have ONE pledge per project (they can edit it, but not create multiple)
  const normalizedRewardId = rewardId && rewardId !== "no-reward" ? rewardId : null;

  // Calculate reward and addon amounts BEFORE checking for existing pledges
  // This ensures we have correct values for both updating existing pledges and creating new ones
  let rewardAmount = 0;
  if (normalizedRewardId) {
    const reward = await db.reward.findUnique({
      where: { id: normalizedRewardId },
      select: { amount: true },
    });
    rewardAmount = reward ? Number(reward.amount) : 0;
  }

  // Calculate addons amount
  let addonsAmount = 0;
  let addonPriceMap = new Map<string, number>();
  if (addons.length > 0) {
    const addonIds = addons.map(a => a.id);
    const addonRecords = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
      },
      select: { id: true, amount: true },
    });
    addonPriceMap = new Map(addonRecords.map(a => [a.id, Number(a.amount)]));
    addonsAmount = addons.reduce((sum, addon) => {
      return sum + (addonPriceMap.get(addon.id) || 0) * addon.quantity;
    }, 0);
  }

  // First check for completed pledges - these always block new pledges
  const existingCompletedPledge = await db.pledge.findFirst({
    where: {
      userId,
      deletedAt: null,
      projectId,
      status: "COMPLETED",
    },
  });

  if (existingCompletedPledge) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Check for pending pledges with saved payment method - these also block new pledges.
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use `NOT: { field: null }` wrapper syntax instead.
  const existingActivePendingPledge = await db.pledge.findFirst({
    where: {
      userId,
      deletedAt: null,
      projectId,
      status: "PENDING",
      NOT: { stripePaymentMethodId: null },
    },
  });

  if (existingActivePendingPledge) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Check for any recent pending pledge with an active intent (checkout in progress)
  // This prevents race conditions where user clicks "Back" twice before first completes
  const existingCheckoutInProgress = await db.pledge.findFirst({
    where: {
      userId,
      deletedAt: null,
      projectId,
      status: "PENDING",
      stripePaymentMethodId: null,
      // Has an intent (checkout was started)
      OR: [
        { NOT: { stripeSetupIntentId: null } },
        { NOT: { stripePaymentIntentId: null } },
      ],
      // Created within last 30 minutes (active checkout session)
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // If there's an active checkout, try to reuse it
  if (existingCheckoutInProgress) {
    // Retrieve the existing intent to check if it's still usable
    if (!isCampaignFunded && existingCheckoutInProgress.stripeSetupIntentId) {
      try {
        const setupIntent = await stripeClient.setupIntents.retrieve(existingCheckoutInProgress.stripeSetupIntentId);
        if (setupIntent.status === "requires_payment_method" || setupIntent.status === "requires_confirmation") {
          // Update the pledge with new values if anything changed
          const needsUpdate =
            Number(existingCheckoutInProgress.amount) !== amount ||
            existingCheckoutInProgress.rewardId !== normalizedRewardId ||
            Number(existingCheckoutInProgress.addonsAmount) !== addonsAmount ||
            Number(existingCheckoutInProgress.shippingAmount) !== shippingAmount;

          if (needsUpdate) {
            // Update pledge with correct values
            await db.pledge.update({
              where: { id: existingCheckoutInProgress.id },
              data: {
                amount,
                rewardAmount,
                addonsAmount,
                shippingAmount,
                rewardId: normalizedRewardId,
              },
            });

            // Update addon records: delete old ones and create new ones
            await db.pledgeAddon.deleteMany({
              where: { pledgeId: existingCheckoutInProgress.id },
            });

            if (addons.length > 0) {
              await db.pledgeAddon.createMany({
                data: addons.map((addon) => ({
                  pledgeId: existingCheckoutInProgress.id,
                  addonId: addon.id,
                  quantity: addon.quantity,
                  amount: (addonPriceMap.get(addon.id) || 0) * addon.quantity,
                })),
              });
            }
          }
          return {
            type: "setup_intent" as const,
            clientSecret: setupIntent.client_secret,
            pledgeId: existingCheckoutInProgress.id,
            chargedImmediately: false,
          };
        }
        // If setupIntent succeeded, payment method should be saved soon
        // Block creating new pledge to avoid race condition
        if (setupIntent.status === "succeeded") {
          throw new Error("Your pledge is being processed. Please wait a moment and check your backer dashboard.");
        }
      } catch (e) {
        // If intent retrieval fails or is in terminal state, we can create a new pledge
        if (e instanceof Error && e.message.includes("pledge is being processed")) {
          throw e;
        }
        // Intent was canceled or invalid, continue to create new pledge
      }
    } else if (isCampaignFunded && existingCheckoutInProgress.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripeClient.paymentIntents.retrieve(existingCheckoutInProgress.stripePaymentIntentId);
        if (paymentIntent.status === "requires_payment_method" || paymentIntent.status === "requires_confirmation") {
          // Update the pledge with new values if anything changed
          const needsUpdate =
            Number(existingCheckoutInProgress.amount) !== amount ||
            existingCheckoutInProgress.rewardId !== normalizedRewardId ||
            Number(existingCheckoutInProgress.addonsAmount) !== addonsAmount ||
            Number(existingCheckoutInProgress.shippingAmount) !== shippingAmount;

          if (needsUpdate) {
            // Update pledge with correct values
            await db.pledge.update({
              where: { id: existingCheckoutInProgress.id },
              data: {
                amount,
                rewardAmount,
                addonsAmount,
                shippingAmount,
                rewardId: normalizedRewardId,
              },
            });

            // Update addon records: delete old ones and create new ones
            await db.pledgeAddon.deleteMany({
              where: { pledgeId: existingCheckoutInProgress.id },
            });

            if (addons.length > 0) {
              await db.pledgeAddon.createMany({
                data: addons.map((addon) => ({
                  pledgeId: existingCheckoutInProgress.id,
                  addonId: addon.id,
                  quantity: addon.quantity,
                  amount: (addonPriceMap.get(addon.id) || 0) * addon.quantity,
                })),
              });
            }
          }
          return {
            type: "payment_intent" as const,
            clientSecret: paymentIntent.client_secret,
            pledgeId: existingCheckoutInProgress.id,
            chargedImmediately: true,
          };
        }
        // If paymentIntent is processing or succeeded, block new pledge
        if (paymentIntent.status === "processing" || paymentIntent.status === "succeeded") {
          throw new Error("Your pledge is being processed. Please wait a moment and check your backer dashboard.");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("pledge is being processed")) {
          throw e;
        }
        // Intent was canceled or invalid, continue to create new pledge
      }
    }
  }

  // Check for old stale pending pledges (older than 30 min) to clean up
  // These can be reused if they still have valid intents
  const stalePendingPledge = await db.pledge.findFirst({
    where: {
      userId,
      deletedAt: null,
      projectId,
      status: "PENDING",
      stripePaymentMethodId: null,
      createdAt: {
        lt: new Date(Date.now() - 30 * 60 * 1000),
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // If there's a stale pending pledge, cancel its old intent and mark it cancelled
  if (stalePendingPledge) {
    if (stalePendingPledge.stripeSetupIntentId) {
      await safeCancelSetupIntent(stripeClient, stalePendingPledge.stripeSetupIntentId);
    }
    if (stalePendingPledge.stripePaymentIntentId) {
      await safeCancelPaymentIntent(stripeClient, stalePendingPledge.stripePaymentIntentId);
    }
    await db.pledge.update({
      where: { id: stalePendingPledge.id },
      data: { status: "CANCELLED", lastFailureReason: "Checkout abandoned, new pledge created" },
    });
  }

  // Create new pending pledge (no valid existing pledge found)
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId: normalizedRewardId,
      amount,
      rewardAmount,
      addonsAmount,
      shippingAmount,
      paymentProcessor: "STRIPE",
      status: "PENDING",
      stripeCustomerId: customerId,
      chargedImmediately: isCampaignFunded,
      shippingAddress: shippingAddress
        ? (shippingAddress as unknown as Record<string, unknown>)
        : undefined,
      // Only include sourceCampaignId if it has a value (requires migration)
      ...(sourceCampaignId ? { sourceCampaignId } : {}),
    },
  });

  // Create addon records if any
  if (addons.length > 0) {
    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: addon.quantity,
        amount: (addonPriceMap.get(addon.id) || 0) * addon.quantity,
      })),
    });
  }

  const amountInCents = Math.round(amount * 100);
  const platformFee = Math.round(amount * platformFeeRate * 100);

  try {
  if (isCampaignFunded) {
    // Campaign already funded - charge immediately
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      customer: customerId,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: project.creator.stripeConfig.stripeAccountId,
      },
      metadata: {
        pledgeId: pledge.id,
        projectId,
        userId,
        chargeType: "immediate",
      },
      // Save the payment method for potential retries
      setup_future_usage: "off_session",
    });

    // Update pledge with payment intent ID
    await db.pledge.update({
      where: { id: pledge.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      type: "payment_intent" as const,
      clientSecret: paymentIntent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: true,
    };
  } else {
    // Campaign not yet funded - save card for later using SetupIntent
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        pledgeId: pledge.id,
        projectId,
        userId,
        amount: amountInCents.toString(),
        platformFee: platformFee.toString(),
        connectedAccountId: project.creator.stripeConfig.stripeAccountId,
      },
    });

    // Update pledge with setup intent ID
    await db.pledge.update({
      where: { id: pledge.id },
      data: { stripeSetupIntentId: setupIntent.id },
    });

    return {
      type: "setup_intent" as const,
      clientSecret: setupIntent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: false,
    };
  }
  } catch (stripeError) {
    // Clean up the created pledge so it doesn't accumulate as an orphaned PENDING record
    await db.pledge.update({
      where: { id: pledge.id },
      data: { status: "CANCELLED", lastFailureReason: "Stripe intent creation failed" },
    }).catch(() => {/* best-effort cleanup */});
    throw stripeError;
  }
}
