import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminChangelogLogger = logger.child({ module: "admin-changelog" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true, id: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return { ...session.user, id: user.id };
}

// GET - List all changelog entries
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const category = url.searchParams.get("category");
    const published = url.searchParams.get("published");

    const search = url.searchParams.get("search");

    const where: {
      category?: string;
      isPublished?: boolean;
      OR?: Array<{ title?: { contains: string; mode: "insensitive" }; description?: { contains: string; mode: "insensitive" } }>;
    } = {};

    if (category) {
      where.category = category;
    }

    if (published === "true") {
      where.isPublished = true;
    } else if (published === "false") {
      where.isPublished = false;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // "Upgrades" is the union of non-bugfix, non-OTHER categories —
    // improvements, security, performance, UI/UX, API, and docs — so the
    // admin dashboard can show a single "software upgrades" count next to
    // "new features" and "bug fixes" (which is what the page used to show
    // before the stats were trimmed).
    const UPGRADE_CATEGORIES = [
      "IMPROVEMENT",
      "SECURITY",
      "PERFORMANCE",
      "UI_UX",
      "API",
      "DOCUMENTATION",
    ] as const;

    const [
      entries,
      total,
      publishedCount,
      draftCount,
      bugfixCount,
      featureCount,
      upgradeCount,
    ] = await Promise.all([
      db.changelogEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { name: true, email: true },
          },
        },
      }),
      db.changelogEntry.count({ where }),
      db.changelogEntry.count({ where: { isPublished: true } }),
      db.changelogEntry.count({ where: { isPublished: false } }),
      db.changelogEntry.count({ where: { category: "BUGFIX" } }),
      db.changelogEntry.count({ where: { category: "FEATURE" } }),
      db.changelogEntry.count({ where: { category: { in: [...UPGRADE_CATEGORIES] } } }),
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        published: publishedCount,
        drafts: draftCount,
        bugfixes: bugfixCount,
        features: featureCount,
        upgrades: upgradeCount,
      },
    });
  } catch (error) {
    adminChangelogLogger.error({ err: String(error) }, "Error fetching changelog entries:");
    return NextResponse.json({ error: "Failed to fetch changelog entries" }, { status: 500 });
  }
}

// POST - Create a new changelog entry
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, category, version, commitHash, branch, isPublished } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: "Title, description, and category are required" },
        { status: 400 }
      );
    }

    const entry = await db.changelogEntry.create({
      data: {
        title,
        description,
        category,
        version: version || null,
        commitHash: commitHash || null,
        branch: branch || null,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        authorId: admin.id,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    adminChangelogLogger.error({ err: String(error) }, "Error creating changelog entry:");
    return NextResponse.json({ error: "Failed to create changelog entry" }, { status: 500 });
  }
}

// PUT - Update a changelog entry
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, title, description, category, version, commitHash, branch, isPublished } = body;

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    const existing = await db.changelogEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // If publishing for the first time, set publishedAt
    const publishedAt = isPublished && !existing.isPublished ? new Date() : existing.publishedAt;

    const entry = await db.changelogEntry.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        description: description ?? existing.description,
        category: category ?? existing.category,
        version: version !== undefined ? version : existing.version,
        commitHash: commitHash !== undefined ? commitHash : existing.commitHash,
        branch: branch !== undefined ? branch : existing.branch,
        isPublished: isPublished ?? existing.isPublished,
        publishedAt,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    adminChangelogLogger.error({ err: String(error) }, "Error updating changelog entry:");
    return NextResponse.json({ error: "Failed to update changelog entry" }, { status: 500 });
  }
}

// DELETE - Delete a changelog entry
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    // deleteMany for idempotency on concurrent double-clicks.
    await db.changelogEntry.deleteMany({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminChangelogLogger.error({ err: String(error) }, "Error deleting changelog entry:");
    return NextResponse.json({ error: "Failed to delete changelog entry" }, { status: 500 });
  }
}
