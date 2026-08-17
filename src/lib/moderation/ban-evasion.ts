import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const log = logger.child({ module: "ban-evasion" });

// Reading the blocklist we already write to.
//
// IPBlocklist was write-only. The admin ban path, the chargeback cron, the
// DivinityCoin ban handler and account deletion all upsert rows into it, and
// nothing anywhere read one back — so a banned creator could register again
// from the same machine a minute later and nothing stopped them. Terms 11a
// promises otherwise, and this is the read side of that promise.
//
// Two independent signals, because they fail in different ways:
//
//   1. IPBlocklist — an explicit, admin-curated entry. Deliberately added,
//      removable from the admin UI, and honours expiresAt for timed bans.
//   2. A live banned account with the same lastKnownIP. Catches the window
//      between banning someone and any blocklist write, and covers bans
//      applied by paths that never wrote a row.
//
// Deliberately NOT matched on: email. A banned user's email is already
// rejected by the "already registered" check, and near-miss matching on
// addresses (dots, plus-addressing) produces false positives on shared
// domains without catching anyone determined.

export interface BanEvasionVerdict {
  blocked: boolean;
  /** Internal detail for logs and admin review. Never shown to the visitor. */
  reason: string | null;
}

const ALLOWED: BanEvasionVerdict = { blocked: false, reason: null };

/**
 * Whether a sign-up from this IP should be refused as ban evasion.
 *
 * Fails open. A database hiccup here must not take registration down with
 * it — the cost of letting one evader through is much lower than the cost of
 * turning away every legitimate new user, and the ban still holds everywhere
 * else it is enforced.
 */
export async function checkBanEvasion(ip: string | null): Promise<BanEvasionVerdict> {
  if (!ip) return ALLOWED;

  try {
    const now = new Date();

    const [blocked, bannedSharingIp] = await Promise.all([
      db.iPBlocklist.findFirst({
        where: {
          ipAddress: ip,
          // A temporary block that has run out is not a block.
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, reason: true, expiresAt: true },
      }),
      db.user.findFirst({
        where: { lastKnownIP: ip, lockedAt: { not: null } },
        select: { id: true, lockedReason: true },
      }),
    ]);

    if (blocked) {
      return {
        blocked: true,
        reason: `IPBlocklist entry ${blocked.id}${blocked.reason ? `: ${blocked.reason}` : ""}`,
      };
    }

    if (bannedSharingIp) {
      return {
        blocked: true,
        reason: `Banned account ${bannedSharingIp.id} shares this IP${
          bannedSharingIp.lockedReason ? `: ${bannedSharingIp.lockedReason}` : ""
        }`,
      };
    }

    return ALLOWED;
  } catch (error) {
    log.error({ err: formatError(error), ip }, "Ban evasion check failed; allowing sign-up");
    return ALLOWED;
  }
}

/**
 * What the visitor is told.
 *
 * No confirmation that an IP is blocked and no hint at which signal matched —
 * that is a free oracle for anyone probing which of their addresses still
 * works. It names a route out, because this will occasionally catch a
 * housemate or a shared office, and those people need somewhere to go.
 */
export const BAN_EVASION_MESSAGE =
  "We can't create an account from this connection. If you think that's a mistake, email support@indiecrowdfund.com and we'll sort it out.";
