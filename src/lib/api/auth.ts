import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { sha256, secretMatches, SCOPE_READ_PUBLIC } from "./keys";

const log = logger.child({ module: "public-api-auth" });

/**
 * Authentication for the public Data API.
 *
 * Credentials go in headers, never the query string: a key in a URL ends up
 * in access logs, proxy caches, and Referer headers on any redirect.
 *
 *   X-API-Key:    ick_live_...
 *   X-API-Secret: icsk_live_...
 *
 * Authorization: Bearer <key>:<secret> is accepted as an alternative because
 * most HTTP clients make it the path of least resistance.
 */

export interface AuthedKey {
  id: string;
  userId: string | null;
  scopes: string[];
  appName: string | null;
}

type AuthResult = { ok: true; key: AuthedKey } | { ok: false; response: NextResponse };

function unauthorized(message: string, status = 401): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { error: { code: status === 401 ? "unauthorized" : "forbidden", message } },
      {
        status,
        headers: {
          // Tells a well-behaved client how to authenticate rather than
          // leaving it to guess from a bare 401.
          "WWW-Authenticate": 'Bearer realm="IndieCrowdfund Data API"',
        },
      }
    ),
  };
}

function readCredentials(req: NextRequest): { key: string; secret: string } | null {
  const headerKey = req.headers.get("x-api-key");
  const headerSecret = req.headers.get("x-api-secret");
  if (headerKey && headerSecret) return { key: headerKey.trim(), secret: headerSecret.trim() };

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const sep = token.indexOf(":");
    if (sep > 0) {
      return { key: token.slice(0, sep), secret: token.slice(sep + 1) };
    }
  }
  return null;
}

export async function authenticateApiRequest(req: NextRequest): Promise<AuthResult> {
  const creds = readCredentials(req);
  if (!creds || !creds.key || !creds.secret) {
    return unauthorized(
      "Provide X-API-Key and X-API-Secret headers, or Authorization: Bearer <key>:<secret>."
    );
  }

  // Look up by hash of the public half. The key is indexed, so this is a
  // single indexed read rather than a scan.
  const record = await db.apiKey.findFirst({
    where: { key: creds.key },
    select: {
      id: true,
      userId: true,
      scopes: true,
      appName: true,
      secretHash: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  // Same generic message whether the key is unknown, revoked or mismatched —
  // a caller probing for valid keys learns nothing from the difference.
  const reject = () => unauthorized("Invalid API credentials.");

  if (!record) return reject();
  if (record.status !== "ACTIVE" || record.revokedAt) return reject();
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return reject();
  if (!secretMatches(creds.secret, record.secretHash)) return reject();

  // Legacy admin-minted keys predate scopes and carry an empty array. They are
  // grandfathered into read:public rather than being locked out by a field
  // that did not exist when they were issued.
  const scopes = record.scopes.length > 0 ? record.scopes : [SCOPE_READ_PUBLIC];
  if (!scopes.includes(SCOPE_READ_PUBLIC)) {
    return unauthorized("This key does not have the read:public scope.", 403);
  }

  // Usage accounting is best-effort and deliberately not awaited into the
  // response path — a bookkeeping failure must not turn a good request into
  // a 500, and the extra round trip should not sit in the caller's latency.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  void db.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ip, usageCount: { increment: 1 } },
    })
    .catch((err: unknown) => log.warn({ err: formatError(err) }, "API key usage update failed"));

  return {
    ok: true,
    key: { id: record.id, userId: record.userId, scopes, appName: record.appName },
  };
}

/** Hash helper re-exported so callers don't reach into ./keys for one function. */
export { sha256 };
