import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Verify signed state parameter
function verifySignedState(state: string): { valid: boolean; data?: { projectId: string; userId: string; shopDomain: string; timestamp: number } } {
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

// Verify HMAC from Shopify
function verifyShopifyHmac(query: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const hmac = query.get("hmac");
  if (!hmac) return false;

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

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(calculatedHmac)
  );
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

    // Verify HMAC from Shopify (if present)
    if (searchParams.has("hmac") && !verifyShopifyHmac(searchParams)) {
      console.error("Invalid Shopify HMAC");
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Invalid request signature", req.url)
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

    const { projectId, userId, shopDomain } = stateResult.data;

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

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Project not found", req.url)
      );
    }

    // Exchange code for access token - get credentials from project's FulfillmentIntegration
    const integration = await db.fulfillmentIntegration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
    });

    const credentials = integration?.credentials as {
      apiKey?: string;
      apiSecret?: string;
    } | null;

    const shopifyApiKey = credentials?.apiKey;
    const shopifyApiSecret = credentials?.apiSecret;

    if (!shopifyApiKey || !shopifyApiSecret) {
      console.error("Missing Shopify API credentials for project:", projectId);
      return NextResponse.redirect(
        new URL("/dashboard/indiekit?error=Shopify API credentials not configured. Please add them in the Shopify API Key settings.", req.url)
      );
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: shopifyApiKey,
        client_secret: shopifyApiSecret,
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
    const scope = tokenData.scope;

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

    // Save integration to database
    await db.fulfillmentIntegration.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
      create: {
        projectId,
        provider: "SHOPIFY",
        status: "CONNECTED",
        credentials: {
          shopDomain: shop,
          accessToken,
          shopName: shopInfo.name,
          shopEmail: shopInfo.email,
          scope,
          connectedVia: "oauth",
        },
      },
      update: {
        status: "CONNECTED",
        credentials: {
          shopDomain: shop,
          accessToken,
          shopName: shopInfo.name,
          shopEmail: shopInfo.email,
          scope,
          connectedVia: "oauth",
        },
        lastSyncError: null,
      },
    });

    // Redirect back to IndieKit settings with success
    return NextResponse.redirect(
      new URL(`/dashboard/indiekit?projectId=${projectId}&shopify=connected&shop=${encodeURIComponent(shopInfo.name)}`, req.url)
    );
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/indiekit?error=Failed to complete Shopify authorization", req.url)
    );
  }
}
