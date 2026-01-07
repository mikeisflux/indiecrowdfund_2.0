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

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const shopDomain = searchParams.get("shop");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    if (!shopDomain) {
      return NextResponse.json({ error: "Shop domain required" }, { status: 400 });
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
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get Shopify API credentials from project's FulfillmentIntegration
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

    if (!shopifyApiKey) {
      return NextResponse.json({
        error: "Shopify API credentials not configured. Please add your API Key in the Shopify API Key settings section."
      }, { status: 400 });
    }

    // Clean up shop domain
    const cleanShop = shopDomain
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim();

    // Ensure it has .myshopify.com suffix
    const shopHost = cleanShop.includes(".myshopify.com")
      ? cleanShop
      : `${cleanShop}.myshopify.com`;

    // Generate signed state parameter for CSRF protection
    const state = createSignedState({
      projectId,
      userId: session.user.id,
      shopDomain: shopHost,
      timestamp: Date.now(),
    });

    // Build Shopify OAuth authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/creator/indiekit/shopify/oauth/callback`;

    const authUrl = new URL(`https://${shopHost}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", shopifyApiKey);
    authUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Shopify OAuth authorize error:", error);
    return NextResponse.json({ error: "Failed to initiate Shopify authorization" }, { status: 500 });
  }
}
