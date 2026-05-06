import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "pledges-confirm-dc-setup" });

// Phase 2 of the DivinityCoin AoN saved-card flow.
//
// /api/pledges (POST) created the pledge in PENDING state and returned a
// SetupIntent clientSecret. The browser confirmed the SetupIntent via
// stripe.confirmSetup() pointed at DC's publishable key; that succeeded
// and produced a payment_method id (pm_...). The browser now POSTs that
// pm id back here so we can persist it on the pledge — the AoN
// charge-on-success cron will later call DC's
// /charge-saved-payment-method with this pm to capture the funds.
//
// We never see card data; only the durable pm_... handle.

const bodySchema = z.object({
  setupIntentId: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1).max(200),
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
      return NextResponse.json({ error: "Missing setupIntentId or paymentMethodId" }, { status: 400 });
    }
    const { setupIntentId, paymentMethodId } = parse.data;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentProcessor: true,
        chargedImmediately: true,
        divinityCoinPaymentMethodId: true,
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

    // Idempotency: re-saving the same pm is a no-op. Re-saving a
    // DIFFERENT pm is also OK — replaces the prior one. The cron
    // charges whatever we have on file at the time it runs.
    if (pledge.divinityCoinPaymentMethodId === paymentMethodId) {
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        alreadyConfirmed: true,
      });
    }

    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        divinityCoinSetupIntentId: setupIntentId,
        divinityCoinPaymentMethodId: paymentMethodId,
      },
    });

    log.info(
      { pledgeId: pledge.id, setupIntentId },
      "[Confirm DC Setup] Card saved on pledge for AoN charge-on-success"
    );

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
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
