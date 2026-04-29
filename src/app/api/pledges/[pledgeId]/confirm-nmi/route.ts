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

const log = logger.child({ module: "pledges-confirm-nmi" });

// Phase 2 of the PaymentCloud pledge flow. The browser tokenized the
// card via Collect.js and now POSTs the single-use payment_token here.
// We exchange it for a Customer Vault id and either:
//   - AoN: keep the pledge PENDING and let the charge-on-success cron
//     run the sale when the campaign hits its goal
//   - KIA: run the sale now and mark the pledge COMPLETED

const bodySchema = z.object({
  paymentToken: z.string().min(1).max(200),
  // Billing fields collected on the pledge form. Used for AVS on the
  // sale + stored on the Customer Vault so future re-charges (chargeback
  // recoup, retries) carry consistent CIT/MIT context. Optional so old
  // clients still work, but every new browser submit sends them.
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
    } = parse.data;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            campaignType: true,
            paymentProcessor: true,
          },
        },
      },
    });
    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pledge.paymentProcessor !== "NMI") {
      return NextResponse.json(
        { error: "Pledge is not on PaymentCloud" },
        { status: 400 }
      );
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: `Pledge is already ${pledge.status.toLowerCase()}` },
        { status: 400 }
      );
    }
    if (pledge.nmiCustomerVaultId) {
      // Idempotency guard — already tokenized; client may be retrying.
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        chargedImmediately: pledge.chargedImmediately,
        status: pledge.status,
        alreadyConfirmed: true,
      });
    }

    const nmiConfig = await loadNmiConfig();
    if (!nmiConfig) {
      log.error({ pledgeId }, "PaymentCloud not configured");
      return NextResponse.json(
        { error: "Payment processor not configured. Please contact support." },
        { status: 502 }
      );
    }

    const userRecord = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { email: true, name: true },
    });
    const shippingAddress = pledge.shippingAddress as
      | {
          name?: string;
          address1?: string;
          city?: string;
          state?: string;
          zip?: string;
          country?: string;
        }
      | null;

    let vaultResp;
    try {
      // Prefer billing fields the cardholder typed on the form. Fall
      // back to shipping / account name only when an older client (or
      // a retry of an old request) didn't send them.
      const [acctFirst, ...acctLastParts] = (userRecord?.name || "").split(" ");
      const shipName = shippingAddress?.name || "";
      const [shipFirst, ...shipLastParts] = shipName.split(" ");
      vaultResp = await addCustomerToVault(nmiConfig, {
        paymentToken,
        firstName: billingFirstName || shipFirst || acctFirst || undefined,
        lastName:
          billingLastName ||
          shipLastParts.join(" ") ||
          acctLastParts.join(" ") ||
          undefined,
        email: userRecord?.email || undefined,
        address1: billingLine1 || shippingAddress?.address1,
        address2: billingLine2,
        city: billingCity || shippingAddress?.city,
        state: billingState || shippingAddress?.state,
        zip: billingZip || shippingAddress?.zip,
        country: billingCountry || shippingAddress?.country,
      });
    } catch (err) {
      log.error(
        { pledgeId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud vault add error"
      );
      return NextResponse.json(
        { error: "Failed to save card. Please try a different card or contact support." },
        { status: 502 }
      );
    }

    if (vaultResp.response !== "1" || !vaultResp.customer_vault_id) {
      // Log the full raw response so we can see exactly which fields
      // NMI returned. We've hit a case where response=1 ("Customer
      // Added") came back without a customer_vault_id key — likely a
      // PaymentCloud white-label difference in field naming.
      log.warn(
        {
          pledgeId,
          response: vaultResp.response,
          text: vaultResp.responsetext,
          rawKeys: Object.keys(vaultResp.raw),
          raw: vaultResp.raw,
        },
        "PaymentCloud vault add declined"
      );
      return NextResponse.json(
        { error: vaultResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }
    const customerVaultId = vaultResp.customer_vault_id;

    // CAS-update: only attach this vault id if the pledge is still
    // PENDING with a null vault id. If the user double-tapped or two
    // network retries reached the server in parallel, the second one
    // loses this guard and we delete the vault entry it just created
    // so we don't leak orphans inside PaymentCloud's vault.
    const claimed = await db.pledge.updateMany({
      where: {
        id: pledge.id,
        status: "PENDING",
        nmiCustomerVaultId: null,
        deletedAt: null,
      },
      data: { nmiCustomerVaultId: customerVaultId },
    });
    if (claimed.count === 0) {
      // Lost the race — another request already saved a vault entry
      // for this pledge. Tear down the duplicate vault we just created
      // and report success so the client doesn't see a confusing error.
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      const fresh = await db.pledge.findUnique({
        where: { id: pledge.id },
        select: { status: true, chargedImmediately: true },
      });
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        chargedImmediately: !!fresh?.chargedImmediately,
        status: fresh?.status ?? "PENDING",
        alreadyConfirmed: true,
      });
    }

    const isKeepItAll = pledge.project.campaignType === "KEEP_IT_ALL";
    if (!isKeepItAll) {
      // AoN — defer the sale to the charge-on-success cron.
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        chargedImmediately: false,
        status: "PENDING",
      });
    }

    // KIA: claim the COMPLETED transition before running the sale so
    // a duplicate concurrent confirm-nmi can't sell the same vault
    // twice. We flip chargedImmediately=true while still PENDING; the
    // sale call below either flips to COMPLETED on success or rolls
    // back chargedImmediately=false on decline.
    const charging = await db.pledge.updateMany({
      where: {
        id: pledge.id,
        status: "PENDING",
        chargedImmediately: false,
        nmiTransactionId: null,
        deletedAt: null,
      },
      data: { chargedImmediately: true },
    });
    if (charging.count === 0) {
      // Another request beat us to the charge — return whatever the
      // pledge looks like now so the client can move on.
      const fresh = await db.pledge.findUnique({
        where: { id: pledge.id },
        select: { status: true, chargedImmediately: true },
      });
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        chargedImmediately: !!fresh?.chargedImmediately,
        status: fresh?.status ?? "PENDING",
        alreadyConfirmed: true,
      });
    }

    let saleResp;
    try {
      // Tag this as the FIRST sale on the freshly-stored credential.
      // Per NMI's Direct Post API "Stored Credentials (CIT/MIT)" section
      // (docs/-Direct-Post-API.pdf), the initial transaction that
      // creates the credential-on-file relationship gets initiated_by
      // "customer" + stored_credential_indicator "stored". Subsequent
      // re-charges (chargeback recoup, retries) use initiated_by
      // "merchant" + stored_credential_indicator "used" +
      // initial_transaction_id pointing back to this txn.
      saleResp = await saleByVaultToken(nmiConfig, {
        amount: Number(pledge.amount),
        customerVaultId,
        orderid: pledge.id,
        orderdescription: `Pledge to ${pledge.project.title}`,
        email: userRecord?.email || undefined,
        initiatedBy: "customer",
        storedCredentialIndicator: "stored",
      });
    } catch (err) {
      log.error(
        { pledgeId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud KIA sale error"
      );
      // Roll back the chargedImmediately claim so a retry can run.
      await db.pledge
        .updateMany({
          where: { id: pledge.id, status: "PENDING", chargedImmediately: true, nmiTransactionId: null },
          data: { chargedImmediately: false },
        })
        .catch(() => null);
      return NextResponse.json(
        { error: "Failed to charge card. Please try again or contact support." },
        { status: 502 }
      );
    }

    if (saleResp.response !== "1" || !saleResp.transactionid) {
      // Decline — clean up the vault entry so the user can retry with a
      // different card without leaking saved cards. Roll back the claim.
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING", chargedImmediately: true, nmiTransactionId: null },
        data: { chargedImmediately: false, nmiCustomerVaultId: null },
      });
      return NextResponse.json(
        { error: saleResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }

    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        status: "COMPLETED",
        nmiTransactionId: saleResp.transactionid,
        nmiInitialTransactionId: saleResp.transactionid,
      },
    });

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      chargedImmediately: true,
      status: "COMPLETED",
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "confirm-nmi error"
    );
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
