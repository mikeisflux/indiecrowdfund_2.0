import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import {
  chargeDcSavedPaymentMethod,
  lookupDcPayment,
} from "@/lib/payments/divinitycoin/saved-cards";
import { createNotification } from "@/lib/notifications/core";
import { loadDcProjectBalance } from "@/lib/payouts/project-balance";
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

const isAdminRole = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";

/**
 * The reconciliation key sent to DC as `pledgeId`. A chargeback recoup
 * uses the disputed pledge; an overpayment recoup has no pledge, so it
 * uses a `recoup:<id>` key that handlePaymentSucceeded recognises.
 */
export function dcPledgeKeyForRecoup(recoup: { id: string; pledgeId: string | null }): string {
  return recoup.pledgeId ?? `recoup:${recoup.id}`;
}

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
    select: { creatorId: true, creator: { select: { role: true } } },
  });
  if (!project) throw new Error(`Project ${params.projectId} not found`);

  // Admin / super-admin owned campaigns are never charged. Their losses
  // are written off from the payouts dialog instead (writeOffProjectBalance).
  if (isAdminRole(project.creator.role)) {
    return { recoupId: "", created: false };
  }

  const disputed = Math.round(params.disputedAmount * 100) / 100;
  const fee = CHARGEBACK_RECOUP_FEE_USD;
  const row = await db.chargebackRecoup.create({
    data: {
      kind: "CHARGEBACK",
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

async function loadContext(projectId: string, pledgeId: string | null): Promise<RecoupContext> {
  const [project, pledge] = await Promise.all([
    db.project.findFirst({
      where: { id: projectId },
      select: { title: true, creator: { select: { email: true, name: true } } },
    }),
    pledgeId ? db.pledge.findFirst({ where: { id: pledgeId }, select: { backerNumber: true } }) : null,
  ]);
  return {
    projectTitle: project?.title || "your campaign",
    creatorEmail: project?.creator.email ?? null,
    creatorName: project?.creator.name ?? null,
    backerLabel: pledge?.backerNumber
      ? `Backer #${pledge.backerNumber}`
      : pledgeId
        ? "a backer"
        : "overpaid balance after refunds",
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
  if (recoup.status === "CHARGED" || recoup.status === "WAIVED" || recoup.status === "WRITTEN_OFF") {
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
  const dcKey = dcPledgeKeyForRecoup(recoup);
  if (recoup.attempts > 0) {
    const lookup = await lookupDcPayment(dcKey);
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
    pledgeId: dcKey,
    idempotencyKey: recoup.idempotencyKey,
    projectId: recoup.projectId,
    description:
      recoup.kind === "OVERPAYMENT"
        ? `Overpayment recoup — ${ctx.projectTitle} (paid out, then refunds/chargebacks)`
        : `Chargeback recoup — ${ctx.projectTitle} (${ctx.backerLabel}${recoup.disputeId ? `, ${recoup.disputeId}` : ""})`,
    statement_descriptor: recoup.kind === "OVERPAYMENT" ? "ICF BALANCE DUE" : "ICF CHARGEBACK",
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
    title:
      recoup.kind === "OVERPAYMENT"
        ? "Overpaid balance collected from your protection card"
        : "Chargeback recouped from your protection card",
    message:
      recoup.kind === "OVERPAYMENT"
        ? `$${Number(recoup.amount).toFixed(2)} was charged to your chargeback protection card: "${ctx.projectTitle}" was paid out and later refunds/chargebacks left that amount owed back.`
        : `$${Number(recoup.amount).toFixed(2)} was charged to your chargeback protection card for a dispute on "${ctx.projectTitle}" (${ctx.backerLabel}).`,
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
  pledgeKey: string,
  paymentIntentId: string | null | undefined,
  amountCents: number | null | undefined
): Promise<boolean> {
  const open = pledgeKey.startsWith("recoup:")
    ? await db.chargebackRecoup.findFirst({
        where: { id: pledgeKey.slice("recoup:".length), status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
      })
    : await db.chargebackRecoup.findFirst({
        where: { pledgeId: pledgeKey, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
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

// ── Recovery scan ────────────────────────────────────────────────────────
//
// Walks past history and collects whatever is owed:
//   1. Every CHARGEBACK pledge with no recoup row (disputes from before
//      automatic recoups) gets one, with the fee.
//   2. A project whose payout balance is negative — paid out, then refunds
//      or chargebacks took money back — gets an OVERPAYMENT recoup for the
//      shortfall, so the creator's card is charged for the balance too.
//   3. Everything open is charged if the creator's card is vaulted.
// Admin / super-admin owned campaigns are skipped; they are written off.

export interface ProjectRecoveryResult {
  projectId: string;
  title: string;
  skipped?: "admin" | "not-dc";
  chargebackRecoupsOpened: number;
  overpaymentOpened: number | null; // amount, or null when balance isn't negative
  charged: number;
  stillOpen: number;
}

export async function recoverProject(projectId: string): Promise<ProjectRecoveryResult> {
  const balance = await loadDcProjectBalance(projectId);
  if (!balance) {
    return { projectId, title: "", skipped: "not-dc", chargebackRecoupsOpened: 0, overpaymentOpened: null, charged: 0, stillOpen: 0 };
  }
  const result: ProjectRecoveryResult = {
    projectId,
    title: balance.title,
    chargebackRecoupsOpened: 0,
    overpaymentOpened: null,
    charged: 0,
    stillOpen: 0,
  };
  if (isAdminRole(balance.creatorRole)) {
    result.skipped = "admin";
    return result;
  }

  // 1. Disputes with no recoup yet.
  const disputed = await db.pledge.findMany({
    where: { projectId, status: "CHARGEBACK", deletedAt: null },
    select: { id: true, amount: true, metadata: true },
  });
  if (disputed.length > 0) {
    const covered = await db.chargebackRecoup.findMany({
      where: { projectId, kind: "CHARGEBACK", pledgeId: { in: disputed.map((d) => d.id) } },
      select: { pledgeId: true },
    });
    const coveredIds = new Set(covered.map((c: { pledgeId: string | null }) => c.pledgeId));
    for (const p of disputed) {
      if (coveredIds.has(p.id)) continue;
      const meta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as {
        dispute?: { disputeId?: string; reason?: string; processor?: string };
      };
      // Open without charging yet; the batch charge below handles it.
      const idempotencyKey = `recoup:${p.id}:${meta.dispute?.disputeId || "manual"}`;
      await db.chargebackRecoup.create({
        data: {
          kind: "CHARGEBACK",
          projectId,
          pledgeId: p.id,
          creatorId: balance.creatorId,
          disputeId: meta.dispute?.disputeId || null,
          processor: meta.dispute?.processor || "backfill",
          reason: meta.dispute?.reason || null,
          disputedAmount: Number(p.amount),
          feeAmount: CHARGEBACK_RECOUP_FEE_USD,
          amount: Math.round((Number(p.amount) + CHARGEBACK_RECOUP_FEE_USD) * 100) / 100,
          idempotencyKey,
          status: "PENDING",
        },
      });
      result.chargebackRecoupsOpened++;
    }
  }

  // 2. Negative balance beyond what open chargeback recoups will recover.
  //    Charged chargeback recoups are already credited into the balance;
  //    pending ones will be, so don't double-collect them here.
  const pendingPrincipal = await db.chargebackRecoup.findMany({
    where: { projectId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    select: { kind: true, disputedAmount: true },
  });
  const pendingCredit = pendingPrincipal.reduce(
    (sum: number, r: { disputedAmount: unknown }) => sum + Number(r.disputedAmount),
    0
  );
  const hasOpenOverpayment = pendingPrincipal.some((r: { kind: string }) => r.kind === "OVERPAYMENT");
  const shortfall = Math.round((-balance.remainingAmount - pendingCredit) * 100) / 100;
  if (shortfall > 0 && !hasOpenOverpayment) {
    await db.chargebackRecoup.create({
      data: {
        kind: "OVERPAYMENT",
        projectId,
        pledgeId: null,
        creatorId: balance.creatorId,
        processor: "payout-reconciliation",
        reason: "Paid out, then refunds/chargebacks left a negative balance",
        disputedAmount: shortfall,
        feeAmount: 0,
        amount: shortfall,
        idempotencyKey: `recoup:overpay:${projectId}:${Date.now()}`,
        status: "PENDING",
      },
    });
    result.overpaymentOpened = shortfall;
  }

  // 3. Charge everything open.
  const open = await db.chargebackRecoup.findMany({
    where: { projectId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    select: { id: true },
  });
  for (const r of open) {
    const res = await attemptRecoupCharge(r.id, { force: true }).catch(() => ({ status: "error" }));
    if (res.status === "CHARGED") result.charged++;
    else result.stillOpen++;
  }
  return result;
}

/** Every DivinityCoin campaign that has ended: open and charge what's owed. */
export async function recoverAllProjects(): Promise<ProjectRecoveryResult[]> {
  const now = new Date();
  const projects = await db.project.findMany({
    where: {
      paymentProcessor: "DIVINITYCOIN",
      deletedAt: null,
      OR: [
        { status: { in: ["FUNDED", "FAILED"] } },
        { status: "LIVE", fundedAt: { not: null }, endDate: { lt: now } },
      ],
    },
    select: { id: true },
  });
  const out: ProjectRecoveryResult[] = [];
  for (const p of projects) {
    out.push(
      await recoverProject(p.id).catch((err) => {
        log.error({ err: formatError(err), projectId: p.id }, "recoverProject threw");
        return { projectId: p.id, title: "", chargebackRecoupsOpened: 0, overpaymentOpened: null, charged: 0, stillOpen: 0 };
      })
    );
  }
  return out;
}

/**
 * Admin / super-admin owned campaign with a negative balance: record the
 * loss and zero the balance. Logged as a WRITTEN_OFF recoup so the payout
 * dialog shows the red figure with "internal loss" next to it, and the
 * balance credit brings the remaining amount back to zero.
 */
export async function writeOffProjectBalance(
  projectId: string,
  adminId: string,
  reason: string
): Promise<{ ok: boolean; amount: number; error?: string }> {
  const balance = await loadDcProjectBalance(projectId);
  if (!balance) return { ok: false, amount: 0, error: "Not a DivinityCoin project" };
  if (!isAdminRole(balance.creatorRole)) {
    return { ok: false, amount: 0, error: "Only admin-owned campaigns can be written off; charge the creator's card instead" };
  }
  if (balance.remainingAmount >= 0) return { ok: false, amount: 0, error: "Balance is not negative" };
  const amount = Math.round(-balance.remainingAmount * 100) / 100;
  await db.chargebackRecoup.create({
    data: {
      kind: "OVERPAYMENT",
      projectId,
      pledgeId: null,
      creatorId: balance.creatorId,
      processor: "internal-write-off",
      reason: reason.slice(0, 500),
      disputedAmount: amount,
      feeAmount: 0,
      amount,
      idempotencyKey: `writeoff:${projectId}:${Date.now()}`,
      status: "WRITTEN_OFF",
      waivedAt: new Date(),
      waivedById: adminId,
      waivedReason: reason.slice(0, 500),
    },
  });
  log.warn({ projectId, adminId, amount }, "Admin-owned campaign balance written off as internal loss");
  return { ok: true, amount };
}
