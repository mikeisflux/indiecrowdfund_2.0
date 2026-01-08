import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/creator/indiekit/shipping-providers/credentials
 * Get shipping provider credential status for the current user
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
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

    // Return credential status (with masked previews for saved credentials)
    return NextResponse.json({
      shipstation: {
        hasCredentials: !!(user.shipstationApiKey && user.shipstationApiSecret),
        apiKeyPreview: user.shipstationApiKey
          ? `${user.shipstationApiKey.substring(0, 8)}••••••••`
          : null,
      },
      shippo: {
        hasCredentials: !!user.shippoApiToken,
        apiTokenPreview: user.shippoApiToken
          ? `${user.shippoApiToken.substring(0, 12)}••••••••`
          : null,
      },
      easypost: {
        hasCredentials: !!user.easypostApiKey,
        apiKeyPreview: user.easypostApiKey
          ? `${user.easypostApiKey.substring(0, 8)}••••••••`
          : null,
      },
      stamps: {
        hasCredentials: !!(user.stampsIntegrationId && user.stampsUsername && user.stampsPassword),
        integrationIdPreview: user.stampsIntegrationId
          ? `${user.stampsIntegrationId.substring(0, 4)}••••••••`
          : null,
        usernamePreview: user.stampsUsername
          ? `${user.stampsUsername.substring(0, 4)}••••`
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting shipping provider credentials:", error);
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
    const session = await getSession();
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
      case "shipstation":
        if (!credentials.apiKey || !credentials.apiSecret) {
          return NextResponse.json(
            { error: "ShipStation requires API Key and API Secret" },
            { status: 400 }
          );
        }
        updateData.shipstationApiKey = credentials.apiKey;
        updateData.shipstationApiSecret = credentials.apiSecret;
        break;

      case "shippo":
        if (!credentials.apiToken) {
          return NextResponse.json(
            { error: "Shippo requires API Token" },
            { status: 400 }
          );
        }
        updateData.shippoApiToken = credentials.apiToken;
        break;

      case "easypost":
        if (!credentials.apiKey) {
          return NextResponse.json(
            { error: "EasyPost requires API Key" },
            { status: 400 }
          );
        }
        updateData.easypostApiKey = credentials.apiKey;
        break;

      case "stamps":
        if (!credentials.integrationId || !credentials.username || !credentials.password) {
          return NextResponse.json(
            { error: "Stamps.com requires Integration ID, Username, and Password" },
            { status: 400 }
          );
        }
        updateData.stampsIntegrationId = credentials.integrationId;
        updateData.stampsUsername = credentials.username;
        updateData.stampsPassword = credentials.password;
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
    console.error("Error saving shipping provider credentials:", error);
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
    const session = await getSession();
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
    console.error("Error clearing shipping provider credentials:", error);
    return NextResponse.json(
      { error: "Failed to clear credentials" },
      { status: 500 }
    );
  }
}
