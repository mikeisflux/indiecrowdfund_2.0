import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/encryption";

export const dynamic = "force-dynamic";

// GET - Retrieve Shopify API credentials status for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's Shopify credentials
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        shopifyApiKey: true,
        shopifyApiSecret: true,
        shopifyAccessToken: true,
        shopifyShopDomain: true,
      },
    });

    // Only return existence status and a preview of the API key (first 8 chars)
    const hasCredentials = !!(user?.shopifyApiKey && user?.shopifyApiSecret);
    let apiKeyPreview: string | null = null;
    if (user?.shopifyApiKey) {
      try {
        const decrypted = decryptCredential(user.shopifyApiKey);
        apiKeyPreview = `${decrypted.substring(0, 8)}••••••••`;
      } catch {
        // Key may be stored unencrypted (legacy) - show preview directly
        apiKeyPreview = `${user.shopifyApiKey.substring(0, 8)}••••••••`;
      }
    }

    // Also indicate if they have a connected store
    const hasConnectedStore = !!(user?.shopifyAccessToken && user?.shopifyShopDomain);
    const shopDomain = user?.shopifyShopDomain || null;

    return NextResponse.json({
      hasCredentials,
      apiKeyPreview,
      hasConnectedStore,
      shopDomain,
    });
  } catch (error) {
    console.error("Error fetching Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to fetch credentials" }, { status: 500 });
  }
}

// POST - Save Shopify API credentials for the current user
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey, apiSecret } = body;

    if (!apiKey && !apiSecret) {
      return NextResponse.json({ error: "API Key or API Secret required" }, { status: 400 });
    }

    // Build update object with encrypted values
    const updateData: { shopifyApiKey?: string; shopifyApiSecret?: string } = {};
    if (apiKey) updateData.shopifyApiKey = encryptCredential(apiKey);
    if (apiSecret) updateData.shopifyApiSecret = encryptCredential(apiSecret);

    // Update the user's Shopify credentials
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { shopifyApiKey: true },
    });

    // Show preview of the original (unencrypted) key
    const apiKeyPreview = apiKey
      ? `${apiKey.substring(0, 8)}••••••••`
      : null;

    return NextResponse.json({
      success: true,
      apiKeyPreview,
    });
  } catch (error) {
    console.error("Error saving Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
  }
}

// DELETE - Clear Shopify API credentials for the current user
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear all Shopify-related fields on the user
    await db.user.update({
      where: { id: session.user.id },
      data: {
        shopifyApiKey: null,
        shopifyApiSecret: null,
        shopifyAccessToken: null,
        shopifyShopDomain: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to clear credentials" }, { status: 500 });
  }
}
