import { db } from "@/lib/db";

// Types for Shopify API responses
interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  fulfillment_status: string | null;
}

interface ShopifyVariant {
  id: number;
  sku: string;
  title: string;
  product_id: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
}

// Cache for SKU to variant ID lookups
const skuToVariantCache = new Map<string, number>();

// Look up variant ID by SKU in Shopify using GraphQL
async function lookupVariantBySku(
  shopDomain: string,
  accessToken: string,
  sku: string
): Promise<number | null> {
  // Check cache first
  const cacheKey = `${shopDomain}:${sku}`;
  if (skuToVariantCache.has(cacheKey)) {
    return skuToVariantCache.get(cacheKey) || null;
  }

  try {
    // Use GraphQL to search for variant by SKU
    const graphqlQuery = {
      query: `
        query getVariantBySku($sku: String!) {
          productVariants(first: 1, query: $sku) {
            edges {
              node {
                id
                sku
                title
              }
            }
          }
        }
      `,
      variables: { sku: `sku:${sku}` }
    };

    const url = `https://${shopDomain}/admin/api/2026-01/graphql.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) {
      throw new Error(`GraphQL error: ${response.status}`);
    }

    const result = await response.json();
    const edges = result.data?.productVariants?.edges;

    if (edges && edges.length > 0) {
      // Extract numeric ID from GraphQL ID (gid://shopify/ProductVariant/123)
      const gid = edges[0].node.id;
      const numericId = parseInt(gid.split('/').pop());
      skuToVariantCache.set(cacheKey, numericId);
      console.log(`[lookupVariantBySku] Found variant ${numericId} for SKU ${sku}`);
      return numericId;
    }

    console.log(`[lookupVariantBySku] No variant found for SKU ${sku}`);
    return null;
  } catch (error) {
    console.error(`[lookupVariantBySku] Error looking up SKU ${sku}:`, error);
    return null;
  }
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

  console.log("[pushOrdersToShopify] SKU mappings loaded:");
  console.log("  - Reward SKUs:", Array.from(rewardSkuMap.entries()));
  console.log("  - Addon SKUs:", Array.from(addonSkuMap.entries()));
  console.log("  - Modifier SKUs:", Array.from(modifierSkuMap.entries()));

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

  // Also fetch survey responses for these pledges to get shipping addresses
  const pledgeIds_list = pledges.map(p => p.id);
  const surveyResponses = await db.surveyResponse.findMany({
    where: {
      pledgeId: { in: pledgeIds_list },
    },
    select: {
      pledgeId: true,
      shippingAddress: true,
    },
  });
  const surveyResponseMap = new Map(
    surveyResponses.map(sr => [sr.pledgeId, sr.shippingAddress])
  );

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
      // If we have variant_id, that's all Shopify needs - it gets title/price from the product
      const lineItems: Array<{
        title?: string;
        quantity: number;
        price?: string;
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
        let variantId: number | undefined;
        let title = pledge.reward.title;

        if (modifierAssignment) {
          // Use modifier combination SKU
          const modifierKey = `${pledge.reward.id}-${modifierAssignment.modifierAddonId}`;
          const modifierSku = modifierSkuMap.get(modifierKey);

          if (modifierSku) {
            sku = modifierSku.sku;
            variantId = modifierSku.variantId ? parseInt(modifierSku.variantId) : undefined;
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
            variantId = rewardSku?.variantId ? parseInt(rewardSku.variantId) : undefined;
          }
        } else {
          // No modifier - use base reward SKU
          const rewardSku = rewardSkuMap.get(pledge.reward.id);
          sku = rewardSku?.sku;
          variantId = rewardSku?.variantId ? parseInt(rewardSku.variantId) : undefined;
        }

        // If we have a SKU but no variant_id, look it up in Shopify
        if (sku && !variantId) {
          variantId = await lookupVariantBySku(credentials.shopDomain, credentials.accessToken, sku) || undefined;
        }

        const rewardSkuData = rewardSkuMap.get(pledge.reward.id);
        const quantity = rewardSkuData?.quantity || 1;

        // If we have variant_id, just use that - Shopify gets title/price from the product
        if (variantId) {
          lineItems.push({
            variant_id: variantId,
            quantity,
          });
        } else {
          // Fallback to custom line item if no product match
          lineItems.push({
            title,
            quantity,
            price: (pledge.pledgeAmount ?? 0).toString(),
          });
        }
      }

      for (const addon of pledge.addons) {
        // Skip modifier addons that have been assigned to a reward (already included in reward line item)
        if (addon.addon.isModifier && assignedModifierAddonIds.has(addon.addon.id)) {
          continue;
        }

        const addonSku = addonSkuMap.get(addon.addon.id);
        let addonVariantId = addonSku?.variantId ? parseInt(addonSku.variantId) : undefined;

        // If we have a SKU but no variant_id, look it up in Shopify
        if (addonSku?.sku && !addonVariantId) {
          addonVariantId = await lookupVariantBySku(credentials.shopDomain, credentials.accessToken, addonSku.sku) || undefined;
        }

        const addonQuantity = (addon.quantity ?? 1) * (addonSku?.quantity || 1);

        // If we have variant_id, just use that - Shopify gets title/price from the product
        if (addonVariantId) {
          lineItems.push({
            variant_id: addonVariantId,
            quantity: addonQuantity,
          });
        } else {
          // Fallback to custom line item if no product match
          lineItems.push({
            title: addon.addon.title,
            quantity: addonQuantity,
            price: (addon.unitPrice ?? 0).toString(),
          });
        }
      }

      // Get shipping address - prefer survey response, fall back to pledge
      const surveyAddress = surveyResponseMap.get(pledge.id) as {
        name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        phone?: string;
      } | null;

      const pledgeAddress = pledge.shippingAddress as {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
        name?: string;
        phone?: string;
      } | null;

      // Use survey address if available, otherwise use pledge address
      const shippingAddress = surveyAddress || pledgeAddress;

      // Build customer info
      const customerEmail = pledge.user?.email || (pledge as { email?: string }).email;
      const customerName = shippingAddress?.name || pledge.user?.name || (pledge as { name?: string }).name || "";
      const nameParts = customerName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      console.log("[pushOrdersToShopify] Customer data for pledge", pledge.id, ":", {
        email: customerEmail,
        name: customerName,
        firstName,
        lastName,
        hasShippingAddress: !!shippingAddress,
        shippingAddressSource: surveyAddress ? "survey" : (pledgeAddress ? "pledge" : "none"),
        shippingAddress,
      });

      // Create draft order in Shopify (kept as draft for manual review)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draftOrderPayload: { draft_order: any } = {
        draft_order: {
          line_items: lineItems.length > 0 ? lineItems : [
            {
              title: `Pledge - ${project?.title || "Project"}`,
              quantity: 1,
              price: (pledge.pledgeAmount ?? 0).toString(),
            },
          ],
          note: `IndieCrowdfund Pledge #${pledge.id}`,
          tags: `indiecrowdfund,project-${projectId},pledge-${pledge.id}`,
        },
      };

      // Add customer info if we have an email
      if (customerEmail) {
        draftOrderPayload.draft_order.customer = {
          email: customerEmail,
          first_name: firstName,
          last_name: lastName,
        };
      }

      // Add shipping address if available
      if (shippingAddress && shippingAddress.line1) {
        draftOrderPayload.draft_order.shipping_address = {
          first_name: firstName,
          last_name: lastName,
          address1: shippingAddress.line1 || "",
          address2: shippingAddress.line2 || "",
          city: shippingAddress.city || "",
          province: shippingAddress.state || "",
          country: shippingAddress.country || "",
          zip: shippingAddress.postalCode || "",
          phone: shippingAddress.phone || "",
        };
        // Also add billing address (same as shipping for now)
        draftOrderPayload.draft_order.billing_address = draftOrderPayload.draft_order.shipping_address;
      }

      console.log("[pushOrdersToShopify] Creating draft order for pledge:", pledge.id);
      console.log("[pushOrdersToShopify] Line items:", JSON.stringify(draftOrderPayload.draft_order.line_items, null, 2));
      console.log("[pushOrdersToShopify] Full payload:", JSON.stringify(draftOrderPayload, null, 2));

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
