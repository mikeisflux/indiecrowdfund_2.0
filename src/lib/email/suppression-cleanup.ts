import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "suppression-cleanup" });

/**
 * Reconcile the mailing lists against who has actually opted out.
 *
 * The platform has two unsubscribe surfaces and they disagreed. /api/unsubscribe
 * always updated both the User row and the NewsletterSubscriber row; the
 * settings toggle (PATCH /api/user/me/email-state) only ever updated the User
 * row. Anyone who opted out from their settings page therefore stayed active
 * on the newsletter list, got selected by the next digest, queued, and only
 * then rejected by sendEmail's unsubscribe check — one FAILED row per person
 * per send, forever, reading "User has unsubscribed from emails".
 *
 * The suppression was working. The list was wrong. This puts the list right,
 * and cancels the queued mail that should never have been created.
 *
 * Covers four groups, all of whom we have committed not to email:
 * unsubscribed users, deleted accounts, banned accounts, and addresses on the
 * hard blocklist (bounces and spam complaints).
 */

export interface SuppressionCleanupResult {
  /** NewsletterSubscriber rows deactivated because the person had opted out. */
  subscribersDeactivated: number;
  /** Queued-but-unsent emails cancelled because the recipient is suppressed. */
  queuedCancelled: number;
  /** FAILED rows removed that had already been rejected for this reason. */
  failedCleared: number;
  /** Distinct addresses involved, for the summary line. */
  addresses: number;
}

/** Every address we must not send marketing to, lower-cased. */
async function suppressedAddresses(): Promise<Set<string>> {
  const [users, blocked] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [
          { emailUnsubscribedAt: { not: null } },
          { accountDeletedAt: { not: null } },
          { lockedAt: { not: null } },
          { deletedAt: { not: null } },
        ],
      },
      select: { email: true },
    }),
    db.emailBlocklist.findMany({
      where: {
        type: "EMAIL",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { value: true, reason: true },
    }),
  ]);

  const set = new Set<string>();
  for (const u of users as { email: string }[]) set.add(u.email.toLowerCase().trim());
  for (const b of blocked as { value: string; reason: string | null }[]) {
    // "ratelimit" entries are temporary and deliberately not treated as
    // blocks by isEmailBlocked, so they must not be treated as blocks here
    // either — otherwise a transient throttle would unsubscribe someone.
    if (b.reason !== "ratelimit") set.add(b.value.toLowerCase().trim());
  }
  return set;
}

/**
 * @param dryRun count what would change without changing it.
 */
export async function cleanUpSuppressedRecipients(
  dryRun = false
): Promise<SuppressionCleanupResult> {
  const suppressed = await suppressedAddresses();
  const result: SuppressionCleanupResult = {
    subscribersDeactivated: 0,
    queuedCancelled: 0,
    failedCleared: 0,
    addresses: suppressed.size,
  };

  if (suppressed.size === 0) return result;

  const list = Array.from(suppressed);

  // Postgres will take a large IN list, but not an unbounded one, and the
  // suppressed set grows with the platform. Chunked so this keeps working at
  // ten times the current size.
  const CHUNK = 1_000;
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);

    // 1. Take them off the newsletter list. This is the actual fix — every
    //    other step below is cleaning up what this omission produced.
    const stillActive = await db.newsletterSubscriber.findMany({
      where: { email: { in: chunk, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (stillActive.length > 0) {
      if (!dryRun) {
        await db.newsletterSubscriber.updateMany({
          where: { id: { in: stillActive.map((s: { id: string }) => s.id) } },
          data: { isActive: false, unsubscribedAt: new Date() },
        });
      }
      result.subscribersDeactivated += stillActive.length;
    }

    // 2. Cancel mail already queued to them. Leaving it costs a send attempt
    //    each and lands as another FAILED row saying what we already know.
    const pending = await db.emailQueue.findMany({
      where: {
        toEmail: { in: chunk, mode: "insensitive" },
        status: { in: ["PENDING", "PROCESSING"] },
        // Password resets and verification mail are allowed through the
        // unsubscribe gate on purpose; cancelling those would lock people out
        // of their own accounts.
        skipUnsubscribeCheck: false,
      },
      select: { id: true },
    });
    if (pending.length > 0) {
      if (!dryRun) {
        await db.emailQueue.deleteMany({ where: { id: { in: pending.map((p: { id: string }) => p.id) } } });
      }
      result.queuedCancelled += pending.length;
    }

    // 3. Clear the FAILED rows this already produced, so the failed tab shows
    //    problems worth looking at rather than a backlog of correct refusals.
    const failed = await db.emailQueue.findMany({
      where: {
        toEmail: { in: chunk, mode: "insensitive" },
        status: "FAILED",
        error: { contains: "unsubscribed", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (failed.length > 0) {
      if (!dryRun) {
        await db.emailQueue.deleteMany({ where: { id: { in: failed.map((f: { id: string }) => f.id) } } });
      }
      result.failedCleared += failed.length;
    }
  }

  log.info({ ...result, dryRun }, "Suppressed-recipient cleanup complete");
  return result;
}
