import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPrelaunchLogger = logger.child({ module: "admin-prelaunch" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user, role: user.role };
}

/**
 * GET /api/admin/prelaunch
 *
 * Get all prelaunch pages for admin review
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    // Build where clause.
    // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
    // runtime — use `NOT: { field: null }` wrapper syntax instead.
    const where: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { prelaunchActive: true },
        { prelaunchStatus: { in: ["SUBMITTED", "APPROVED", "REJECTED"] } },
        { NOT: { prelaunchDescription: null } },
      ],
    };

    // Filter by prelaunch status
    if (status !== "all") {
      where.prelaunchStatus = status;
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          prelaunchStatus: true,
          prelaunchActive: true,
          prelaunchDescription: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              vanityUrl: true,
            },
          },
          _count: {
            select: {
              followers: true,
            },
          },
        },
      }),
      db.project.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await Promise.all([
      db.project.count({ where: { ...where, prelaunchStatus: "DRAFT" } }),
      db.project.count({ where: { ...where, prelaunchStatus: "SUBMITTED" } }),
      db.project.count({ where: { ...where, prelaunchStatus: "APPROVED" } }),
      db.project.count({ where: { ...where, prelaunchStatus: "REJECTED" } }),
      db.project.count({ where: { ...where, prelaunchActive: true } }),
    ]);

    const formattedProjects = projects.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      projectStatus: p.status,
      prelaunchStatus: p.prelaunchStatus,
      prelaunchActive: p.prelaunchActive,
      prelaunchDescription: p.prelaunchDescription,
      createdAt: p.createdAt.toISOString(),
      creator: p.creator,
      followerCount: p._count.followers,
    }));

    return NextResponse.json({
      projects: formattedProjects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: {
        draft: statusCounts[0],
        submitted: statusCounts[1],
        approved: statusCounts[2],
        rejected: statusCounts[3],
        live: statusCounts[4],
      },
    });
  } catch (error) {
    adminPrelaunchLogger.error({ err: String(error) }, "Error fetching prelaunch pages:");
    return NextResponse.json(
      { error: "Failed to fetch prelaunch pages" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/prelaunch
 *
 * Update prelaunch page status (approve, reject, unpublish)
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { projectId, action, reason } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        creatorId: true,
        prelaunchStatus: true,
        prelaunchActive: true,
        status: true,
        creator: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    let reviewNotes = "";

    switch (action) {
      case "APPROVE":
        updateData = {
          prelaunchStatus: "APPROVED",
          prelaunchActive: true, // Auto-activate on approval
        };
        reviewNotes = "Prelaunch page approved and activated by admin";
        break;

      case "REJECT":
        updateData = {
          prelaunchStatus: "REJECTED",
          prelaunchActive: false,
        };
        reviewNotes = reason || "Prelaunch page rejected by admin";
        break;

      case "UNPUBLISH":
        updateData = {
          prelaunchActive: false,
        };
        reviewNotes = reason || "Prelaunch page unpublished by admin";
        break;

      case "PUBLISH":
        if (project.prelaunchStatus !== "APPROVED") {
          return NextResponse.json(
            { error: "Can only publish approved prelaunch pages" },
            { status: 400 }
          );
        }
        updateData = {
          prelaunchActive: true,
        };
        reviewNotes = "Prelaunch page published by admin";
        break;

      case "DELETE":
        // Clear all prelaunch data
        updateData = {
          prelaunchActive: false,
          prelaunchDescription: null,
          prelaunchStatus: "DRAFT",
        };
        reviewNotes = reason || "Prelaunch page deleted by admin";
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const newPrelaunchStatus = (updateData.prelaunchStatus as string | undefined) ?? project.prelaunchStatus;
    const willActivate = !!(updateData.prelaunchActive);
    const shouldPromoteCreator = willActivate && project.creator?.role === "USER" && project.creatorId;

    // CAS on prelaunchStatus matching the value we read above, so two
    // admins approving/rejecting the same prelaunch page can't both
    // create duplicate ProjectReview rows and both promote the creator.
    const casResult = await db.project.updateMany({
      where: {
        id: projectId,
        prelaunchStatus: project.prelaunchStatus,
        deletedAt: null,
      },
      data: updateData,
    });

    if (casResult.count === 0) {
      return NextResponse.json(
        { error: "Prelaunch status changed — another admin may have already acted. Please refresh." },
        { status: 409 }
      );
    }

    const [updatedProject] = await db.$transaction([
      db.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          prelaunchStatus: true,
          prelaunchActive: true,
        },
      }),
      db.projectReview.create({
        data: {
          projectId,
          // ProjectReview.action is the ReviewAction enum (no "REVIEWED"
          // value). Map prelaunch actions onto the closest existing
          // member; the prelaunch transition itself is captured in
          // `notes` and the flagsRaised marker below.
          action:
            action === "APPROVE" ? "APPROVED"
            : action === "REJECT" ? "REJECTED"
            : action === "PUBLISH" ? "REACTIVATE"
            : "DEACTIVATE",
          // previousStatus/newStatus are ProjectStatus, not PrelaunchStatus.
          // Prelaunch actions don't actually change project.status, so
          // both sides stay equal to the current project status. The
          // prelaunch transition (e.g. SUBMITTED -> REJECTED) lives in
          // `notes` for audit purposes.
          previousStatus: project.status,
          newStatus: project.status,
          notes: `[Prelaunch ${action}: ${project.prelaunchStatus} -> ${newPrelaunchStatus}] ${reviewNotes}`,
          flagsRaised: ["prelaunch_admin_action"],
        },
      }),
      ...(shouldPromoteCreator
        ? [db.user.update({ where: { id: project.creatorId! }, data: { role: "CREATOR" } })]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: `Prelaunch page ${action.toLowerCase()}ed successfully`,
    });
  } catch (error) {
    adminPrelaunchLogger.error({ err: String(error) }, "Error updating prelaunch page:");
    return NextResponse.json(
      { error: "Failed to update prelaunch page" },
      { status: 500 }
    );
  }
}
