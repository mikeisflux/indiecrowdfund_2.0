import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendBalanceDueEmail, type BalanceBreakdown } from "@/lib/email/email-templates-pledge";

const log = logger.child({ module: "indiekit-balance-request" });

const TOKEN_DAYS = 30;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What a backer still owes on an order. The stored `metadata.balanceDue`
 * (written by order edits, balance adjustments and shipping requests) wins;
 * without it, the gap between what the order adds up to and what was paid.
 */
export function currentBalanceDue(p: {
  amount: unknown;
  rewardAmount: unknown;
  addonsAmount: unknown;
  shippingAmount: unknown;
  metadata: unknown;
}): number {
  const meta = (p.metadata as Record<string, unknown>) || {};
  const stored = meta.balanceDue != null ? Number(meta.balanceDue) : null;
  if (stored !== null && Number.isFinite(stored)) return Math.max(0, round2(stored));
  const expected = Number(p.rewardAmount) + Number(p.addonsAmount) + Number(p.shippingAmount);
  return Math.max(0, round2(expected - Number(p.amount)));
}

export type BalanceRequestResult =
  | { ok: true; balanceDue: number; deduplicated: boolean; email: string }
  | { ok: false; error: string; balanceDue?: number };

/**
 * Email one backer a pay link for their outstanding balance.
 *
 * Shared by the per-order "Send charge request" button and the bulk
 * shipping-request / resend flows. The pay link is a token on the pledge
 * metadata read by /pay/balance/[token]. An unexpired token is reused so a
 * resend does not kill the link in the backer's earlier email.
 */
export async function sendBalanceRequest(
  pledgeId: string,
  projectId: string,
  opts: { minSecondsBetween?: number } = {}
): Promise<BalanceRequestResult> {
  const minSeconds = opts.minSecondsBetween ?? 60;

  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId, projectId, deletedAt: null, status: "COMPLETED" },
    include: {
      user: { select: { email: true, name: true } },
      reward: { select: { title: true } },
      addons: { include: { addon: { select: { title: true, amount: true } } } },
      project: { select: { title: true, slug: true, currency: true, creator: { select: { vanityUrl: true } } } },
    },
  });
  if (!pledge) return { ok: false, error: "Pledge not found" };
  if (!pledge.user.email) return { ok: false, error: "Backer has no email address" };

  const balanceDue = currentBalanceDue(pledge);
  if (balanceDue <= 0) return { ok: false, error: "No balance due for this pledge", balanceDue };
  const meta0 = (pledge.metadata as Record<string, unknown>) || {};
  if (meta0.balancePaymentCompletedAt && !(meta0.balanceDue != null && Number(meta0.balanceDue) > 0)) {
    return { ok: false, error: "This order's balance was already paid", balanceDue };
  }

  // Claim the send atomically; two clicks inside a minute send once.
  const claim = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledgeId} FOR UPDATE`;
    const fresh = await tx.pledge.findUnique({ where: { id: pledgeId }, select: { metadata: true } });
    const meta = (fresh?.metadata as Record<string, unknown>) || {};
    const lastSentAt = typeof meta.balanceNotificationSentAt === "string" ? meta.balanceNotificationSentAt : null;
    if (lastSentAt) {
      const secondsSince = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
      if (secondsSince < minSeconds) return { deduplicated: true as const, token: "" };
    }
    const existingToken = typeof meta.balancePaymentToken === "string" ? meta.balancePaymentToken : null;
    const existingExpiry = typeof meta.balancePaymentTokenExpiry === "string" ? new Date(meta.balancePaymentTokenExpiry) : null;
    const keep = !!existingToken && !!existingExpiry && existingExpiry.getTime() > Date.now() + 24 * 60 * 60 * 1000 && !meta.balancePaymentCompletedAt;
    const token = keep ? (existingToken as string) : crypto.randomBytes(32).toString("hex");
    const expiry = keep ? (existingExpiry as Date) : new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await tx.pledge.update({
      where: { id: pledgeId },
      data: {
        metadata: {
          ...meta,
          balancePaymentToken: token,
          balancePaymentTokenExpiry: expiry.toISOString(),
          balanceNotificationSentAt: new Date().toISOString(),
          balanceDueAmount: balanceDue,
          // A fresh request supersedes an earlier paid marker (second
          // balance on the same order, e.g. shipping after add-ons).
          ...(keep ? {} : { balancePaymentCompletedAt: null, balanceDivinityCoinPaymentId: null }),
        },
      },
    });
    return { deduplicated: false as const, token };
  });

  if (claim.deduplicated) return { ok: true, balanceDue, deduplicated: true, email: pledge.user.email };

  const addonItems = pledge.addons
    .filter((a: { addon: { title: string; amount: unknown } | null }) => a.addon != null)
    .map((a: { addon: { title: string; amount: unknown }; quantity: number }) => ({
      title: a.addon.title,
      quantity: a.quantity,
      amount: Number(a.addon.amount),
    }));

  const breakdownRaw = meta0.balanceDueBreakdown;
  const breakdown: BalanceBreakdown | undefined = Array.isArray(breakdownRaw)
    ? {
        reason: typeof meta0.balanceDueReason === "string" ? meta0.balanceDueReason : undefined,
        lines: (breakdownRaw as { label?: unknown; amount?: unknown }[])
          .filter((l) => typeof l?.label === "string" && Number.isFinite(Number(l?.amount)))
          .map((l) => ({ label: String(l.label), amount: Number(l.amount) })),
      }
    : undefined;

  const result = await sendBalanceDueEmail(
    pledge.user.email,
    pledge.user.name || "Backer",
    pledge.project.title,
    pledge.project.slug,
    balanceDue,
    claim.token,
    pledge.reward?.title || null,
    addonItems,
    pledge.project.creator?.vanityUrl ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}` : undefined,
    pledge.project.currency || "USD",
    breakdown
  ).catch((err) => ({ success: false, error: String(err) }));

  if (!result.success) {
    log.error({ pledgeId, err: "error" in result ? result.error : undefined }, "balance request email failed");
    return { ok: false, error: ("error" in result && result.error) || "Email delivery failed", balanceDue };
  }
  return { ok: true, balanceDue, deduplicated: false, email: pledge.user.email };
}
