import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAnnouncementBarLogger = logger.child({ module: "admin-announcement-bar" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Default announcement bar content
const defaultAnnouncementData = {
  text: "For instant support, please join our Discord.",
  linkUrl: "https://discord.gg/Bx6HjuKwEk",
  linkText: "https://discord.gg/Bx6HjuKwEk",
  backgroundColor: "#2563eb",
  textColor: "#ffffff",
  dismissible: true,
  isActive: true,
  sortOrder: 0,
};

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

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }

  return { ...session.user, id: user.id };
}

// GET - List all announcement bars
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    let announcements = await db.announcementBar.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // If no announcements exist, create the default one. Guard with an
    // advisory lock so two admins hitting the page at the same time
    // don't both create duplicate default announcements.
    if (announcements.length === 0) {
      const seeded = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seed-announcement-bar'))`;

        const existing = await tx.announcementBar.findMany({
          orderBy: { sortOrder: "asc" },
        });
        if (existing.length > 0) return existing;

        const created = await tx.announcementBar.create({
          data: defaultAnnouncementData,
        });
        return [created];
      });
      announcements = seeded;
    }

    const activeCount = announcements.filter((a: { isActive: boolean }) => a.isActive).length;

    return NextResponse.json({
      announcements,
      stats: {
        total: announcements.length,
        active: activeCount,
        inactive: announcements.length - activeCount,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    adminAnnouncementBarLogger.error({ err: String(error) }, "Error fetching announcement bars:");
    return NextResponse.json({ error: "Failed to fetch announcement bars" }, { status: 500, headers: corsHeaders });
  }
}

// POST - Create a new announcement bar
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      text,
      linkUrl,
      linkText,
      backgroundColor,
      textColor,
      dismissible,
      isActive,
      startDate,
      endDate,
    } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400, headers: corsHeaders });
    }

    // Get the highest sort order
    const lastAnnouncement = await db.announcementBar.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const announcement = await db.announcementBar.create({
      data: {
        text,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        backgroundColor: backgroundColor || "#2563eb",
        textColor: textColor || "#ffffff",
        dismissible: dismissible ?? true,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sortOrder: (lastAnnouncement?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ announcement }, { headers: corsHeaders });
  } catch (error) {
    adminAnnouncementBarLogger.error({ err: String(error) }, "Error creating announcement bar:");
    return NextResponse.json({ error: "Failed to create announcement bar" }, { status: 500, headers: corsHeaders });
  }
}

// PUT - Update an announcement bar
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      id,
      text,
      linkUrl,
      linkText,
      backgroundColor,
      textColor,
      dismissible,
      isActive,
      startDate,
      endDate,
      sortOrder,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Announcement ID is required" }, { status: 400, headers: corsHeaders });
    }

    const existing = await db.announcementBar.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404, headers: corsHeaders });
    }

    const announcement = await db.announcementBar.update({
      where: { id },
      data: {
        text: text ?? existing.text,
        linkUrl: linkUrl !== undefined ? linkUrl : existing.linkUrl,
        linkText: linkText !== undefined ? linkText : existing.linkText,
        backgroundColor: backgroundColor ?? existing.backgroundColor,
        textColor: textColor ?? existing.textColor,
        dismissible: dismissible !== undefined ? dismissible : existing.dismissible,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ announcement }, { headers: corsHeaders });
  } catch (error) {
    adminAnnouncementBarLogger.error({ err: String(error) }, "Error updating announcement bar:");
    return NextResponse.json({ error: "Failed to update announcement bar" }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Delete an announcement bar
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Announcement ID is required" }, { status: 400, headers: corsHeaders });
    }

    const existing = await db.announcementBar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404, headers: corsHeaders });
    }

    await db.announcementBar.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    adminAnnouncementBarLogger.error({ err: String(error) }, "Error deleting announcement bar:");
    return NextResponse.json({ error: "Failed to delete announcement bar" }, { status: 500, headers: corsHeaders });
  }
}

// PATCH - Reorder announcement bars
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { announcementIds } = body;

    if (!Array.isArray(announcementIds)) {
      return NextResponse.json({ error: "announcementIds must be an array" }, { status: 400, headers: corsHeaders });
    }

    // Update sort order for each announcement
    await Promise.all(
      announcementIds.map((id: string, index: number) =>
        db.announcementBar.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    adminAnnouncementBarLogger.error({ err: String(error) }, "Error reordering announcement bars:");
    return NextResponse.json({ error: "Failed to reorder announcement bars" }, { status: 500, headers: corsHeaders });
  }
}
