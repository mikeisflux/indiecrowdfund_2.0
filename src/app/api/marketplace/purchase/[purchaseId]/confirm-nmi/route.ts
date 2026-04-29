import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  loadNmiConfig,
  addCustomerToVault,
  saleByVaultToken,
  deleteVaultCustomer,
} from "@/lib/nmi";

const log = logger.child({ module: "marketplace-purchase-confirm-nmi" });

// Phase 2 of the marketplace PaymentCloud flow. The browser tokenized
// the card via Collect.js → POSTs the single-use payment_token here.
// We exchange it for a Customer Vault id, charge immediately
// (marketplace items always charge at purchase time, no AoN-style
// hold), and mark the purchase COMPLETED.
//
// Concurrency: vault-attach + sale are both CAS-guarded so a
// double-tap can't double-charge. Loser of the CAS sees the already-
// completed state and gets idempotent success.

const bodySchema = z.object({
  paymentToken: z.string().min(1).max(200),
  // Billing fields collected on the marketplace card form. NMI uses
  // address1 + zip for AVS; missing them downgrades interchange.
  billingFirstName: z.string().trim().max(100).optional(),
  billingLastName: z.string().trim().max(100).optional(),
  billingLine1: z.string().trim().max(200).optional(),
  billingLine2: z.string().trim().max(200).optional(),
  billingCity: z.string().trim().max(100).optional(),
  billingState: z.string().trim().max(100).optional(),
  billingZip: z.string().trim().max(20).optional(),
  billingCountry: z.string().trim().max(3).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { purchaseId } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing payment token" }, { status: 400 });
    }
    const {
      paymentToken,
      billingFirstName,
      billingLastName,
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
    } = parsed.data;

    const purchase = await db.marketplacePurchase.findFirst({
      where: { id: purchaseId },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            paymentProcessor: true,
          },
        },
      },
    });
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (purchase.paymentProcessor !== "NMI") {
      return NextResponse.json(
        { error: "Purchase is not on PaymentCloud" },
        { status: 400 }
      );
    }
    if (purchase.status === "COMPLETED" && purchase.nmiTransactionId) {
      return NextResponse.json({
        ok: true,
        purchaseId: purchase.id,
        status: "COMPLETED",
        alreadyConfirmed: true,
      });
    }
    if (purchase.status !== "PENDING") {
      return NextResponse.json(
        { error: `Purchase is already ${purchase.status.toLowerCase()}` },
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

    const userRecord = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { email: true, name: true },
    });

    // Tokenize → vault. Prefer cardholder-typed billing for AVS;
    // fall back to account name when an older client didn't send it.
    let vaultResp;
    try {
      const [first, ...rest] = (userRecord?.name || "").split(" ");
      vaultResp = await addCustomerToVault(nmiConfig, {
        paymentToken,
        firstName: billingFirstName || first || undefined,
        lastName: billingLastName || rest.join(" ") || undefined,
        email: userRecord?.email || undefined,
        address1: billingLine1,
        address2: billingLine2,
        city: billingCity,
        state: billingState,
        zip: billingZip,
        country: billingCountry,
      });
    } catch (err) {
      log.error(
        { purchaseId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud vault add error"
      );
      return NextResponse.json(
        { error: "Failed to save card. Please try a different card." },
        { status: 502 }
      );
    }
    if (vaultResp.response !== "1" || !vaultResp.customer_vault_id) {
      log.warn(
        { purchaseId, response: vaultResp.response, text: vaultResp.responsetext },
        "PaymentCloud vault add declined"
      );
      return NextResponse.json(
        { error: vaultResp.responsetext || "Card was declined." },
        { status: 400 }
      );
    }
    const customerVaultId = vaultResp.customer_vault_id;

    // CAS-attach the vault to the purchase. Loser of the race tears
    // down its duplicate vault entry and returns idempotent success.
    const claimedVault = await db.marketplacePurchase.updateMany({
      where: {
        id: purchase.id,
        status: "PENDING",
        nmiCustomerVaultId: null,
      },
      data: { nmiCustomerVaultId: customerVaultId },
    });
    if (claimedVault.count === 0) {
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      const fresh = await db.marketplacePurchase.findUnique({
        where: { id: purchase.id },
        select: { status: true, nmiTransactionId: true },
      });
      return NextResponse.json({
        ok: true,
        purchaseId: purchase.id,
        status: fresh?.status ?? "PENDING",
        alreadyConfirmed: !!fresh?.nmiTransactionId,
      });
    }

    // Sale. Tag as the FIRST sale on the freshly-stored credential
    // (CIT/initial) per Direct Post API "Stored Credentials (CIT/MIT)".
    let saleResp;
    try {
      saleResp = await saleByVaultToken(nmiConfig, {
        amount: Number(purchase.amount),
        customerVaultId,
        orderid: purchase.id,
        orderdescription: `Marketplace purchase: ${purchase.book.title}`,
        email: userRecord?.email || undefined,
        initiatedBy: "customer",
        storedCredentialIndicator: "stored",
      });
    } catch (err) {
      log.error(
        { purchaseId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud marketplace sale error"
      );
      return NextResponse.json(
        { error: "Failed to charge card. Please try again." },
        { status: 502 }
      );
    }

    if (saleResp.response !== "1" || !saleResp.transactionid) {
      // Decline — clean up the vault entry and the partial purchase row.
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      await db.marketplacePurchase.update({
        where: { id: purchase.id },
        data: { nmiCustomerVaultId: null },
      });
      return NextResponse.json(
        { error: saleResp.responsetext || "Card was declined." },
        { status: 400 }
      );
    }

    await db.marketplacePurchase.update({
      where: { id: purchase.id },
      data: {
        status: "COMPLETED",
        nmiTransactionId: saleResp.transactionid,
        transactionId: saleResp.transactionid,
        completedAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    // Bump the book's purchase counter for display.
    await db.marketplaceBook.update({
      where: { id: purchase.bookId },
      data: { purchaseCount: { increment: 1 } },
    }).catch((err: unknown) => log.warn({ err: String(err) }, "purchase count bump failed"));

    return NextResponse.json({
      ok: true,
      purchaseId: purchase.id,
      status: "COMPLETED",
    });
  } catch (err) {
    log.error({ err: String(err) }, "confirm-nmi error");
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
