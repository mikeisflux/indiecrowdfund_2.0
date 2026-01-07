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
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
}

/**
 * This endpoint handles Shopify app installation/access requests.
 * When a merchant clicks "Install" from the Shopify Partners dashboard or admin,
 * Shopify sends them here with shop and hmac parameters.
 *
 * This endpoint will:
 * 1. Check if the user is logged in
 * 2. If logged in with Shopify credentials, initiate OAuth automatically
 * 3. If logged in without credentials, redirect to settings to add them
 * 4. If not logged in, redirect to sign in with callback URL
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    // If no shop parameter, redirect to IndieKit dashboard
    if (!shop) {
      return NextResponse.redirect(new URL("/dashboard/indiekit", req.url));
    }

    // Clean up shop domain - handle various input formats
    let cleanShop = shop
      .toLowerCase()
      .replace(/^https?:\/\//, "")  // Remove protocol
      .replace(/\/$/, "")            // Remove trailing slash
      .replace(/\/.*$/, "")          // Remove any path
      .trim();

    // Extract just the store name by removing common domain suffixes
    cleanShop = cleanShop
      .replace(/\.myshopify\.com$/, "")
      .replace(/\.my-shopify\.com$/, "")
      .replace(/\.shopify\.com$/, "");

    // Build the correct Shopify domain
    const shopHost = `${cleanShop}.myshopify.com`;

    // Check if user is logged in
    const session = await auth();

    if (!session?.user?.id) {
      // User not logged in - redirect to sign in with return URL
      // Use the install endpoint as callback so we can continue the flow
      const callbackUrl = `/api/creator/indiekit/shopify/install?shop=${encodeURIComponent(shop)}`;
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
      );
    }

    // User is logged in - check if they have Shopify credentials
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        shopifyApiKey: true,
        shopifyApiSecret: true,
      },
    });

    if (!user?.shopifyApiKey || !user?.shopifyApiSecret) {
      // User doesn't have Shopify credentials - redirect to IndieKit settings
      // with a message to add credentials
      return NextResponse.redirect(
        new URL(`/dashboard/indiekit?tab=settings&shopify=needs_credentials&shop=${encodeURIComponent(shopHost)}`, req.url)
      );
    }

    // User has credentials - start the OAuth flow automatically
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
    console.error("Shopify install error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/indiekit?error=Failed to install Shopify app", req.url)
    );
  }
}
