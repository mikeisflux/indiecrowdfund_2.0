import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
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

    // Get existing SKU mappings
    const mappings = await db.shopifySkuMapping.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    // Build list of items that need mapping
    const unmappedItems: Array<{
      sourceType: string;
      sourceId: string;
      sourceName: string;
      amount?: number;
      quantityClaimed?: number;
    }> = [];

    // Check rewards (both tiers and addons)
    for (const reward of project.rewards) {
      const isMapped = mappings.some(
        (m: { sourceType: string; sourceId: string }) => m.sourceType === "REWARD" && m.sourceId === reward.id
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

    // Check project items
    for (const item of project.projectItems) {
      const isMapped = mappings.some(
        (m: { sourceType: string; sourceId: string }) => m.sourceType === "PROJECT_ITEM" && m.sourceId === item.id
      );
      if (!isMapped) {
        unmappedItems.push({
          sourceType: "PROJECT_ITEM",
          sourceId: item.id,
          sourceName: item.title,
        });
      }
    }

    return NextResponse.json({
      mappings,
      unmappedItems,
      rewards: project.rewards,
      projectItems: project.projectItems,
    });
  } catch (error) {
    console.error("SKU mapping GET error:", error);
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
      shopifyProductId,
      shopifyVariantId,
      shopifyProductName,
      quantity,
      mappingId,
    } = body;

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

    // CREATE or UPDATE mapping
    if (action === "save" || action === "create" || action === "update") {
      if (!sourceType || !sourceId || !sourceName || !shopifySku) {
        return NextResponse.json(
          { error: "sourceType, sourceId, sourceName, and shopifySku are required" },
          { status: 400 }
        );
      }

      const mapping = await db.shopifySkuMapping.upsert({
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
          shopifySku,
          shopifyProductId: shopifyProductId || null,
          shopifyVariantId: shopifyVariantId || null,
          shopifyProductName: shopifyProductName || null,
          quantity: quantity || 1,
        },
        update: {
          sourceName,
          shopifySku,
          shopifyProductId: shopifyProductId || null,
          shopifyVariantId: shopifyVariantId || null,
          shopifyProductName: shopifyProductName || null,
          quantity: quantity || 1,
        },
      });

      return NextResponse.json({
        success: true,
        message: "SKU mapping saved",
        mapping,
      });
    }

    // DELETE mapping
    if (action === "delete") {
      if (!mappingId) {
        return NextResponse.json({ error: "Mapping ID required" }, { status: 400 });
      }

      await db.shopifySkuMapping.delete({
        where: { id: mappingId },
      });

      return NextResponse.json({
        success: true,
        message: "SKU mapping deleted",
      });
    }

    // BULK SAVE mappings
    if (action === "bulk_save") {
      const { mappings } = body;
      if (!mappings || !Array.isArray(mappings)) {
        return NextResponse.json({ error: "mappings array required" }, { status: 400 });
      }

      const results = [];
      for (const m of mappings) {
        if (m.sourceType && m.sourceId && m.sourceName && m.shopifySku) {
          const mapping = await db.shopifySkuMapping.upsert({
            where: {
              projectId_sourceType_sourceId: {
                projectId,
                sourceType: m.sourceType,
                sourceId: m.sourceId,
              },
            },
            create: {
              projectId,
              sourceType: m.sourceType,
              sourceId: m.sourceId,
              sourceName: m.sourceName,
              shopifySku: m.shopifySku,
              shopifyProductId: m.shopifyProductId || null,
              shopifyVariantId: m.shopifyVariantId || null,
              shopifyProductName: m.shopifyProductName || null,
              quantity: m.quantity || 1,
            },
            update: {
              sourceName: m.sourceName,
              shopifySku: m.shopifySku,
              shopifyProductId: m.shopifyProductId || null,
              shopifyVariantId: m.shopifyVariantId || null,
              shopifyProductName: m.shopifyProductName || null,
              quantity: m.quantity || 1,
            },
          });
          results.push(mapping);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Saved ${results.length} SKU mappings`,
        mappings: results,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("SKU mapping POST error:", error);
    return NextResponse.json({ error: "Failed to save SKU mapping" }, { status: 500 });
  }
}
