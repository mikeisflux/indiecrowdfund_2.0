import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    // Note: HMAC verification requires knowing which project this is for to get the API secret.
    // Since this endpoint is reached from Shopify admin (before project context), we skip HMAC
    // verification here. The actual OAuth flow will verify credentials when the user connects.

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
