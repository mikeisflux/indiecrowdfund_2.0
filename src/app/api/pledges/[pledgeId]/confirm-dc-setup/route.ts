import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { commitDcPledge, getDcSetupIntent } from "@/lib/payments/divinitycoin";

const log = logger.child({ module: "pledges-confirm-dc-setup" });

// Phase 2 of the DivinityCoin AoN saved-card flow.
//
// /api/pledges (POST) created the pledge in PENDING state and returned a
// SetupIntent clientSecret. The browser confirmed the SetupIntent via
// stripe.confirmSetup() pointed at DC's publishable key; that succeeded
// and produced a payment_method id (pm_...). The browser POSTs that pm
// id back here so we can persist it on the pledge — the AoN
// charge-on-success cron will later call DC's
// /charge-saved-payment-method with this pm to capture the funds.
//
// 3DS-redirect recovery: if confirmSetup() needed a full-page redirect
// (3DS challenge) the browser never gets the pm_... back, so
// handleSuccessRedirect POSTs here with only the setupIntentId and the
// server resolves the pm via DC's get-setup-intent.
//
// We never see card data; only the durable pm_... handle.
//
// COMMIT BOOKKEEPING: for the saved-card flow there is NO later confirm
// step — confirm/route.ts explicitly rejects non-chargedImmediately
// pledges. So saving the card here IS the commit, and this route must
// do the same bookkeeping confirm/route.ts does for the charge-now
// flows: atomically flip confirmationEmailSent (the codebase-wide
// "counted toward the goal" flag — see lib/stats.ts), bump the project's
// denormalized currentAmount / backerCount, claim reward + addon slots,
// assign a backer number, notify the creator, and send the confirmation
// email. Skipping this is what made AoN DivinityCoin campaigns show
// $0 / 0 backers despite real saved-card pledges.
//
// The atomic confirmationEmailSent claim makes the route safe to call
// repeatedly — double-submit, retry, or healing an older pledge that
// had its card saved before this bookkeeping existed.

const bodySchema = z.object({
  setupIntentId: z.string().min(1).max(200),
  // Optional: the in-browser flow hands this back directly. The
  // 3DS-redirect recovery path omits it and the server resolves it from
  // the SetupIntent via DC's get-setup-intent (see header comment).
  paymentMethodId: z.string().min(1).max(200).optional(),
});

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
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Missing or invalid setupIntentId" }, { status: 400 });
    }
    const { setupIntentId, paymentMethodId } = parse.data;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        paymentProcessor: true,
        status: true,
        chargedImmediately: true,
        divinityCoinSetupIntentId: true,
      },
    });
    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pledge.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "Pledge is not on DivinityCoin" },
        { status: 400 }
      );
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: `Pledge is already ${pledge.status.toLowerCase()}` },
        { status: 400 }
      );
    }
    if (pledge.chargedImmediately) {
      // KIA / already-funded-AoN DivinityCoin pledges charge immediately
      // and are committed through /api/pledges/[id]/confirm once the
      // PaymentIntent succeeds. They must NOT be committed here, where
      // there is no payment-success verification — doing so would count
      // an unpaid pledge toward the goal.
      return NextResponse.json(
        { error: "Pledge is not on the saved-card flow" },
        { status: 400 }
      );
    }

    // Resolve the saved-card token. The in-browser flow POSTs
    // paymentMethodId directly. The 3DS-redirect recovery path omits it
    // — Stripe did a full-page redirect mid-confirmSetup so the browser
    // never received the pm_... — so resolve it from DC using the
    // SetupIntent id on the pledge (prefer the one we stored at pledge
    // creation over the client-supplied value). get-setup-intent returns
    // the paymentMethodId once the SetupIntent has succeeded.
    const effectiveSetupIntentId = pledge.divinityCoinSetupIntentId || setupIntentId;
    let resolvedPaymentMethodId = paymentMethodId;
    if (!resolvedPaymentMethodId) {
      const si = await getDcSetupIntent(effectiveSetupIntentId);
      if (!si.success) {
        log.error(
          { pledgeId: pledge.id, setupIntentId: effectiveSetupIntentId, err: si.error },
          "[Confirm DC Setup] get-setup-intent lookup failed"
        );
        return NextResponse.json(
          { error: "Could not verify the saved card. Please try again." },
          { status: 502 }
        );
      }
      if (si.status !== "succeeded" || !si.paymentMethodId) {
        return NextResponse.json(
          { error: `Card setup is not complete (status: ${si.status}). Please try again.` },
          { status: 400 }
        );
      }
      resolvedPaymentMethodId = si.paymentMethodId;
    }

    // Delegate the saved-card persist + bookkeeping to the shared
    // commit helper. Same behavior the inline-Elements flow has always
    // had — the helper is the byte-identical extract. The
    // hosted-checkout return + checkout.completed webhook call the
    // same helper for SETUP-mode pledges; the CAS inside guarantees
    // only one of them runs the side effects.
    const result = await commitDcPledge({
      pledgeId: pledge.id,
      paymentMethodId: resolvedPaymentMethodId,
      setupIntentId: effectiveSetupIntentId,
      source: "confirm-dc-setup",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      alreadyConfirmed: result.alreadyCommitted,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "confirm-dc-setup error"
    );
    return NextResponse.json(
      { error: "Failed to save card" },
      { status: 500 }
    );
  }
}
