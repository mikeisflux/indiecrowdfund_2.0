import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import {
  chargeDcSavedPaymentMethod,
  lookupDcPayment,
} from "@/lib/payments/divinitycoin/saved-cards";
import { createNotification } from "@/lib/notifications/core";
import { isValidCustomerIp, type CustomerOrigin } from "@/lib/payments/customer-origin";
import {
  sendChargebackRecoupChargedEmail,
  sendChargebackRecoupFailedEmail,
} from "@/lib/email/email-templates-misc";

const log = logger.child({ module: "chargeback-recoup" });

// Recouping a chargeback from the creator's protection card.
//
// When a backer's bank claws a pledge back, the platform has already paid
// or owes that money to the creator. The creator agreed at launch that
// their protection card covers it. This module charges that card the way
// we charge backers' saved cards: off-session, against the token DC vaulted
// after verifying the card and its CVC at save time. No card data is
// handled here.
//
// Lifecycle of a ChargebackRecoup row:
//   PENDING   → created by applyChargeback; charge attempted immediately
//   CHARGED   → DC confirmed the charge (terminal)
//   FAILED    → declined / no card / DC down; retried on a backoff schedule
//   HELD_BACK → retries exhausted; the amount is withheld from payouts instead
//   WAIVED    → an admin decided not to collect (terminal)

/**
 * Dispute fee passed through to the creator, on top of the disputed amount.
 * $20 per dispute (platform policy). CHARGEBACK_RECOUP_FEE in .env overrides.
 */
export const CHARGEBACK_RECOUP_FEE_USD = Math.max(
  0,
  Number(process.env.CHARGEBACK_RECOUP_FEE ?? "20") || 20
);

const MAX_ATTEMPTS = 5;
// 1 day, 3 days, 7 days, 14 days between retries.
const BACKOFF_DAYS = [1, 3, 7, 14];

const OUTSTANDING_STATUSES = ["PENDING", "FAILED", "HELD_BACK"] as const;

export interface VaultedChargebackCard {
  cardId: string;
  creatorId: string;
  paymentMethodId: string;
  cardBrand: string | null;
  cardLastFour: string;
  /** Where the card was entered — sent to DC as the customer origin. */
  origin: CustomerOrigin;
}

/**
 * The project's chargeback card, only if it is chargeable through DC.
 * Legacy rows (encrypted PAN, or a PaymentCloud vault id from the
 * decommissioned processor) return null: nothing can charge those.
 */
export async function resolveVaultedChargebackCard(
  projectId: string
): Promise<VaultedChargebackCard | null> {
  const card = await db.creatorChargebackCard.findUnique({
    where: { projectId },
    select: {
      id: true,
      divinityCoinPaymentMethodId: true,
      cardBrand: true,
      cardLastFour: true,
      savedFromIp: true,
      savedFromUserAgent: true,
      project: { select: { creatorId: true } },
    },
  });
  if (!card?.divinityCoinPaymentMethodId) return null;
  return {
    cardId: card.id,
    creatorId: card.project.creatorId,
    paymentMethodId: card.divinityCoinPaymentMethodId,
    cardBrand: card.cardBrand,
    cardLastFour: card.cardLastFour,
    origin: {
      ...(isValidCustomerIp(card.savedFromIp) ? { customerIpAddress: card.savedFromIp } : {}),
      ...(card.savedFromUserAgent ? { customerUserAgent: card.savedFromUserAgent } : {}),
    },
  };
}

/** Sum still owed by the creator for this project: withheld from payouts. */
export async function outstandingRecoupTotal(projectId: string): Promise<number> {
  const rows = await db.chargebackRecoup.findMany({
    where: { projectId, status: { in: [...OUTSTANDING_STATUSES] } },
    select: { amount: true },
  });
  return Math.round(rows.reduce((sum: number, r: { amount: unknown }) => sum + Number(r.amount), 0) * 100) / 100;
}

/**
 * Open a recoup for a disputed pledge and try to collect it right away.
 * Idempotent per (pledge, dispute): a redelivered dispute webhook finds the
 * existing row instead of charging the creator twice.
 */
export async function openChargebackRecoup(params: {
  pledgeId: string;
  projectId: string;
  disputedAmount: number;
  processor: string;
  disputeId?: string | null;
  reason?: string | null;
}): Promise<{ recoupId: string; created: boolean }> {
  const idempotencyKey = `recoup:${params.pledgeId}:${params.disputeId || "manual"}`;
  const existing = await db.chargebackRecoup.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return { recoupId: existing.id, created: false };

  const project = await db.project.findFirst({
    where: { id: params.projectId },
    select: { creatorId: true },
  });
  if (!project) throw new Error(`Project ${params.projectId} not found`);

  const disputed = Math.round(params.disputedAmount * 100) / 100;
  const fee = CHARGEBACK_RECOUP_FEE_USD;
  const row = await db.chargebackRecoup.create({
    data: {
      projectId: params.projectId,
      pledgeId: params.pledgeId,
      creatorId: project.creatorId,
      disputeId: params.disputeId || null,
      processor: params.processor,
      reason: params.reason || null,
      disputedAmount: disputed,
      feeAmount: fee,
      amount: Math.round((disputed + fee) * 100) / 100,
      idempotencyKey,
      status: "PENDING",
    },
    select: { id: true },
  });

  await attemptRecoupCharge(row.id).catch((err) =>
    log.error({ err: formatError(err), recoupId: row.id }, "Initial recoup attempt threw")
  );
  return { recoupId: row.id, created: true };
}

function nextBackoff(attempts: number): Date {
  const days = BACKOFF_DAYS[Math.min(attempts - 1, BACKOFF_DAYS.length - 1)];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

interface RecoupContext {
  projectTitle: string;
  creatorEmail: string | null;
  creatorName: string | null;
  backerLabel: string;
}

async function loadContext(projectId: string, pledgeId: string): Promise<RecoupContext> {
  const [project, pledge] = await Promise.all([
    db.project.findFirst({
      where: { id: projectId },
      select: { title: true, creator: { select: { email: true, name: true } } },
    }),
    db.pledge.findFirst({ where: { id: pledgeId }, select: { backerNumber: true } }),
  ]);
  return {
    projectTitle: project?.title || "your campaign",
    creatorEmail: project?.creator.email ?? null,
    creatorName: project?.creator.name ?? null,
    backerLabel: pledge?.backerNumber ? `Backer #${pledge.backerNumber}` : "a backer",
  };
}

/**
 * Charge (or re-charge) one recoup. Safe to call from the webhook, the
 * retry cron, the admin "Charge now" button, and the moment a creator
 * re-enters their card. Every path funnels through here so the
 * idempotency key and the attempt counter stay consistent.
 */
export async function attemptRecoupCharge(
  recoupId: string,
  opts: { actorId?: string; force?: boolean } = {}
): Promise<{ status: string; error?: string }> {
  const recoup = await db.chargebackRecoup.findUnique({ where: { id: recoupId } });
  if (!recoup) return { status: "missing", error: "Recoup not found" };
  if (recoup.status === "CHARGED" || recoup.status === "WAIVED") {
    return { status: recoup.status };
  }
  if (recoup.status === "HELD_BACK" && !opts.force) {
    return { status: "HELD_BACK", error: "Retries exhausted; amount is withheld from payouts" };
  }

  const amountCents = Math.round(Number(recoup.amount) * 100);
  const ctx = await loadContext(recoup.projectId, recoup.pledgeId);

  // A retry after a network-uncertain attempt must not double-charge. DC
  // keeps idempotency keys for 24h; past that, check DC's record for a
  // succeeded charge matching this recoup before charging again.
  if (recoup.attempts > 0) {
    const lookup = await lookupDcPayment(recoup.pledgeId);
    if (lookup.success) {
      const prior = lookup.attempts.find(
        (a) =>
          a.status === "succeeded" &&
          Number(a.amount) === amountCents &&
          (!a.createdAt || new Date(a.createdAt) >= recoup.createdAt)
      );
      if (prior?.paymentIntentId) {
        await markRecoupCharged(recoup.id, prior.paymentIntentId, ctx);
        return { status: "CHARGED" };
      }
    }
  }

  const card = await resolveVaultedChargebackCard(recoup.projectId);
  if (!card) {
    return await recordFailure(recoup.id, recoup.attempts, "No verified chargeback card on file", ctx, recoup);
  }

  const result = await chargeDcSavedPaymentMethod({
    platformUserId: card.creatorId,
    paymentMethodId: card.paymentMethodId,
    amount: amountCents,
    pledgeId: recoup.pledgeId,
    idempotencyKey: recoup.idempotencyKey,
    projectId: recoup.projectId,
    description: `Chargeback recoup — ${ctx.projectTitle} (${ctx.backerLabel}${recoup.disputeId ? `, ${recoup.disputeId}` : ""})`,
    statement_descriptor: "ICF CHARGEBACK",
    ...card.origin,
  });

  if (result.success && result.status !== "failed") {
    await markRecoupCharged(recoup.id, result.paymentIntentId || null, ctx);
    if (opts.actorId) {
      log.info({ recoupId, actorId: opts.actorId }, "Recoup charged by admin");
    }
    return { status: "CHARGED" };
  }

  const reason =
    result.declineCode || result.code || result.error || "Card declined";
  return await recordFailure(recoup.id, recoup.attempts, reason, ctx, recoup);
}

async function markRecoupCharged(
  recoupId: string,
  paymentIntentId: string | null,
  ctx: RecoupContext
): Promise<void> {
  const updated = await db.chargebackRecoup.updateMany({
    where: { id: recoupId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    data: {
      status: "CHARGED",
      chargedAt: new Date(),
      divinityCoinPaymentId: paymentIntentId,
      lastError: null,
      nextAttemptAt: null,
      attempts: { increment: 1 },
    },
  });
  if (updated.count === 0) return;

  const recoup = await db.chargebackRecoup.findUnique({ where: { id: recoupId } });
  if (!recoup) return;

  await createNotification({
    userId: recoup.creatorId,
    type: "CHARGEBACK_RECOUPED",
    title: "Chargeback recouped from your protection card",
    message: `$${Number(recoup.amount).toFixed(2)} was charged to your chargeback protection card for a dispute on "${ctx.projectTitle}" (${ctx.backerLabel}).`,
    actionUrl: "/dashboard",
    projectId: recoup.projectId,
  }).catch(() => {});

  if (ctx.creatorEmail) {
    await sendChargebackRecoupChargedEmail({
      email: ctx.creatorEmail,
      creatorName: ctx.creatorName || "there",
      projectTitle: ctx.projectTitle,
      backerLabel: ctx.backerLabel,
      disputedAmount: Number(recoup.disputedAmount),
      feeAmount: Number(recoup.feeAmount),
      total: Number(recoup.amount),
      reason: recoup.reason,
    }).catch((err) => log.warn({ err: String(err), recoupId }, "recoup charged email failed"));
  }
  log.info({ recoupId, paymentIntentId, amount: Number(recoup.amount) }, "Chargeback recouped");
}

async function recordFailure(
  recoupId: string,
  priorAttempts: number,
  reason: string,
  ctx: RecoupContext,
  recoup: { creatorId: string; projectId: string; amount: unknown; disputedAmount: unknown; feeAmount: unknown; disputeId: string | null }
): Promise<{ status: string; error: string }> {
  const attempts = priorAttempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  await db.chargebackRecoup.update({
    where: { id: recoupId },
    data: {
      status: exhausted ? "HELD_BACK" : "FAILED",
      attempts,
      lastError: reason.slice(0, 500),
      nextAttemptAt: exhausted ? null : nextBackoff(attempts),
      heldBackAt: exhausted ? new Date() : undefined,
    },
  });

  // Tell the creator on the first failure and when we give up. Every
  // intermediate retry failing would just be noise.
  if (attempts === 1 || exhausted) {
    await createNotification({
      userId: recoup.creatorId,
      type: "CHARGEBACK_RECEIVED",
      title: exhausted
        ? "Chargeback amount will be withheld from your payout"
        : "Action needed: chargeback recoup failed",
      message: exhausted
        ? `We couldn't collect $${Number(recoup.amount).toFixed(2)} for a dispute on "${ctx.projectTitle}" from your protection card. It will be deducted from your next payout.`
        : `A dispute on "${ctx.projectTitle}" (${ctx.backerLabel}) could not be charged to your protection card: ${reason}. Update your card so we can collect $${Number(recoup.amount).toFixed(2)}.`,
      actionUrl: "/dashboard",
      projectId: recoup.projectId,
    }).catch(() => {});

    if (ctx.creatorEmail) {
      await sendChargebackRecoupFailedEmail({
        email: ctx.creatorEmail,
        creatorName: ctx.creatorName || "there",
        projectTitle: ctx.projectTitle,
        backerLabel: ctx.backerLabel,
        total: Number(recoup.amount),
        reason,
        heldBack: exhausted,
      }).catch((err) => log.warn({ err: String(err), recoupId }, "recoup failed email failed"));
    }
  }

  log.warn({ recoupId, attempts, reason, exhausted }, "Chargeback recoup attempt failed");
  return { status: exhausted ? "HELD_BACK" : "FAILED", error: reason };
}

/**
 * Called from the DC payment.succeeded webhook when the pledge is already
 * CHARGEBACK: that payment is a recoup charge landing asynchronously
 * (or one whose synchronous response we lost). Match it to the open row.
 */
export async function markRecoupChargedByPayment(
  pledgeId: string,
  paymentIntentId: string | null | undefined,
  amountCents: number | null | undefined
): Promise<boolean> {
  const open = await db.chargebackRecoup.findFirst({
    where: { pledgeId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!open) return false;
  if (amountCents != null && Math.round(Number(open.amount) * 100) !== amountCents) return false;
  const ctx = await loadContext(open.projectId, open.pledgeId);
  await markRecoupCharged(open.id, paymentIntentId || null, ctx);
  return true;
}

/** Re-run every open recoup for a project — used the moment a creator saves a new card. */
export async function retryOpenRecoupsForProject(projectId: string): Promise<number> {
  const open = await db.chargebackRecoup.findMany({
    where: { projectId, status: { in: ["FAILED", "HELD_BACK"] } },
    select: { id: true },
  });
  let charged = 0;
  for (const r of open) {
    const res = await attemptRecoupCharge(r.id, { force: true }).catch(() => ({ status: "error" }));
    if (res.status === "CHARGED") charged++;
  }
  return charged;
}

export async function waiveRecoup(recoupId: string, adminId: string, reason: string): Promise<boolean> {
  const res = await db.chargebackRecoup.updateMany({
    where: { id: recoupId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    data: { status: "WAIVED", waivedAt: new Date(), waivedById: adminId, waivedReason: reason.slice(0, 500) },
  });
  return res.count > 0;
}
