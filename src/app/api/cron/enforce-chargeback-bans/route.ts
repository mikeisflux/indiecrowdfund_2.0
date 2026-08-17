import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";

const cronEnforceChargebackBansLogger = logger.child({ module: "cron-enforce-chargeback-bans" });

export const dynamic = "force-dynamic";

// Same auth pattern as the other cron routes -- Bearer CRON_SECRET or
// Bearer ADMIN_API_KEY.
function verifyCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (adminApiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${adminApiKey}`) return true;
  }
  return false;
}

const AUTO_BAN_REASON_PREFIX = "Auto-banned: matches banned account";

// An IP used by more than this many distinct accounts is a shared one —
// office NAT, campus, carrier-grade NAT, a household — not a person.
//
// Propagating a ban across an address like that bans strangers. The signal is
// still recorded and an admin can act on it by hand; what it will not do is
// lock out a dozen unrelated creators because one person on their ISP's CGNAT
// pool was banned. Email matching is exact and is never subject to this.
const SHARED_IP_ACCOUNT_THRESHOLD = 4;

interface BannedSignal {
  bannedUserId: string;
  email: string;
  ip: string | null;
  bannedAt: Date;
}

interface BanMatch {
  candidateUserId: string;
  candidateEmail: string;
  matchedSignals: string[];
  sourceBanIds: string[];
}

// POST /api/cron/enforce-chargeback-bans
//
// Enforces two things: the "future accounts created under the same
// email, payment method, IP, or device fingerprint are also banned"
// clause of the Chargeback Handling Policy (/terms?tab=chargebacks),
// and Terms of Service 11a, which makes a ban for any violation
// attach to the person rather than to the account record.
//
// The route keeps its original path so the deployed cron entry does
// not need changing; despite the name it is no longer chargeback-only.
//
// What this does on each run:
//   1. Load every banned User (lockedAt set), whatever the reason.
//      These are the source bans we propagate from. (Bans are
//      applied by the payment-processor dispute webhook handler or
//      by SUPER_ADMIN action -- this cron does NOT create new
//      source bans, only fan them out.)
//   2. Build two signal sets:
//        - canonical lowercased emails
//        - lastKnownIP values (skip nulls and obvious shared
//          NAT/CGNAT proxies if we later want to allow-list them)
//   3. For every active User (lockedAt IS NULL AND deletedAt IS
//      NULL) where the email or lastKnownIP intersects a banned
//      signal:
//        - Stamp lockedAt + lockedReason explaining the auto-ban
//        - Upsert the user's IP into IPBlocklist so future
//          unauthenticated visits are blocked too
//   4. Return counts for observability.
//
// What this does NOT do (deferred / out-of-scope):
//   - Match by payment-method fingerprint. We store provider
//     payment IDs (pm_xxx, paypalOrderId, divinityCoinPaymentId,
//     whopPaymentId) but those are per-transaction tokens, not
//     stable card fingerprints. To cover this we need
//     payment_method.card.fingerprint (Stripe) /
//     equivalent vault id (NMI / Whop) stored against the Pledge
//     row. Tracked as a follow-up.
//   - Device fingerprint. We're not capturing a browser fingerprint
//     at signup yet. Once we do (FingerprintJS / similar), add the
//     signal set here.
//
// Run cadence: every 5-15 minutes via system cron / Vercel cron.
// Idempotent -- safe to invoke at any frequency.
export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    // Every banned account, not only the chargeback ones.
    //
    // This used to filter on lockedReason containing "chargeback", which meant
    // a creator banned for fraud, harassment or prohibited content propagated
    // to nothing: they could open a new account from the same machine and no
    // job would ever notice. Terms 11a makes the ban attach to the person for
    // any violation, so the enforcement has to match.
    const bannedUsers = await db.user.findMany({
      where: {
        lockedAt: { not: null },
      },
      select: {
        id: true,
        email: true,
        lastKnownIP: true,
        lockedAt: true,
      },
    });

    if (bannedUsers.length === 0) {
      cronEnforceChargebackBansLogger.info("No banned source accounts to propagate from");
      return NextResponse.json({
        ok: true,
        sourceBanCount: 0,
        matchedCount: 0,
        bannedCount: 0,
        dryRun,
      });
    }

    const signals: BannedSignal[] = bannedUsers.map((u) => ({
      bannedUserId: u.id,
      email: u.email.trim().toLowerCase(),
      ip: u.lastKnownIP || null,
      bannedAt: u.lockedAt as Date,
    }));

    const bannedEmails = Array.from(new Set(signals.map((s) => s.email)));
    const candidateIps = Array.from(
      new Set(signals.map((s) => s.ip).filter((ip): ip is string => !!ip))
    );

    // Drop the addresses too many people sit behind before they are used to
    // ban anybody. Counting every account on the IP, banned or not, is what
    // distinguishes "one person's home connection" from "a shared exit node".
    const ipCounts =
      candidateIps.length > 0
        ? await db.user.groupBy({
            by: ["lastKnownIP"],
            where: { lastKnownIP: { in: candidateIps }, deletedAt: null },
            _count: { _all: true },
          })
        : [];
    const sharedIps = new Set(
      (ipCounts as { lastKnownIP: string | null; _count: { _all: number } }[])
        .filter((r) => r._count._all > SHARED_IP_ACCOUNT_THRESHOLD)
        .map((r) => r.lastKnownIP)
        .filter((ip): ip is string => !!ip)
    );
    const bannedIps = candidateIps.filter((ip) => !sharedIps.has(ip));

    if (sharedIps.size > 0) {
      // Never silently. A skipped IP is a banned person we did not follow, and
      // whoever reads these logs needs to know it happened.
      cronEnforceChargebackBansLogger.warn(
        { sharedIps: Array.from(sharedIps), threshold: SHARED_IP_ACCOUNT_THRESHOLD },
        "Skipped IP propagation for addresses shared by many accounts; review by hand"
      );
    }

    // Map a signal back to which source ban it came from -- so the
    // auto-ban reason can reference the source for audit.
    const emailToSourceIds = new Map<string, string[]>();
    const ipToSourceIds = new Map<string, string[]>();
    for (const s of signals) {
      const eList = emailToSourceIds.get(s.email) ?? [];
      eList.push(s.bannedUserId);
      emailToSourceIds.set(s.email, eList);
      if (s.ip && !sharedIps.has(s.ip)) {
        const iList = ipToSourceIds.get(s.ip) ?? [];
        iList.push(s.bannedUserId);
        ipToSourceIds.set(s.ip, iList);
      }
    }

    const candidates = await db.user.findMany({
      where: {
        lockedAt: null,
        deletedAt: null,
        accountDeletedAt: null,
        OR: [
          { email: { in: bannedEmails, mode: "insensitive" } },
          ...(bannedIps.length > 0
            ? [{ lastKnownIP: { in: bannedIps } }]
            : []),
        ],
      },
      select: {
        id: true,
        email: true,
        lastKnownIP: true,
      },
    });

    // Don't ban the source users again -- their email/IP will match
    // themselves trivially.
    const sourceIds = new Set(bannedUsers.map((u) => u.id));
    const matches: BanMatch[] = candidates
      .filter((c) => !sourceIds.has(c.id))
      .map((c) => {
        const matchedSignals: string[] = [];
        const sourceBanIds: string[] = [];
        const emailKey = c.email.trim().toLowerCase();
        if (emailToSourceIds.has(emailKey)) {
          matchedSignals.push(`email:${emailKey}`);
          sourceBanIds.push(...(emailToSourceIds.get(emailKey) ?? []));
        }
        if (c.lastKnownIP && ipToSourceIds.has(c.lastKnownIP)) {
          matchedSignals.push(`ip:${c.lastKnownIP}`);
          sourceBanIds.push(...(ipToSourceIds.get(c.lastKnownIP) ?? []));
        }
        return {
          candidateUserId: c.id,
          candidateEmail: c.email,
          matchedSignals,
          sourceBanIds: Array.from(new Set(sourceBanIds)),
        };
      })
      .filter((m) => m.matchedSignals.length > 0);

    if (dryRun) {
      cronEnforceChargebackBansLogger.info(
        { sourceBanCount: bannedUsers.length, matchedCount: matches.length, matches },
        "Dry run -- no users locked"
      );
      return NextResponse.json({
        ok: true,
        dryRun: true,
        sourceBanCount: bannedUsers.length,
        matchedCount: matches.length,
        matches,
      });
    }

    let bannedCount = 0;
    for (const match of matches) {
      const reason = `${AUTO_BAN_REASON_PREFIX} via ${match.matchedSignals.join(", ")} (source bans: ${match.sourceBanIds.join(",")})`;
      try {
        await db.$transaction(async (tx) => {
          // Re-check inside the tx -- a concurrent run / admin
          // action may have already locked them.
          const fresh = await tx.user.findUnique({
            where: { id: match.candidateUserId },
            select: { lockedAt: true, lastKnownIP: true },
          });
          if (!fresh || fresh.lockedAt) return;

          await tx.user.update({
            where: { id: match.candidateUserId },
            data: {
              lockedAt: new Date(),
              lockedReason: reason,
            },
          });

          // Drop all active sessions so they're booted out
          // immediately, not just on next login.
          await tx.session.deleteMany({
            where: { userId: match.candidateUserId },
          });

          // Mirror the IP into IPBlocklist so unauthenticated
          // visits (signup attempts on the same IP) get blocked.
          if (fresh.lastKnownIP) {
            await tx.iPBlocklist.upsert({
              where: { ipAddress: fresh.lastKnownIP },
              update: {},
              create: {
                ipAddress: fresh.lastKnownIP,
                userId: match.candidateUserId,
                reason: `Auto-ban via ban enforcement (source bans: ${match.sourceBanIds.join(",")})`,
              },
            });
          }
        });
        bannedCount += 1;
        cronEnforceChargebackBansLogger.info(
          { candidate: match.candidateUserId, email: match.candidateEmail, signals: match.matchedSignals, sources: match.sourceBanIds },
          "Auto-banned account via ban enforcement"
        );
      } catch (err) {
        cronEnforceChargebackBansLogger.error(
          { err: formatError(err), candidate: match.candidateUserId },
          "Failed to auto-ban candidate"
        );
      }
    }

    return NextResponse.json({
      ok: true,
      sourceBanCount: bannedUsers.length,
      matchedCount: matches.length,
      bannedCount,
      skippedSharedIps: Array.from(sharedIps),
    });
  } catch (error) {
    cronEnforceChargebackBansLogger.error({ err: formatError(error) }, "Cron failed");
    return NextResponse.json(
      { error: "Cron failed" },
      { status: 500 }
    );
  }
}

// GET for health check / dry-run convenience -- same auth, same
// behavior as POST with ?dryRun=1.
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  url.searchParams.set("dryRun", "1");
  const proxied = new NextRequest(url.toString(), {
    method: "POST",
    headers: req.headers,
  });
  return POST(proxied);
}
