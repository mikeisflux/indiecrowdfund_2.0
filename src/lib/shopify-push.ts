import { db } from "@/lib/db";

// Types for Shopify API responses
interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  fulfillment_status: string | null;
}

// Helper to make Shopify API requests
async function shopifyFetch<T>(
  shopDomain: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/2026-01/${endpoint}`;

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

export interface PushToShopifyResult {
  success: boolean;
  message: string;
  pushed: number;
  failed: number;
  errors?: string[];
}

/**
 * Push orders to Shopify as draft orders
 * This function can be called directly without going through HTTP
 */
export async function pushOrdersToShopify(
  projectId: string,
  backerIds?: string[]
): Promise<PushToShopifyResult> {
  console.log("[pushOrdersToShopify] Starting for project:", projectId, "backers:", backerIds);

  // Get the integration
  const integration = await db.fulfillmentIntegration.findUnique({
    where: {
      projectId_provider: {
        projectId,
        provider: "SHOPIFY",
      },
    },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return {
      success: false,
      message: "Shopify not connected",
      pushed: 0,
      failed: 0,
      errors: ["Shopify integration not found or not connected"],
    };
  }

  const credentials = integration.credentials as {
    shopDomain: string;
    accessToken: string;
  };

  console.log("[pushOrdersToShopify] Using credentials for shop:", credentials.shopDomain);

  // Get project title for line items
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });

  // Get SKU mappings for this project
  const skuMappings = await db.shopifySkuMapping.findMany({
    where: { projectId },
  });

  // Get modifier SKU mappings for this project
  const modifierSkuMappings = await db.modifierSkuMapping.findMany({
    where: { projectId },
  });

  // Create lookup maps for quick access
  const rewardSkuMap = new Map<string, { sku: string; variantId?: string; quantity: number }>();
  const addonSkuMap = new Map<string, { sku: string; variantId?: string; quantity: number }>();
  // Map key: "baseRewardId-modifierAddonId" -> combined SKU
  const modifierSkuMap = new Map<string, { sku: string; variantId?: string }>();

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

  // Build modifier SKU lookup map
  for (const mapping of modifierSkuMappings) {
    const key = `${mapping.baseRewardId}-${mapping.modifierAddonId}`;
    modifierSkuMap.set(key, {
      sku: mapping.shopifySku,
      variantId: mapping.shopifyVariantId || undefined,
    });
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
              isModifier: true,
            },
          },
        },
      },
      modifierAssignments: {
        select: {
          rewardId: true,
          modifierAddonId: true,
        },
      },
    },
    take: 100, // Limit batch size
  });

  console.log("[pushOrdersToShopify] Found pledges to push:", pledges.length);

  if (pledges.length === 0) {
    return {
      success: true,
      message: "No orders to push",
      pushed: 0,
      failed: 0,
    };
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
        console.log("[pushOrdersToShopify] Skipping already pushed pledge:", pledge.id);
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

      // Track which modifier addon IDs have been assigned to rewards (don't add as separate line items)
      const assignedModifierAddonIds = new Set(
        pledge.modifierAssignments?.map((ma: { modifierAddonId: string }) => ma.modifierAddonId) || []
      );

      if (pledge.reward) {
        // Check if this reward has a modifier applied
        const modifierAssignment = pledge.modifierAssignments?.find(
          (ma: { rewardId: string }) => ma.rewardId === pledge.reward?.id
        );

        let sku: string | undefined;
        let variantId: string | undefined;
        let title = pledge.reward.title;

        if (modifierAssignment) {
          // Use modifier combination SKU
          const modifierKey = `${pledge.reward.id}-${modifierAssignment.modifierAddonId}`;
          const modifierSku = modifierSkuMap.get(modifierKey);

          if (modifierSku) {
            sku = modifierSku.sku;
            variantId = modifierSku.variantId;
            // Find the modifier addon name for the title
            const modifierAddon = pledge.addons.find(
              (a: { addon: { id: string } }) => a.addon.id === modifierAssignment.modifierAddonId
            );
            if (modifierAddon) {
              title = `${pledge.reward.title} + ${modifierAddon.addon.title}`;
            }
          } else {
            // Fallback to base reward SKU if no modifier mapping exists
            const rewardSku = rewardSkuMap.get(pledge.reward.id);
            sku = rewardSku?.sku;
            variantId = rewardSku?.variantId;
          }
        } else {
          // No modifier - use base reward SKU
          const rewardSku = rewardSkuMap.get(pledge.reward.id);
          sku = rewardSku?.sku;
          variantId = rewardSku?.variantId;
        }

        const rewardSkuData = rewardSkuMap.get(pledge.reward.id);
        lineItems.push({
          title,
          quantity: rewardSkuData?.quantity || 1,
          price: (pledge.pledgeAmount ?? 0).toString(),
          sku,
          variant_id: variantId ? parseInt(variantId) : undefined,
        });
      }

      for (const addon of pledge.addons) {
        // Skip modifier addons that have been assigned to a reward (already included in reward line item)
        if (addon.addon.isModifier && assignedModifierAddonIds.has(addon.addon.id)) {
          continue;
        }

        const addonSku = addonSkuMap.get(addon.addon.id);
        lineItems.push({
          title: addon.addon.title,
          quantity: (addon.quantity ?? 1) * (addonSku?.quantity || 1),
          price: (addon.unitPrice ?? 0).toString(),
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
              title: `Pledge - ${project?.title || "Project"}`,
              quantity: 1,
              price: (pledge.pledgeAmount ?? 0).toString(),
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

      console.log("[pushOrdersToShopify] Creating draft order for pledge:", pledge.id);

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

      console.log("[pushOrdersToShopify] Created draft order:", orderResponse.draft_order.id, orderResponse.draft_order.name);

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
      console.error(`[pushOrdersToShopify] Failed to push pledge ${pledge.id}:`, pushError);
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

  console.log("[pushOrdersToShopify] Completed. Pushed:", pushedCount, "Failed:", failedCount);

  return {
    success: true,
    message: `Pushed ${pushedCount} draft orders to Shopify`,
    pushed: pushedCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  };
}
