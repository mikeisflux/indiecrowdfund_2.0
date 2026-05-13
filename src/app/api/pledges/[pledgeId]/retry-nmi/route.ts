import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { NMI_DISABLED, NMI_DISABLED_MESSAGE } from "@/lib/features";
import {
  loadNmiConfig,
  saleByPaymentToken,
  addCustomerToVault,
} from "@/lib/nmi";
import { finalizeNmiPledge } from "@/lib/payments/nmi/finalize-pledge";

const log = logger.child({ module: "pledges-retry-nmi" });

// Self-service retry for a backer whose NMI charge failed at funded-
// campaign time. The user revisits a "Retry Payment" page, tokenizes
// a new card via Collect.js, and POSTs here. We do an immediate sale
// against the new payment_token (campaign is past funding, no need to
// defer the charge), and on success transition the SAME pledge row to
// COMPLETED — preserving reward selection, addons, survey responses,
// backer number, everything. No duplicate pledge is created.
//
// Authorization: only the pledge owner can retry. Status must be
// PENDING (mid-retry-window) or FAILED (cron gave up after 5 attempts).
// COMPLETED pledges can't be re-charged — the original sale already
// went through and the pledge owner shouldn't be at this URL.

const bodySchema = z.object({
  paymentToken: z.string().min(1).max(200),
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
  // Rail disabled — no point pushing the user through a Collect.js
  // retry when the receiving merchant is dead. Refuse the POST so
  // the dashboard banner stops surfacing the retry CTA too.
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
          select: { id: true, title: true, paymentProcessor: true },
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
        { error: "This pledge is not on Mentom Payments" },
        { status: 400 }
      );
    }
    if (pledge.status === "COMPLETED") {
      return NextResponse.json(
        { error: "This pledge has already been paid" },
        { status: 400 }
      );
    }
    if (pledge.status !== "PENDING" && pledge.status !== "FAILED") {
      return NextResponse.json(
        { error: `Pledge is in ${pledge.status.toLowerCase()} state and can't be retried` },
        { status: 400 }
      );
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

    // Resolve billing fields. Prefer what the cardholder typed on the
    // retry form. Fall back to the shipping address attached to the
    // pledge (if any) and finally the account name for first/last.
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

    // CAS-claim the retry attempt so a double-click doesn't run two
    // sales in parallel. We bump retryCount to indicate a manual
    // retry occurred, separate from the cron's 5-attempt budget.
    const claim = await db.pledge.updateMany({
      where: { id: pledge.id, status: pledge.status, deletedAt: null },
      data: {
        retryCount: { increment: 1 },
        nextRetryAt: null,
      },
    });
    if (claim.count === 0) {
      return NextResponse.json(
        { error: "Pledge state changed during retry. Please refresh and try again." },
        { status: 409 }
      );
    }

    let saleResp;
    try {
      saleResp = await saleByPaymentToken(nmiConfig, {
        amount: Number(pledge.amount),
        paymentToken,
        orderid: pledge.id,
        orderdescription: `Pledge to ${pledge.project.title} (manual retry)`,
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
        "PaymentCloud retry sale error"
      );
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
        },
        "PaymentCloud retry sale declined"
      );
      // Record the failure reason on the pledge so the page can show
      // it on next load (e.g. "Card declined: insufficient funds").
      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          lastFailureReason: saleResp.responsetext || "Card was declined",
        },
      });
      return NextResponse.json(
        { error: saleResp.responsetext || "Card was declined. Please try a different card." },
        { status: 400 }
      );
    }

    // Sale succeeded. Vault the new card so future re-charges (e.g.
    // chargeback recoup) have a credential on file, then transition
    // the pledge to COMPLETED with the same finalize side effects
    // the cron uses (project counters, reward slots, backer number,
    // creator notification). Same pledge row — no data loss.
    const newVaultId = pledge.id;
    try {
      await addCustomerToVault(nmiConfig, {
        paymentToken,
        customerVaultId: newVaultId,
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
    } catch (vaultErr) {
      // Non-fatal — the sale already went through. Vault add is a
      // future-proofing step; log and continue.
      log.warn(
        { pledgeId, err: vaultErr instanceof Error ? vaultErr.message : String(vaultErr) },
        "Vault add failed during retry (sale already succeeded — non-fatal)"
      );
    }

    const transitioned = await db.pledge.updateMany({
      where: { id: pledge.id, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "COMPLETED",
        nmiTransactionId: saleResp.transactionid,
        nmiInitialTransactionId: saleResp.transactionid,
        nmiCustomerVaultId: newVaultId,
        chargedImmediately: true,
        retryCount: 0,
        nextRetryAt: null,
        lastFailureReason: null,
      },
    });

    if (transitioned.count > 0) {
      await finalizeNmiPledge(pledge.id);
    }

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      status: "COMPLETED",
      transactionId: saleResp.transactionid,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "retry-nmi error"
    );
    return NextResponse.json(
      { error: "Failed to process retry" },
      { status: 500 }
    );
  }
}

// GET — return the data the retry page needs (pledge summary, public
// Collect.js key, current failure reason). Auth-gated to the owner.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  if (NMI_DISABLED) {
    return NextResponse.json({ error: NMI_DISABLED_MESSAGE, canRetry: false }, { status: 503 });
  }
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            paymentProcessor: true,
            creator: { select: { vanityUrl: true } },
          },
        },
        reward: { select: { id: true, title: true, amount: true } },
        addons: {
          include: {
            addon: { select: { id: true, title: true, amount: true } },
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
        { error: "This pledge is not on Mentom Payments" },
        { status: 400 }
      );
    }

    const config = await loadNmiConfig();
    if (!config?.publicKey) {
      return NextResponse.json(
        { error: "Payment processor not configured" },
        { status: 502 }
      );
    }

    const projectPath = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        status: pledge.status,
        lastFailureReason: pledge.lastFailureReason,
        retryCount: pledge.retryCount,
        rewardTitle: pledge.reward?.title || null,
        rewardAmount: pledge.reward ? Number(pledge.reward.amount) : 0,
        addons: pledge.addons.map((a: { addon: { title: string }; quantity: number; amount: unknown }) => ({
          title: a.addon.title,
          quantity: a.quantity,
          amount: Number(a.amount),
        })),
        shippingAmount: Number(pledge.shippingAmount || 0),
      },
      project: {
        id: pledge.project.id,
        title: pledge.project.title,
        url: projectPath,
      },
      nmiPublicKey: config.publicKey,
      canRetry: pledge.status === "PENDING" || pledge.status === "FAILED",
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "retry-nmi GET error"
    );
    return NextResponse.json(
      { error: "Failed to load retry info" },
      { status: 500 }
    );
  }
}
