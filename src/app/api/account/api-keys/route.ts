import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";
import { mintCredential, maskKey, SCOPE_READ_PUBLIC } from "@/lib/api/keys";

const log = logger.child({ module: "account-api-keys" });

export const dynamic = "force-dynamic";

/**
 * Self-service credentials for the public Data API.
 *
 * Signed-in only, and scoped to the caller's own keys throughout — every
 * query filters on userId, so one account can never see or revoke another's.
 * Admin oversight lives at /api/admin/api-keys; this route deliberately has
 * no admin bypass, because a route that can act on any key is a route that
 * has to get its authorization check right every single time.
 */

// Three is enough for prod + staging + a rotation overlap, and it caps how
// much damage one scripted account can do.
const MAX_KEYS_PER_USER = 3;

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  appName: z.string().trim().min(1).max(120),
  appUrl: z.string().trim().url().max(300),
  contactEmail: z.string().trim().email().max(200),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await db.apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        key: true,
        prefix: true,
        secretPrefix: true,
        environment: true,
        status: true,
        scopes: true,
        appName: true,
        appUrl: true,
        contactEmail: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
        revokedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    type KeyRow = (typeof keys)[number];
    return NextResponse.json({
      keys: (keys as KeyRow[]).map((k: KeyRow) => ({
        ...k,
        // The full key is safe to return to its owner; the secret is not, and
        // is not stored in a recoverable form anyway.
        maskedKey: maskKey(k.key),
      })),
      limit: MAX_KEYS_PER_USER,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to list API keys");
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());

    const active = await db.apiKey.count({
      where: { userId: session.user.id, status: "ACTIVE" },
    });
    if (active >= MAX_KEYS_PER_USER) {
      return NextResponse.json(
        {
          error: `You can have at most ${MAX_KEYS_PER_USER} active API keys. Revoke one to create another.`,
        },
        { status: 409 }
      );
    }

    const cred = mintCredential("PRODUCTION");

    await db.apiKey.create({
      data: {
        name: body.name,
        key: cred.key,
        keyHash: cred.keyHash,
        prefix: cred.prefix,
        secretHash: cred.secretHash,
        secretPrefix: cred.secretPrefix,
        environment: "PRODUCTION",
        status: "ACTIVE",
        scopes: [SCOPE_READ_PUBLIC],
        userId: session.user.id,
        createdById: session.user.id,
        appName: body.appName,
        appUrl: body.appUrl,
        contactEmail: body.contactEmail,
      },
    });

    log.info(
      { userId: session.user.id, prefix: cred.prefix, appName: body.appName },
      "Public API credential issued"
    );

    // The only time the secret is ever returned. It is not recoverable
    // afterwards by us or by the owner — losing it means regenerating.
    return NextResponse.json({
      success: true,
      key: cred.key,
      secret: cred.secret,
      warning:
        "Copy the secret now. It is hashed before storage and cannot be shown again — if you lose it, regenerate the key.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    log.error({ err: formatError(error) }, "Failed to create API key");
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing key id" }, { status: 400 });
    }

    // userId in the WHERE, not a fetch-then-check: the ownership test and the
    // write are the same statement, so there is no window between them and no
    // way to revoke a key you don't own.
    const revoked = await db.apiKey.updateMany({
      where: { id, userId: session.user.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), revokedById: session.user.id },
    });

    if (revoked.count === 0) {
      return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
    }

    log.info({ userId: session.user.id, keyId: id }, "Public API credential revoked by owner");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to revoke API key");
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
