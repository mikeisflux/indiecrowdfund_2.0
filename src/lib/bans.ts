import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { sendChargebackBackerNoticeEmail } from "@/lib/email/email-templates-misc";

const log = logger.child({ module: "bans" });

export const CHARGEBACK_BAN_REASON = "Chargeback filed — permanent ban under the Chargeback Handling Policy";

/**
 * Ban an account for filing a chargeback, exactly as an admin BAN_USER would:
 * expulsion stamp + sign-in lock, sessions dropped, last known IP blocked.
 *
 * The Chargeback Handling Policy (/terms?tab=chargebacks) says filing a
 * dispute is an immediate permanent ban. The propagation cron's comment
 * always claimed "bans are applied by the dispute webhook handler", but no
 * handler ever set bannedAt — disputed backers kept full access. This is
 * the missing source ban; enforce-chargeback-bans fans it out from here.
 *
 * Idempotent. Never bans admins (a disputed admin is a human decision).
 */
export async function banUserForChargeback(params: {
  userId: string;
  pledgeId: string;
  disputeId?: string | null;
  processor?: string;
}): Promise<{ banned: boolean; reason: string }> {
  const { userId, pledgeId, disputeId, processor } = params;
  const user = await db.user.findFirst({
    where: { id: userId },
    select: { id: true, role: true, bannedAt: true, lastKnownIP: true, email: true },
  });
  if (!user) return { banned: false, reason: "user not found" };
  if (user.bannedAt) return { banned: false, reason: "already banned" };
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    log.warn({ userId, pledgeId }, "Chargeback on an admin account — not auto-banning");
    return { banned: false, reason: "admin account" };
  }

  const detail = `${CHARGEBACK_BAN_REASON} (pledge ${pledgeId}${disputeId ? `, dispute ${disputeId}` : ""}${processor ? `, via ${processor}` : ""})`;
  const now = new Date();

  // CAS on bannedAt so a redelivered dispute webhook and an admin ban racing
  // each other don't both write; the first one wins and the rest no-op.
  const res = await db.user.updateMany({
    where: { id: userId, bannedAt: null },
    data: {
      bannedAt: now,
      bannedReason: detail,
      bannedById: null, // automated
      lockedAt: now,
      lockedReason: detail,
      lockedById: null,
    },
  });
  if (res.count === 0) return { banned: false, reason: "already banned" };

  // Boot every live session so the ban takes effect now, not at next login.
  await db.session.deleteMany({ where: { userId } }).catch((err: unknown) =>
    log.error({ err: formatError(err), userId }, "Failed to drop sessions after chargeback ban")
  );

  if (user.lastKnownIP) {
    await db.iPBlocklist
      .upsert({
        where: { ipAddress: user.lastKnownIP },
        update: { reason: detail, userId },
        create: { ipAddress: user.lastKnownIP, reason: detail, userId },
      })
      .catch((err: unknown) =>
        log.error({ err: formatError(err), userId }, "Failed to block IP after chargeback ban")
      );
  }

  log.warn({ userId, email: user.email, pledgeId, disputeId }, "Account banned for chargeback");
  return { banned: true, reason: detail };
}


/**
 * Tell the backer their dispute banned the account and froze the reward.
 * Idempotent per pledge: records metadata.disputeNoticeSentAt and skips
 * when already set unless `force`.
 */
export async function notifyBackerOfChargebackBan(
  pledgeId: string,
  opts: { force?: boolean } = {}
): Promise<{ sent: boolean; reason: string; to?: string }> {
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId },
    select: {
      id: true,
      amount: true,
      metadata: true,
      fulfillmentStatus: true,
      user: { select: { email: true, name: true } },
      project: { select: { title: true } },
      reward: { select: { title: true } },
    },
  });
  if (!pledge) return { sent: false, reason: "pledge not found" };
  if (!pledge.user?.email) return { sent: false, reason: "no email" };

  const meta = (pledge.metadata && typeof pledge.metadata === "object" && !Array.isArray(pledge.metadata)
    ? (pledge.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown> & { dispute?: { disputeId?: string }; disputeNoticeSentAt?: string };
  if (meta.disputeNoticeSentAt && !opts.force) {
    return { sent: false, reason: "already notified", to: pledge.user.email };
  }

  const result = await sendChargebackBackerNoticeEmail({
    email: pledge.user.email,
    backerName: pledge.user.name || "",
    projectTitle: pledge.project.title,
    rewardTitle: pledge.reward?.title ?? null,
    amount: Number(pledge.amount),
    disputeId: meta.dispute?.disputeId ?? null,
    alreadyShipped: pledge.fulfillmentStatus === "SHIPPED" || pledge.fulfillmentStatus === "DELIVERED",
  });
  if (!result.success) return { sent: false, reason: result.error || "queue failed", to: pledge.user.email };

  await db.pledge
    .update({
      where: { id: pledgeId },
      data: { metadata: { ...meta, disputeNoticeSentAt: new Date().toISOString() } },
    })
    .catch((err: unknown) => log.warn({ err: formatError(err), pledgeId }, "could not record dispute notice"));
  log.info({ pledgeId, to: pledge.user.email }, "Chargeback ban notice emailed to backer");
  return { sent: true, reason: "sent", to: pledge.user.email };
}
