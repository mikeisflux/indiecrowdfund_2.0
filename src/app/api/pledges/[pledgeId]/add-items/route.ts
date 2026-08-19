import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesAddItemsLogger = logger.child({ module: "pledges-add-items" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDivinityCoinConfig, chargeDcSavedPaymentMethod, formatDeclineReason } from "@/lib/payments/divinitycoin";
import { createWhopUpcharge } from "@/lib/payments/whop/upcharge";
import { createPayPalUpcharge } from "@/lib/payments/paypal/upcharge";

export const dynamic = "force-dynamic";

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

    // An empty add-on list with a positive amount is a bare top-up: the
    // backer just wants to give more, without picking anything. That used to
    // be rejected here, which left "Add Additional Support" with nowhere to
    // go — the pledge PATCH refused charged pledges and sent people to
    // "Change Reward or Add-ons", which in turn insists on choosing a reward
    // or add-on. Backers who only wanted to add money hit a loop.
    const isDonationTopUp = addonsWithQuantity.length === 0;

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
        reward: { select: { shippingType: true } },
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

    // Order lock freeze: a locked order is final and can't take new items.
    if (pledge.orderLockStatus === "LOCKED") {
      return NextResponse.json(
        { error: "Your order is locked and can no longer be changed." },
        { status: 403 }
      );
    }

    // Verify pledge is completed
    if (pledge.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only add items to completed pledges" },
        { status: 400 }
      );
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

    // Digital-reward gate: if this pledge's main reward is digital
    // (shippingType NO_SHIPPING), only digital add-ons may be added. A
    // physical reward can take any add-on. Enforced here too so the rule
    // can't be bypassed by posting directly to this endpoint.
    if (
      pledge.reward?.shippingType === "NO_SHIPPING" &&
      validAddons.some((a) => a.shippingType !== "NO_SHIPPING")
    ) {
      return NextResponse.json(
        { error: "Physical add-ons can't be added to a digital reward. Only digital add-ons are available for this pledge." },
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
    // The $500 ceiling exists to stop an overcharge slipping past the addon
    // total via the shipping allowance. It doesn't apply to a bare top-up,
    // where the whole amount IS the intended contribution.
    if (!isDonationTopUp && amount > calculatedAmount + 500) {
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

    // DivinityCoin add-items: prefer the off-session saved-card path
    // when a pm_... is on file (AoN saved-card flow). The cardholder
    // isn't actively at checkout for an upcharge, so we charge directly
    // via DC's /charge-saved-payment-method and skip the client-side
    // confirm step entirely. Falls through to create-payment-intent
    // when there's no saved card (legacy DC pledges that charged
    // immediately, KIA pledges, or backers who paid before the saved-
    // card flow shipped).
    if (paymentProcessor === "DIVINITYCOIN" && pledge.divinityCoinPaymentMethodId) {
      // A fresh idempotency key per upcharge, so this charge doesn't dedupe
      // against the pledge's original one. It goes in `idempotencyKey`, NOT
      // in `pledgeId`: this used to send `${pledge.id}-addon-${timestamp}` as
      // the pledgeId, and DC persists that value and echoes it back in
      // payment.* webhooks — so every upcharge webhook arrived naming a
      // pledge that doesn't exist, and reconciliation had nothing to match on
      // at either end. The double-charge guard for this path is the
      // pendingAdditionalItems row lock taken above, not the key.
      const upchargeIdempotencyKey = `addon-${Date.now()}`;
      try {
        const charge = await chargeDcSavedPaymentMethod({
          platformUserId: session.user.id,
          paymentMethodId: pledge.divinityCoinPaymentMethodId,
          amount: Math.round(amount * 100),
          currency: "usd",
          pledgeId: pledge.id,
          idempotencyKey: upchargeIdempotencyKey,
          projectId: pledge.projectId,
          description: "Add-on items for existing pledge",
        });

        if (!charge.success || charge.status !== "succeeded" || !charge.paymentIntentId) {
          // Roll back the pendingAdditionalItems reservation we stamped
          // under the row lock above so the next attempt isn't blocked.
          await db.pledge.update({
            where: { id: pledgeId },
            data: { metadata: { ...currentMetadata } },
          }).catch(() => null);
          const reason = formatDeclineReason({
            declineCode: charge.declineCode,
            code: charge.code,
            fallbackError: charge.error,
          });
          pledgesAddItemsLogger.warn(
            { pledgeId, declineCode: charge.declineCode, code: charge.code, status: charge.status },
            "[AddItems DC] Saved-card off-session charge declined"
          );
          return NextResponse.json(
            { error: reason, declineCode: charge.declineCode, code: charge.code },
            { status: 402 }
          );
        }

        // Charge succeeded — apply the new addons + bump the pledge
        // amount in a single transaction. The webhook handler that
        // normally fans out add-ons fires off the original PaymentIntent
        // confirmation, so for the off-session path we apply them here.
        //
        // IMPORTANT: the money is already captured by this point, so
        // nothing in this transaction is allowed to throw for business
        // reasons — a rollback here means "backer charged, nothing
        // granted". That's why:
        //   - an existing PledgeAddon row is incremented, not re-created
        //     (PledgeAddon has @@unique([pledgeId, addonId]); a bare
        //     create on a repeat purchase of the same addon throws P2002
        //     and rolled the whole grant back — that was a live bug)
        //   - the slot-claim check logs an oversell instead of throwing
        //     (the confirm-add-items flow can throw because it verifies
        //     before acking, but here the charge is final)
        await db.$transaction(async (tx) => {
          for (const a of addonsWithQuantity) {
            const reward = await tx.reward.findFirst({
              where: { id: a.id, projectId: pledge.projectId },
              select: { amount: true },
            });
            const unitAmount = reward ? Number(reward.amount) : 0;

            const existingAddon = await tx.pledgeAddon.findFirst({
              where: { pledgeId: pledge.id, addonId: a.id },
            });
            if (existingAddon) {
              await tx.pledgeAddon.update({
                where: { id: existingAddon.id },
                data: {
                  quantity: existingAddon.quantity + a.quantity,
                  amount: (existingAddon.quantity + a.quantity) * unitAmount,
                },
              });
            } else {
              await tx.pledgeAddon.create({
                data: {
                  pledgeId: pledge.id,
                  addonId: a.id,
                  quantity: a.quantity,
                  amount: unitAmount * a.quantity,
                },
              });
            }

            // Claim addon slots so limited addons track availability on
            // this path too (parity with confirm-add-items). Row-locked
            // to serialize against concurrent claims.
            const addonRows = await tx.$queryRaw<Array<{
              id: string;
              quantityAvailable: number | null;
              quantityClaimed: number;
            }>>`
              SELECT id, "quantityAvailable", "quantityClaimed"
              FROM "Reward"
              WHERE id = ${a.id}
              FOR UPDATE
            `;
            const addonInfo = addonRows[0];
            if (addonInfo) {
              const availableSlots = addonInfo.quantityAvailable === null
                ? Infinity
                : addonInfo.quantityAvailable - addonInfo.quantityClaimed;
              if (availableSlots < a.quantity) {
                // Money already taken — grant anyway and flag for the
                // creator/admin to reconcile rather than charging the
                // backer for nothing.
                pledgesAddItemsLogger.error(
                  { pledgeId, addonId: a.id, requested: a.quantity, availableSlots },
                  "[AddItems DC] OVERSELL: saved-card charge granted more addon units than remained available"
                );
              }
              await tx.reward.update({
                where: { id: a.id },
                data: { quantityClaimed: { increment: a.quantity } },
              });
            }
          }
          await tx.pledge.update({
            where: { id: pledge.id },
            data: {
              amount: { increment: amount },
              addonsAmount: { increment: amount },
              metadata: { ...currentMetadata },
            },
          });
          // Keep the project headline total in step with the pledge bump
          // (the confirm-add-items path already does this).
          await tx.project.update({
            where: { id: pledge.projectId },
            data: { currentAmount: { increment: amount } },
          });
        });

        pledgesAddItemsLogger.info(
          { pledgeId, paymentIntentId: charge.paymentIntentId, amount },
          "[AddItems DC] Saved-card off-session charge succeeded"
        );
        return NextResponse.json({
          ok: true,
          paymentMethod: "DIVINITYCOIN",
          type: "off_session_charge",
          paymentIntentId: charge.paymentIntentId,
          amount: charge.amount,
        });
      } catch (dcError) {
        // Roll back the reservation marker so the user can retry.
        await db.pledge.update({
          where: { id: pledgeId },
          data: { metadata: { ...currentMetadata } },
        }).catch(() => null);
        const message = dcError instanceof Error ? dcError.message : "Unknown error";
        pledgesAddItemsLogger.error({ err: message }, "[AddItems DC saved-card] error:");
        return NextResponse.json(
          { error: `Failed to charge saved card: ${message}` },
          { status: 502 }
        );
      }
    }

    // DivinityCoin (no saved card): legacy on-session flow — create a
    // PaymentIntent and have the client confirm with Stripe Elements.
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

    // Whop upcharge: create a Whop checkout configuration tagged with
    // metadata.type="upcharge" so the webhook handler bails out of
    // the new-pledge completion branch. Client uses the Whop SDK to
    // pay and then calls confirm-add-items, which verifies the
    // payment via Whop's API and applies the addons.
    if (paymentProcessor === "WHOP") {
      try {
        const { sessionId, planId, environment } = await createWhopUpcharge({
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          userId: session.user.id,
          amount,
        });

        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...currentMetadata,
              pendingAdditionalItems: {
                paymentMethod: "WHOP",
                paymentIntentId: sessionId,
                addons: addonsWithQuantity,
                amount,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });

        pledgesAddItemsLogger.info(
          { pledgeId, sessionId, amount, addonCount: addonsWithQuantity.length },
          "[AddItems Whop] Upcharge checkout created"
        );

        return NextResponse.json({
          paymentMethod: "WHOP",
          type: "whop_checkout",
          sessionId,
          planId,
          environment,
          pledgeId: pledge.id,
        });
      } catch (whopErr) {
        await db.pledge.update({
          where: { id: pledgeId },
          data: { metadata: { ...currentMetadata } },
        }).catch(() => null);
        const message = whopErr instanceof Error ? whopErr.message : "Unknown error";
        pledgesAddItemsLogger.error({ err: message }, "[AddItems Whop] API error:");
        return NextResponse.json(
          { error: `Failed to create Whop checkout: ${message}` },
          { status: 502 }
        );
      }
    }

    // PayPal upcharge: create a PayPal order (CAPTURE intent) for
    // just the upcharge amount. Client uses PayPal SDK to approve;
    // confirm-add-items captures via the PayPal API and applies the
    // addons. Custom_id is prefixed `upcharge_` so the PayPal capture
    // route's pledge-lookup-by-orderId never collides with this.
    if (paymentProcessor === "PAYPAL") {
      try {
        const { paypalOrderId, paypalClientId, paypalMode } = await createPayPalUpcharge({
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          amount,
        });

        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...currentMetadata,
              pendingAdditionalItems: {
                paymentMethod: "PAYPAL",
                paymentIntentId: paypalOrderId,
                addons: addonsWithQuantity,
                amount,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });

        pledgesAddItemsLogger.info(
          { pledgeId, paypalOrderId, amount, addonCount: addonsWithQuantity.length },
          "[AddItems PayPal] Upcharge order created"
        );

        return NextResponse.json({
          paymentMethod: "PAYPAL",
          type: "paypal_order",
          paypalOrderId,
          paypalClientId,
          paypalMode,
          pledgeId: pledge.id,
        });
      } catch (ppErr) {
        await db.pledge.update({
          where: { id: pledgeId },
          data: { metadata: { ...currentMetadata } },
        }).catch(() => null);
        const message = ppErr instanceof Error ? ppErr.message : "Unknown error";
        pledgesAddItemsLogger.error({ err: message }, "[AddItems PayPal] API error:");
        return NextResponse.json(
          { error: `Failed to create PayPal order: ${message}` },
          { status: 502 }
        );
      }
    }

    // Roll back the reservation marker — processor not supported for
    // add-ons (legacy Stripe or unconfigured).
    await db.pledge.update({
      where: { id: pledgeId },
      data: { metadata: { ...currentMetadata } },
    }).catch(() => null);

    return NextResponse.json(
      { error: "Adding items is not supported for this pledge's payment processor." },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    pledgesAddItemsLogger.error({ err: `${message}: ${error}` }, "Error adding items to pledge:");
    return NextResponse.json(
      { error: `Failed to add items to pledge: ${message}` },
      { status: 500 }
    );
  }
}
