import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { decryptCredential } from "@/lib/encryption";

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
    throw new Error("NEXTAUTH_SECRET is not configured — cannot sign OAuth state");
  }
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * This page handles Shopify app installation/access requests.
 * When a merchant clicks "Install" from the Shopify Partners dashboard or admin,
 * Shopify sends them here with shop and hmac parameters.
 *
 * App URL in Shopify Partners should be set to:
 * https://yourdomain.com/dashboard/indiekit/shopify/install
 *
 * This page will:
 * 1. Check if the user is logged in
 * 2. If logged in with Shopify credentials, initiate OAuth automatically
 * 3. If logged in without credentials, redirect to settings to add them
 * 4. If not logged in, redirect to sign in with callback URL
 */
export default async function ShopifyInstallPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const shop = typeof resolvedParams.shop === "string" ? resolvedParams.shop : null;

  // If no shop parameter, redirect to IndieKit dashboard
  if (!shop) {
    redirect("/dashboard/indiekit");
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
    // Use this install page as callback so we can continue the flow
    const callbackUrl = `/dashboard/indiekit/shopify/install?shop=${encodeURIComponent(shop)}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
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
    redirect(`/dashboard/indiekit?tab=settings&shopify=needs_credentials&shop=${encodeURIComponent(shopHost)}`);
  }

  // User has credentials - start the OAuth flow automatically
  // Generate signed state parameter for CSRF protection
  const state = createSignedState({
    userId: session.user.id,
    shopDomain: shopHost,
    timestamp: Date.now(),
  });

  // Build Shopify OAuth authorization URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  const redirectUri = `${appUrl}/api/creator/indiekit/shopify/oauth/callback`;

  const authUrl = new URL(`https://${shopHost}/admin/oauth/authorize`);
  // Decrypt API key (backwards compatible with legacy unencrypted values)
  let apiKey: string;
  try {
    apiKey = decryptCredential(user.shopifyApiKey);
  } catch {
    apiKey = user.shopifyApiKey;
  }
  authUrl.searchParams.set("client_id", apiKey);
  authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  redirect(authUrl.toString());
}
