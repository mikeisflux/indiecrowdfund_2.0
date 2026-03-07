import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminLinkSanitizerLogger = logger.child({ module: "admin-link-sanitizer" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/link-sanitizer - List all project links
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const unused = searchParams.get("unused"); // "90" days
    const search = searchParams.get("search");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deletedAt: null, // Exclude soft-deleted projects
    };

    if (status) {
      where.status = status;
    }

    // Calculate unused threshold date (90 days)
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (unused === "90") {
      where.status = "DRAFT";
      where.backerCount = 0;
      where.updatedAt = { lt: ninetyDaysAgo };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { creator: { name: { contains: search, mode: "insensitive" } } },
        { creator: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch projects
    const projects = await db.project.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            vanityUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    // Calculate stats
    const [total, draft, unused90Days] = await Promise.all([
      db.project.count({ where: { deletedAt: null } }),
      db.project.count({ where: { status: "DRAFT", deletedAt: null } }),
      db.project.count({
        where: {
          status: "DRAFT",
          backerCount: 0,
          updatedAt: { lt: ninetyDaysAgo },
          deletedAt: null,
        },
      }),
    ]);

    // Format projects with full URL
    const formattedProjects = projects.map((project) => {
      const basePath = project.creator.vanityUrl
        ? `projects/${project.creator.vanityUrl}/${project.slug}`
        : `projects/${project.slug}`;

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        status: project.status,
        creator: {
          id: project.creator.id,
          name: project.creator.name,
          email: project.creator.email,
          vanityUrl: project.creator.vanityUrl,
        },
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        backerCount: project.backerCount,
        currentAmount: Number(project.currentAmount),
        goalAmount: Number(project.goalAmount),
        fullUrl: basePath,
      };
    });

    return NextResponse.json({
      projects: formattedProjects,
      stats: {
        total,
        draft,
        unused90Days,
      },
    });
  } catch (error) {
    adminLinkSanitizerLogger.error({ err: String(error) }, "Failed to fetch project links:");
    return NextResponse.json(
      { error: "Failed to fetch project links" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/link-sanitizer - Delete projects
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectIds } = body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: "No project IDs provided" },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt
    const result = await db.project.updateMany({
      where: {
        id: { in: projectIds },
        deletedAt: null, // Only delete if not already deleted
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    adminLinkSanitizerLogger.error({ err: String(error) }, "Failed to delete projects:");
    return NextResponse.json(
      { error: "Failed to delete projects" },
      { status: 500 }
    );
  }
}
