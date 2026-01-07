import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Verify HMAC from Shopify
function verifyShopifyHmac(query: URLSearchParams, secret: string): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return true; // HMAC is optional for some flows

  // Remove hmac from query params
  const params = new URLSearchParams();
  query.forEach((value, key) => {
    if (key !== "hmac") {
      params.append(key, value);
    }
  });

  // Sort parameters
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(calculatedHmac)
    );
  } catch {
    return false;
  }
}

/**
 * This endpoint handles Shopify app installation/access requests.
 * When a merchant clicks "Install" or accesses the app from Shopify admin,
 * Shopify sends them here with shop and hmac parameters.
 *
 * Since our integration is project-based (each IndieKit project can connect
 * to a different Shopify store), we redirect users to sign in and then
 * to their IndieKit dashboard where they can select a project to connect.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    // If no shop parameter, redirect to home
    if (!shop) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Get Shopify API credentials from database or environment
    const platformSettings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { shopifyApiSecret: true },
    });

    const shopifyApiSecret = platformSettings?.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;

    // Verify HMAC if present and we have a secret
    if (searchParams.has("hmac") && shopifyApiSecret) {
      if (!verifyShopifyHmac(searchParams, shopifyApiSecret)) {
        console.error("Invalid Shopify HMAC");
        return NextResponse.redirect(new URL("/?error=invalid_signature", req.url));
      }
    }

    // Clean up shop domain for display
    const cleanShop = shop
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .replace(".myshopify.com", "")
      .trim();

    // Check if user is logged in
    const session = await auth();

    if (!session?.user?.id) {
      // User not logged in - redirect to sign in with return URL
      const returnUrl = `/dashboard/indiekit?connectShopify=${encodeURIComponent(shop)}`;
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`, req.url)
      );
    }

    // User is logged in - redirect to IndieKit dashboard with shop parameter
    // They can then select which project to connect this shop to
    return NextResponse.redirect(
      new URL(`/dashboard/indiekit?connectShopify=${encodeURIComponent(shop)}&shopName=${encodeURIComponent(cleanShop)}`, req.url)
    );
  } catch (error) {
    console.error("Shopify install error:", error);
    return NextResponse.redirect(new URL("/?error=install_failed", req.url));
  }
}
