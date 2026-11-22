import { db } from "@/lib/db";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";
import { loadSkuContext } from "@/lib/fulfillment/modifiers-db";
import { resolvePledgeLines } from "@/lib/fulfillment/production-counts";

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
      // Shopify returns 403 + "requires merchant approval for
      // write_customers scope" when the access token was issued
      // before write_customers was added to SHOPIFY_SCOPES (in the
      // OAuth authorize route). Downgrade to warn — repeated error-
      // level logs hammer the error pager every time a backer order
      // pushes, and the calling code already handles a null return
      // by creating the draft order with the customer email inline.
      // Creator needs to reconnect their Shopify store; the rest of
      // the push still works.
      const isScopeError =
        createResponse.status === 403 &&
        /write_customers|merchant approval/i.test(errorText);
      if (isScopeError) {
        shopifyPushLogger.warn(
          { shopDomain, email },
          `[findOrCreateCustomer] Shopify access token missing write_customers scope — creator needs to reconnect their store. Continuing without a customer record; the draft order will be created with the email inline.`,
        );
      } else {
        shopifyPushLogger.error(`[findOrCreateCustomer] Failed to create customer: ${errorText}`);
      }
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

  // SKU resolution is shared with the Production tab (see
  // lib/fulfillment/production-counts): a ShopifySkuMapping row, else
  // Reward.sku; for an upgraded item a ModifierSkuMapping row, else base
  // SKU + the modifier's suffix. The draft order and the production count
  // therefore name the same product for the same backer.
  const skuContext = await loadSkuContext(projectId);

  shopifyPushLogger.info(
    { rewardSkus: skuContext.skuMappings.length, modifierSkus: skuContext.modifierSkuMappings.length, items: skuContext.projectItemsById.size },
    "[pushOrdersToShopify] SKU context loaded"
  );

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
          projectItemId: true,
          modifierAddonId: true,
          unitIndex: true,
          source: true,
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
        requires_shipping?: boolean;
        taxable?: boolean;
      }> = [];

      // Every physical unit the pledge owes, upgrades applied per copy
      // (an "Upgrade to foil" assigned to SW3-18 is one SW3-18-F line and
      // one fewer SW3-18). Modifier add-ons never appear on their own.
      const lines = resolvePledgeLines(
        {
          id: pledge.id,
          rewardId: pledge.reward?.id ?? null,
          addons: pledge.addons.map((a: { addon: { id: string }; quantity: number }) => ({ addonId: a.addon.id, quantity: a.quantity })),
          modifierAssignments: pledge.modifierAssignments,
        },
        skuContext
      );

      // Per-unit prices for custom (unmatched) line items, from what the
      // backer actually paid: the tier snapshot and each PledgeAddon's
      // line total / quantity. An upgraded item is base + upgrade.
      const unitPrice = (rewardId: string): number => {
        if (pledge.reward?.id === rewardId) return Number(pledge.rewardAmount ?? pledge.amount ?? 0);
        const row = pledge.addons.find((a: { addon: { id: string } }) => a.addon.id === rewardId);
        if (!row) return 0;
        return Number(row.amount ?? 0) / Math.max(1, row.quantity || 1);
      };

      for (const line of lines) {
        const quantity = line.quantity * line.unitsPerItem;

        if (line.kind === "unassigned_upgrade") {
          // The backer hasn't said which item this applies to. Keep the
          // money and the fact on the order as a custom line so nothing is
          // silently dropped; the Production tab lists it for resolving.
          lineItems.push({
            title: line.label,
            quantity,
            price: unitPrice(line.modifierAddonId!).toFixed(2),
            requires_shipping: true,
            taxable: true,
          });
          continue;
        }

        let variantId = line.shopifyVariantId ? parseInt(line.shopifyVariantId) : undefined;
        // The live SKU lookup is authoritative (cached per SKU); a stored
        // variantId is only the fallback when there is no SKU.
        if (line.sku) {
          const looked = await lookupVariantBySku(credentials.shopDomain, credentials.accessToken, line.sku);
          if (looked) variantId = looked;
        }

        if (variantId && !Number.isNaN(variantId)) {
          lineItems.push({ variant_id: variantId, quantity });
        } else {
          const price = unitPrice(line.rewardId) + (line.modifierAddonId ? unitPrice(line.modifierAddonId) : 0);
          lineItems.push({
            title: line.sku ? `${line.label} [${line.sku}]` : line.label,
            quantity,
            price: price.toFixed(2),
            requires_shipping: true,
            taxable: true,
          });
        }
      }

      // Get shipping address - prefer survey response, fall back to the
      // pledge's own address (Order Lock / checkout), normalizing the differing
      // field shapes (region/state, line1/address1, postalCode/zip).
      const shippingAddress = resolvePledgeShippingAddress(
        surveyResponseMap.get(pledge.id),
        pledge.shippingAddress
      );

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
        shippingAddressSource: surveyResponseMap.get(pledge.id) ? "survey" : (pledge.shippingAddress ? "pledge" : "none"),
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
              // pledge.amount is the real pledge total; pledgeAmount never
              // existed on the model (was always "0").
              price: Number(pledge.amount ?? 0).toFixed(2),
              requires_shipping: true,
              taxable: true,
            },
          ],
          email: customerEmail || undefined,
          phone: phone || undefined,
          note: `IndieCrowdfund · ${project?.title || "Campaign"} · Backer #${pledge.backerNumber || pledge.id}`,
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

// ── Tracking sync ───────────────────────────────────────────────────────────

interface ShopifyFulfillment {
  id: number;
  status: string | null;
  shipment_status: string | null;
  tracking_number: string | null;
  tracking_company: string | null;
  tracking_url: string | null;
  tracking_urls?: string[] | null;
  created_at?: string | null;
}

export interface SyncShopifyTrackingResult {
  success: boolean;
  message: string;
  /** Orders that gained (or changed) a tracking number this run. */
  synced: number;
  /** Rows whose draft order has not been completed in Shopify yet. */
  awaitingCompletion: number;
  /** Not looked at this run because the time budget ran out. */
  remaining: number;
  errors?: string[];
}

// Orders are pushed to Shopify as DRAFT orders and left for the creator to
// review. A draft has no fulfillments — it has to be completed into a real
// order first — so the tracking number lives on the completed order, one hop
// away from the id we stored.
//
// ShopifyFulfillmentOrder.shopifyOrderId holds the DRAFT id, and there is no
// column for the completed order's id. Rather than add one, this reads
// draft_order.order_id on each pass. That costs one extra call per unshipped
// order and none at all once a row reaches SHIPPED, since shipped rows are
// not polled again.
const SYNC_BUDGET_MS = 45_000;

export async function syncShopifyTracking(projectId: string): Promise<SyncShopifyTrackingResult> {
  const integration = await db.fulfillmentIntegration.findUnique({
    where: { projectId_provider: { projectId, provider: "SHOPIFY" } },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return {
      success: false,
      message: "Shopify not connected",
      synced: 0,
      awaitingCompletion: 0,
      remaining: 0,
      errors: ["Shopify integration not found or not connected"],
    };
  }

  const credentials = integration.credentials as { shopDomain: string; accessToken: string };
  if (!credentials?.shopDomain || !credentials?.accessToken) {
    return {
      success: false,
      message: "Shopify credentials incomplete",
      synced: 0,
      awaitingCompletion: 0,
      remaining: 0,
      errors: ["Shopify credentials are missing a shop domain or access token"],
    };
  }

  // Anything already SHIPPED or DELIVERED is done, and CANCELLED will never
  // ship. Everything else is worth a look.
  const rows = await db.shopifyFulfillmentOrder.findMany({
    where: {
      projectId,
      status: { notIn: ["SHIPPED", "DELIVERED", "CANCELLED"] },
    },
    orderBy: { pushedAt: "asc" },
  });

  const errors: string[] = [];
  let synced = 0;
  let awaitingCompletion = 0;
  let remaining = 0;
  const startedAt = Date.now();

  for (const [index, row] of rows.entries()) {
    if (Date.now() - startedAt > SYNC_BUDGET_MS) {
      remaining = rows.length - index;
      break;
    }

    try {
      // 1. Has the draft been completed into a real order yet?
      const draft = await shopifyFetch<{ draft_order: { id: number; order_id: number | null } }>(
        credentials.shopDomain,
        credentials.accessToken,
        `draft_orders/${encodeURIComponent(row.shopifyOrderId)}.json`
      );

      const realOrderId = draft.draft_order?.order_id;
      if (!realOrderId) {
        awaitingCompletion++;
        continue;
      }

      // 2. Read that order's fulfillments.
      const result = await shopifyFetch<{ fulfillments: ShopifyFulfillment[] }>(
        credentials.shopDomain,
        credentials.accessToken,
        `orders/${realOrderId}/fulfillments.json`
      );

      // A cancelled fulfillment is a voided label — treating one as shipped
      // would tell a backer their parcel is on its way when it is not.
      const fulfillment = (result.fulfillments || [])
        .filter((f) => f.status !== "cancelled" && f.status !== "error")
        .find((f) => f.tracking_number);

      if (!fulfillment) continue;

      const trackingUrl =
        fulfillment.tracking_url || fulfillment.tracking_urls?.[0] || null;
      const delivered = fulfillment.shipment_status === "delivered";

      await db.$transaction(async (tx) => {
        await tx.shopifyFulfillmentOrder.update({
          where: { id: row.id },
          data: {
            shopifyFulfillmentId: String(fulfillment.id),
            trackingNumber: fulfillment.tracking_number,
            trackingCompany: fulfillment.tracking_company,
            trackingUrl,
            status: delivered ? "DELIVERED" : "SHIPPED",
            fulfilledAt: row.fulfilledAt ?? new Date(),
            shippedAt: row.shippedAt ?? new Date(),
            ...(delivered && !row.deliveredAt ? { deliveredAt: new Date() } : {}),
            lastError: null,
          },
        });

        // The backer reads the pledge, not the Shopify record.
        await tx.pledge.update({
          where: { id: row.pledgeId },
          data: {
            trackingNumber: fulfillment.tracking_number,
            // Shopify hands back both, so the backer's link is the carrier's
            // own URL rather than one built from a guess.
            trackingCarrier: fulfillment.tracking_company,
            trackingUrl,
            fulfillmentStatus: delivered ? "DELIVERED" : "SHIPPED",
          },
        });
      });

      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Pledge ${row.pledgeId}: ${message}`);
      await db.shopifyFulfillmentOrder
        .update({
          where: { id: row.id },
          data: { lastError: message.slice(0, 500), errorCount: { increment: 1 } },
        })
        .catch(() => null);
    }
  }

  await db.fulfillmentIntegration
    .update({
      where: { projectId_provider: { projectId, provider: "SHOPIFY" } },
      data: { lastSyncAt: new Date(), lastSyncError: errors[0]?.slice(0, 500) ?? null },
    })
    .catch(() => null);

  shopifyPushLogger.info(
    { projectId, synced, awaitingCompletion, remaining, errorCount: errors.length },
    "Shopify tracking sync completed"
  );

  return {
    success: true,
    message:
      `Synced tracking for ${synced} order(s).` +
      (awaitingCompletion > 0
        ? ` ${awaitingCompletion} still awaiting completion in Shopify — a draft order has to be completed before it can be fulfilled.`
        : ""),
    synced,
    awaitingCompletion,
    remaining,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  };
}
