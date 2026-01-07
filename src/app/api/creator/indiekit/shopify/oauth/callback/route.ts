import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Verify signed state parameter
function verifySignedState(state: string): { valid: boolean; data?: { userId: string; shopDomain: string; timestamp: number } } {
  try {
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    const { payload, signature } = decoded;

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (signature !== expectedSignature) {
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
      return NextResponse.redirect(new URL("/auth/signin?error=unauthorized", req.url));
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shop = searchParams.get("shop");

    // Check for error from Shopify
    const error = searchParams.get("error");
    if (error) {
      const errorDesc = searchParams.get("error_description") || "Authorization failed";
      console.error("Shopify OAuth error:", error, errorDesc);
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
      console.error("Invalid or expired state parameter");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Invalid or expired authorization request", req.url)
      );
    }

    const { userId, shopDomain } = stateResult.data;

    // Verify user matches
    if (userId !== session.user.id) {
      console.error("User mismatch in OAuth callback");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Authorization mismatch", req.url)
      );
    }

    // Verify shop matches
    if (shop !== shopDomain) {
      console.error("Shop mismatch in OAuth callback:", shop, "vs", shopDomain);
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
      console.error("Missing Shopify API credentials for user:", session.user.id);
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Shopify API credentials not configured. Please add them in the Shopify API Key settings.", req.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: user.shopifyApiKey,
        client_secret: user.shopifyApiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to exchange code for token:", errorText);
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Failed to complete authorization", req.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch shop info
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    });

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
        shopifyAccessToken: accessToken,
        shopifyShopDomain: shop,
      },
    });

    // Redirect back to IndieKit settings with success
    return NextResponse.redirect(
      new URL(`/dashboard/indiekit?shopify=connected&shop=${encodeURIComponent(shopInfo.name)}`, req.url)
    );
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/indiekit?error=Failed to complete Shopify authorization", req.url)
    );
  }
}
