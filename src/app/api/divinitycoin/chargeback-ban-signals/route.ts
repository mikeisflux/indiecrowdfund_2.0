import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";

const dcFeedLogger = logger.child({ module: "dc-chargeback-ban-feed" });

export const dynamic = "force-dynamic";

// GET /api/divinitycoin/chargeback-ban-signals
//
// Public feed (bearer-auth) consumed by DivinityCoin's pre-charge
// prefilter. Returns the FULL current set of chargeback-banned users
// plus every identifier we can hand DC about them so they can match
// new charge attempts against the list before submitting to the rail.
//
// Spec: docs/divinitycoin-chargeback-ban-prefilter-spec.md
//
// Auth: Bearer DIVINITYCOIN_FEED_TOKEN
// IP restriction: enforced by nginx/Cloudflare at the edge (we
//   don't second-guess it here -- but we do require the bearer).
// Cadence: DC polls every 5-15 min. Always full snapshot.

const CHARGEBACK_REASON_MARKER = "chargeback";

interface BillingAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface SignalIdentifiers {
  emails: string[];
  phones: string[];
  billing_names: string[];
  billing_addresses: BillingAddress[];
  card_fingerprints: string[];
  last_known_ips: string[];
  device_fingerprints: string[];
}

interface Signal {
  source_user_id: string;
  banned_at: string;
  reason: string;
  identifiers: SignalIdentifiers;
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function normPhone(s: string): string {
  // Best effort: strip everything that's not a digit or leading +
  const t = s.trim();
  if (!t) return "";
  return t.startsWith("+") ? `+${t.replace(/[^\d]/g, "")}` : t.replace(/[^\d]/g, "");
}

function normName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractAddressFromShipping(raw: unknown): BillingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const line1 = typeof r.line1 === "string" ? r.line1.trim() : "";
  const country = typeof r.country === "string" ? r.country.trim() : "";
  if (!line1 || !country) return null;
  return {
    line1,
    line2: typeof r.line2 === "string" && r.line2.trim() ? r.line2.trim() : null,
    city: typeof r.city === "string" ? r.city.trim() : "",
    state: typeof r.state === "string" ? r.state.trim() : "",
    postal_code: typeof r.postalCode === "string" ? r.postalCode.trim() : "",
    country,
  };
}

export async function GET(req: NextRequest) {
  const expected = process.env.DIVINITYCOIN_FEED_TOKEN;
  if (!expected) {
    dcFeedLogger.error("DIVINITYCOIN_FEED_TOKEN not configured -- refusing feed access");
    return NextResponse.json({ error: "Feed not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    dcFeedLogger.warn({ ip: req.headers.get("x-forwarded-for") }, "Invalid bearer on chargeback ban feed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const banned = await db.user.findMany({
      where: {
        // bannedAt, not lockedAt. This feed tells DivinityCoin whose charges to
        // pre-block, which is ban enforcement — an account merely on an
        // administrative hold has not earned that and must not be exported.
        NOT: { bannedAt: null },
        bannedReason: { contains: CHARGEBACK_REASON_MARKER, mode: "insensitive" },
      },
      select: {
        id: true,
        email: true,
        bannedAt: true,
        bannedReason: true,
        lastKnownIP: true,
        pledges: {
          select: {
            shippingAddress: true,
          },
        },
      },
    });

    const signals: Signal[] = banned.map((u) => {
      const emails = new Set<string>([normEmail(u.email)]);
      const phones = new Set<string>();
      const billingNames = new Set<string>();
      const billingAddresses: BillingAddress[] = [];
      const ips = new Set<string>();
      if (u.lastKnownIP) ips.add(u.lastKnownIP);

      const seenAddrKey = new Set<string>();
      for (const p of u.pledges) {
        const addr = extractAddressFromShipping(p.shippingAddress);
        if (addr) {
          const key = [addr.line1, addr.postal_code, addr.country].join("|").toLowerCase();
          if (!seenAddrKey.has(key)) {
            seenAddrKey.add(key);
            billingAddresses.push(addr);
          }
        }
        if (p.shippingAddress && typeof p.shippingAddress === "object") {
          const raw = p.shippingAddress as Record<string, unknown>;
          if (typeof raw.name === "string") {
            const n = normName(raw.name);
            if (n) billingNames.add(n);
          }
          if (typeof raw.phone === "string") {
            const ph = normPhone(raw.phone);
            if (ph) phones.add(ph);
          }
        }
      }

      return {
        source_user_id: u.id,
        banned_at: (u.bannedAt as Date).toISOString(),
        // Always "chargeback" for now -- the lockedReason text is the
        // gate. Reserved for future ban-class differentiation per
        // spec.
        reason: "chargeback",
        identifiers: {
          emails: Array.from(emails),
          phones: Array.from(phones),
          billing_names: Array.from(billingNames),
          billing_addresses: billingAddresses,
          // Card fingerprints not yet captured server-side. Stripe's
          // payment_method.card.fingerprint would need to be pulled
          // and stored on Pledge at charge time. Tracked as a
          // follow-up; the rest of the signals still let DC catch
          // the same person reusing the same email / address / phone.
          card_fingerprints: [],
          last_known_ips: Array.from(ips),
          // Device fingerprints not yet captured on signup. Tracked
          // as a follow-up.
          device_fingerprints: [],
        },
      };
    });

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      signals,
    });
  } catch (error) {
    dcFeedLogger.error({ err: formatError(error) }, "Failed to build chargeback ban feed");
    return NextResponse.json({ error: "Feed failed" }, { status: 500 });
  }
}
