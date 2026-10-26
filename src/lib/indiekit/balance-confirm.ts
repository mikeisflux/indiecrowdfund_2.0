import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
// The client module directly, not the package index: payments.ts imports
// this file, and the index re-exports payments.ts.
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin/client";
import { lookupDcPayment } from "@/lib/payments/divinitycoin/saved-cards";
import { verifyWhopUpchargePayment } from "@/lib/payments/whop/upcharge";
import { createNotification } from "@/lib/notifications/core";
import { sendBalancePaidEmail } from "@/lib/email/email-templates-pledge";
import { currentBalanceDue, round2 } from "@/lib/indiekit/balance-request";

const log = logger.child({ module: "indiekit-balance-confirm" });

export type BalanceConfirmStatus =
  | "confirmed" // verified with the processor and credited just now
  | "already" // nothing outstanding; credited earlier
  | "unpaid" // processor does not (yet) report a successful payment
  | "mismatch" // wrong intent or wrong amount for this balance
  | "missing" // no payment reference to verify
  | "unsupported" // campaign processor cannot take balance payments
  | "error";

export interface BalanceConfirmResult {
  status: BalanceConfirmStatus;
  amount?: number;
  error?: string;
}

/**
 * The one place a balance / shipping payment is verified and credited.
 *
 * Reached three ways, and it had better be the same code for all three:
 *  - the pay page's browser call right after the card form succeeds
 *  - the processor's own payment-succeeded webhook
 *  - the reconcile sweep, for payments where neither of the above landed
 *
 * Before this existed only the browser call recorded a payment. A closed
 * tab, a 3-D Secure redirect or one failed request meant the backer was
 * charged and IndieKit kept showing the balance as unpaid.
 */
export async function confirmBalancePayment(opts: {
  pledgeId: string;
  source: "browser" | "dc-webhook" | "whop-webhook" | "sweep";
  /** Intent id the browser claims paid; must match the stored one when both exist. */
  clientIntentId?: string | null;
  /** Intent id the processor's webhook says succeeded; verified before use. */
  webhookIntentId?: string | null;
}): Promise<BalanceConfirmResult> {
  try {
    const pledge = await db.pledge.findFirst({
      where: { id: opts.pledgeId, status: "COMPLETED", deletedAt: null },
      select: {
        id: true,
        projectId: true,
        amount: true,
        rewardAmount: true,
        addonsAmount: true,
        shippingAmount: true,
        metadata: true,
        divinityCoinPaymentId: true,
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: { id: true, title: true, slug: true, paymentProcessor: true, creatorId: true, currency: true, creator: { select: { vanityUrl: true } } },
        },
      },
    });
    if (!pledge) return { status: "error", error: "Pledge not found" };
    const meta = (pledge.metadata as Record<string, unknown>) || {};
    const balanceDue = currentBalanceDue(pledge);
    if (meta.balancePaymentCompletedAt && balanceDue <= 0) return { status: "already", amount: Number(meta.balanceAmountPaid ?? 0) };
    if (balanceDue <= 0) return { status: "already", amount: 0 };

    const processor = pledge.project.paymentProcessor;
    let paymentReference: string;
    let verifiedAmount: number | undefined;

    if (processor === "DIVINITYCOIN") {
      const stored = typeof meta.balanceDivinityCoinPaymentId === "string" ? meta.balanceDivinityCoinPaymentId : null;
      if (stored && opts.clientIntentId && stored !== opts.clientIntentId) {
        log.warn({ pledgeId: pledge.id, stored, client: opts.clientIntentId }, "balance confirm: client intent does not match stored");
        return { status: "mismatch", error: "Payment reference does not match this balance" };
      }
      // The webhook's intent outranks the stored one: the stored id is
      // whichever intent the backer last opened the form with, and a
      // retried card produces a sibling. Both get verified below.
      let intentId = opts.webhookIntentId || stored || opts.clientIntentId || null;
      if (!intentId) {
        // Nothing stored (the pay page lost the id for a while). DC keeps
        // every attempt against the pledge; a succeeded one for exactly
        // this balance, that is not the pledge's original payment and was
        // made after the link went out, is the payment we're looking for.
        intentId = await findBalanceIntentInDcHistory(pledge.id, pledge.divinityCoinPaymentId, balanceDue, meta);
        if (!intentId) return { status: "missing", error: "No payment reference to verify" };
        log.info({ pledgeId: pledge.id, intentId, source: opts.source }, "balance confirm: recovered intent from DC payment history");
      }
      const verify = await callDivinityCoinAPI("verify-payment", { paymentIntentId: intentId });
      if (!verify.success) return { status: "error", error: verify.error || "Could not reach DivinityCoin" };
      if (verify.data?.status !== "succeeded") return { status: "unpaid" };
      const a = (verify.data as { amount?: unknown }).amount;
      if (typeof a === "number") verifiedAmount = a;
      paymentReference = intentId;
    } else if (processor === "WHOP") {
      const checkoutId = typeof meta.balanceWhopCheckoutId === "string" ? meta.balanceWhopCheckoutId : null;
      if (!checkoutId) return { status: "missing", error: "No payment reference to verify" };
      const verify = await verifyWhopUpchargePayment(checkoutId);
      if (!verify.paid) return { status: "unpaid" };
      paymentReference = verify.paymentId || checkoutId;
    } else {
      return { status: "unsupported", error: "This campaign's payment processor cannot take balance payments" };
    }

    // The verified charge has to be FOR this balance. DC reports cents or
    // dollars depending on the action version; accept either.
    if (typeof verifiedAmount === "number") {
      const matchesDollars = Math.abs(verifiedAmount - balanceDue) <= 0.01;
      const matchesCents = Math.abs(verifiedAmount - Math.round(balanceDue * 100)) <= 0.5;
      if (!matchesDollars && !matchesCents) {
        log.warn({ pledgeId: pledge.id, verifiedAmount, balanceDue }, "balance confirm: verified amount does not match balance due");
        return { status: "mismatch", error: "Payment amount does not match the balance due" };
      }
    }

    // Row lock + re-check so two confirmations (browser and webhook racing)
    // credit once.
    const credited = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledge.id} FOR UPDATE`;
      const fresh = await tx.pledge.findFirst({
        where: { id: pledge.id, deletedAt: null },
        select: { metadata: true, amount: true, rewardAmount: true, addonsAmount: true, shippingAmount: true },
      });
      if (!fresh) return false;
      const freshMeta = (fresh.metadata as Record<string, unknown>) || {};
      const due = currentBalanceDue(fresh);
      if (freshMeta.balancePaymentCompletedAt && due <= 0) return false;
      if (due <= 0) return false;
      await tx.pledge.update({
        where: { id: pledge.id },
        data: {
          amount: { increment: due },
          metadata: {
            ...freshMeta,
            balancePaymentCompletedAt: new Date().toISOString(),
            balancePaymentIntentId: paymentReference,
            balancePaymentProcessor: processor,
            balanceAmountPaid: due,
            balanceConfirmedVia: opts.source,
            ...(freshMeta.balanceDue != null ? { balanceDue: Math.max(0, round2(Number(freshMeta.balanceDue) - due)) } : {}),
          },
        },
      });
      await tx.project.update({ where: { id: pledge.projectId }, data: { currentAmount: { increment: due } } });
      // Its own ledger type. Every "was this pledge paid" check reads
      // type PAYMENT rows, so a shipping or balance payment must never
      // be written as one.
      const reasonNow = typeof freshMeta.balanceDueReason === "string" ? freshMeta.balanceDueReason : null;
      await tx.divinityCoinTransaction.create({
        data: {
          userId: pledge.user.id,
          pledgeId: pledge.id,
          amount: due,
          type: reasonNow === "shipping" ? "SHIPPING_PAYMENT" : "BALANCE_PAYMENT",
          description: `${reasonNow === "shipping" ? "Shipping" : "Balance"} payment on "${pledge.project.title}" via ${processor}`,
          metadata: JSON.stringify({
            paymentReference,
            processor,
            confirmedVia: opts.source,
            reason: reasonNow,
            processedAt: new Date().toISOString(),
          }),
        },
      });
      return true;
    });
    if (!credited) return { status: "already", amount: balanceDue };

    log.info({ pledgeId: pledge.id, amount: balanceDue, source: opts.source, paymentReference }, "Balance payment confirmed");

    // Receipt to the backer, heads-up to the creator. Neither may fail the
    // confirmation; the money is recorded above.
    const reason = typeof meta.balanceDueReason === "string" ? meta.balanceDueReason : null;
    const projectPath = pledge.project.creator?.vanityUrl ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}` : `/projects/${pledge.project.slug}`;
    if (pledge.user.email) {
      await sendBalancePaidEmail(pledge.user.email, pledge.user.name || "there", pledge.project.title, balanceDue, reason, projectPath, pledge.project.currency || "USD").catch((err) =>
        log.warn({ err: String(err), pledgeId: pledge.id }, "balance receipt email failed")
      );
    }
    await createNotification({
      userId: pledge.project.creatorId,
      type: "PLEDGE_RECEIVED",
      title: reason === "shipping" ? "Shipping paid" : "Balance paid",
      message: `${pledge.user.name || pledge.user.email || "A backer"} paid $${balanceDue.toFixed(2)} ${reason === "shipping" ? "shipping" : "balance"} on "${pledge.project.title}".`,
      actionUrl: "/dashboard/indiekit",
      projectId: pledge.projectId,
    }).catch(() => {});

    return { status: "confirmed", amount: balanceDue };
  } catch (err) {
    log.error({ err: String(err), pledgeId: opts.pledgeId, source: opts.source }, "confirmBalancePayment failed");
    return { status: "error", error: "Confirmation failed" };
  }
}

async function findBalanceIntentInDcHistory(
  pledgeId: string,
  originalPaymentId: string | null,
  balanceDue: number,
  meta: Record<string, unknown>
): Promise<string | null> {
  const history = await lookupDcPayment(pledgeId);
  if (!history.success) return null;
  const sentAt = typeof meta.balanceNotificationSentAt === "string" ? new Date(meta.balanceNotificationSentAt).getTime() : 0;
  const cents = Math.round(balanceDue * 100);
  const match = history.attempts.find((a) => {
    if (a?.status !== "succeeded" || typeof a.paymentIntentId !== "string") return false;
    if (a.paymentIntentId === originalPaymentId) return false;
    if (typeof a.amount !== "number" || Math.abs(a.amount - cents) > 0.5) return false;
    if (sentAt && typeof a.createdAt === "string") {
      const made = new Date(a.createdAt).getTime();
      // A minute of slack for clock skew between us and DC.
      if (Number.isFinite(made) && made < sentAt - 60_000) return false;
    }
    return true;
  });
  return match?.paymentIntentId ?? null;
}

/**
 * Pledges that were sent a pay link and are still not marked paid. Ones
 * with a stored payment attempt are always checked; ones without (the pay
 * page lost the id for a while, or the backer never opened the form) are
 * checked in a bounded batch no more than every six hours each, so a few
 * hundred open links don't burn DC's rate limit every five minutes.
 */
export async function findUnconfirmedBalancePayments(limit = 100, unreferencedLimit = 30): Promise<string[]> {
  const withRef = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pledge"
    WHERE status = 'COMPLETED'
      AND "deletedAt" IS NULL
      AND metadata->>'balancePaymentToken' IS NOT NULL
      AND metadata->>'balancePaymentCompletedAt' IS NULL
      AND (metadata->>'balanceDivinityCoinPaymentId' IS NOT NULL OR metadata->>'balanceWhopCheckoutId' IS NOT NULL)
      AND metadata->>'balanceNotificationSentAt' IS NOT NULL
      AND (metadata->>'balanceNotificationSentAt')::timestamptz > now() - interval '45 days'
    ORDER BY (metadata->>'balanceNotificationSentAt')::timestamptz DESC
    LIMIT ${limit}
  `;
  const withoutRef = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pledge"
    WHERE status = 'COMPLETED'
      AND "deletedAt" IS NULL
      AND metadata->>'balancePaymentToken' IS NOT NULL
      AND metadata->>'balancePaymentCompletedAt' IS NULL
      AND metadata->>'balanceDivinityCoinPaymentId' IS NULL
      AND metadata->>'balanceWhopCheckoutId' IS NULL
      AND metadata->>'balanceNotificationSentAt' IS NOT NULL
      AND (metadata->>'balanceNotificationSentAt')::timestamptz > now() - interval '45 days'
      AND (metadata->>'balanceSweepCheckedAt' IS NULL OR (metadata->>'balanceSweepCheckedAt')::timestamptz < now() - interval '6 hours')
    ORDER BY (metadata->>'balanceSweepCheckedAt')::timestamptz ASC NULLS FIRST, (metadata->>'balanceNotificationSentAt')::timestamptz ASC
    LIMIT ${unreferencedLimit}
  `;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of [...withRef, ...withoutRef]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      ids.push(r.id);
    }
  }
  return ids;
}

/** Remember that the sweep looked at this pledge, so the unreferenced batch rotates. */
export async function markBalanceSweepChecked(pledgeId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "Pledge"
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{balanceSweepCheckedAt}', to_jsonb(now()::text))
    WHERE id = ${pledgeId}
  `.catch(() => undefined);
}
