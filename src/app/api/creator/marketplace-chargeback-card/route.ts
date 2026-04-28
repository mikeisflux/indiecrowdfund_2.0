import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  loadNmiConfig,
  addCustomerToVault,
  deleteVaultCustomer,
  validateVaultCard,
} from "@/lib/nmi";
import { isValidNamePart, describeNameError } from "@/lib/validation/name";

const log = logger.child({ module: "creator-marketplace-chargeback-card" });

// User-level marketplace chargeback card. Mirrors the per-project
// /api/projects/[id]/chargeback-card endpoint but the card belongs to
// the creator account, not a single project, since marketplace sales
// are user-level. PAN is tokenized in the browser via Collect.js;
// server stores only the Customer Vault id + display data and runs
// `type=validate` to confirm the card is real and chargeable.

function brandFromCollectJs(type?: string | null): string | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === "visa") return "Visa";
  if (t === "mastercard") return "Mastercard";
  if (t === "amex" || t === "american-express") return "Amex";
  if (t === "discover") return "Discover";
  if (t === "jcb") return "JCB";
  if (t === "diners" || t === "diners-club") return "Diners";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function lastFourFromMasked(masked?: string | null): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function parseExp(exp?: string | null): { month: number; year: number } | null {
  if (!exp) return null;
  const s = exp.replace(/\D/g, "");
  if (s.length !== 4) return null;
  const month = parseInt(s.slice(0, 2), 10);
  const yearTwo = parseInt(s.slice(2), 10);
  if (!month || month < 1 || month > 12) return null;
  if (Number.isNaN(yearTwo)) return null;
  return { month, year: 2000 + yearTwo };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const card = await db.creatorMarketplaceChargebackCard.findUnique({
      where: { userId: session.user.id },
      select: {
        cardLastFour: true,
        cardBrand: true,
        expMonth: true,
        expYear: true,
        updatedAt: true,
      },
    });

    if (!card) return NextResponse.json({ exists: false });

    return NextResponse.json({
      exists: true,
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
      expMonth: card.expMonth,
      expYear: card.expYear,
      updatedAt: card.updatedAt,
    });
  } catch (err) {
    // Defensive: if the table doesn't exist yet (fresh deploy without
    // prisma db push), return `exists: false` so consumer pages don't
    // surface a 500 banner.
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "GET error");
    return NextResponse.json({ exists: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      paymentToken,
      cardMasked,
      cardType,
      cardExp,
      billingFirstName,
      billingLastName,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
    } = body as Record<string, string | undefined>;

    if (!paymentToken || typeof paymentToken !== "string") {
      return NextResponse.json(
        { error: "Missing payment token. Please re-enter the card and try again." },
        { status: 400 }
      );
    }
    if (!isValidNamePart(billingFirstName)) {
      return NextResponse.json({ error: describeNameError("first name on the card") }, { status: 400 });
    }
    if (!isValidNamePart(billingLastName)) {
      return NextResponse.json({ error: describeNameError("last name on the card") }, { status: 400 });
    }
    if (!billingLine1 || !billingCity || !billingState || !billingZip || !billingCountry) {
      return NextResponse.json(
        { error: "All billing address fields are required" },
        { status: 400 }
      );
    }

    const nmiConfig = await loadNmiConfig();
    if (!nmiConfig) {
      return NextResponse.json(
        { error: "Payment processor not configured" },
        { status: 502 }
      );
    }

    const vaultResp = await addCustomerToVault(nmiConfig, {
      paymentToken,
      firstName: billingFirstName!.trim(),
      lastName: billingLastName!.trim(),
      address1: billingLine1!.trim(),
      city: billingCity!.trim(),
      state: billingState!.trim(),
      zip: billingZip!.trim(),
      country: billingCountry!.trim(),
    });
    if (vaultResp.response !== "1" || !vaultResp.customer_vault_id) {
      log.warn(
        { userId: session.user.id, response: vaultResp.response, text: vaultResp.responsetext },
        "PaymentCloud vault add declined for marketplace chargeback card"
      );
      return NextResponse.json(
        { error: vaultResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }
    const customerVaultId = vaultResp.customer_vault_id;

    const validateResp = await validateVaultCard(nmiConfig, customerVaultId);
    if (validateResp.response !== "1") {
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      return NextResponse.json(
        {
          error:
            validateResp.responsetext ||
            "Card could not be validated. Please try a different card.",
        },
        { status: 400 }
      );
    }

    const lastFour = lastFourFromMasked(cardMasked) || "0000";
    const brand = brandFromCollectJs(cardType);
    const exp = parseExp(cardExp);
    const expMonth = exp?.month ?? 0;
    const expYear = exp?.year ?? 0;

    const existing = await db.creatorMarketplaceChargebackCard.findUnique({
      where: { userId: session.user.id },
      select: { nmiCustomerVaultId: true },
    });
    const priorVaultId =
      existing?.nmiCustomerVaultId && existing.nmiCustomerVaultId !== customerVaultId
        ? existing.nmiCustomerVaultId
        : null;

    await db.creatorMarketplaceChargebackCard.upsert({
      where: { userId: session.user.id },
      update: {
        nmiCustomerVaultId: customerVaultId,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
      },
      create: {
        userId: session.user.id,
        nmiCustomerVaultId: customerVaultId,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
      },
    });

    if (priorVaultId) {
      await deleteVaultCustomer(nmiConfig, priorVaultId).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      lastFour,
      brand,
      expMonth,
      expYear,
    });
  } catch (err) {
    log.error({ err: String(err) }, "POST error");
    return NextResponse.json(
      { error: "Failed to save chargeback card" },
      { status: 500 }
    );
  }
}
