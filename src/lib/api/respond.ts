import { NextResponse } from "next/server";

/**
 * Shared response envelope + rate limiting for the Data API.
 *
 * Every response carries CORS headers because the primary consumers are
 * tracking sites that may call from a browser. Only GET is ever allowed —
 * the API is read-only, so there is no preflight-able mutation to worry about.
 */

export const API_VERSION = "1.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "X-API-Key, X-API-Secret, Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function apiJson(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: {
      ...CORS,
      "X-API-Version": API_VERSION,
      // Trackers poll; a short shared cache absorbs a lot of duplicate load
      // without making the numbers meaningfully stale.
      "Cache-Control": "public, max-age=60, s-maxage=60",
      ...init.headers,
    },
  });
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...CORS, "X-API-Version": API_VERSION } }
  );
}

export function apiOptions() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── Rate limiting ───────────────────────────────────────────────────────────
//
// Per-key fixed window, held in process memory. This runs under PM2 cluster
// with 8 workers, so the effective ceiling is up to 8x the configured limit —
// it is a courtesy brake against a runaway poller, NOT a security control.
// Anything that needs a hard guarantee belongs at the proxy.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const existing = hits.get(keyId);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    hits.set(keyId, { count: 1, resetAt });

    // Opportunistic sweep so a long-lived process doesn't accumulate an entry
    // per key forever. Cheap because it only runs when a window rolls over.
    if (hits.size > 5_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return { allowed: true, remaining: MAX_PER_WINDOW - 1, resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= MAX_PER_WINDOW,
    remaining: Math.max(0, MAX_PER_WINDOW - existing.count),
    resetAt: existing.resetAt,
  };
}

export function rateLimitHeaders(r: { remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Limit": String(MAX_PER_WINDOW),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
}

export { MAX_PER_WINDOW as API_RATE_LIMIT_PER_MINUTE };
