import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitAddonsLogger = logger.child({ module: "creator-indiekit-addons" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/auth/collaborator";

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

    // Read access -- the catalogue listing should be visible to any
    // collaborator who can edit OR coordinate fulfillment (segments /
    // surveys / packing). Owner always passes.
    const access =
      (await getProjectAccess(projectId, session.user.id, "canEditProject")) ||
      (await getProjectAccess(projectId, session.user.id, "canCoordinateFulfillment"));
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get addons linked to the survey (showInSurvey = true)
    const addons = await db.reward.findMany({
      where: {
        projectId,
        type: "ADDON",
        showInSurvey: true,
      },
      orderBy: { amount: "asc" },
    });

    return NextResponse.json({ addons });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons GET error:");
    return NextResponse.json({ error: "Failed to fetch addons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, addonId, addonIds, title, description, amount, quantityAvailable } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Mutations require the catalog-edit perm. Legacy collaborators
    // (all four perms false) auto-pass; new restricted collaborators
    // are 403'd here before they can touch the price / quantity / name.
    const access = await getProjectAccess(projectId, session.user.id, "canEditProject");
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Create a new addon and auto-link to survey
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
          showInSurvey: true,
        },
      });

      return NextResponse.json({ addon });
    }

    // Update an existing addon.
    //
    // CRITICAL: every single-id mutation in this file used to update by
    // `{ id: addonId }` without scoping to `projectId`. The access check
    // on line 74 only confirms the caller can edit *some* project --
    // they could then pass an addonId belonging to ANY other project
    // and mutate the foreign row cross-tenant (rename, change price,
    // zero out quantity, end the campaign for that creator's addons,
    // etc.). updateMany with `{ id, projectId, type: "ADDON" }` makes
    // the same scope mandatory; count:0 -> 404, can't escape the tenant.
    if (action === "update" && addonId) {
      const result = await db.reward.updateMany({
        where: { id: addonId, projectId, type: "ADDON" },
        data: { title, description, amount, quantityAvailable },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }
      const addon = await db.reward.findUnique({ where: { id: addonId } });
      return NextResponse.json({ addon });
    }

    // Link existing addon(s) to the survey
    if (action === "link" && addonIds?.length) {
      const result = await db.reward.updateMany({
        where: {
          id: { in: addonIds },
          projectId,
          type: "ADDON",
        },
        data: { showInSurvey: true },
      });

      return NextResponse.json({ success: true, linked: result.count });
    }

    // Unlink a single addon from the survey (scoped to projectId — see
    // CRITICAL note on `update` above).
    if (action === "unlink" && addonId) {
      const result = await db.reward.updateMany({
        where: { id: addonId, projectId, type: "ADDON" },
        data: { showInSurvey: false },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    // Unlink all addons from the survey
    if (action === "unlink-all") {
      const result = await db.reward.updateMany({
        where: { projectId, type: "ADDON", showInSurvey: true },
        data: { showInSurvey: false },
      });

      return NextResponse.json({ success: true, unlinked: result.count });
    }

    if (action === "activate" && addonId) {
      const result = await db.reward.updateMany({
        where: { id: addonId, projectId, type: "ADDON" },
        data: { isEnded: false, endedAt: null },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }
      const addon = await db.reward.findUnique({ where: { id: addonId } });
      return NextResponse.json({ addon });
    }

    if (action === "deactivate" && addonId) {
      const result = await db.reward.updateMany({
        where: { id: addonId, projectId, type: "ADDON" },
        data: { isEnded: true, endedAt: new Date() },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Addon not found" }, { status: 404 });
      }
      const addon = await db.reward.findUnique({ where: { id: addonId } });
      return NextResponse.json({ addon });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons POST error:");
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

    // DELETE = unlink-from-survey -- still a catalog mutation, so the
    // same canEditProject gate applies.
    const access = await getProjectAccess(projectId, session.user.id, "canEditProject");
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Unlink from survey, scoped to projectId (see the CRITICAL note in
    // POST `update` above). The previous version mutated any addon by
    // id without tenant scope.
    const result = await db.reward.updateMany({
      where: { id: addonId, projectId, type: "ADDON" },
      data: { showInSurvey: false },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Addon not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons DELETE error:");
    return NextResponse.json({ error: "Failed to delete addon" }, { status: 500 });
  }
}
