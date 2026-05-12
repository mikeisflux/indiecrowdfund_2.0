import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

const projectsChargebackCardLogger = logger.child({ module: "projects-chargeback-card" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import {
  loadNmiConfig,
  validateAndAddToVault,
  deleteVaultCustomer,
} from "@/lib/nmi";
import { isValidNamePart, describeNameError } from "@/lib/validation/name";

export const dynamic = "force-dynamic";

// Map a Collect.js card.type string to our CreatorChargebackCard.cardBrand
// display value. Collect.js returns lowercased BIN-derived brand names
// (visa, mastercard, amex, discover, etc).
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

// Collect.js gives the card number as a masked string like "411111******1111".
function lastFourFromMasked(masked?: string | null): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

// Collect.js exp string is "MMYY" (4 chars). Split into ints.
function parseExp(exp?: string | null): { month: number; year: number } | null {
  if (!exp) return null;
  const s = exp.replace(/\D/g, "");
  if (s.length !== 4) return null;
  const month = parseInt(s.slice(0, 2), 10);
  const yearTwo = parseInt(s.slice(2), 10);
  if (!month || month < 1 || month > 12) return null;
  if (Number.isNaN(yearTwo)) return null;
  // Two-digit year → 4-digit year. NMI gives YY for the current century.
  const year = 2000 + yearTwo;
  return { month, year };
}

// GET - Check if project has a chargeback card on file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Check user is creator or admin
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    if (project.creatorId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const card = await db.creatorChargebackCard.findUnique({
      where: { projectId },
      select: {
        id: true,
        cardLastFour: true,
        cardBrand: true,
        expMonth: true,
        expYear: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!card) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
      expMonth: card.expMonth,
      expYear: card.expYear,
      updatedAt: card.updatedAt,
    });
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error fetching chargeback card:");
    return NextResponse.json(
      { error: "Failed to fetch chargeback card" },
      { status: 500 }
    );
  }
}

// POST — Save or update the chargeback card for a project via PaymentCloud.
//
// Body shape (the new tokenized flow):
//   {
//     paymentToken:  string  // single-use Collect.js token from the browser
//     cardMasked?:   string  // "411111******1111" — for last4 display
//     cardType?:     string  // "visa", "mastercard", … — for brand display
//     cardExp?:      string  // "MMYY" — for exp display
//     billingFirstName, billingLastName,
//     billingLine1, billingLine2?, billingCity, billingState, billingZip,
//     billingCountry,
//   }
//
// We exchange the single-use payment token for a PaymentCloud Customer
// Vault id, then run a `type=validate` on it to confirm the card is real
// and chargeable. On a clean validate we save the vault id + display data
// and clear any legacy AES-encrypted PAN columns.
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

    // Verify the user is the project creator
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

    // Validate the cardholder name (first + last as separate fields).
    // We previously had a single combined "name" field where some
    // creators were typing in just a first name or pasting their email.
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
        { error: "Payment processor not configured. Please contact support." },
        { status: 502 }
      );
    }

    // Mint our own customer_vault_id BEFORE the gateway call. PaymentCloud's
    // white-label has been observed to NOT echo customer_vault_id back on
    // add_customer responses (response=1, "Customer Added", but no
    // customer_vault_id field), which used to trip the
    // `!vaultResp.customer_vault_id` check below and reject every save with
    // "Card was declined" even though the vault entry was created on the
    // gateway side. Same workaround the AoN confirm-nmi flow already uses.
    //
    // PaymentCloud caps customer_vault_id at 36 characters
    // ("Customer Vault ID may not exceed 36 characters" REFID error),
    // so use a 32-char dashless UUID (no prefix — uniqueness alone is
    // what NMI requires).
    const customerVaultId = randomUUID().replace(/-/g, "");

    // Combined validate-and-add-to-vault call. Validates the card
    // using the single-use payment_token (which carries CVV) AND
    // commits the vault entry on success. Replaces the previous
    // two-step add_customer → validate sequence which lost the CVV
    // between calls and got rejected by merchant accounts configured
    // to "Require CVV on validate" with "A card security code has
    // never been passed for this account REFID:…".
    //
    // Gateway only commits the vault entry when the validate auth
    // succeeds, so a declined card never leaves an orphan in the
    // vault — no need for the prior delete-on-validate-fail dance.
    const vaultResp = await validateAndAddToVault(nmiConfig, {
      paymentToken,
      customerVaultId,
      firstName: billingFirstName!.trim(),
      lastName: billingLastName!.trim(),
      address1: billingLine1!.trim(),
      city: billingCity!.trim(),
      state: billingState!.trim(),
      zip: billingZip!.trim(),
      country: billingCountry!.trim(),
    });
    if (vaultResp.response !== "1") {
      // Treat "duplicate vault id" as success — vault entry exists on the
      // gateway from a prior attempt whose response was lost in transit,
      // and our minted id is unique per save.
      const text = (vaultResp.responsetext || "").toLowerCase();
      const looksLikeDuplicateVault =
        text.includes("vault") && (text.includes("exist") || text.includes("duplicate"));
      if (!looksLikeDuplicateVault) {
        projectsChargebackCardLogger.warn(
          { projectId, response: vaultResp.response, text: vaultResp.responsetext },
          "PaymentCloud validate+vault-add declined for chargeback card"
        );
        return NextResponse.json(
          { error: vaultResp.responsetext || "Card was declined. Please try a different card." },
          { status: 400 }
        );
      }
      projectsChargebackCardLogger.warn(
        { projectId, response: vaultResp.response, text: vaultResp.responsetext },
        "PaymentCloud validate+vault-add returned duplicate-id; treating as recovered"
      );
    }

    const lastFour = lastFourFromMasked(cardMasked) || "0000";
    const brand = brandFromCollectJs(cardType);
    const exp = parseExp(cardExp);
    const expMonth = exp?.month ?? 0;
    const expYear = exp?.year ?? 0;

    projectsChargebackCardLogger.info(
      { projectId, brand, lastFour, customerVaultId },
      "Chargeback card saved (PaymentCloud vault)"
    );

    // Note the prior vault entry (if any) BEFORE we upsert so we can
    // delete it AFTER the new row is committed. Doing it in this order
    // means a failed upsert never leaves the row pointing at a
    // deleted vault entry.
    const existing = await db.creatorChargebackCard.findUnique({
      where: { projectId },
      select: { nmiCustomerVaultId: true },
    });
    const priorVaultId =
      existing?.nmiCustomerVaultId && existing.nmiCustomerVaultId !== customerVaultId
        ? existing.nmiCustomerVaultId
        : null;

    await db.creatorChargebackCard.upsert({
      where: { projectId },
      update: {
        nmiCustomerVaultId: customerVaultId,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
        // Clear any legacy AES-encrypted PAN columns left from the old flow.
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
      },
      create: {
        projectId,
        nmiCustomerVaultId: customerVaultId,
        cardLastFour: lastFour,
        cardBrand: brand,
        expMonth,
        expYear,
      },
    });

    // Best-effort vault cleanup of the prior saved card now that the
    // new one is committed. A failure here only leaves an orphan in
    // PaymentCloud's vault — no creator-visible breakage.
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
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error saving chargeback card:");
    return NextResponse.json(
      { error: "Failed to save chargeback card" },
      { status: 500 }
    );
  }
}

// GET admin endpoint to retrieve full (decrypted) card details
// This is accessed by admins only through a separate admin API
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin only
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id: projectId } = await params;

    const card = await db.creatorChargebackCard.findUnique({
      where: { projectId },
    });

    if (!card) {
      return NextResponse.json({ error: "No chargeback card on file" }, { status: 404 });
    }

    // New vault-backed cards: PAN lives only in PaymentCloud's vault,
    // never in our DB. Return the vault id so admins can look it up
    // in PaymentCloud's portal if they need full card details.
    if (card.nmiCustomerVaultId) {
      return NextResponse.json({
        storage: "paymentcloud_vault",
        nmiCustomerVaultId: card.nmiCustomerVaultId,
        lastFour: card.cardLastFour,
        brand: card.cardBrand,
        expMonth: card.expMonth,
        expYear: card.expYear,
      });
    }

    // Legacy AES-encrypted rows — decrypt for admin viewing.
    return NextResponse.json({
      storage: "aes_encrypted_legacy",
      cardNumber: card.cardNumberEncrypted ? decrypt(card.cardNumberEncrypted) : null,
      expMonth: card.expMonthEncrypted ? decrypt(card.expMonthEncrypted) : null,
      expYear: card.expYearEncrypted ? decrypt(card.expYearEncrypted) : null,
      cvc: card.cvcEncrypted ? decrypt(card.cvcEncrypted) : null,
      billingName: card.billingNameEncrypted ? decrypt(card.billingNameEncrypted) : null,
      billingLine1: card.billingLine1Encrypted ? decrypt(card.billingLine1Encrypted) : null,
      billingLine2: card.billingLine2Encrypted ? decrypt(card.billingLine2Encrypted) : null,
      billingCity: card.billingCityEncrypted ? decrypt(card.billingCityEncrypted) : null,
      billingState: card.billingStateEncrypted ? decrypt(card.billingStateEncrypted) : null,
      billingZip: card.billingZipEncrypted ? decrypt(card.billingZipEncrypted) : null,
      billingCountry: card.billingCountryEncrypted ? decrypt(card.billingCountryEncrypted) : null,
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
    });
  } catch (error) {
    projectsChargebackCardLogger.error({ err: String(error) }, "Error fetching decrypted card:");
    return NextResponse.json(
      { error: "Failed to retrieve card details" },
      { status: 500 }
    );
  }
}
