import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
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

    const where: {
      category?: string;
      isPublished?: boolean;
    } = {};

    if (category) {
      where.category = category;
    }

    if (published === "true") {
      where.isPublished = true;
    } else if (published === "false") {
      where.isPublished = false;
    }

    const [entries, total] = await Promise.all([
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
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching changelog entries:", error);
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
    console.error("Error creating changelog entry:", error);
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
    console.error("Error updating changelog entry:", error);
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

    await db.changelogEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting changelog entry:", error);
    return NextResponse.json({ error: "Failed to delete changelog entry" }, { status: 500 });
  }
}
