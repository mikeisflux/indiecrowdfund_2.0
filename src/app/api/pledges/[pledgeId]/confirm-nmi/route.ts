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
    const { paymentToken } = parse.data;

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
      const [acctFirst, ...acctLastParts] = (userRecord?.name || "").split(" ");
      const shipName = shippingAddress?.name || "";
      const [shipFirst, ...shipLastParts] = shipName.split(" ");
      vaultResp = await addCustomerToVault(nmiConfig, {
        paymentToken,
        firstName: shipFirst || acctFirst || undefined,
        lastName: shipLastParts.join(" ") || acctLastParts.join(" ") || undefined,
        email: userRecord?.email || undefined,
        address1: shippingAddress?.address1,
        city: shippingAddress?.city,
        state: shippingAddress?.state,
        zip: shippingAddress?.zip,
        country: shippingAddress?.country,
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
      log.warn(
        { pledgeId, response: vaultResp.response, text: vaultResp.responsetext },
        "PaymentCloud vault add declined"
      );
      return NextResponse.json(
        { error: vaultResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }
    const customerVaultId = vaultResp.customer_vault_id;
    await db.pledge.update({
      where: { id: pledge.id },
      data: { nmiCustomerVaultId: customerVaultId },
    });

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

    let saleResp;
    try {
      saleResp = await saleByVaultToken(nmiConfig, {
        amount: Number(pledge.amount),
        customerVaultId,
        orderid: pledge.id,
        orderdescription: `Pledge to ${pledge.project.title}`,
        email: userRecord?.email || undefined,
      });
    } catch (err) {
      log.error(
        { pledgeId, err: err instanceof Error ? err.message : String(err) },
        "PaymentCloud KIA sale error"
      );
      // Card got vaulted but charge failed; vault id stays so user can retry
      // via support without re-entering the card. Pledge stays PENDING.
      return NextResponse.json(
        { error: "Failed to charge card. Please try again or contact support." },
        { status: 502 }
      );
    }

    if (saleResp.response !== "1" || !saleResp.transactionid) {
      // Decline — clean up the vault entry so the user can retry with a
      // different card without leaking saved cards.
      await deleteVaultCustomer(nmiConfig, customerVaultId).catch(() => null);
      await db.pledge.update({
        where: { id: pledge.id },
        data: { nmiCustomerVaultId: null },
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
        chargedImmediately: true,
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
