import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/vault";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { verifyTwitterCredentials } from "@/lib/social/twitter";
import { decryptAccountCredentials } from "@/lib/social/creator-social";

const creatorSocialAccountLogger = logger.child({ module: "creator-social-account" });

/**
 * The creator's connected X account for the dashboard Social Hub.
 *
 * POST connects (verifies the four OAuth 1.0a values against
 * GET /2/users/me before saving them encrypted), PATCH flips the
 * auto-post switch, DELETE disconnects. Secrets never leave the server:
 * GET only reports connection state and the verified handle.
 */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await db.creatorSocialAccount.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: "twitter" } },
      select: { id: true, handle: true, autoPostEnabled: true, createdAt: true },
    });

    return NextResponse.json({
      connected: !!account,
      handle: account?.handle ?? null,
      autoPostEnabled: account?.autoPostEnabled ?? false,
      connectedAt: account?.createdAt ?? null,
    });
  } catch (error) {
    creatorSocialAccountLogger.error({ err: formatError(error) }, "Social account GET failed");
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const apiKey = String(body.apiKey || "").trim();
    const apiSecret = String(body.apiSecret || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const accessSecret = String(body.accessSecret || "").trim();

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return NextResponse.json(
        { error: "All four credentials are required (API Key, API Secret, Access Token, Access Token Secret)" },
        { status: 400 }
      );
    }

    // Prove the keys work before storing them — a typo'd secret should
    // fail here, not silently at the first scheduled post.
    const check = await verifyTwitterCredentials({ apiKey, apiSecret, accessToken, accessSecret });
    if (!check.ok) {
      return NextResponse.json(
        { error: `X rejected these credentials: ${check.error || "unknown error"}` },
        { status: 400 }
      );
    }

    const data = {
      apiKey: encryptSecret(apiKey),
      apiSecret: encryptSecret(apiSecret),
      accessToken: encryptSecret(accessToken),
      accessSecret: encryptSecret(accessSecret),
      handle: check.username ?? null,
    };

    const existing = await db.creatorSocialAccount.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: "twitter" } },
      select: { id: true },
    });
    if (existing) {
      await db.creatorSocialAccount.update({ where: { id: existing.id }, data });
    } else {
      await db.creatorSocialAccount.create({
        data: { userId: session.user.id, platform: "twitter", ...data },
      });
    }

    creatorSocialAccountLogger.info(
      { userId: session.user.id, handle: check.username },
      "Creator X account connected"
    );
    return NextResponse.json({ success: true, handle: check.username });
  } catch (error) {
    creatorSocialAccountLogger.error({ err: formatError(error) }, "Social account connect failed");
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const account = await db.creatorSocialAccount.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: "twitter" } },
      select: { id: true, apiKey: true, apiSecret: true, accessToken: true, accessSecret: true },
    });
    if (!account) {
      return NextResponse.json({ error: "No X account connected" }, { status: 404 });
    }

    if (typeof body.autoPostEnabled === "boolean") {
      // Turning auto-post ON re-verifies the stored keys, so a creator
      // whose app was revoked finds out now instead of via silent
      // failures at their next milestone.
      if (body.autoPostEnabled) {
        const check = await verifyTwitterCredentials(decryptAccountCredentials(account));
        if (!check.ok) {
          return NextResponse.json(
            { error: `Your stored X credentials no longer work (${check.error}). Reconnect the account first.` },
            { status: 400 }
          );
        }
      }
      await db.creatorSocialAccount.update({
        where: { id: account.id },
        data: { autoPostEnabled: body.autoPostEnabled },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorSocialAccountLogger.error({ err: formatError(error) }, "Social account PATCH failed");
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await db.creatorSocialAccount.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: "twitter" } },
      select: { id: true },
    });
    if (account) {
      // Scheduled posts can't go out without credentials — cancel them
      // explicitly so they don't sit as zombie SCHEDULED rows.
      await db.creatorSocialPost.updateMany({
        where: { accountId: account.id, status: "SCHEDULED" },
        data: { status: "CANCELLED", error: "X account disconnected" },
      });
      await db.creatorSocialAccount.delete({ where: { id: account.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorSocialAccountLogger.error({ err: formatError(error) }, "Social account disconnect failed");
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
