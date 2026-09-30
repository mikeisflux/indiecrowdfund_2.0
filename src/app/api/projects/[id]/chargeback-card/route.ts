import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

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
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
        divinityCoinPaymentMethodId: true,
        vaultVerifiedAt: true,
      },
    });

    if (!card) {
      return NextResponse.json({ exists: false, vaulted: false, needsReentry: false });
    }

    const vaulted = !!card.divinityCoinPaymentMethodId;
    return NextResponse.json({
      exists: true,
      // Only a DC-vaulted card can be charged for a dispute. Legacy rows
      // (encrypted PAN / dead PaymentCloud vault) must be re-entered.
      vaulted,
      needsReentry: !vaulted,
      verifiedAt: card.vaultVerifiedAt,
      lastFour: card.cardLastFour,
      brand: card.cardBrand,
      expMonth: card.expMonth,
      expYear: card.expYear,
      updatedAt: card.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching chargeback card:", error);
    return NextResponse.json(
      { error: "Failed to fetch chargeback card" },
      { status: 500 }
    );
  }
}

// POST - Retired. Card numbers no longer pass through this server at all:
// the builder saves the card through the DivinityCoin vault
// (./setup-intent then ./confirm). Kept as an explicit 410 so any stale
// client build gets a clear message instead of a silent 404.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Chargeback cards are now saved through the Divinity Payments secure form. Please reload the page and use the Add Card button.",
      code: "USE_VAULT_FORM",
    },
    { status: 410 }
  );
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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

    // Card details are viewed for a reason (usually a manual recoup
    // charge) — leave a trail of who looked and when.
    auditLog({
      action: "CHARGEBACK_CARD_VIEW",
      actorId: session.user.id,
      targetType: "PROJECT",
      targetId: projectId,
      details: { lastFour: card.cardLastFour, vaultTokenized: !!card.nmiCustomerVaultId },
    });

    // Vault-tokenized cards never store the PAN on our side. DC-vaulted
    // cards are charged from the admin payouts dialog (Charge now) or
    // automatically by the dispute webhook; there is nothing to reveal.
    if (!card.cardNumberEncrypted) {
      return NextResponse.json({
        vaultOnly: true,
        processor: card.divinityCoinPaymentMethodId ? "divinitycoin" : "paymentcloud",
        vaultId: card.divinityCoinPaymentMethodId || card.nmiCustomerVaultId,
        lastFour: card.cardLastFour,
        brand: card.cardBrand,
        expMonth: card.expMonth,
        expYear: card.expYear,
      });
    }

    // Decrypt for admin viewing (legacy rows that pre-date vaulting)
    return NextResponse.json({
      cardNumber: decrypt(card.cardNumberEncrypted),
      expMonth: card.expMonthEncrypted ? decrypt(card.expMonthEncrypted) : String(card.expMonth),
      expYear: card.expYearEncrypted ? decrypt(card.expYearEncrypted) : String(card.expYear),
      // Legacy rows may still hold an encrypted CVC; it is deliberately
      // never returned — storing or displaying it is a PCI violation.
      cvc: null,
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
    console.error("Error fetching decrypted card:", error);
    return NextResponse.json(
      { error: "Failed to retrieve card details" },
      { status: 500 }
    );
  }
}
