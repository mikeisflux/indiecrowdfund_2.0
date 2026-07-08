import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptCredential } from "@/lib/encryption";
import { circuitBreaker } from "@/lib/circuit-breaker";

import { logger } from "@/lib/logger";

const creatorIndiekitShopifySkuMappingLogger = logger.child({ module: "creator-indiekit-shopify-sku-mapping" });


export const dynamic = "force-dynamic";

// Helper to search for a SKU in Shopify
async function findSkuInShopify(
  shopDomain: string,
  accessToken: string,
  sku: string
): Promise<{
  found: boolean;
  productId?: string;
  variantId?: string;
  productName?: string;
  variantTitle?: string;
}> {
  // Use Shopify GraphQL API to search for products by SKU
  const query = `
    query searchBySku($query: String!) {
      productVariants(first: 10, query: $query) {
        edges {
          node {
            id
            sku
            title
            product {
              id
              title
            }
          }
        }
      }
    }
  `;

  try {
    const response = await circuitBreaker.execute("shopify", () =>
      fetch(`https://${shopDomain}/admin/api/2026-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { query: `sku:${sku}` },
        }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      creatorIndiekitShopifySkuMappingLogger.error({ err: errorText, status: response.status }, "Shopify API error");
      return { found: false };
    }

    const data = await response.json();
    const variants = data.data?.productVariants?.edges || [];

    // Look for exact SKU match
    for (const edge of variants) {
      const variant = edge.node;
      if (variant.sku?.toLowerCase() === sku.toLowerCase()) {
        // Extract numeric IDs from GraphQL global IDs
        const productId = variant.product.id.replace("gid://shopify/Product/", "");
        const variantId = variant.id.replace("gid://shopify/ProductVariant/", "");

        return {
          found: true,
          productId,
          variantId,
          productName: variant.product.title,
          variantTitle: variant.title !== "Default Title" ? variant.title : undefined,
        };
      }
    }

    return { found: false };
  } catch (error) {
    creatorIndiekitShopifySkuMappingLogger.error({ err: error }, "Error searching Shopify SKU:");
    return { found: false };
  }
}

// GET - Get SKU mappings and unmapped items for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

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
      include: {
        rewards: {
          select: {
            id: true,
            title: true,
            type: true,
            amount: true,
            quantityClaimed: true,
            isModifier: true,
          },
        },
        projectItems: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get pledges with actual orders to find which rewards/addons have
    // been ordered. Committed-PENDING filter matches the rest of
    // IndieKit so SKU mapping covers the same backer set.
    const pledgesWithOrders = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { status: "COMPLETED" },
          { status: "PENDING", confirmationEmailSent: true },
        ],
      },
      select: {
        rewardId: true,
        addons: {
          select: {
            addonId: true,
          },
        },
      },
    });

    // Build sets of ordered reward IDs and addon IDs
    const orderedRewardIds = new Set<string>();
    const orderedAddonIds = new Set<string>();

    for (const pledge of pledgesWithOrders) {
      if (pledge.rewardId) {
        orderedRewardIds.add(pledge.rewardId);
      }
      for (const addon of pledge.addons) {
        orderedAddonIds.add(addon.addonId);
      }
    }

    // Get existing SKU mappings
    const mappings = await db.shopifySkuMapping.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    // Get skipped items
    const skippedItems = await db.fulfillmentSkippedItem.findMany({
      where: { projectId },
    });

    // Build list of items that need mapping - ONLY items that have been ordered
    const unmappedItems: Array<{
      sourceType: string;
      sourceId: string;
      sourceName: string;
      amount?: number;
      quantityClaimed?: number;
    }> = [];

    // Check rewards (tiers) - only if someone ordered them
    for (const reward of project.rewards) {
      if (reward.type !== "ADDON" && !orderedRewardIds.has(reward.id)) {
        // This reward tier hasn't been ordered by anyone, skip it
        continue;
      }
      if (reward.type === "ADDON" && !orderedAddonIds.has(reward.id)) {
        // This addon hasn't been ordered by anyone, skip it
        continue;
      }

      // Skip modifier addons - they're handled separately in the Modifier SKU Combinations section
      if (reward.type === "ADDON" && reward.isModifier) {
        continue;
      }

      const isMapped = mappings.some(
        (m: { sourceType: string; sourceId: string }) =>
          (m.sourceType === "REWARD" || m.sourceType === "ADDON") && m.sourceId === reward.id
      );
      if (!isMapped) {
        unmappedItems.push({
          sourceType: reward.type === "ADDON" ? "ADDON" : "REWARD",
          sourceId: reward.id,
          sourceName: reward.title,
          amount: Number(reward.amount),
          quantityClaimed: reward.quantityClaimed,
        });
      }
    }

    // Note: projectItems are not included since they're not directly ordered
    // If you need to include project items, you'd need to track which items
    // are included in which rewards/pledges

    return NextResponse.json({
      mappings,
      unmappedItems,
      skippedItems,
      rewards: project.rewards,
      projectItems: project.projectItems,
      // Include stats for debugging
      stats: {
        orderedRewards: orderedRewardIds.size,
        orderedAddons: orderedAddonIds.size,
        totalPledges: pledgesWithOrders.length,
      },
    });
  } catch (error) {
    creatorIndiekitShopifySkuMappingLogger.error({ err: error }, "SKU mapping GET error:");
    return NextResponse.json({ error: "Failed to fetch SKU mappings" }, { status: 500 });
  }
}

// POST - Create or update SKU mapping
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      projectId,
      action,
      sourceType,
      sourceId,
      sourceName,
      shopifySku,
      quantity,
      mappingId,
      skipValidation, // Allow skipping validation for testing
    } = body;

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
        creatorId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get PROJECT CREATOR's Shopify credentials for validation
    // Collaborators use the creator's connection, not their own
    const creatorRaw = await db.user.findFirst({
      where: { id: project.creatorId, deletedAt: null },
      select: {
        shopifyAccessToken: true,
        shopifyShopDomain: true,
      },
    });

    // Decrypt access token (backwards compatible with legacy unencrypted values)
    const creator = creatorRaw ? {
      ...creatorRaw,
      shopifyAccessToken: creatorRaw.shopifyAccessToken ? (() => {
        try { return decryptCredential(creatorRaw.shopifyAccessToken); } catch { return creatorRaw.shopifyAccessToken; }
      })() : null,
    } : null;

    // CREATE or UPDATE mapping
    if (action === "save" || action === "create" || action === "update") {
      if (!sourceType || !sourceId || !sourceName || !shopifySku) {
        return NextResponse.json(
          { error: "sourceType, sourceId, sourceName, and shopifySku are required" },
          { status: 400 }
        );
      }

      // Validate SKU exists in Shopify (unless skipped)
      let shopifyProductId: string | null = null;
      let shopifyVariantId: string | null = null;
      let shopifyProductName: string | null = null;

      if (!skipValidation && creator?.shopifyAccessToken && creator?.shopifyShopDomain) {
        const skuResult = await findSkuInShopify(
          creator.shopifyShopDomain,
          creator.shopifyAccessToken,
          shopifySku.trim()
        );

        if (!skuResult.found) {
          return NextResponse.json(
            {
              error: `SKU "${shopifySku}" not found in Shopify. Please check the SKU and try again.`,
              code: "SKU_NOT_FOUND"
            },
            { status: 400 }
          );
        }

        // Use the Shopify product info from the search
        shopifyProductId = skuResult.productId || null;
        shopifyVariantId = skuResult.variantId || null;
        shopifyProductName = skuResult.variantTitle
          ? `${skuResult.productName} - ${skuResult.variantTitle}`
          : skuResult.productName || null;
      }

      // Check if mapping already exists for this item + SKU combination
      const existingMapping = await db.shopifySkuMapping.findFirst({
        where: {
          projectId,
          sourceType,
          sourceId,
          shopifySku: shopifySku.trim(),
        },
      });

      let mapping;
      if (existingMapping) {
        // Update existing mapping
        mapping = await db.shopifySkuMapping.update({
          where: { id: existingMapping.id },
          data: {
            sourceName,
            shopifyProductId,
            shopifyVariantId,
            shopifyProductName,
            quantity: quantity || 1,
          },
        });
      } else {
        // Create new mapping
        mapping = await db.shopifySkuMapping.create({
          data: {
            projectId,
            sourceType,
            sourceId,
            sourceName,
            shopifySku: shopifySku.trim(),
            shopifyProductId,
            shopifyVariantId,
            shopifyProductName,
            quantity: quantity || 1,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: shopifyProductName
          ? `SKU mapped to "${shopifyProductName}"`
          : "SKU mapping saved",
        mapping,
      });
    }

    // DELETE mapping
    if (action === "delete") {
      if (!mappingId) {
        return NextResponse.json({ error: "Mapping ID required" }, { status: 400 });
      }

      // Scoped delete via deleteMany — enforces projectId in the WHERE
      // (blocks cross-project abuse) AND resolves concurrent double-
      // clicks as { count: 0 } instead of P2025.
      const deleted = await db.shopifySkuMapping.deleteMany({
        where: { id: mappingId, projectId },
      });

      if (deleted.count === 0) {
        return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "SKU mapping deleted",
      });
    }

    // VALIDATE SKU (just check if it exists, don't save)
    if (action === "validate") {
      if (!shopifySku) {
        return NextResponse.json({ error: "shopifySku required" }, { status: 400 });
      }

      if (!creator?.shopifyAccessToken || !creator?.shopifyShopDomain) {
        return NextResponse.json(
          { error: "Shopify not connected. The project creator must connect their Shopify store first." },
          { status: 400 }
        );
      }

      const skuResult = await findSkuInShopify(
        creator.shopifyShopDomain,
        creator.shopifyAccessToken,
        shopifySku.trim()
      );

      if (!skuResult.found) {
        return NextResponse.json(
          {
            valid: false,
            error: `SKU "${shopifySku}" not found in Shopify`
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        valid: true,
        productId: skuResult.productId,
        variantId: skuResult.variantId,
        productName: skuResult.productName,
        variantTitle: skuResult.variantTitle,
      });
    }

    // SKIP an item (exclude from fulfillment)
    if (action === "skip") {
      if (!sourceType || !sourceId || !sourceName) {
        return NextResponse.json(
          { error: "sourceType, sourceId, and sourceName are required" },
          { status: 400 }
        );
      }

      const skippedItem = await db.fulfillmentSkippedItem.upsert({
        where: {
          projectId_sourceType_sourceId: {
            projectId,
            sourceType,
            sourceId,
          },
        },
        create: {
          projectId,
          sourceType,
          sourceId,
          sourceName,
        },
        update: {
          sourceName,
        },
      });

      return NextResponse.json({
        success: true,
        message: `"${sourceName}" skipped from fulfillment`,
        skippedItem,
      });
    }

    // UNSKIP an item (include in fulfillment again)
    if (action === "unskip") {
      if (!sourceType || !sourceId) {
        return NextResponse.json(
          { error: "sourceType and sourceId are required" },
          { status: 400 }
        );
      }

      await db.fulfillmentSkippedItem.deleteMany({
        where: {
          projectId,
          sourceType,
          sourceId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Item restored for fulfillment",
      });
    }

    // BULK SAVE mappings
    if (action === "bulk_save") {
      const { mappings } = body;
      if (!mappings || !Array.isArray(mappings)) {
        return NextResponse.json({ error: "mappings array required" }, { status: 400 });
      }

      const results = [];
      const errors = [];

      for (const m of mappings) {
        if (m.sourceType && m.sourceId && m.sourceName && m.shopifySku) {
          // Validate each SKU
          let shopifyProductId: string | null = null;
          let shopifyVariantId: string | null = null;
          let shopifyProductName: string | null = null;

          if (!skipValidation && creator?.shopifyAccessToken && creator?.shopifyShopDomain) {
            const skuResult = await findSkuInShopify(
              creator.shopifyShopDomain,
              creator.shopifyAccessToken,
              m.shopifySku.trim()
            );

            if (!skuResult.found) {
              errors.push({
                sourceName: m.sourceName,
                sku: m.shopifySku,
                error: "SKU not found in Shopify",
              });
              continue;
            }

            shopifyProductId = skuResult.productId || null;
            shopifyVariantId = skuResult.variantId || null;
            shopifyProductName = skuResult.variantTitle
              ? `${skuResult.productName} - ${skuResult.variantTitle}`
              : skuResult.productName || null;
          }

          // Check if mapping already exists
          const existingMapping = await db.shopifySkuMapping.findFirst({
            where: {
              projectId,
              sourceType: m.sourceType,
              sourceId: m.sourceId,
              shopifySku: m.shopifySku.trim(),
            },
          });

          let mapping;
          if (existingMapping) {
            mapping = await db.shopifySkuMapping.update({
              where: { id: existingMapping.id },
              data: {
                sourceName: m.sourceName,
                shopifyProductId,
                shopifyVariantId,
                shopifyProductName,
                quantity: m.quantity || 1,
              },
            });
          } else {
            mapping = await db.shopifySkuMapping.create({
              data: {
                projectId,
                sourceType: m.sourceType,
                sourceId: m.sourceId,
                sourceName: m.sourceName,
                shopifySku: m.shopifySku.trim(),
                shopifyProductId,
                shopifyVariantId,
                shopifyProductName,
                quantity: m.quantity || 1,
              },
            });
          }
          results.push(mapping);
        }
      }

      return NextResponse.json({
        success: errors.length === 0,
        message: errors.length > 0
          ? `Saved ${results.length} mappings, ${errors.length} failed`
          : `Saved ${results.length} SKU mappings`,
        mappings: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitShopifySkuMappingLogger.error({ err: error }, "SKU mapping POST error:");
    return NextResponse.json({ error: "Failed to save SKU mapping" }, { status: 500 });
  }
}
