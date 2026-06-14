import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitShopifyLogger = logger.child({ module: "creator-indiekit-shopify" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { encryptCredential, decryptCredential } from "@/lib/encryption";
import { pushOrdersToShopify } from "@/lib/shopify-push";

export const dynamic = "force-dynamic";

// Types for Shopify API responses
interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  fulfillment_status: string | null;
}

interface ShopifyFulfillment {
  id: number;
  order_id: number;
  status: string;
  tracking_number: string | null;
  tracking_company: string | null;
  tracking_url: string | null;
}

// Helper to make Shopify API requests
async function shopifyFetch<T>(
  shopDomain: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/2026-01/${endpoint}`;

  const response = await circuitBreaker.execute("shopify", () =>
    fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
        ...options.headers,
      },
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// GET - Get Shopify integration status and orders
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const action = searchParams.get("action");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get Shopify integration for this project
    const integration = await db.fulfillmentIntegration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
    });

    if (action === "status") {
      if (!integration) {
        return NextResponse.json({
          connected: false,
          shop: null,
          stats: null,
        });
      }

      const credentials = integration.credentials as {
        shopDomain: string;
        accessToken: string;
        shopName?: string;
      };

      // Get order stats
      const orderStats = await db.shopifyFulfillmentOrder.groupBy({
        by: ["status"],
        where: { projectId },
        _count: { status: true },
      });

      const stats = {
        pending: 0,
        pushed: 0,
        processing: 0,
        fulfilled: 0,
        shipped: 0,
        delivered: 0,
        failed: 0,
      };

      orderStats.forEach((stat: { status: string; _count: { status: number } }) => {
        const key = stat.status.toLowerCase() as keyof typeof stats;
        if (key in stats) {
          stats[key] = stat._count.status;
        }
      });

      return NextResponse.json({
        connected: integration.status === "CONNECTED",
        status: integration.status,
        shop: {
          domain: credentials.shopDomain,
          name: credentials.shopName || credentials.shopDomain,
        },
        stats,
        lastSyncAt: integration.lastSyncAt,
        lastSyncError: integration.lastSyncError,
      });
    }

    if (action === "orders") {
      // Get Shopify orders for this project
      const orders = await db.shopifyFulfillmentOrder.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return NextResponse.json({ orders });
    }

    return NextResponse.json({
      connected: !!integration && integration.status === "CONNECTED",
      integration: integration
        ? {
            id: integration.id,
            status: integration.status,
            ordersPushed: integration.ordersPushed,
            ordersShipped: integration.ordersShipped,
            ordersFailed: integration.ordersFailed,
            lastSyncAt: integration.lastSyncAt,
          }
        : null,
    });
  } catch (error) {
    creatorIndiekitShopifyLogger.error({ err: formatError(error) }, "Shopify GET error:");
    return NextResponse.json({ error: "Failed to fetch Shopify integration" }, { status: 500 });
  }
}

// POST - Connect, push orders, or sync status
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, shopDomain, accessToken, backerIds } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        creatorId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Check if user is the creator (needed for connect/disconnect actions)
    const isCreator = project.creatorId === session.user.id;

    // CONNECT - Link Shopify store (creator only)
    if (action === "connect") {
      if (!isCreator) {
        return NextResponse.json(
          { error: "Only the project creator can connect integrations" },
          { status: 403 }
        );
      }
      if (!shopDomain || !accessToken) {
        return NextResponse.json(
          { error: "Shop domain and access token are required" },
          { status: 400 }
        );
      }

      // Clean up shop domain (remove https:// and trailing slashes)
      const cleanDomain = shopDomain
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .trim();

      // Verify connection by fetching shop info
      try {
        const shopResponse = await shopifyFetch<{ shop: ShopifyShop }>(
          cleanDomain,
          accessToken,
          "shop.json"
        );

        // Upsert the integration
        const integration = await db.fulfillmentIntegration.upsert({
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
              shopDomain: cleanDomain,
              accessToken: encryptCredential(accessToken),
              shopName: shopResponse.shop.name,
              shopEmail: shopResponse.shop.email,
            },
          },
          update: {
            status: "CONNECTED",
            credentials: {
              shopDomain: cleanDomain,
              accessToken: encryptCredential(accessToken),
              shopName: shopResponse.shop.name,
              shopEmail: shopResponse.shop.email,
            },
            lastSyncError: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Connected to ${shopResponse.shop.name}`,
          shop: {
            name: shopResponse.shop.name,
            domain: cleanDomain,
            email: shopResponse.shop.email,
          },
          integration: {
            id: integration.id,
            status: integration.status,
          },
        });
      } catch (shopifyError) {
        creatorIndiekitShopifyLogger.error({ err: String(shopifyError) }, "Shopify connection error:");
        return NextResponse.json(
          {
            error: "Failed to connect to Shopify. Please verify your shop domain and access token.",
            details: shopifyError instanceof Error ? shopifyError.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    // DISCONNECT - Remove Shopify integration (creator only)
    if (action === "disconnect") {
      if (!isCreator) {
        return NextResponse.json(
          { error: "Only the project creator can disconnect integrations" },
          { status: 403 }
        );
      }

      await db.fulfillmentIntegration.update({
        where: {
          projectId_provider: {
            projectId,
            provider: "SHOPIFY",
          },
        },
        data: {
          status: "DISCONNECTED",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Shopify disconnected",
      });
    }

    // PUSH_ORDERS - Push backer orders to Shopify as draft orders.
    //
    // Delegates to the shared pushOrdersToShopify in
    // src/lib/shopify-push.ts. This route used to carry a full divergent
    // copy of the push logic that (a) referenced fields that don't exist
    // on the models (pledge.pledgeAmount / addon.unitPrice), so every
    // custom line item was priced "0", and (b) sent both `price` and
    // `variant_id` on each line item -- the explicit price overrode the
    // matched Shopify variant's own price, which is why products pushed
    // with no/zero prices. The shared lib resolves the variant by SKU
    // (live Shopify lookup) and references variant_id ONLY when matched,
    // so Shopify supplies the real price + requires_shipping. Both the
    // Backers "push to fulfillment" and the Packages "push" now run the
    // same code.
    if (action === "push_orders") {
      const result = await pushOrdersToShopify(
        projectId,
        Array.isArray(backerIds) && backerIds.length > 0 ? backerIds : undefined
      );
      return NextResponse.json(result);
    }

    // SYNC_STATUS - Sync fulfillment status from Shopify
    if (action === "sync_status") {
      const integration = await db.fulfillmentIntegration.findUnique({
        where: {
          projectId_provider: {
            projectId,
            provider: "SHOPIFY",
          },
        },
      });

      if (!integration || integration.status !== "CONNECTED") {
        return NextResponse.json(
          { error: "Shopify not connected" },
          { status: 400 }
        );
      }

      const rawCreds2 = integration.credentials as {
        shopDomain: string;
        accessToken: string;
      };
      let decryptedAccessToken2: string;
      try { decryptedAccessToken2 = decryptCredential(rawCreds2.accessToken); } catch { decryptedAccessToken2 = rawCreds2.accessToken; }
      const credentials = { shopDomain: rawCreds2.shopDomain, accessToken: decryptedAccessToken2 };

      // Get all pushed orders
      const trackedOrders = await db.shopifyFulfillmentOrder.findMany({
        where: {
          projectId,
          status: { in: ["PUSHED", "PROCESSING", "FULFILLED"] },
        },
      });

      let updatedCount = 0;
      let shippedCount = 0;

      for (const order of trackedOrders) {
        try {
          // Fetch order from Shopify
          const orderResponse = await shopifyFetch<{ order: ShopifyOrder & { fulfillments?: ShopifyFulfillment[] } }>(
            credentials.shopDomain,
            credentials.accessToken,
            `orders/${order.shopifyOrderId}.json`
          );

          const shopifyOrder = orderResponse.order;
          const fulfillment = shopifyOrder.fulfillments?.[0];

          let newStatus = order.status;
          let trackingNumber = order.trackingNumber;
          let trackingCompany = order.trackingCompany;
          let trackingUrl = order.trackingUrl;

          if (shopifyOrder.fulfillment_status === "fulfilled" && fulfillment) {
            newStatus = "SHIPPED";
            trackingNumber = fulfillment.tracking_number;
            trackingCompany = fulfillment.tracking_company;
            trackingUrl = fulfillment.tracking_url;
            shippedCount++;
          } else if (shopifyOrder.fulfillment_status === "partial") {
            newStatus = "PROCESSING";
          }

          if (newStatus !== order.status || trackingNumber !== order.trackingNumber) {
            await db.shopifyFulfillmentOrder.update({
              where: { id: order.id },
              data: {
                status: newStatus as "PUSHED" | "PROCESSING" | "FULFILLED" | "SHIPPED" | "DELIVERED" | "FAILED" | "CANCELLED" | "PENDING",
                trackingNumber,
                trackingCompany,
                trackingUrl,
                shippedAt: newStatus === "SHIPPED" ? new Date() : order.shippedAt,
              },
            });

            // Update pledge fulfillment status if shipped
            if (newStatus === "SHIPPED") {
              await db.pledge.update({
                where: { id: order.pledgeId },
                data: { fulfillmentStatus: "SHIPPED" },
              });
            }

            updatedCount++;
          }
        } catch (syncError) {
          creatorIndiekitShopifyLogger.error({ err: String(syncError) }, `Failed to sync order ${order.shopifyOrderId}:`);
        }
      }

      // Update integration last sync
      await db.fulfillmentIntegration.update({
        where: {
          projectId_provider: {
            projectId,
            provider: "SHOPIFY",
          },
        },
        data: {
          lastSyncAt: new Date(),
          ordersShipped: { increment: shippedCount },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Synced ${updatedCount} orders, ${shippedCount} shipped`,
        updated: updatedCount,
        shipped: shippedCount,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitShopifyLogger.error({ err: formatError(error) }, "Shopify POST error:");
    return NextResponse.json(
      { error: "Failed to process Shopify request" },
      { status: 500 }
    );
  }
}
