import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { mintCredential } from "@/lib/api/keys";
import { SCOPE_AGENT_READ, SCOPE_AGENT_WRITE } from "@/lib/agent-api/auth";

const log = logger.child({ module: "admin-agent-api-keys" });

/**
 * Agent API keys. SUPER_ADMIN only: these credentials can read every backer
 * on the platform, so issuing one is not an ADMIN-level action.
 */

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "SUPER_ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: session.user.id };
}

const AGENT_SCOPES = [SCOPE_AGENT_READ, SCOPE_AGENT_WRITE];

export async function GET() {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;
  try {
    const keys = await db.apiKey.findMany({
      where: { scopes: { hasSome: AGENT_SCOPES } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, prefix: true, secretPrefix: true, scopes: true, status: true, lastUsedAt: true, lastUsedIp: true, usageCount: true,
        createdAt: true, expiresAt: true, revokedAt: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { agentCalls: true } },
      },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    log.error({ err: formatError(error) }, "list agent keys failed");
    return NextResponse.json({ error: "Failed to load keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Name must be 2-80 characters" }, { status: 400 });
    const allowWrite = body.allowWrite === true;
    const expiresInDays = Number(body.expiresInDays);
    const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86_400_000) : null;

    const minted = mintCredential("PRODUCTION");
    const created = await db.apiKey.create({
      data: {
        name,
        key: minted.key,
        keyHash: minted.keyHash,
        prefix: minted.prefix,
        secretHash: minted.secretHash,
        secretPrefix: minted.secretPrefix,
        environment: "PRODUCTION",
        status: "ACTIVE",
        scopes: allowWrite ? [SCOPE_AGENT_READ, SCOPE_AGENT_WRITE] : [SCOPE_AGENT_READ],
        appName: "Agent API (MCP)",
        createdById: gate.userId,
        expiresAt,
      },
      select: { id: true, name: true, scopes: true, createdAt: true, expiresAt: true },
    });
    log.info({ keyId: created.id, by: gate.userId, scopes: created.scopes }, "agent API key issued");
    // The secret is returned exactly once. Only its hash is stored.
    return NextResponse.json({ key: created, credentials: { apiKey: minted.key, apiSecret: minted.secret } });
  } catch (error) {
    log.error({ err: formatError(error) }, "create agent key failed");
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

/** Revoke (never delete): the call log keeps pointing at the key's name. */
export async function DELETE(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const res = await db.apiKey.updateMany({
      where: { id, scopes: { hasSome: AGENT_SCOPES }, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), revokedById: gate.userId },
    });
    if (res.count === 0) return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
    log.info({ keyId: id, by: gate.userId }, "agent API key revoked");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: formatError(error) }, "revoke agent key failed");
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
