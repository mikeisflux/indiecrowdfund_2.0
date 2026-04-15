import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSeoRedirectsLogger = logger.child({ module: "admin-seo-redirects" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List all redirects
export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [redirects, total, activeCount] = await Promise.all([
      db.seoRedirect.findMany({
        orderBy: { createdAt: "desc" },
      }),
      db.seoRedirect.count(),
      db.seoRedirect.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      data: redirects,
      stats: {
        total,
        active: activeCount,
        inactive: total - activeCount,
        totalHits: redirects.reduce((sum: number, r: { hitCount: number }) => sum + r.hitCount, 0),
      },
    });
  } catch (error) {
    adminSeoRedirectsLogger.error({ err: String(error) }, "Error fetching SEO redirects:");
    return NextResponse.json(
      { error: "Failed to fetch SEO redirects" },
      { status: 500 }
    );
  }
}

// POST - Create a new redirect
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { fromPath, toPath, statusCode, isActive } = body;

    if (!fromPath || typeof fromPath !== "string") {
      return NextResponse.json(
        { error: "fromPath is required and must be a string" },
        { status: 400 }
      );
    }

    if (!toPath || typeof toPath !== "string") {
      return NextResponse.json(
        { error: "toPath is required and must be a string" },
        { status: 400 }
      );
    }

    // Normalize paths to start with /
    const normalizedFrom = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    const normalizedTo = toPath.startsWith("/") || toPath.startsWith("http")
      ? toPath
      : `/${toPath}`;

    // Validate status code
    const validStatusCodes = [301, 302, 307, 308];
    const redirectStatusCode = statusCode || 301;
    if (!validStatusCodes.includes(redirectStatusCode)) {
      return NextResponse.json(
        { error: `Invalid status code. Must be one of: ${validStatusCodes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check for duplicate fromPath
    const existing = await db.seoRedirect.findFirst({
      where: { fromPath: normalizedFrom },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A redirect from this path already exists" },
        { status: 409 }
      );
    }

    // Prevent redirect loops
    if (normalizedFrom === normalizedTo) {
      return NextResponse.json(
        { error: "fromPath and toPath cannot be the same (redirect loop)" },
        { status: 400 }
      );
    }

    let redirect;
    try {
      redirect = await db.seoRedirect.create({
        data: {
          fromPath: normalizedFrom,
          toPath: normalizedTo,
          statusCode: redirectStatusCode,
          isActive: isActive ?? true,
        },
      });
    } catch (createErr) {
      // P2002 on fromPath @unique — the findFirst check above is TOCTOU.
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "A redirect from this path already exists" },
          { status: 409 }
        );
      }
      throw createErr;
    }

    return NextResponse.json({
      data: redirect,
      stats: {
        action: "created",
        fromPath: redirect.fromPath,
        toPath: redirect.toPath,
      },
    });
  } catch (error) {
    adminSeoRedirectsLogger.error({ err: String(error) }, "Error creating SEO redirect:");
    return NextResponse.json(
      { error: "Failed to create SEO redirect" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing redirect by id
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, fromPath, toPath, statusCode, isActive } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Redirect ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.seoRedirect.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Redirect not found" },
        { status: 404 }
      );
    }

    // If fromPath is being changed, check for duplicates
    // Normalize before comparing so "/path" and "path" are treated as identical
    const normalizedFrom = fromPath ? (fromPath.startsWith("/") ? fromPath : `/${fromPath}`) : null;
    if (normalizedFrom && normalizedFrom !== existing.fromPath) {
      const duplicate = await db.seoRedirect.findFirst({
        where: {
          fromPath: normalizedFrom,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Another redirect from this path already exists" },
          { status: 409 }
        );
      }
    }

    // Validate status code if provided
    if (statusCode !== undefined) {
      const validStatusCodes = [301, 302, 307, 308];
      if (!validStatusCodes.includes(statusCode)) {
        return NextResponse.json(
          { error: `Invalid status code. Must be one of: ${validStatusCodes.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: {
      fromPath?: string;
      toPath?: string;
      statusCode?: number;
      isActive?: boolean;
    } = {};

    if (fromPath !== undefined) {
      updateData.fromPath = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    }
    if (toPath !== undefined) {
      updateData.toPath = toPath.startsWith("/") || toPath.startsWith("http")
        ? toPath
        : `/${toPath}`;
    }
    if (statusCode !== undefined) {
      updateData.statusCode = statusCode;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Check for redirect loop
    const finalFrom = updateData.fromPath || existing.fromPath;
    const finalTo = updateData.toPath || existing.toPath;
    if (finalFrom === finalTo) {
      return NextResponse.json(
        { error: "fromPath and toPath cannot be the same (redirect loop)" },
        { status: 400 }
      );
    }

    const redirect = await db.seoRedirect.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      data: redirect,
      stats: {
        action: "updated",
        fromPath: redirect.fromPath,
        toPath: redirect.toPath,
      },
    });
  } catch (error) {
    adminSeoRedirectsLogger.error({ err: String(error) }, "Error updating SEO redirect:");
    return NextResponse.json(
      { error: "Failed to update SEO redirect" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a redirect by id (from searchParams)
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
        { error: "Redirect ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.seoRedirect.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Redirect not found" },
        { status: 404 }
      );
    }

    await db.seoRedirect.delete({
      where: { id },
    });

    return NextResponse.json({
      data: { success: true },
      stats: {
        action: "deleted",
        fromPath: existing.fromPath,
      },
    });
  } catch (error) {
    adminSeoRedirectsLogger.error({ err: String(error) }, "Error deleting SEO redirect:");
    return NextResponse.json(
      { error: "Failed to delete SEO redirect" },
      { status: 500 }
    );
  }
}
