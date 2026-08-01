import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSecret } from "@/lib/vault";

const log = logger.child({ module: "inbound-blocklist" });

// Mailgun caps the number of routes; each blocked sender costs one. Blocking a
// whole domain is one route for any number of addresses, which is why the
// admin UI offers it.
const MAILGUN_ROUTE_PRIORITY = 0; // lower runs first — must beat the forward route

export interface BlockDecision {
  blocked: boolean;
  /** Which blocklist row matched, for logging + stats. */
  matchedId?: string;
  matchedValue?: string;
}

/**
 * Is this sender blocked? Checks exact address, its domain, and any PATTERN
 * rows (stored as regular expressions). Expired and inactive rows are ignored.
 *
 * Called on every inbound email before we store anything, so a blocked sender
 * costs us no database row and no R2 upload even if the provider-level rule
 * hasn't propagated (or was never created because Mailgun creds are absent).
 */
export async function isSenderBlocked(fromEmail: string): Promise<BlockDecision> {
  const email = fromEmail.trim().toLowerCase();
  if (!email) return { blocked: false };
  const domain = email.split("@")[1] || "";
  const now = new Date();

  const rows = await db.emailBlocklist.findMany({
    where: {
      isActive: true,
      OR: [
        { type: "EMAIL", value: email },
        ...(domain ? [{ type: "DOMAIN" as const, value: domain }] : []),
        { type: "PATTERN" as const },
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: { id: true, type: true, value: true },
  });

  for (const row of rows) {
    if (row.type === "EMAIL" || row.type === "DOMAIN") {
      return { blocked: true, matchedId: row.id, matchedValue: row.value };
    }
    if (row.type === "PATTERN") {
      try {
        if (new RegExp(row.value, "i").test(email)) {
          return { blocked: true, matchedId: row.id, matchedValue: row.value };
        }
      } catch {
        // A malformed pattern shouldn't take the whole inbound path down.
        log.warn({ pattern: row.value }, "Invalid blocklist pattern — skipped");
      }
    }
  }

  return { blocked: false };
}

/** Bump the hit counters on a matched rule. Best-effort; never throws. */
export async function recordBlockHit(id: string): Promise<void> {
  await db.emailBlocklist
    .update({
      where: { id },
      data: { blockedCount: { increment: 1 }, lastBlockedAt: new Date() },
    })
    .catch(() => {});
}

async function mailgunCreds(): Promise<{ apiKey: string; domain: string } | null> {
  const settings = await db.platformSettings
    .findUnique({
      where: { id: "default" },
      select: { mailgunApiKey: true, mailgunDomain: true },
    })
    .catch(() => null);

  const apiKey =
    getSecret("mailgun_api_key", settings?.mailgunApiKey) || process.env.MAILGUN_API_KEY || "";
  const domain = settings?.mailgunDomain || process.env.MAILGUN_DOMAIN || "";
  if (!apiKey || !domain) return null;
  return { apiKey, domain };
}

function mailgunAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

// Mailgun matches routes with a Go regexp against the raw header. Escape
// everything the user gave us so a "." in a domain can't match any character.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProviderBlockResult {
  ok: boolean;
  /** Mailgun route id, so we can delete it when the block is lifted. */
  routeId?: string;
  error?: string;
}

/**
 * Create a Mailgun route that drops mail from this sender at the provider,
 * before it is ever forwarded to our webhook.
 *
 * `stop()` halts route evaluation, so with priority 0 this beats the
 * store/forward route that delivers to /api/webhooks/email/inbound. Mailgun
 * accepts the message and discards it — the sender sees no bounce, which is
 * what you want for spam (a bounce confirms the address is live).
 */
export async function blockSenderAtProvider(
  value: string,
  type: "EMAIL" | "DOMAIN"
): Promise<ProviderBlockResult> {
  const creds = await mailgunCreds();
  if (!creds) {
    return { ok: false, error: "Mailgun is not configured — blocked locally only." };
  }

  // match_header runs against the full From header ("Name <addr@host>"), so
  // anchor loosely and match the address portion.
  const expression =
    type === "DOMAIN"
      ? `match_header("from", ".*@${escapeRegex(value)}>?\\s*$|.*@${escapeRegex(value)}[>\\s,]")`
      : `match_header("from", ".*${escapeRegex(value)}.*")`;

  const form = new URLSearchParams();
  form.set("priority", String(MAILGUN_ROUTE_PRIORITY));
  form.set("description", `IndieCrowdfund spam block: ${type.toLowerCase()} ${value}`);
  form.set("expression", expression);
  form.append("action", "stop()");

  try {
    const res = await fetch("https://api.mailgun.net/v3/routes", {
      method: "POST",
      headers: {
        Authorization: mailgunAuth(creds.apiKey),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      log.warn({ status: res.status, body }, "Mailgun route create failed");
      return { ok: false, error: `Mailgun returned ${res.status}` };
    }
    return { ok: true, routeId: body?.route?.id };
  } catch (err) {
    log.warn({ err: String(err) }, "Mailgun route create threw");
    return { ok: false, error: "Could not reach Mailgun" };
  }
}

/** Remove a previously created Mailgun route (used when unblocking). */
export async function unblockSenderAtProvider(routeId: string): Promise<ProviderBlockResult> {
  const creds = await mailgunCreds();
  if (!creds) return { ok: false, error: "Mailgun is not configured" };
  try {
    const res = await fetch(`https://api.mailgun.net/v3/routes/${encodeURIComponent(routeId)}`, {
      method: "DELETE",
      headers: { Authorization: mailgunAuth(creds.apiKey) },
    });
    // A route that's already gone is a success from our side.
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: `Mailgun returned ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Mailgun" };
  }
}
