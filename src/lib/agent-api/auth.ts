import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { secretMatches } from "@/lib/api/keys";

const log = logger.child({ module: "agent-api-auth" });

/**
 * Authentication for the Agent API (/api/agent/v1).
 *
 * Same credential system as the public Data API — an `ick_live_...` key that
 * identifies the caller plus an `icsk_live_...` secret that proves it, only
 * the secret's hash stored — but a different scope. A public key cannot call
 * agent tools and an agent key cannot be issued by self-service: agent keys
 * are minted by a SUPER_ADMIN in /admin/agent-api and carry one or both of
 *
 *   agent:read   every reporting / lookup tool
 *   agent:write  the handful of guarded mutations (extend a campaign, add
 *                newsletter subscribers, draft an email campaign)
 *
 * Credentials travel in headers only:
 *   X-API-Key / X-API-Secret, or Authorization: Bearer <key>:<secret>
 */

export const SCOPE_AGENT_READ = "agent:read";
export const SCOPE_AGENT_WRITE = "agent:write";
export type AgentScope = typeof SCOPE_AGENT_READ | typeof SCOPE_AGENT_WRITE;

export interface AgentKey {
  id: string;
  name: string;
  scopes: string[];
  ip: string | null;
}

type AuthResult = { ok: true; key: AgentKey } | { ok: false; response: NextResponse };

function deny(message: string, status: 401 | 403): AuthResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: { code: status === 401 ? "unauthorized" : "forbidden", message } },
      { status, headers: { "WWW-Authenticate": 'Bearer realm="IndieCrowdfund Agent API"' } }
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
    if (sep > 0) return { key: token.slice(0, sep), secret: token.slice(sep + 1) };
  }
  return null;
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function authenticateAgentRequest(req: NextRequest): Promise<AuthResult> {
  const creds = readCredentials(req);
  if (!creds?.key || !creds.secret) {
    return deny("Provide X-API-Key and X-API-Secret headers, or Authorization: Bearer <key>:<secret>.", 401);
  }

  const record = await db.apiKey.findFirst({
    where: { key: creds.key },
    select: { id: true, name: true, scopes: true, secretHash: true, status: true, expiresAt: true, revokedAt: true },
  });

  // One generic rejection whatever the reason, so probing learns nothing.
  if (!record) return deny("Invalid API credentials.", 401);
  if (record.status !== "ACTIVE" || record.revokedAt) return deny("Invalid API credentials.", 401);
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return deny("Invalid API credentials.", 401);
  if (!secretMatches(creds.secret, record.secretHash)) return deny("Invalid API credentials.", 401);

  const hasAgentScope = record.scopes.includes(SCOPE_AGENT_READ) || record.scopes.includes(SCOPE_AGENT_WRITE);
  if (!hasAgentScope) return deny("This key is not an Agent API key.", 403);

  const ip = clientIp(req);
  void db.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date(), lastUsedIp: ip, usageCount: { increment: 1 } } })
    .catch((err: unknown) => log.warn({ err: formatError(err) }, "agent key usage update failed"));

  return { ok: true, key: { id: record.id, name: record.name, scopes: record.scopes, ip } };
}

export function keyHasScope(key: AgentKey, scope: AgentScope): boolean {
  // Write implies read: a key trusted to change things can certainly look.
  if (scope === SCOPE_AGENT_READ) return key.scopes.includes(SCOPE_AGENT_READ) || key.scopes.includes(SCOPE_AGENT_WRITE);
  return key.scopes.includes(SCOPE_AGENT_WRITE);
}
