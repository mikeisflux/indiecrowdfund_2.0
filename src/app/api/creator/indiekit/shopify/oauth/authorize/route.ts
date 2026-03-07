import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Required Shopify scopes for IndieKit fulfillment
const SHOPIFY_SCOPES = [
  "read_products",
  "write_draft_orders",
  "read_orders",
  "write_orders",
  "read_fulfillments",
  "write_fulfillments",
].join(",");

// Create a signed state parameter
function createSignedState(data: object): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const { searchParams } = new URL(req.url);
    const shopDomain = searchParams.get("shop");

    if (!shopDomain) {
      return NextResponse.json({ error: "Shop domain required" }, { status: 400 });
    }

    // Get Shopify API credentials from user's account
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        shopifyApiKey: true,
        shopifyApiSecret: true,
      },
    });

    if (!user?.shopifyApiKey) {
      return NextResponse.json({
        error: "Shopify API credentials not configured. Please add your API Key in the Shopify API Key settings section."
      }, { status: 400 });
    }

    // Clean up shop domain - handle various input formats
    let cleanShop = shopDomain
      .toLowerCase()
      .replace(/^https?:\/\//, "")  // Remove protocol
      .replace(/\/$/, "")            // Remove trailing slash
      .replace(/\/.*$/, "")          // Remove any path
      .trim();

    // Extract just the store name by removing common domain suffixes
    // Handle formats like: "storename", "storename.myshopify.com", "storename.my-shopify.com", etc.
    cleanShop = cleanShop
      .replace(/\.myshopify\.com$/, "")
      .replace(/\.my-shopify\.com$/, "")
      .replace(/\.shopify\.com$/, "");

    // Validate store name - should only contain alphanumeric and hyphens
    if (!/^[a-z0-9-]+$/.test(cleanShop)) {
      return NextResponse.json({
        error: "Invalid shop name. Please enter just your store name (e.g., 'my-store' or 'my-store.myshopify.com')"
      }, { status: 400 });
    }

    // Build the correct Shopify domain
    const shopHost = `${cleanShop}.myshopify.com`;

    // Generate signed state parameter for CSRF protection
    const state = createSignedState({
      userId: session.user.id,
      shopDomain: shopHost,
      timestamp: Date.now(),
    });

    // Build Shopify OAuth authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/creator/indiekit/shopify/oauth/callback`;

    const authUrl = new URL(`https://${shopHost}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", user.shopifyApiKey);
    authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Shopify OAuth authorize error:", error);
    return NextResponse.json({ error: "Failed to initiate Shopify authorization" }, { status: 500 });
  }
}
