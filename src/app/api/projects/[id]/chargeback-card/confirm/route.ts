import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { getCustomerOrigin } from "@/lib/payments/customer-origin";
import {
  getDcSetupIntent,
  listDcPaymentMethods,
} from "@/lib/payments/divinitycoin/saved-cards";
import { recoverProject } from "@/lib/payments/chargeback-recoup";

const log = logger.child({ module: "chargeback-card-confirm" });

export const dynamic = "force-dynamic";

function titleCaseBrand(brand: string | undefined | null): string | null {
  if (!brand) return null;
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return map[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

// POST - Finish saving the chargeback card. The browser confirmed the
// SetupIntent with DC (card + CVC verified there); we verify the
// SetupIntent server-side, persist the token, and purge any legacy
// encrypted card data for this project.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: projectId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can set the chargeback card" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const clientSetupIntentId =
      typeof body.setupIntentId === "string" ? body.setupIntentId : "";
    const clientPaymentMethodId =
      typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";

    // Prefer the SetupIntent we minted for this project over a
    // client-supplied one, so a creator can't attach someone else's token.
    const existing = await db.creatorChargebackCard.findUnique({
      where: { projectId },
      select: { divinityCoinSetupIntentId: true },
    });
    const setupIntentId = existing?.divinityCoinSetupIntentId || clientSetupIntentId;
    if (!setupIntentId) {
      return NextResponse.json({ error: "Start the card form first" }, { status: 400 });
    }

    const si = await getDcSetupIntent(setupIntentId);
    if (!si.success) {
      log.error({ projectId, setupIntentId, err: si.error }, "get-setup-intent failed");
      return NextResponse.json(
        { error: "Could not verify the card with Divinity Payments. Please try again." },
        { status: 502 }
      );
    }
    if (si.status !== "succeeded") {
      return NextResponse.json(
        { error: `Card verification is not complete (status: ${si.status}). Please try again.` },
        { status: 400 }
      );
    }
    const paymentMethodId = si.paymentMethodId || clientPaymentMethodId;
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "The card was verified but no saved-card token came back. Please try again." },
        { status: 400 }
      );
    }
    if (clientPaymentMethodId && si.paymentMethodId && clientPaymentMethodId !== si.paymentMethodId) {
      return NextResponse.json({ error: "Card token mismatch" }, { status: 400 });
    }

    // Display details come from DC's record of the token, not the browser.
    const methods = await listDcPaymentMethods(project.creatorId);
    const pm = methods.paymentMethods.find((m) => m.id === paymentMethodId);
    if (!pm) {
      log.warn({ projectId, paymentMethodId }, "Saved token not in list-payment-methods");
    }
    const lastFour = pm?.last4 || "0000";
    const brand = titleCaseBrand(pm?.brand);
    const expMonth = pm?.expMonth || 0;
    const expYear = pm?.expYear || 0;
    // Recoup charges run off-session; DC gets the origin of THIS request
    // (where the card was entered) as the customer origin for them.
    const origin = getCustomerOrigin(req);

    await db.creatorChargebackCard.upsert({
      where: { projectId },
      update: {
        divinityCoinPaymentMethodId: paymentMethodId,
        divinityCoinSetupIntentId: setupIntentId,
        vaultVerifiedAt: new Date(),
        savedFromIp: origin.customerIpAddress ?? null,
        savedFromUserAgent: origin.customerUserAgent ?? null,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
        // A verified vault token replaces every legacy secret for this
        // project. The encrypted card number is gone the moment the
        // creator re-enters through the secure form.
        cardNumberEncrypted: null,
        expMonthEncrypted: null,
        expYearEncrypted: null,
        cvcEncrypted: null,
        billingNameEncrypted: null,
        billingLine1Encrypted: null,
        billingLine2Encrypted: null,
        billingCityEncrypted: null,
        billingStateEncrypted: null,
        billingZipEncrypted: null,
        billingCountryEncrypted: null,
        nmiCustomerVaultId: null,
      },
      create: {
        projectId,
        divinityCoinPaymentMethodId: paymentMethodId,
        divinityCoinSetupIntentId: setupIntentId,
        vaultVerifiedAt: new Date(),
        savedFromIp: origin.customerIpAddress ?? null,
        savedFromUserAgent: origin.customerUserAgent ?? null,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
      },
    });

    auditLog({
      action: "CHARGEBACK_CARD_VAULTED",
      actorId: session.user.id,
      targetType: "PROJECT",
      targetId: projectId,
      details: { lastFour, brand },
    });

    // Anything we couldn't collect on the old card gets collected now.
    const recovery = await recoverProject(projectId).catch((err) => {
      log.warn({ err: formatError(err), projectId }, "recoverProject failed");
      return null;
    });
    const recouped = recovery?.charged ?? 0;

    return NextResponse.json({
      success: true,
      lastFour,
      brand,
      expMonth,
      expYear,
      vaulted: true,
      recoupedOutstanding: recouped,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "confirm route failed");
    return NextResponse.json({ error: "Failed to save chargeback card" }, { status: 500 });
  }
}
