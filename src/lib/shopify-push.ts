import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const shopifyPushLogger = logger.child({ module: "shopify-push" });


// Types for Shopify API responses
interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  fulfillment_status: string | null;
}

// Cache for SKU to variant ID lookups
const skuToVariantCache = new Map<string, number>();

// Shopify's REST Admin API rate limit for standard apps is ~2 requests/
// second (leaky bucket of 40, refilling 2/sec). A push fires 4-6 calls
// per pledge, so without pacing a 100-backer batch 429s almost
// immediately. Every Shopify HTTP call goes through shopifyRequest(),
// which serializes calls onto a single queue, holds a minimum gap
// between them, and on a 429 honours Retry-After and retries.
const SHOPIFY_MIN_REQUEST_GAP_MS = 600; // ~1.6 req/sec — safely under the 2/sec ceiling
const SHOPIFY_MAX_429_RETRIES = 4;

let shopifyRequestQueue: Promise<unknown> = Promise.resolve();
let lastShopifyRequestAt = 0;

async function shopifyRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const run = shopifyRequestQueue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      const gap = SHOPIFY_MIN_REQUEST_GAP_MS - (Date.now() - lastShopifyRequestAt);
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      lastShopifyRequestAt = Date.now();

      const response = await fetch(url, options);
      if (response.status !== 429 || attempt >= SHOPIFY_MAX_429_RETRIES) {
        return response;
      }

      // Rate limited — wait out Retry-After (seconds; default 2) and retry.
      const retryAfter = Number(response.headers.get("Retry-After")) || 2;
      shopifyPushLogger.warn(
        `[shopifyRequest] 429 from Shopify, retrying in ${retryAfter}s (attempt ${attempt + 1}/${SHOPIFY_MAX_429_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
  });
  // Keep the queue chained even if this request throws/rejects.
  shopifyRequestQueue = run.then(() => {}, () => {});
  return run;
}

// Find or create customer in Shopify by email
async function findOrCreateCustomer(
  shopDomain: string,
  accessToken: string,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<number | null> {
  try {
    // Search for existing customer by email
    const searchUrl = `https://${shopDomain}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}`;
    const searchResponse = await shopifyRequest(searchUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    });

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.customers && searchResult.customers.length > 0) {
        const customerId = searchResult.customers[0].id;
        shopifyPushLogger.info(`[findOrCreateCustomer] Found existing customer ${customerId} for email ${email}`);
        return customerId;
      }
    }

    // Customer not found, create new one
    const createUrl = `https://${shopDomain}/admin/api/2026-01/customers.json`;
    const createResponse = await shopifyRequest(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        customer: {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || undefined,
          verified_email: true,
          send_email_welcome: false,
        },
      }),
    });

    if (createResponse.ok) {
      const createResult = await createResponse.json();
      const customerId = createResult.customer?.id;
      shopifyPushLogger.info(`[findOrCreateCustomer] Created new customer ${customerId} for email ${email}`);
      return customerId;
    } else {
      const errorText = await createResponse.text();
      shopifyPushLogger.error(`[findOrCreateCustomer] Failed to create customer: ${errorText}`);
      return null;
    }
  } catch (error) {
    shopifyPushLogger.error({ err: error }, `[findOrCreateCustomer] Error:`);
    return null;
  }
}

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
    const response = await shopifyRequest(url, {
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
      shopifyPushLogger.info(`[lookupVariantBySku] Found variant ${numericId} for SKU ${sku}`);
      return numericId;
    }

    shopifyPushLogger.info(`[lookupVariantBySku] No variant found for SKU ${sku}`);
    return null;
  } catch (error) {
    shopifyPushLogger.error({ err: error }, `[lookupVariantBySku] Error looking up SKU ${sku}:`);
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

  const response = await shopifyRequest(url, {
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
  shopifyPushLogger.info({ projectId, backerIds }, "Starting Shopify push");

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

  shopifyPushLogger.info({ data: credentials.shopDomain }, "[pushOrdersToShopify] Using credentials for shop:");

  // Get project title for line items
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
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

  shopifyPushLogger.info("[pushOrdersToShopify] SKU mappings loaded:");
  shopifyPushLogger.info({ data: Array.from(rewardSkuMap.entries()) }, "  - Reward SKUs:");
  shopifyPushLogger.info({ data: Array.from(addonSkuMap.entries()) }, "  - Addon SKUs:");
  shopifyPushLogger.info({ data: Array.from(modifierSkuMap.entries()) }, "  - Modifier SKUs:");

  // Get backers to push (either specified or all unpushed)
  const whereClause: {
    projectId: string;
    status: string;
    id?: { in: string[] };
    fulfillmentStatus?: { not: string } | { notIn: string[] };
  } = {
    projectId,
    status: "COMPLETED",
  };

  if (backerIds && Array.isArray(backerIds) && backerIds.length > 0) {
    whereClause.id = { in: backerIds };
  } else {
    // Only get pledges not already pushed or shipped
    whereClause.fulfillmentStatus = { notIn: ["IN_PROGRESS", "SHIPPED"] };
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

  shopifyPushLogger.info({ data: pledges.length }, "[pushOrdersToShopify] Found pledges to push:");

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

      // Build line items from reward and addons with SKU mappings
      // If we have variant_id, that's all Shopify needs - it gets title/price from the product
      const lineItems: Array<{
        title?: string;
        quantity: number;
        price?: string;
        sku?: string;
        variant_id?: number;
      }> = [];

      if (pledge.reward) {
        // Check if this reward has a modifier applied
        // First check explicit assignment, then auto-detect from modifier addons
        let modifierAssignment = pledge.modifierAssignments?.find(
          (ma: { rewardId: string }) => ma.rewardId === pledge.reward?.id
        );

        // If no explicit assignment, auto-detect modifier from addons
        if (!modifierAssignment) {
          // Find any modifier addon in this pledge's addons
          const modifierAddon = pledge.addons.find(
            (a: { addon: { isModifier: boolean } }) => a.addon.isModifier
          );
          if (modifierAddon) {
            // Check if we have a SKU mapping for this reward + modifier combo
            const potentialKey = `${pledge.reward.id}-${modifierAddon.addon.id}`;
            if (modifierSkuMap.has(potentialKey)) {
              // Auto-create the assignment for this push
              modifierAssignment = {
                rewardId: pledge.reward.id,
                modifierAddonId: modifierAddon.addon.id,
              };
              shopifyPushLogger.info(`[pushOrdersToShopify] Auto-detected modifier: ${pledge.reward.title} + ${modifierAddon.addon.title}`);
            }
          }
        }

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
        // Skip modifier addons entirely - they should only be included via modifier assignments
        // If a modifier isn't assigned to a reward, it shouldn't be a separate line item
        if (addon.addon.isModifier) {
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

      const phone = shippingAddress?.phone || "";

      shopifyPushLogger.info({
        pledgeId: pledge.id,
        email: customerEmail,
        name: customerName,
        hasShippingAddress: !!shippingAddress,
        shippingAddressSource: surveyAddress ? "survey" : (pledgeAddress ? "pledge" : "none"),
      }, "Customer data for pledge");

      // Find or create customer in Shopify first
      let customerId: number | null = null;
      if (customerEmail) {
        customerId = await findOrCreateCustomer(
          credentials.shopDomain,
          credentials.accessToken,
          customerEmail,
          firstName,
          lastName,
          phone
        );
      }

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
          email: customerEmail || undefined,
          phone: phone || undefined,
          note: `IndieCrowdfund Backer #${pledge.backerNumber || pledge.id}`,
          tags: `indiecrowdfund,project-${projectId},backer-${pledge.backerNumber || pledge.id}`,
        },
      };

      // Add customer by ID if we have one (this links to existing/new customer)
      if (customerId) {
        draftOrderPayload.draft_order.customer = {
          id: customerId,
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
          phone: phone || "",
        };
        // Also add billing address (same as shipping for now)
        draftOrderPayload.draft_order.billing_address = draftOrderPayload.draft_order.shipping_address;
      }

      shopifyPushLogger.info({ data: pledge.id }, "[pushOrdersToShopify] Creating draft order for pledge:");
      shopifyPushLogger.info({ data: JSON.stringify(draftOrderPayload.draft_order.line_items, null, 2) }, "[pushOrdersToShopify] Line items:");
      shopifyPushLogger.info({ data: JSON.stringify(draftOrderPayload, null, 2) }, "[pushOrdersToShopify] Full payload:");

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

      shopifyPushLogger.info({ orderId: orderResponse.draft_order.id, orderName: orderResponse.draft_order.name }, "Created draft order");

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
      shopifyPushLogger.error({ err: pushError }, `[pushOrdersToShopify] Failed to push pledge ${pledge.id}:`);
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

  shopifyPushLogger.info({ pushedCount, failedCount }, "Shopify push completed");

  return {
    success: true,
    message: `Pushed ${pushedCount} draft orders to Shopify`,
    pushed: pushedCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  };
}
