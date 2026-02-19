import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

    // Get addons (rewards with type ADDON) for this project - include soft-deleted for admin view
    const addons = await db.reward.findMany({
      where: {
        projectId,
        type: "ADDON",
      },
      orderBy: { amount: "asc" },
    });

    return NextResponse.json({ addons });
  } catch (error) {
    console.error("Addons GET error:", error);
    return NextResponse.json({ error: "Failed to fetch addons" }, { status: 500 });
  }
}

// Helper to verify project access
async function verifyProjectAccess(projectId: string, userId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId } } },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, addonId, title, description, amount, quantityAvailable } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "create") {
      const addon = await db.reward.create({
        data: {
          projectId,
          type: "ADDON",
          title: title || "New Add-on",
          description: description || "",
          amount: amount || 0,
          quantityAvailable,
          shippingType: "NO_SHIPPING",
          shippingCountries: [],
        },
      });

      return NextResponse.json({ addon });
    }

    if (action === "update" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: {
          title,
          description,
          amount,
          quantityAvailable,
        },
      });

      return NextResponse.json({ addon });
    }

    if (action === "delete" && addonId) {
      const existing = await db.reward.findUnique({
        where: { id: addonId },
        select: { id: true, quantityClaimed: true },
      });

      if (existing?.quantityClaimed && existing.quantityClaimed > 0) {
        await db.reward.update({
          where: { id: addonId },
          data: { isEnded: true, endedAt: new Date(), visibility: "HIDDEN" },
        });
      } else {
        await db.reward.delete({
          where: { id: addonId },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "duplicate" && addonId) {
      const source = await db.reward.findUnique({ where: { id: addonId } });
      if (!source || source.projectId !== projectId) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }

      const addon = await db.reward.create({
        data: {
          projectId,
          type: "ADDON",
          title: `Copy of ${source.title}`,
          description: source.description,
          amount: source.amount,
          imageUrl: source.imageUrl,
          quantityAvailable: source.quantityAvailable,
          shippingType: source.shippingType,
          shippingCountries: source.shippingCountries,
          shippingCost: source.shippingCost || {},
          copiedFromId: source.id,
        },
      });

      return NextResponse.json({ addon });
    }

    if (action === "activate" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: { isEnded: false, endedAt: null },
      });

      return NextResponse.json({ addon });
    }

    if (action === "deactivate" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: { isEnded: true, endedAt: new Date() },
      });

      return NextResponse.json({ addon });
    }

    if (action === "delete-all") {
      // Get all addons for this project
      const allAddons = await db.reward.findMany({
        where: { projectId, type: "ADDON" },
        select: { id: true, quantityClaimed: true },
      });

      // Hard delete those with no purchases, soft delete the rest
      const noPurchases = allAddons.filter(a => !a.quantityClaimed || a.quantityClaimed === 0);
      const hasPurchases = allAddons.filter(a => a.quantityClaimed && a.quantityClaimed > 0);

      if (noPurchases.length > 0) {
        await db.reward.deleteMany({
          where: { id: { in: noPurchases.map(a => a.id) } },
        });
      }

      if (hasPurchases.length > 0) {
        await db.reward.updateMany({
          where: { id: { in: hasPurchases.map(a => a.id) } },
          data: { isEnded: true, endedAt: new Date(), visibility: "HIDDEN" },
        });
      }

      return NextResponse.json({
        success: true,
        deleted: noPurchases.length,
        hidden: hasPurchases.length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Addons POST error:", error);
    return NextResponse.json({ error: "Failed to process addon request" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const addonId = searchParams.get("addonId");

    if (!projectId || !addonId) {
      return NextResponse.json({ error: "Project ID and Addon ID required" }, { status: 400 });
    }

    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Check if addon has any purchases before hard deleting
    const addon = await db.reward.findUnique({
      where: { id: addonId },
      select: { id: true, quantityClaimed: true },
    });

    if (!addon) {
      return NextResponse.json({ error: "Addon not found" }, { status: 404 });
    }

    if (addon.quantityClaimed && addon.quantityClaimed > 0) {
      // Soft delete if there are purchases (preserve data integrity)
      await db.reward.update({
        where: { id: addonId },
        data: { isEnded: true, endedAt: new Date(), visibility: "HIDDEN" },
      });
    } else {
      // Hard delete if no purchases
      await db.reward.delete({
        where: { id: addonId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Addons DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete addon" }, { status: 500 });
  }
}
