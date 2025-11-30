import { NextRequest, NextResponse } from "next/server";
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

// GET - Get media files
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const folder = searchParams.get("folder") || "all";
    const mimeType = searchParams.get("mimeType") || "all";
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (folder !== "all") {
      where.folder = folder;
    }
    if (mimeType !== "all") {
      where.mimeType = { startsWith: mimeType };
    }
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } }
      ];
    }

    const [files, total, stats] = await Promise.all([
      db.mediaFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      db.mediaFile.count({ where }),
      Promise.all([
        db.mediaFile.count(),
        db.mediaFile.aggregate({ _sum: { size: true } }),
        db.mediaFile.count({ where: { mimeType: { startsWith: "image" } } }),
        db.mediaFile.count({ where: { mimeType: { startsWith: "video" } } }),
        db.mediaFile.count({ where: { mimeType: { startsWith: "application/pdf" } } })
      ])
    ]);

    // Get unique folders
    const folders = await db.mediaFile.groupBy({
      by: ["folder"],
      _count: true
    });

    return NextResponse.json({
      files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        totalFiles: stats[0],
        totalSize: stats[1]._sum.size || 0,
        images: stats[2],
        videos: stats[3],
        documents: stats[4]
      },
      folders: folders.map((f: { folder: string; _count: number }) => ({
        name: f.folder,
        count: f._count
      }))
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media files" },
      { status: 500 }
    );
  }
}

// POST - Upload media file (metadata only - actual file upload would use a separate service)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { filename, originalName, mimeType, size, url, thumbnailUrl, width, height, duration, folder, tags, altText } = body;

    if (!filename || !originalName || !mimeType || !size || !url) {
      return NextResponse.json(
        { error: "Required fields: filename, originalName, mimeType, size, url" },
        { status: 400 }
      );
    }

    const file = await db.mediaFile.create({
      data: {
        uploaderId: authResult.user.id,
        filename,
        originalName,
        mimeType,
        size,
        url,
        thumbnailUrl,
        width,
        height,
        duration,
        folder: folder || "uploads",
        tags: tags || [],
        altText
      }
    });

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      { error: "Failed to upload media file" },
      { status: 500 }
    );
  }
}

// PATCH - Update media file
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { fileId, folder, tags, altText } = body;

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (folder !== undefined) updateData.folder = folder;
    if (tags !== undefined) updateData.tags = tags;
    if (altText !== undefined) updateData.altText = altText;

    const file = await db.mediaFile.update({
      where: { id: fileId },
      data: updateData
    });

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error("Error updating media:", error);
    return NextResponse.json(
      { error: "Failed to update media file" },
      { status: 500 }
    );
  }
}

// DELETE - Delete media file
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // In production, also delete the actual file from storage
    await db.mediaFile.delete({
      where: { id: fileId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: "Failed to delete media file" },
      { status: 500 }
    );
  }
}
