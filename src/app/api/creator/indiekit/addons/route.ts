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
      // Hide from survey form - does not permanently delete the reward
      await db.reward.update({
        where: { id: addonId },
        data: { visibility: "HIDDEN" },
      });

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
      // Get all ADDON rewards for this project
      const allAddons = await db.reward.findMany({
        where: { projectId, type: "ADDON" },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      // Group by title to find originals vs copies
      const byTitle = new Map<string, typeof allAddons>();
      for (const addon of allAddons) {
        const existing = byTitle.get(addon.title) || [];
        existing.push(addon);
        byTitle.set(addon.title, existing);
      }

      // For each title, keep the oldest (original), delete newer copies
      const copyIds: string[] = [];
      const originalIds: string[] = [];
      for (const [, addons] of byTitle) {
        originalIds.push(addons[0].id); // oldest = original
        for (let i = 1; i < addons.length; i++) {
          copyIds.push(addons[i].id); // newer = copies
        }
      }

      // Hard-delete copies that have no pledge references
      let deletedCount = 0;
      if (copyIds.length > 0) {
        // Check which copies have pledge references
        const copiesWithPledges = await db.pledgeAddon.findMany({
          where: { addonId: { in: copyIds } },
          select: { addonId: true },
        });
        const pledgeAddonIds = new Set(copiesWithPledges.map(p => p.addonId));

        const safeToDelete = copyIds.filter(id => !pledgeAddonIds.has(id));
        const mustHide = copyIds.filter(id => pledgeAddonIds.has(id));

        if (safeToDelete.length > 0) {
          await db.reward.deleteMany({
            where: { id: { in: safeToDelete } },
          });
          deletedCount = safeToDelete.length;
        }

        // Hide copies that have pledge references (can't delete)
        if (mustHide.length > 0) {
          await db.reward.updateMany({
            where: { id: { in: mustHide } },
            data: { visibility: "HIDDEN" },
          });
        }
      }

      // Hide originals from survey (they still exist on the project)
      if (originalIds.length > 0) {
        await db.reward.updateMany({
          where: { id: { in: originalIds } },
          data: { visibility: "HIDDEN" },
        });
      }

      return NextResponse.json({
        success: true,
        removed: originalIds.length,
        duplicatesDeleted: deletedCount,
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

    // Hide from survey form - does not permanently delete the reward
    await db.reward.update({
      where: { id: addonId },
      data: { visibility: "HIDDEN" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Addons DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete addon" }, { status: 500 });
  }
}
