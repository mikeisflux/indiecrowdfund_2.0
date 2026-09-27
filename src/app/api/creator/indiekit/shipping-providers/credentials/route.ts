import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";

const creatorIndiekitShippingProvidersCredentialsLogger = logger.child({ module: "creator-indiekit-shipping-providers-credentials" });
import { db } from "@/lib/db";
import { shipStationFetch, getShipStationAuthHeader } from "@/lib/fulfillment/shipstation-client";
import { encryptCredential, decryptCredential } from "@/lib/encryption";

/** Decrypt a stored credential, falling back to plaintext for legacy values */
function safeDecrypt(value: string): string {
  try { return decryptCredential(value); } catch { return value; }
}

/**
 * GET /api/creator/indiekit/shipping-providers/credentials
 * Get shipping provider credential status for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        // ShipStation
        shipstationApiKey: true,
        shipstationApiSecret: true,
        // Shippo
        shippoApiToken: true,
        // EasyPost
        easypostApiKey: true,
        // Stamps.com
        stampsIntegrationId: true,
        stampsUsername: true,
        stampsPassword: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Decrypt for preview display
    const ssKey = user.shipstationApiKey ? safeDecrypt(user.shipstationApiKey) : null;
    const shippoToken = user.shippoApiToken ? safeDecrypt(user.shippoApiToken) : null;
    const epKey = user.easypostApiKey ? safeDecrypt(user.easypostApiKey) : null;
    const stIntId = user.stampsIntegrationId ? safeDecrypt(user.stampsIntegrationId) : null;
    const stUser = user.stampsUsername ? safeDecrypt(user.stampsUsername) : null;

    // Return credential status (with masked previews for saved credentials)
    return NextResponse.json({
      shipstation: {
        hasCredentials: !!(user.shipstationApiKey && user.shipstationApiSecret),
        apiKeyPreview: ssKey ? `${ssKey.substring(0, 8)}••••••••` : null,
      },
      shippo: {
        hasCredentials: !!user.shippoApiToken,
        apiTokenPreview: shippoToken ? `${shippoToken.substring(0, 12)}••••••••` : null,
      },
      easypost: {
        hasCredentials: !!user.easypostApiKey,
        apiKeyPreview: epKey ? `${epKey.substring(0, 8)}••••••••` : null,
      },
      stamps: {
        hasCredentials: !!(user.stampsIntegrationId && user.stampsUsername && user.stampsPassword),
        integrationIdPreview: stIntId ? `${stIntId.substring(0, 4)}••••••••` : null,
        usernamePreview: stUser ? `${stUser.substring(0, 4)}••••` : null,
      },
    });
  } catch (error) {
    creatorIndiekitShippingProvidersCredentialsLogger.error({ err: formatError(error) }, "Error getting shipping provider credentials:");
    return NextResponse.json(
      { error: "Failed to get credentials" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/indiekit/shipping-providers/credentials
 * Save shipping provider credentials for the current user
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, credentials } = body;

    if (!provider || !credentials) {
      return NextResponse.json(
        { error: "Provider and credentials are required" },
        { status: 400 }
      );
    }

    // Build update data based on provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    switch (provider) {
      case "shipstation": {
        if (!credentials.apiKey || !credentials.apiSecret) {
          return NextResponse.json(
            { error: "ShipStation requires API Key and API Secret" },
            { status: 400 }
          );
        }
        // Prove the keys work before saving. Unverified keys are how
        // "API credentials saved — integration is ready" ended up meaning
        // nothing until a push failed in the middle of a fulfilment run.
        const check = await shipStationFetch("/carriers", {
          headers: { Authorization: getShipStationAuthHeader(String(credentials.apiKey).trim(), String(credentials.apiSecret).trim()) },
        }).catch(() => null);
        if (!check) {
          return NextResponse.json({ error: "Couldn't reach ShipStation just now. Try again in a minute." }, { status: 502 });
        }
        if (check.status === 401 || check.status === 403) {
          return NextResponse.json(
            { error: "ShipStation rejected those credentials. Check the API Key and API Secret under Settings > Account > API Settings." },
            { status: 400 }
          );
        }
        if (!check.ok) {
          return NextResponse.json({ error: `ShipStation returned ${check.status} while verifying the keys` }, { status: 502 });
        }
        updateData.shipstationApiKey = encryptCredential(String(credentials.apiKey).trim());
        updateData.shipstationApiSecret = encryptCredential(String(credentials.apiSecret).trim());
        break;
      }

      case "shippo":
        if (!credentials.apiToken) {
          return NextResponse.json(
            { error: "Shippo requires API Token" },
            { status: 400 }
          );
        }
        updateData.shippoApiToken = encryptCredential(credentials.apiToken);
        break;

      case "easypost":
        if (!credentials.apiKey) {
          return NextResponse.json(
            { error: "EasyPost requires API Key" },
            { status: 400 }
          );
        }
        updateData.easypostApiKey = encryptCredential(credentials.apiKey);
        break;

      case "stamps":
        if (!credentials.integrationId || !credentials.username || !credentials.password) {
          return NextResponse.json(
            { error: "Stamps.com requires Integration ID, Username, and Password" },
            { status: 400 }
          );
        }
        updateData.stampsIntegrationId = encryptCredential(credentials.integrationId);
        updateData.stampsUsername = encryptCredential(credentials.username);
        updateData.stampsPassword = encryptCredential(credentials.password);
        break;

      default:
        return NextResponse.json(
          { error: "Unknown provider" },
          { status: 400 }
        );
    }

    // Update user with credentials
    await db.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${provider} credentials saved successfully`,
    });
  } catch (error) {
    creatorIndiekitShippingProvidersCredentialsLogger.error({ err: formatError(error) }, "Error saving shipping provider credentials:");
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/creator/indiekit/shipping-providers/credentials
 * Clear shipping provider credentials for the current user
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    // Build update data to clear credentials based on provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    switch (provider) {
      case "shipstation":
        updateData.shipstationApiKey = null;
        updateData.shipstationApiSecret = null;
        break;

      case "shippo":
        updateData.shippoApiToken = null;
        break;

      case "easypost":
        updateData.easypostApiKey = null;
        break;

      case "stamps":
        updateData.stampsIntegrationId = null;
        updateData.stampsUsername = null;
        updateData.stampsPassword = null;
        break;

      default:
        return NextResponse.json(
          { error: "Unknown provider" },
          { status: 400 }
        );
    }

    // Update user to clear credentials
    await db.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${provider} credentials cleared successfully`,
    });
  } catch (error) {
    creatorIndiekitShippingProvidersCredentialsLogger.error({ err: formatError(error) }, "Error clearing shipping provider credentials:");
    return NextResponse.json(
      { error: "Failed to clear credentials" },
      { status: 500 }
    );
  }
}
