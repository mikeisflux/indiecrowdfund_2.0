import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const url = `https://${shopDomain}/admin/api/2024-10/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...options.headers,
    },
  });

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
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
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
    console.error("Shopify GET error:", error);
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
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // CONNECT - Link Shopify store
    if (action === "connect") {
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
              accessToken,
              shopName: shopResponse.shop.name,
              shopEmail: shopResponse.shop.email,
            },
          },
          update: {
            status: "CONNECTED",
            credentials: {
              shopDomain: cleanDomain,
              accessToken,
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
        console.error("Shopify connection error:", shopifyError);
        return NextResponse.json(
          {
            error: "Failed to connect to Shopify. Please verify your shop domain and access token.",
            details: shopifyError instanceof Error ? shopifyError.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    // DISCONNECT - Remove Shopify integration
    if (action === "disconnect") {
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

    // PUSH_ORDERS - Push backer orders to Shopify as draft orders
    if (action === "push_orders") {
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

      const credentials = integration.credentials as {
        shopDomain: string;
        accessToken: string;
      };

      // Get SKU mappings for this project
      const skuMappings = await db.shopifySkuMapping.findMany({
        where: { projectId },
      });

      // Create lookup maps for quick access
      const rewardSkuMap = new Map<string, { sku: string; variantId?: string; quantity: number }>();
      const addonSkuMap = new Map<string, { sku: string; variantId?: string; quantity: number }>();

      for (const mapping of skuMappings) {
        const skuData = {
          sku: mapping.shopifySku,
          variantId: mapping.shopifyVariantId || undefined,
          quantity: mapping.quantity,
        };

        if (mapping.sourceType === "REWARD") {
          rewardSkuMap.set(mapping.sourceId, skuData);
        } else if (mapping.sourceType === "ADDON") {
          addonSkuMap.set(mapping.sourceId, skuData);
        }
      }

      // Get backers to push (either specified or all unpushed)
      const whereClause: {
        projectId: string;
        status: string;
        id?: { in: string[] };
        fulfillmentStatus?: { not: string };
      } = {
        projectId,
        status: "COMPLETED",
      };

      if (backerIds && Array.isArray(backerIds) && backerIds.length > 0) {
        whereClause.id = { in: backerIds };
      } else {
        // Only get pledges not already pushed
        whereClause.fulfillmentStatus = { not: "SHIPPED" };
      }

      const pledges = await db.pledge.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
            },
          },
          addons: {
            include: {
              addon: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        take: 100, // Limit batch size
      });

      if (pledges.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No orders to push",
          pushed: 0,
        });
      }

      let pushedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const pledge of pledges) {
        try {
          // Check if already pushed
          const existing = await db.shopifyFulfillmentOrder.findUnique({
            where: {
              projectId_pledgeId: {
                projectId,
                pledgeId: pledge.id,
              },
            },
          });

          if (existing && existing.status !== "FAILED") {
            continue; // Skip already pushed orders
          }

          // Build line items from reward and addons with SKU mappings
          const lineItems: Array<{
            title: string;
            quantity: number;
            price: string;
            sku?: string;
            variant_id?: number;
          }> = [];

          if (pledge.reward) {
            const rewardSku = rewardSkuMap.get(pledge.reward.id);
            lineItems.push({
              title: pledge.reward.title,
              quantity: rewardSku?.quantity || 1,
              price: pledge.pledgeAmount.toString(),
              sku: rewardSku?.sku,
              variant_id: rewardSku?.variantId ? parseInt(rewardSku.variantId) : undefined,
            });
          }

          for (const addon of pledge.addons) {
            const addonSku = addonSkuMap.get(addon.addon.id);
            lineItems.push({
              title: addon.addon.title,
              quantity: addon.quantity * (addonSku?.quantity || 1),
              price: addon.unitPrice.toString(),
              sku: addonSku?.sku,
              variant_id: addonSku?.variantId ? parseInt(addonSku.variantId) : undefined,
            });
          }

          // Parse shipping address
          const shippingAddress = pledge.shippingAddress as {
            line1?: string;
            line2?: string;
            city?: string;
            state?: string;
            country?: string;
            postalCode?: string;
            name?: string;
            phone?: string;
          } | null;

          // Create draft order in Shopify (kept as draft for manual review)
          const draftOrderPayload = {
            draft_order: {
              line_items: lineItems.length > 0 ? lineItems : [
                {
                  title: `Pledge - ${project.title}`,
                  quantity: 1,
                  price: pledge.pledgeAmount.toString(),
                },
              ],
              customer: {
                email: pledge.user?.email || pledge.email,
                first_name: pledge.user?.name?.split(" ")[0] || pledge.name?.split(" ")[0] || "",
                last_name: pledge.user?.name?.split(" ").slice(1).join(" ") || pledge.name?.split(" ").slice(1).join(" ") || "",
              },
              shipping_address: shippingAddress ? {
                address1: shippingAddress.line1 || "",
                address2: shippingAddress.line2 || "",
                city: shippingAddress.city || "",
                province: shippingAddress.state || "",
                country: shippingAddress.country || "",
                zip: shippingAddress.postalCode || "",
                name: shippingAddress.name || pledge.user?.name || pledge.name || "",
                phone: shippingAddress.phone || "",
              } : undefined,
              note: `IndieCrowdfund Pledge #${pledge.id}`,
              tags: `indiecrowdfund,project-${projectId},pledge-${pledge.id}`,
            },
          };

          // Create draft order (kept as draft - not completed)
          const orderResponse = await shopifyFetch<{ draft_order: ShopifyOrder }>(
            credentials.shopDomain,
            credentials.accessToken,
            "draft_orders.json",
            {
              method: "POST",
              body: JSON.stringify(draftOrderPayload),
            }
          );

          // Note: We're NOT completing the draft order here
          // The draft order stays in draft state for the creator to review in Shopify
          // and complete/fulfill when ready

          // Create or update tracking record
          await db.shopifyFulfillmentOrder.upsert({
            where: {
              projectId_pledgeId: {
                projectId,
                pledgeId: pledge.id,
              },
            },
            create: {
              projectId,
              pledgeId: pledge.id,
              shopifyOrderId: orderResponse.draft_order.id.toString(),
              orderNumber: orderResponse.draft_order.name,
              status: "PUSHED",
              pushedAt: new Date(),
            },
            update: {
              shopifyOrderId: orderResponse.draft_order.id.toString(),
              orderNumber: orderResponse.draft_order.name,
              status: "PUSHED",
              pushedAt: new Date(),
              lastError: null,
              errorCount: 0,
            },
          });

          // Update pledge fulfillment status
          await db.pledge.update({
            where: { id: pledge.id },
            data: { fulfillmentStatus: "IN_PROGRESS" },
          });

          pushedCount++;
        } catch (pushError) {
          console.error(`Failed to push pledge ${pledge.id}:`, pushError);
          failedCount++;
          errors.push(`Pledge ${pledge.id}: ${pushError instanceof Error ? pushError.message : "Unknown error"}`);

          // Record failure
          await db.shopifyFulfillmentOrder.upsert({
            where: {
              projectId_pledgeId: {
                projectId,
                pledgeId: pledge.id,
              },
            },
            create: {
              projectId,
              pledgeId: pledge.id,
              shopifyOrderId: `failed-${pledge.id}`,
              status: "FAILED",
              lastError: pushError instanceof Error ? pushError.message : "Unknown error",
              errorCount: 1,
            },
            update: {
              status: "FAILED",
              lastError: pushError instanceof Error ? pushError.message : "Unknown error",
              errorCount: { increment: 1 },
            },
          });
        }
      }

      // Update integration stats
      await db.fulfillmentIntegration.update({
        where: {
          projectId_provider: {
            projectId,
            provider: "SHOPIFY",
          },
        },
        data: {
          ordersPushed: { increment: pushedCount },
          ordersFailed: { increment: failedCount },
          lastSyncAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Pushed ${pushedCount} draft orders to Shopify`,
        pushed: pushedCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      });
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

      const credentials = integration.credentials as {
        shopDomain: string;
        accessToken: string;
      };

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
          console.error(`Failed to sync order ${order.shopifyOrderId}:`, syncError);
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
    console.error("Shopify POST error:", error);
    return NextResponse.json(
      { error: "Failed to process Shopify request" },
      { status: 500 }
    );
  }
}
