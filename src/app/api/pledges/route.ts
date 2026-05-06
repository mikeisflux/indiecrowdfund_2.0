import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createStripePayment, checkAndUpdateStripeOnboarding } from "@/lib/payments/stripe";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { createPayPalPayment } from "@/lib/payments/paypal";
import { createWhopPayment } from "@/lib/payments/whop";
import { isEmailVerificationRequired } from "@/lib/email";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { withCorrelation } from "@/lib/correlation";
import { metrics } from "@/lib/metrics";

const pledgeLogger = logger.child({ module: "pledges" });

// Cookie name for campaign attribution (must match click tracking)
const CAMPAIGN_COOKIE_NAME = "ec_source";

// Addon with quantity schema
const addonWithQuantitySchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
});

const createPledgeSchema = z.object({
  projectId: z.string(),
  rewardId: z.string().nullable().optional(), // Optional for "pledge without reward"
  // Support both array of IDs (legacy) and array of objects with quantities
  addonIds: z.array(z.string()).max(50).default([]),
  addons: z.array(addonWithQuantitySchema).max(50).optional(), // New format with quantities
  amount: z.number().positive(),
  shippingAmount: z.number().min(0).optional(), // Shipping cost
  shippingCountry: z.string().optional(), // Country code for shipping
  shippingAddress: z.object({
    name: z.string().max(100),
    address1: z.string().max(200),
    address2: z.string().max(200).optional(),
    city: z.string().max(100),
    state: z.string().max(100),
    zip: z.string().max(20),
    country: z.string().max(10),
    phone: z.string().max(30).optional(),
  }).optional(),
  // PaymentCloud-only: Collect.js payment_token from the browser. The
  // PAN never touches our server — we exchange the single-use token
  // for a stable Customer Vault id server-side, then either save it
  // for charge-on-success (AoN) or sell against it immediately (KIA).
  paymentToken: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
    const startTime = Date.now();
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if email verification is required before pledging
      const verificationRequired = await isEmailVerificationRequired();
      if (verificationRequired) {
        const user = await db.user.findFirst({
          where: { id: session.user.id, deletedAt: null },
          select: { emailVerified: true },
        });

        if (!user?.emailVerified) {
          return NextResponse.json(
            { error: "Please verify your email address before pledging. Check your inbox for a verification link." },
            { status: 403 }
          );
        }
      }

      const body = await req.json();
      const data = createPledgeSchema.parse(body);

      // Get project to determine payment processor
      const project = await db.project.findFirst({ where: { id: data.projectId, deletedAt: null },
        include: {
          creator: {
            include: {
              stripeConfig: true,
            },
          },
        },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (project.status !== "LIVE") {
        return NextResponse.json(
          { error: "Project is not accepting pledges" },
          { status: 400 }
        );
      }

      // Check if project has ended
      if (project.endDate && new Date(project.endDate) < new Date()) {
        return NextResponse.json(
          { error: "This campaign has ended and is no longer accepting pledges" },
          { status: 400 }
        );
      }

      // Validate reward exists and belongs to project (without quantity check - that happens atomically later)
      let reward = null;
      if (data.rewardId && data.rewardId !== "no-reward") {
        reward = await db.reward.findUnique({
          where: { id: data.rewardId, isEnded: false },
        });

        if (!reward || reward.projectId !== data.projectId) {
          return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
        }

        // Quick pre-check for sold out (actual atomic check happens during pledge creation)
        if (reward.quantityAvailable !== null &&
            reward.quantityClaimed >= reward.quantityAvailable) {
          return NextResponse.json({ error: "Reward sold out" }, { status: 400 });
        }
      }

      // Use the new addons format if provided, otherwise convert legacy addonIds
      const addonsWithQuantity = data.addons || data.addonIds.map(id => ({ id, quantity: 1 }));

      // Validate all addons belong to this project and are of type ADDON (prevents cross-project abuse)
      // Also pull shippingType for the address-required gate below.
      const addonShippingTypes: string[] = [];
      if (addonsWithQuantity.length > 0) {
        const addonIdList = addonsWithQuantity.map((a: { id: string }) => a.id);
        const addonRows = await db.reward.findMany({
          where: { id: { in: addonIdList }, projectId: data.projectId, type: "ADDON", isEnded: false },
          select: { id: true, shippingType: true },
        });
        if (addonRows.length !== addonIdList.length) {
          return NextResponse.json({ error: "One or more invalid addons" }, { status: 400 });
        }
        for (const row of addonRows) addonShippingTypes.push(row.shippingType);
      }

      // Address-required gate. If anything in this cart ships, the
      // backer must have a saved address. Shipping cost is calculated
      // against the saved profile address; the resulting Pledge row
      // also needs shippingAddress so confirm-nmi can run AVS for
      // PaymentCloud sales. We auto-attach the user's default address
      // to the pledge when they have one — clients don't need to
      // re-send it.
      const cartHasShipping =
        (reward && reward.shippingType !== "NO_SHIPPING") ||
        addonShippingTypes.some((t) => t !== "NO_SHIPPING");
      let resolvedShippingAddress: typeof data.shippingAddress = data.shippingAddress;
      if (cartHasShipping && !resolvedShippingAddress) {
        const savedAddr = await db.userAddress.findFirst({
          where: { userId: session.user.id },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });
        if (!savedAddr) {
          return NextResponse.json(
            {
              error:
                "Please add a shipping address to your profile before pledging. Go to Dashboard → Backer → Addresses.",
            },
            { status: 400 }
          );
        }
        resolvedShippingAddress = {
          name: savedAddr.fullName,
          address1: savedAddr.line1,
          address2: savedAddr.line2 ?? undefined,
          city: savedAddr.city,
          state: savedAddr.state,
          zip: savedAddr.postalCode,
          country: savedAddr.country,
          phone: savedAddr.phone ?? undefined,
        };
      }

      // Server-side amount validation: prevent underselling (user cannot submit less than reward+addon prices)
      {
        const rewardMin = reward ? Number(reward.amount) : 0;
        let addonsMin = 0;
        if (addonsWithQuantity.length > 0) {
          const addonIdList = addonsWithQuantity.map((a: { id: string }) => a.id);
          const addonPrices = await db.reward.findMany({
            where: { id: { in: addonIdList } },
            select: { id: true, amount: true },
          });
          const addonPriceMap = new Map(addonPrices.map(a => [a.id, Number(a.amount)]));
          addonsMin = addonsWithQuantity.reduce((sum: number, addon: { id: string; quantity: number }) => {
            return sum + (addonPriceMap.get(addon.id) || 0) * addon.quantity;
          }, 0);
        }
        const expectedMinimum = rewardMin + addonsMin;
        // Allow a 1-cent tolerance for floating-point rounding from client
        if (expectedMinimum > 0 && data.amount < expectedMinimum - 0.01) {
          return NextResponse.json(
            { error: `Pledge amount must be at least $${expectedMinimum.toFixed(2)}` },
            { status: 400 }
          );
        }
      }

      // Clean up stale abandoned carts for this project (older than 1 hour, no payment evidence)
      // This runs in the background and doesn't block pledge creation
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      cleanupAbandonedCarts(data.projectId, oneHourAgo).catch((err) => {
        pledgeLogger.warn({ err: err instanceof Error ? err.message : String(err) }, "Background abandoned cart cleanup failed");
      });

      // Check for campaign attribution cookie
      let sourceCampaignId: string | undefined;
      try {
        const cookieStore = await cookies();
        const attributionCookie = cookieStore.get(CAMPAIGN_COOKIE_NAME);
        if (attributionCookie?.value) {
          const attributionData = JSON.parse(
            Buffer.from(attributionCookie.value, "base64").toString("utf-8")
          );
          sourceCampaignId = attributionData.campaignId;
          pledgeLogger.info({ correlationId, campaignId: sourceCampaignId }, "Pledge attribution from campaign");
        }
      } catch (e) {
        // Cookie parsing failed, continue without attribution
        pledgeLogger.warn({ correlationId, err: e instanceof Error ? e.message : String(e) }, "Failed to parse campaign attribution cookie");
      }

      // Check payment processor and route accordingly
      if (project.paymentProcessor === "DIVINITYCOIN") {
        // Check for existing COMPLETED pledge (user already backed this project)
        const completedPledge = await db.pledge.findFirst({
          where: {
            userId: session.user.id,
            deletedAt: null,
            projectId: data.projectId,
            paymentProcessor: "DIVINITYCOIN",
            status: "COMPLETED",
          },
        });

        if (completedPledge) {
          return NextResponse.json(
            { error: "You have already backed this project" },
            { status: 400 }
          );
        }

        // Delete any existing PENDING pledges for this user/project
        const pendingPledges = await db.pledge.findMany({
          where: {
            userId: session.user.id,
            deletedAt: null,
            projectId: data.projectId,
            paymentProcessor: "DIVINITYCOIN",
            status: "PENDING",
          },
          select: { id: true },
        });

        if (pendingPledges.length > 0) {
          const pendingIds = pendingPledges.map(p => p.id);
          pledgeLogger.info({ correlationId, pendingIds }, "Cleaning up old PENDING DivinityCoin pledges");

          await db.pledgeAddon.deleteMany({
            where: { pledgeId: { in: pendingIds } },
          });

          await db.pledge.deleteMany({
            where: { id: { in: pendingIds } },
          });
        }

        // Calculate reward amount - ensure it's a valid number
        const rewardAmountValue = reward ? Number(reward.amount) : 0;
        const rewardAmount = isNaN(rewardAmountValue) ? 0 : rewardAmountValue;

        // Calculate addons amount
        const addonIds = addonsWithQuantity.map(a => a.id);
        const addonRecords = addonIds.length > 0 ? await db.reward.findMany({
          where: { id: { in: addonIds } },
          select: { id: true, amount: true },
        }) : [];
        const addonAmountMap = new Map(addonRecords.map(a => [a.id, Number(a.amount)]));
        const addonsAmountValue = addonsWithQuantity.reduce((sum, addon) => {
          return sum + (addonAmountMap.get(addon.id) || 0) * addon.quantity;
        }, 0);
        const addonsAmount = isNaN(addonsAmountValue) ? 0 : addonsAmountValue;

        const shippingAmount = data.shippingAmount || 0;

        pledgeLogger.info({
          correlationId,
          userId: session.user.id,
          projectId: data.projectId,
          rewardId: data.rewardId,
          amount: data.amount,
          rewardAmount,
          addonsAmount,
          shippingAmount,
          shippingCountry: data.shippingCountry,
        }, "Creating new DivinityCoin pledge");

        // AoN saved-card mode: when the campaign is All-or-Nothing AND
        // the goal hasn't been met yet, we save the card via DC's
        // /create-setup-intent and defer the actual charge to the
        // process-funded-campaigns cron. KIA campaigns and AoN campaigns
        // already at goal still charge immediately via /create-payment-intent.
        const isKeepItAll = project.campaignType === "KEEP_IT_ALL";
        const isAlreadyFunded = Number(project.currentAmount) >= Number(project.goalAmount);
        const useSavedCardFlow = !isKeepItAll && !isAlreadyFunded;

        const pledge = await db.pledge.create({
          data: {
            userId: session.user.id,
            projectId: data.projectId,
            rewardId: data.rewardId && data.rewardId !== "no-reward" ? data.rewardId : null,
            amount: data.amount,
            rewardAmount,
            addonsAmount,
            shippingAmount,
            status: "PENDING",
            paymentProcessor: "DIVINITYCOIN",
            // chargedImmediately reflects whether this pledge will charge
            // at confirm time (KIA / already-funded AoN) or wait for the
            // success cron (AoN saved-card flow).
            chargedImmediately: !useSavedCardFlow,
            shippingAddress: resolvedShippingAddress
              ? (resolvedShippingAddress as unknown as Record<string, unknown>)
              : undefined,
            ...(sourceCampaignId ? { sourceCampaignId } : {}),
          },
        });

        if (addonsWithQuantity.length > 0) {
          await db.pledgeAddon.createMany({
            data: addonsWithQuantity.map(addon => ({
              pledgeId: pledge.id,
              addonId: addon.id,
              quantity: addon.quantity,
              amount: (addonAmountMap.get(addon.id) || 0) * addon.quantity,
            })),
          });
        }

        try {
          const dcConfig = await getDivinityCoinConfig();
          const userRecord = await db.user.findFirst({
            where: { id: session.user.id, deletedAt: null },
            select: { email: true, name: true },
          });

          const dcAbortController = new AbortController();
          const dcTimeout = setTimeout(() => dcAbortController.abort(), 15000); // 15s timeout
          // Branch the DC API call: SetupIntent for AoN-unfunded, regular
          // PaymentIntent for KIA / already-funded AoN.
          const action = useSavedCardFlow ? "create-setup-intent" : "create-payment-intent";
          const reqBody: Record<string, unknown> = useSavedCardFlow
            ? {
                platformUserId: session.user.id,
                email: userRecord?.email || "",
                name: userRecord?.name || "",
              }
            : {
                amount: Math.round(data.amount * 100),
                currency: "usd",
                platformUserId: session.user.id,
                email: userRecord?.email || "",
                name: userRecord?.name || "",
                pledgeId: pledge.id,
                projectId: data.projectId,
              };
          let dcResponse: Response;
          try {
            dcResponse = await fetch(`${dcConfig.baseUrl}?action=${action}`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${dcConfig.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(reqBody),
              signal: dcAbortController.signal,
            });
          } finally {
            clearTimeout(dcTimeout);
          }

          const dcResult = await dcResponse.json();
          if (!dcResponse.ok || !dcResult.success) {
            pledgeLogger.error({ correlationId, pledgeId: pledge.id, dcResult }, "Failed to create DivinityCoin intent");
            await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
            await db.pledge.deleteMany({ where: { id: pledge.id } });
            return NextResponse.json(
              { error: dcResult.error || "Failed to initialize payment" },
              { status: 502 }
            );
          }

          if (useSavedCardFlow) {
            // Save the SetupIntent id on the pledge. The pm_... id will
            // be persisted by /api/pledges/[id]/confirm-dc-setup once the
            // browser finishes Stripe Elements confirmation.
            await db.pledge.update({
              where: { id: pledge.id },
              data: { divinityCoinSetupIntentId: dcResult.setupIntentId },
            });
            metrics.pledgesCreated.inc({ status: "pending", processor: "divinitycoin" });
            return NextResponse.json({
              paymentMethod: "DIVINITYCOIN",
              type: "setup_intent",
              clientSecret: dcResult.clientSecret,
              publishableKey: dcResult.publishableKey,
              setupIntentId: dcResult.setupIntentId,
              pledgeId: pledge.id,
              chargedImmediately: false,
            });
          }

          await db.pledge.update({
            where: { id: pledge.id },
            data: { divinityCoinPaymentId: dcResult.paymentIntentId },
          });

          metrics.pledgesCreated.inc({ status: "pending", processor: "divinitycoin" });
          return NextResponse.json({
            paymentMethod: "DIVINITYCOIN",
            type: "payment_intent",
            clientSecret: dcResult.clientSecret,
            publishableKey: dcResult.publishableKey,
            pledgeId: pledge.id,
            chargedImmediately: true,
          });
        } catch (dcError) {
          const isTimeout = dcError instanceof Error && dcError.name === "AbortError";
          pledgeLogger.error({ correlationId, pledgeId: pledge.id, err: dcError instanceof Error ? dcError.message : String(dcError), isTimeout }, "DivinityCoin API error");
          await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
          await db.pledge.deleteMany({ where: { id: pledge.id } });
          const errMsg = isTimeout
            ? "Payment processor timed out. Please try again."
            : dcError instanceof Error && dcError.message.includes("not configured")
            ? "Payment processor not configured. Please contact support."
            : "Failed to connect to payment processor. Please try again.";
          return NextResponse.json({ error: errMsg }, { status: 502 });
        }
      }

      // PayPal payment processor
      if (project.paymentProcessor === "PAYPAL") {
        try {
          const result = await createPayPalPayment({
            projectId: data.projectId,
            rewardId: data.rewardId,
            addons: addonsWithQuantity,
            amount: data.amount,
            userId: session.user.id,
            sourceCampaignId,
            shippingAmount: data.shippingAmount || 0,
            shippingAddress: resolvedShippingAddress,
          });

          metrics.pledgesCreated.inc({ status: "pending", processor: "paypal" });
          return NextResponse.json({
            paymentMethod: "PAYPAL",
            type: "paypal_order",
            paypalOrderId: result.paypalOrderId,
            pledgeId: result.pledgeId,
            chargedImmediately: true,
          });
        } catch (paypalError) {
          pledgeLogger.error({ correlationId, err: paypalError instanceof Error ? paypalError.message : String(paypalError) }, "PayPal payment creation error");
          return NextResponse.json(
            { error: paypalError instanceof Error ? paypalError.message : "Failed to initialize PayPal payment" },
            { status: 502 }
          );
        }
      }

      // PaymentCloud (NMI white-label) payment processor.
      //
      // Two-phase to match the other processors:
      //   1. Here: create the PENDING pledge row, return the public
      //      tokenization key + pledgeId so the browser can load
      //      Collect.js and tokenize the card.
      //   2. POST /api/pledges/[pledgeId]/confirm-nmi: client posts the
      //      payment_token from Collect.js → server adds to Customer
      //      Vault, optionally charges (KIA), updates pledge.
      // No card data ever touches our server — the PAN goes straight
      // from Collect.js into PaymentCloud's vault.
      //
      // Concurrency: the read-modify-write below is wrapped in a Postgres
      // transaction with a (userId, projectId)-keyed advisory lock so
      // concurrent "Back this project" double-clicks serialize and
      // produce exactly one PENDING pledge. External calls (NMI vault
      // cleanup) happen AFTER commit so we don't hold the lock across
      // a network round-trip.
      if (project.paymentProcessor === "NMI") {
        // Load NMI config OUTSIDE the lock — it only reads
        // platformSettings and doesn't need transactional consistency
        // with the pledge create. Fail fast if not configured.
        const { loadNmiConfig, deleteVaultCustomer } = await import("@/lib/nmi");
        const nmiConfig = await loadNmiConfig();
        if (!nmiConfig?.publicKey) {
          pledgeLogger.error(
            { correlationId, projectId: data.projectId },
            "PaymentCloud not configured (no public key) but project is NMI"
          );
          return NextResponse.json(
            { error: "Payment processor not configured. Please contact support." },
            { status: 502 }
          );
        }

        // Pre-compute reward + addon amounts (read-only, no races).
        const rewardAmountValue = reward ? Number(reward.amount) : 0;
        const rewardAmount = isNaN(rewardAmountValue) ? 0 : rewardAmountValue;
        const addonIds = addonsWithQuantity.map((a) => a.id);
        const addonRecords = addonIds.length > 0
          ? await db.reward.findMany({
              where: { id: { in: addonIds } },
              select: { id: true, amount: true },
            })
          : [];
        const addonAmountMap = new Map(addonRecords.map((a) => [a.id, Number(a.amount)]));
        const addonsAmountValue = addonsWithQuantity.reduce(
          (sum, a) => sum + (addonAmountMap.get(a.id) || 0) * a.quantity,
          0
        );
        const addonsAmount = isNaN(addonsAmountValue) ? 0 : addonsAmountValue;
        const shippingAmount = data.shippingAmount || 0;

        // Sentinel error type so the transaction can short-circuit with
        // a typed message that we surface to the client. Throwing any
        // other error type rolls the transaction back as a 500.
        type NmiCreateOutcome =
          | { kind: "completed_already" }
          | {
              kind: "ok";
              pledgeId: string;
              orphanedVaultIds: string[];
            };

        let outcome: NmiCreateOutcome;
        try {
          outcome = await db.$transaction<NmiCreateOutcome>(async (tx) => {
            // Serialize concurrent NMI pledge creates from the same
            // (userId, projectId). Lock is auto-released on commit/rollback.
            const lockKey = `nmi-pledge-${session.user.id}-${data.projectId}`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

            const completed = await tx.pledge.findFirst({
              where: {
                userId: session.user.id,
                deletedAt: null,
                projectId: data.projectId,
                paymentProcessor: "NMI",
                status: "COMPLETED",
              },
              select: { id: true },
            });
            if (completed) return { kind: "completed_already" };

            // Atomically delete any PENDING rows for this user/project
            // and capture their vault ids for cleanup-after-commit.
            const pendingRows = await tx.pledge.findMany({
              where: {
                userId: session.user.id,
                deletedAt: null,
                projectId: data.projectId,
                paymentProcessor: "NMI",
                status: "PENDING",
              },
              select: { id: true, nmiCustomerVaultId: true },
            });
            const orphanedVaultIds = pendingRows
              .map((p) => p.nmiCustomerVaultId)
              .filter((v): v is string => !!v);
            if (pendingRows.length > 0) {
              const pendingIds = pendingRows.map((p) => p.id);
              await tx.pledgeAddon.deleteMany({ where: { pledgeId: { in: pendingIds } } });
              await tx.pledge.deleteMany({ where: { id: { in: pendingIds } } });
            }

            const created = await tx.pledge.create({
              data: {
                userId: session.user.id,
                projectId: data.projectId,
                rewardId: data.rewardId && data.rewardId !== "no-reward" ? data.rewardId : null,
                amount: data.amount,
                rewardAmount,
                addonsAmount,
                shippingAmount,
                status: "PENDING",
                paymentProcessor: "NMI",
                chargedImmediately: false,
                shippingAddress: resolvedShippingAddress
                  ? (resolvedShippingAddress as unknown as Record<string, unknown>)
                  : undefined,
                ...(sourceCampaignId ? { sourceCampaignId } : {}),
              },
              select: { id: true },
            });

            if (addonsWithQuantity.length > 0) {
              await tx.pledgeAddon.createMany({
                data: addonsWithQuantity.map((a) => ({
                  pledgeId: created.id,
                  addonId: a.id,
                  quantity: a.quantity,
                  amount: (addonAmountMap.get(a.id) || 0) * a.quantity,
                })),
              });
            }

            return { kind: "ok", pledgeId: created.id, orphanedVaultIds };
          });
        } catch (err) {
          pledgeLogger.error(
            { correlationId, err: err instanceof Error ? err.message : String(err) },
            "NMI pledge create transaction error"
          );
          return NextResponse.json(
            { error: "Failed to create pledge. Please try again." },
            { status: 500 }
          );
        }

        if (outcome.kind === "completed_already") {
          return NextResponse.json(
            { error: "You have already backed this project" },
            { status: 400 }
          );
        }

        // Fire-and-forget vault cleanup for any orphaned PENDING vault
        // entries we just deleted. Failures here only leak entries
        // inside PaymentCloud's vault — no creator/backer impact.
        if (outcome.orphanedVaultIds.length > 0) {
          pledgeLogger.info(
            { correlationId, orphanedVaultIds: outcome.orphanedVaultIds },
            "Cleaning up orphaned PENDING NMI vault entries"
          );
          void Promise.allSettled(
            outcome.orphanedVaultIds.map((id) =>
              deleteVaultCustomer(nmiConfig, id).catch(() => null)
            )
          );
        }

        metrics.pledgesCreated.inc({ status: "pending", processor: "nmi" });
        return NextResponse.json({
          paymentMethod: "NMI",
          type: "nmi_tokenize",
          pledgeId: outcome.pledgeId,
          publicKey: nmiConfig.publicKey,
          isKeepItAll: project.campaignType === "KEEP_IT_ALL",
          chargedImmediately: false,
        });
      }

      // Whop payment processor
      if (project.paymentProcessor === "WHOP") {
        try {
          const result = await createWhopPayment({
            projectId: data.projectId,
            rewardId: data.rewardId,
            addons: addonsWithQuantity,
            amount: data.amount,
            userId: session.user.id,
            sourceCampaignId,
            shippingAmount: data.shippingAmount || 0,
            shippingAddress: resolvedShippingAddress,
          });

          metrics.pledgesCreated.inc({ status: "pending", processor: "whop" });
          return NextResponse.json({
            paymentMethod: "WHOP",
            type: "whop_checkout",
            whopSessionId: result.sessionId,
            pledgeId: result.pledgeId,
            chargedImmediately: true,
          });
        } catch (whopError) {
          pledgeLogger.error({ correlationId, err: whopError instanceof Error ? whopError.message : String(whopError) }, "Whop payment creation error");
          return NextResponse.json(
            { error: whopError instanceof Error ? whopError.message : "Failed to initialize Whop payment" },
            { status: 502 }
          );
        }
      }

      // For Stripe projects, verify creator has Stripe configured
      const stripeConfig = project.creator.stripeConfig;
      if (!stripeConfig?.stripeAccountId) {
        return NextResponse.json(
          { error: "Creator payment not configured" },
          { status: 400 }
        );
      }

      // Check onboarding status - query Stripe directly if DB shows not onboarded (webhook might be delayed)
      const isOnboarded = await checkAndUpdateStripeOnboarding(
        stripeConfig.id,
        stripeConfig.stripeAccountId,
        stripeConfig.isOnboarded
      );

      if (!isOnboarded) {
        return NextResponse.json(
          { error: "Creator payment not fully configured" },
          { status: 400 }
        );
      }

      const result = await createStripePayment({
        projectId: data.projectId,
        rewardId: data.rewardId,
        addons: addonsWithQuantity,
        amount: data.amount,
        userId: session.user.id,
        sourceCampaignId,
        shippingAmount: data.shippingAmount || 0,
        shippingCountry: data.shippingCountry,
        shippingAddress: resolvedShippingAddress,
      });

      const durationSec = (Date.now() - startTime) / 1000;
      metrics.pledgesCreated.inc({ status: "pending", processor: "stripe" });
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/pledges", status: "200" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/pledges" }, durationSec);

      return NextResponse.json({
        paymentMethod: "STRIPE",
        type: result.type,
        clientSecret: result.clientSecret,
        pledgeId: result.pledgeId,
        chargedImmediately: result.chargedImmediately,
      });
    } catch (error) {
      const durationSec = (Date.now() - startTime) / 1000;
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/pledges", status: "500" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/pledges" }, durationSec);
      pledgeLogger.error({ correlationId, err: error instanceof Error ? error.message : String(error) }, "Create pledge error");
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Failed to create pledge" },
        { status: 500 }
      );
    }
  });
}

export async function GET(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get("projectId");

      const where = projectId
        ? { userId: session.user.id, projectId, deletedAt: null }
        : { userId: session.user.id, deletedAt: null };

      const pledges = await db.pledge.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
              status: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Convert Decimal fields to numbers for JSON serialization
      const serializedPledges = pledges.map(pledge => ({
        ...pledge,
        amount: Number(pledge.amount),
        reward: pledge.reward ? {
          ...pledge.reward,
          amount: Number(pledge.reward.amount),
        } : null,
      }));

      return NextResponse.json({ pledges: serializedPledges });
    } catch (error) {
      pledgeLogger.error({ correlationId, err: error instanceof Error ? error.message : String(error) }, "Get pledges error");
      return NextResponse.json(
        { error: "Failed to fetch pledges" },
        { status: 500 }
      );
    }
  });
}

/**
 * Permanently delete stale abandoned cart pledges for a project.
 * Only deletes PENDING pledges older than the cutoff that have no payment evidence.
 */
async function cleanupAbandonedCarts(projectId: string, olderThan: Date) {
  const staleWhere = {
    projectId,
    status: "PENDING" as const,
    deletedAt: null,
    createdAt: { lt: olderThan },
    stripePaymentMethodId: null,
    confirmationEmailSent: false,
    // Exclude PayPal pledges that have been approved but not yet captured
    paypalOrderId: null,
    // Exclude DivinityCoin pledges that have a payment ID (payment was initiated, webhook may be in flight)
    divinityCoinPaymentId: null,
  };

  const stalePledges = await db.pledge.findMany({
    where: staleWhere,
    select: { id: true },
  });

  if (stalePledges.length === 0) return;

  const ids = stalePledges.map((p) => p.id);

  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: { pledgeId: { in: ids }, type: "PAYMENT" },
    select: { pledgeId: true },
  });
  const dcPaidIds = new Set(dcTransactions.map((t: { pledgeId: string | null }) => t.pledgeId).filter((id: string | null): id is string => id !== null));
  const toDelete = ids.filter((id) => !dcPaidIds.has(id));

  if (toDelete.length === 0) return;

  await db.pledgeAddon.deleteMany({ where: { pledgeId: { in: toDelete } } });
  await db.emailLog.deleteMany({ where: { pledgeId: { in: toDelete } } });
  // TOCTOU guard: re-apply the full stale filter so a pledge that completed
  // checkout between the findMany and here (e.g. user returned seconds before
  // this ran) is NOT wrongly deleted. Combining `id IN (...)` with the filter
  // ensures only pledges still matching the stale criteria get removed.
  await db.pledge.deleteMany({
    where: {
      ...staleWhere,
      id: { in: toDelete },
    },
  });

  pledgeLogger.info({ projectId, count: toDelete.length }, "Auto-cleaned abandoned carts");
}
