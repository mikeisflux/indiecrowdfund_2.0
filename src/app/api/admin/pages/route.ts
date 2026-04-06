import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPagesLogger = logger.child({ module: "admin-pages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get custom pages
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const status = searchParams.get("status") || "all";
    const pageId = searchParams.get("id");
    const skip = (page - 1) * limit;

    // Get single page if ID provided
    if (pageId) {
      const customPage = await db.customPage.findUnique({
        where: { id: pageId }
      });

      if (!customPage) {
        return NextResponse.json(
          { error: "Page not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ page: customPage });
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status === "published") {
      where.isPublished = true;
    } else if (status === "draft") {
      where.isPublished = false;
    }

    const [pages, total] = await Promise.all([
      db.customPage.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      db.customPage.count({ where })
    ]);

    return NextResponse.json({
      pages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    adminPagesLogger.error({ err: String(error) }, "Error fetching pages:");
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

// POST - Create custom page
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { slug, title, description, content, metaTitle, metaDescription, ogImage, isPublished } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { error: "Slug and title are required" },
        { status: 400 }
      );
    }

    // Prevent slugs that conflict with reserved application routes
    const RESERVED_SLUGS = [
      "admin", "api", "auth", "profile", "dashboard", "projects",
      "backer", "creator", "marketplace", "settings", "search",
      "login", "signup", "register", "logout", "explore", "discover",
    ];
    const normalizedSlug = slug.toLowerCase();
    if (
      RESERVED_SLUGS.includes(normalizedSlug) ||
      normalizedSlug.startsWith("api/") ||
      normalizedSlug.startsWith("admin/") ||
      normalizedSlug.startsWith("auth/")
    ) {
      return NextResponse.json(
        { error: "This slug is reserved and cannot be used for custom pages" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await db.customPage.findUnique({
      where: { slug }
    });

    if (existing) {
      return NextResponse.json(
        { error: "A page with this slug already exists" },
        { status: 400 }
      );
    }

    const page = await db.customPage.create({
      data: {
        slug,
        title,
        description,
        content: content || { blocks: [] },
        metaTitle,
        metaDescription,
        ogImage,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        createdBy: authResult.user.id
      }
    });

    return NextResponse.json({ success: true, page });
  } catch (error) {
    adminPagesLogger.error({ err: String(error) }, "Error creating page:");
    return NextResponse.json(
      { error: "Failed to create page" },
      { status: 500 }
    );
  }
}

// PATCH - Update custom page
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { id, slug, title, description, content, metaTitle, metaDescription, ogImage, isPublished } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Page ID is required" },
        { status: 400 }
      );
    }

    const existingPage = await db.customPage.findUnique({
      where: { id }
    });

    if (!existingPage) {
      return NextResponse.json(
        { error: "Page not found" },
        { status: 404 }
      );
    }

    // Check if new slug already exists (if slug is being changed)
    if (slug && slug !== existingPage.slug) {
      const slugExists = await db.customPage.findUnique({
        where: { slug }
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A page with this slug already exists" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (slug !== undefined) updateData.slug = slug;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (ogImage !== undefined) updateData.ogImage = ogImage;

    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      if (isPublished && !existingPage.isPublished) {
        updateData.publishedAt = new Date();
      }
    }

    const page = await db.customPage.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, page });
  } catch (error) {
    adminPagesLogger.error({ err: String(error) }, "Error updating page:");
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}

// DELETE - Delete custom page
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Page ID is required" },
        { status: 400 }
      );
    }

    await db.customPage.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminPagesLogger.error({ err: String(error) }, "Error deleting page:");
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
