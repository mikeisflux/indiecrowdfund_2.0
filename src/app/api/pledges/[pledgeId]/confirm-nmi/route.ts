import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { NMI_DISABLED, NMI_DISABLED_MESSAGE } from "@/lib/features";
import {
  loadNmiConfig,
  addCustomerToVault,
  saleByPaymentToken,
} from "@/lib/nmi";
import { finalizeNmiPledge } from "@/lib/payments/nmi/finalize-pledge";

const log = logger.child({ module: "pledges-confirm-nmi" });

// Phase 2 of the PaymentCloud pledge flow. The browser tokenized the
// card via Collect.js and now POSTs the single-use payment_token here.
// What we do with it depends on the campaign type:
//   - KIA: run the sale immediately against the payment_token, mark
//     the pledge COMPLETED. No vault entry — cardholder is present
//     and we never need to re-charge this card.
//   - AoN: store the card in the Customer Vault now and let the
//     charge-on-success cron run the sale when the campaign hits
//     its goal. Vault is required because the cardholder won't be
//     present at charge time.

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
  // Rail disabled — PaymentCloud merchant account was cancelled.
  // Refuse all new confirms; existing PENDING vault-saved pledges
  // can't be charged to a dead merchant.
  if (NMI_DISABLED) {
    return NextResponse.json({ error: NMI_DISABLED_MESSAGE }, { status: 503 });
  }
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
        { error: "Pledge is not on Mentom Payments" },
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

    // Prefer billing fields the cardholder typed on the form. Fall
    // back to shipping / account name only when an older client (or
    // a retry of an old request) didn't send them.
    const [acctFirst, ...acctLastParts] = (userRecord?.name || "").split(" ");
    const shipName = shippingAddress?.name || "";
    const [shipFirst, ...shipLastParts] = shipName.split(" ");
    const firstName = billingFirstName || shipFirst || acctFirst || undefined;
    const lastName =
      billingLastName ||
      shipLastParts.join(" ") ||
      acctLastParts.join(" ") ||
      undefined;
    const address1 = billingLine1 || shippingAddress?.address1;
    const address2 = billingLine2;
    const city = billingCity || shippingAddress?.city;
    const state = billingState || shippingAddress?.state;
    const zip = billingZip || shippingAddress?.zip;
    const country = billingCountry || shippingAddress?.country;

    const isKeepItAll = pledge.project.campaignType === "KEEP_IT_ALL";

    if (isKeepItAll) {
      // KIA: charge the payment_token directly. No vault entry — the
      // cardholder is present and we'll never re-charge this card, so
      // storing a credential-on-file would just burn the per-txn
      // Vault fee.

      // CAS-claim the COMPLETED transition before running the sale so
      // a duplicate concurrent confirm-nmi can't double-charge.
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
        saleResp = await saleByPaymentToken(nmiConfig, {
          amount: Number(pledge.amount),
          paymentToken,
          orderid: pledge.id,
          orderdescription: `Pledge to ${pledge.project.title}`,
          email: userRecord?.email || undefined,
          firstName,
          lastName,
          address1,
          address2,
          city,
          state,
          zip,
          country,
        });
      } catch (err) {
        log.error(
          { pledgeId, err: err instanceof Error ? err.message : String(err) },
          "PaymentCloud KIA sale error"
        );
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
        log.warn(
          {
            pledgeId,
            response: saleResp.response,
            text: saleResp.responsetext,
            rawKeys: Object.keys(saleResp.raw),
          },
          "PaymentCloud KIA sale declined"
        );
        await db.pledge.updateMany({
          where: { id: pledge.id, status: "PENDING", chargedImmediately: true, nmiTransactionId: null },
          data: { chargedImmediately: false },
        });
        return NextResponse.json(
          { error: saleResp.responsetext || "Card was declined. Please try a different card." },
          { status: 400 }
        );
      }

      // CAS guard the transition to COMPLETED so a duplicate confirm
      // (rapid double-click, retry after timeout) can't trigger the
      // post-completion side effects twice.
      const transitioned = await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING" },
        data: {
          status: "COMPLETED",
          nmiTransactionId: saleResp.transactionid,
          nmiInitialTransactionId: saleResp.transactionid,
        },
      });

      if (transitioned.count > 0) {
        // Bump Project.currentAmount + backerCount, claim reward +
        // addon slots, assign backer number, fire creator notification.
        // Skipped (intentionally) on a no-op CAS — that means another
        // request already finalized this pledge.
        await finalizeNmiPledge(pledge.id);
      }

      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        chargedImmediately: true,
        status: "COMPLETED",
      });
    }

    // AoN: store the card in the Customer Vault now; the
    // charge-on-success cron will run the sale when the campaign
    // hits its goal. We mint our own customer_vault_id because
    // PaymentCloud's white-label doesn't echo NMI's auto-generated
    // id back on add_customer responses (observed: response=1
    // "Customer Added" with no customer_vault_id field present).
    // CAS-claim the vault id atomically BEFORE the gateway call
    // so a concurrent retry can't create two vault entries.
    const customerVaultId = pledge.id;
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

    let vaultResp;
    try {
      vaultResp = await addCustomerToVault(nmiConfig, {
        paymentToken,
        customerVaultId,
        firstName,
        lastName,
        email: userRecord?.email || undefined,
        address1,
        address2,
        city,
        state,
        zip,
        country,
      });
    } catch (err) {
      log.error(
        { pledgeId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud vault add error"
      );
      await db.pledge
        .updateMany({
          where: { id: pledge.id, status: "PENDING", nmiCustomerVaultId: customerVaultId },
          data: { nmiCustomerVaultId: null },
        })
        .catch(() => null);
      return NextResponse.json(
        { error: "Failed to save card. Please try a different card or contact support." },
        { status: 502 }
      );
    }

    if (vaultResp.response !== "1") {
      // "Customer Vault id already exists" recovery: a prior attempt
      // may have succeeded at PaymentCloud but the response was lost
      // to a network blip — we rolled back nmiCustomerVaultId locally
      // so the CAS just succeeded again with the same minted id
      // (pledge.id), but the vault entry is still on the gateway side.
      // NMI's add_customer with a duplicate id returns response=3
      // ("Failed") with responsetext containing "exists" / "duplicate".
      // Treat that as success — the vault entry IS there with our id,
      // which is all the AoN cron needs to charge it later.
      const text = (vaultResp.responsetext || "").toLowerCase();
      const looksLikeDuplicateVault =
        text.includes("vault") && (text.includes("exist") || text.includes("duplicate"));
      if (looksLikeDuplicateVault) {
        log.warn(
          { pledgeId, response: vaultResp.response, text: vaultResp.responsetext },
          "PaymentCloud vault add returned duplicate-id error; treating as recovered (vault entry already on gateway from prior attempt)"
        );
        return NextResponse.json({
          ok: true,
          pledgeId: pledge.id,
          chargedImmediately: false,
          status: "PENDING",
          recovered: true,
        });
      }
      log.warn(
        {
          pledgeId,
          response: vaultResp.response,
          text: vaultResp.responsetext,
          rawKeys: Object.keys(vaultResp.raw),
        },
        "PaymentCloud vault add declined"
      );
      await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING", nmiCustomerVaultId: customerVaultId },
        data: { nmiCustomerVaultId: null },
      });
      return NextResponse.json(
        { error: vaultResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      chargedImmediately: false,
      status: "PENDING",
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
