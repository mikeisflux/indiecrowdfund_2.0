import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSeoKeywordsLogger = logger.child({ module: "admin-seo-keywords" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List all tracked keywords with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isTracked = searchParams.get("isTracked");
    const query = searchParams.get("query");

    const where: {
      category?: string;
      isTracked?: boolean;
      keyword?: { contains: string; mode: "insensitive" };
    } = {};

    if (category) {
      where.category = category;
    }

    if (isTracked === "true") {
      where.isTracked = true;
    } else if (isTracked === "false") {
      where.isTracked = false;
    }

    if (query) {
      where.keyword = { contains: query, mode: "insensitive" };
    }

    const [keywords, total, trackedCount, categories] = await Promise.all([
      db.seoKeyword.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      }),
      db.seoKeyword.count({ where }),
      db.seoKeyword.count({ where: { isTracked: true } }),
      db.seoKeyword.groupBy({
        by: ["category"],
        _count: true,
      }),
    ]);

    return NextResponse.json({
      data: keywords,
      stats: {
        total,
        tracked: trackedCount,
        categories: categories.reduce(
          (acc: Record<string, number>, item: { category: string | null; _count: number }) => {
            acc[item.category || "uncategorized"] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    adminSeoKeywordsLogger.error({ err: String(error) }, "Error fetching SEO keywords:");
    return NextResponse.json(
      { error: "Failed to fetch SEO keywords" },
      { status: 500 }
    );
  }
}

// POST - Add a new keyword
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      keyword,
      category,
      targetPages,
      currentRank,
      searchVolume,
      difficulty,
      isTracked,
      notes,
    } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: "Keyword is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Create with P2002 catch on keyword @unique. The findFirst check
    // is TOCTOU under concurrent creates.
    let newKeyword;
    try {
      newKeyword = await db.seoKeyword.create({
        data: {
          keyword: keyword.trim().toLowerCase(),
          category: category || null,
          targetPages: targetPages || [],
          currentRank: currentRank ?? null,
          searchVolume: searchVolume ?? null,
          difficulty: difficulty ?? null,
          isTracked: isTracked ?? true,
          notes: notes || null,
        },
      });
    } catch (createErr) {
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "Keyword already exists" },
          { status: 409 }
        );
      }
      throw createErr;
    }

    return NextResponse.json({
      data: newKeyword,
      stats: {
        action: "created",
        keyword: newKeyword.keyword,
      },
    });
  } catch (error) {
    adminSeoKeywordsLogger.error({ err: String(error) }, "Error creating SEO keyword:");
    return NextResponse.json(
      { error: "Failed to create SEO keyword" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing keyword by id
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      keyword,
      category,
      targetPages,
      currentRank,
      previousRank,
      searchVolume,
      difficulty,
      isTracked,
      notes,
    } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Keyword ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.seoKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Keyword not found" },
        { status: 404 }
      );
    }

    // If keyword text is being changed, check for duplicate
    if (keyword && keyword.trim().toLowerCase() !== existing.keyword) {
      const duplicate = await db.seoKeyword.findFirst({
        where: {
          keyword: keyword.trim().toLowerCase(),
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Another keyword with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updatedKeyword = await db.seoKeyword.update({
      where: { id },
      data: {
        keyword: keyword !== undefined ? keyword.trim().toLowerCase() : existing.keyword,
        category: category !== undefined ? category : existing.category,
        targetPages: targetPages !== undefined ? targetPages : existing.targetPages,
        currentRank: currentRank !== undefined ? currentRank : existing.currentRank,
        previousRank: previousRank !== undefined ? previousRank : existing.previousRank,
        searchVolume: searchVolume !== undefined ? searchVolume : existing.searchVolume,
        difficulty: difficulty !== undefined ? difficulty : existing.difficulty,
        isTracked: isTracked !== undefined ? isTracked : existing.isTracked,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });

    return NextResponse.json({
      data: updatedKeyword,
      stats: {
        action: "updated",
        keyword: updatedKeyword.keyword,
      },
    });
  } catch (error) {
    adminSeoKeywordsLogger.error({ err: String(error) }, "Error updating SEO keyword:");
    return NextResponse.json(
      { error: "Failed to update SEO keyword" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a keyword by id (from searchParams)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Keyword ID is required" },
        { status: 400 }
      );
    }

    // Look up the keyword name first so we can return it in the stats.
    const existing = await db.seoKeyword.findUnique({
      where: { id },
      select: { keyword: true },
    });

    // deleteMany for idempotency on concurrent double-clicks.
    const deleted = await db.seoKeyword.deleteMany({
      where: { id },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Keyword not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { success: true },
      stats: {
        action: "deleted",
        keyword: existing?.keyword ?? "",
      },
    });
  } catch (error) {
    adminSeoKeywordsLogger.error({ err: String(error) }, "Error deleting SEO keyword:");
    return NextResponse.json(
      { error: "Failed to delete SEO keyword" },
      { status: 500 }
    );
  }
}
