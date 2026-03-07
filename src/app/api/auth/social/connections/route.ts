import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const authSocialConnectionsLogger = logger.child({ module: "auth-social-connections" });
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OAuthProvider } from "@/lib/oauth/config";

// GET - List all social connections for the current user
export async function GET() {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const accounts = await db.account.findMany({
      where: {
        userId: session.user.id,
        provider: {
          in: ["youtube", "facebook", "twitter", "instagram"],
        },
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        expires_at: true,
        scope: true,
      },
    });

    // Transform to a more friendly format
    const connections: Record<string, {
      connected: boolean;
      accountId?: string;
      providerAccountId?: string;
      expiresAt?: number | null;
      scope?: string | null;
    }> = {
      youtube: { connected: false },
      facebook: { connected: false },
      twitter: { connected: false },
      instagram: { connected: false },
    };

    for (const account of accounts) {
      connections[account.provider] = {
        connected: true,
        accountId: account.id,
        providerAccountId: account.providerAccountId,
        expiresAt: account.expires_at,
        scope: account.scope,
      };
    }

    return NextResponse.json({ connections });
  } catch (error) {
    authSocialConnectionsLogger.error({ err: String(error) }, "Error fetching social connections:");
    return NextResponse.json(
      { error: "Failed to fetch social connections" },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect a social provider
export async function DELETE(request: NextRequest) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { provider } = await request.json();

    const validProviders: OAuthProvider[] = ["youtube", "facebook", "twitter", "instagram"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    // Delete all accounts for this provider and user
    const result = await db.account.deleteMany({
      where: {
        userId: session.user.id,
        provider,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: `No ${provider} connection found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Successfully disconnected from ${provider}`,
      deleted: result.count,
    });
  } catch (error) {
    authSocialConnectionsLogger.error({ err: String(error) }, "Error disconnecting social provider:");
    return NextResponse.json(
      { error: "Failed to disconnect social provider" },
      { status: 500 }
    );
  }
}
