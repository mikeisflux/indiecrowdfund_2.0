import type { NextRequest } from "next/server";

// Where a purchase came from: the backer's IP and browser, captured in the
// request handler that served the browser and carried through to every
// DivinityCoin charge. DC's calls are server-to-server, so the only address
// they can see on their own is ours — identical for every backer and worse
// than nothing as dispute evidence. They asked for these two fields on
// charge-creating calls (PARTNER-CUSTOMER-ORIGIN spec, 2026-09).
//
// Rules from that spec, and one of our own:
//   - IP 3–45 chars, IPv4 or IPv6; anything else is omitted, never rejected
//   - User-Agent truncated at 512
//   - Off-session charges (cron, recoup) send the origin recorded when the
//     card was saved, or nothing. Never our server's address: a wrong value
//     looks like evidence until someone checks it.
//   - We read the RIGHTMOST X-Forwarded-For entry, not the first. The first
//     is client-supplied under nginx's proxy_add_x_forwarded_for and can be
//     forged; the last is the hop our own proxy appended. Same rule the
//     proxy's rate limits and bans use.

export interface CustomerOrigin {
  customerIpAddress?: string;
  customerUserAgent?: string;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

/** True for a plausible public-or-private IPv4/IPv6 literal. */
export function isValidCustomerIp(value: string | null | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 45) return false;
  if (IPV4.test(v)) return true;
  return v.includes(":") && IPV6.test(v) && v.split(":").length <= 8;
}

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.");
}

/** Client IP of a request, using the same trusted-proxy rule as src/proxy.ts. */
export function getRequestClientIp(req: Pick<NextRequest, "headers">): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (isValidCustomerIp(last) && !isLoopback(last)) return last;
  }
  const single = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (isValidCustomerIp(single) && !isLoopback(single)) return single;
  return undefined;
}

/** Origin fields for a DC call, from the browser request being handled right now. */
export function getCustomerOrigin(req: Pick<NextRequest, "headers">): CustomerOrigin {
  const ip = getRequestClientIp(req);
  const ua = req.headers.get("user-agent")?.trim();
  return {
    ...(ip ? { customerIpAddress: ip } : {}),
    ...(ua ? { customerUserAgent: ua.slice(0, 512) } : {}),
  };
}

// ── Pledge.metadata.origin: remembered for off-session charges ──

type Meta = Record<string, unknown>;
const asObject = (value: unknown): Meta =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Meta) : {};

export interface StoredOrigin extends CustomerOrigin {
  capturedAt?: string;
  /** Which step captured it: "checkout" (pledge created) or "card-saved". */
  source?: string;
}

/** Read the origin recorded on a pledge when its card was entered. */
export function readStoredOrigin(metadata: unknown): CustomerOrigin {
  const o = asObject(asObject(metadata).origin);
  const ip = typeof o.customerIpAddress === "string" ? o.customerIpAddress : undefined;
  const ua = typeof o.customerUserAgent === "string" ? o.customerUserAgent : undefined;
  return {
    ...(isValidCustomerIp(ip) ? { customerIpAddress: ip } : {}),
    ...(ua ? { customerUserAgent: ua.slice(0, 512) } : {}),
  };
}

/** Merge an origin into pledge metadata without disturbing its other buckets. */
export function withStoredOrigin(metadata: unknown, origin: CustomerOrigin, source: string): Meta {
  if (!origin.customerIpAddress && !origin.customerUserAgent) return asObject(metadata);
  const stored: StoredOrigin = { ...origin, capturedAt: new Date().toISOString(), source };
  return { ...asObject(metadata), origin: stored };
}
