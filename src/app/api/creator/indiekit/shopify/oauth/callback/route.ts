import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitShopifyOauthCallbackLogger = logger.child({ module: "creator-indiekit-shopify-oauth-callback" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { decryptCredential, encryptCredential } from "@/lib/encryption";
import { circuitBreaker } from "@/lib/circuit-breaker";

export const dynamic = "force-dynamic";

// Verify signed state parameter
function verifySignedState(state: string): { valid: boolean; data?: { userId: string; shopDomain: string; timestamp: number } } {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET is not configured");
    }
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    const { payload, signature } = decoded;

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false };
      }
    } catch {
      return { valid: false };
    }

    const data = JSON.parse(payload);

    // Check if state is not expired (10 minutes)
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      return { valid: false };
    }

    return { valid: true, data };
  } catch {
    return { valid: false };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shop = searchParams.get("shop");

    // Check for error from Shopify
    const error = searchParams.get("error");
    if (error) {
      const errorDesc = searchParams.get("error_description") || "Authorization failed";
      creatorIndiekitShopifyOauthCallbackLogger.error({ err: `${error}: ${errorDesc}` }, "Shopify OAuth error:");
      return NextResponse.redirect(
        new URL(`/dashboard/indiekit?error=${encodeURIComponent(errorDesc)}`, req.url)
      );
    }

    if (!code || !state || !shop) {
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Missing OAuth parameters", req.url)
      );
    }

    // Verify state parameter
    const stateResult = verifySignedState(state);
    if (!stateResult.valid || !stateResult.data) {
      creatorIndiekitShopifyOauthCallbackLogger.error("Invalid or expired state parameter");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Invalid or expired authorization request", req.url)
      );
    }

    const { userId, shopDomain } = stateResult.data;

    // Verify user matches
    if (userId !== session.user.id) {
      creatorIndiekitShopifyOauthCallbackLogger.error("User mismatch in OAuth callback");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Authorization mismatch", req.url)
      );
    }

    // Verify shop matches
    if (shop !== shopDomain) {
      creatorIndiekitShopifyOauthCallbackLogger.error({ err: `${shop} vs ${shopDomain}` }, "Shop mismatch in OAuth callback:");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Shop mismatch", req.url)
      );
    }

    // Get user's Shopify API credentials
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        shopifyApiKey: true,
        shopifyApiSecret: true,
      },
    });

    if (!user?.shopifyApiKey || !user?.shopifyApiSecret) {
      creatorIndiekitShopifyOauthCallbackLogger.error({ err: String(session.user.id) }, "Missing Shopify API credentials for user:");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Shopify API credentials not configured. Please add them in the Shopify API Key settings.", req.url)
      );
    }

    // Decrypt credentials (with backwards compatibility for unencrypted values)
    let apiKey: string;
    let apiSecret: string;
    try {
      apiKey = decryptCredential(user.shopifyApiKey);
    } catch {
      apiKey = user.shopifyApiKey;
    }
    try {
      apiSecret = decryptCredential(user.shopifyApiSecret);
    } catch {
      apiSecret = user.shopifyApiSecret;
    }

    // Exchange code for access token
    const tokenResponse = await circuitBreaker.execute("shopify", () =>
      fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      })
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      creatorIndiekitShopifyOauthCallbackLogger.error({ err: String(errorText) }, "Failed to exchange code for token:");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Failed to complete authorization", req.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch shop info
    const shopResponse = await circuitBreaker.execute("shopify", () =>
      fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      })
    );

    let shopInfo = { name: shop, email: "" };
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      shopInfo = {
        name: shopData.shop.name,
        email: shopData.shop.email,
      };
    }

    // Save access token and shop domain to user's account
    await db.user.update({
      where: { id: session.user.id },
      data: {
        shopifyAccessToken: encryptCredential(accessToken),
        shopifyShopDomain: shop,
      },
    });

    // Redirect back to IndieKit settings with success
    // Use NEXT_PUBLIC_APP_URL to ensure we redirect to the correct domain
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.url;
    return NextResponse.redirect(
      new URL(`/dashboard/indiekit?shopify=connected&shop=${encodeURIComponent(shopInfo.name)}`, appUrl)
    );
  } catch (error) {
    creatorIndiekitShopifyOauthCallbackLogger.error({ err: String(error) }, "Shopify OAuth callback error:");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.url;
    return NextResponse.redirect(
      new URL("/dashboard/indiekit?error=Failed to complete Shopify authorization", appUrl)
    );
  }
}
