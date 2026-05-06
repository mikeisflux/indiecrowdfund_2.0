import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "admin-email-creator-sent" });

// GET /api/admin/email/creator-sent
//
// Admin monitor view: every email that came out of the platform on
// behalf of a creator (IndieKit campaign sends, inbox composes/replies,
// scheduled-campaign cron, AI-marketing campaigns, etc.). Source is
// EmailQueue rows tagged `isCreatorEmail = true`.
//
// Query params:
//   - status: "all" | "PENDING" | "PROCESSING" | "SENT" | "FAILED"
//   - search: matches toEmail / subject / fromEmail (case-insensitive)
//   - page, limit (defaults 1, 50; cap 200)
//
// Returns the list + counts so the UI can render filter pills.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (me?.role !== "ADMIN" && me?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isCreatorEmail: true };
    if (status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { toEmail: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { fromEmail: { contains: search, mode: "insensitive" } },
        { fromName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, counts] = await Promise.all([
      db.emailQueue.findMany({
        where,
        select: {
          id: true,
          toEmail: true,
          subject: true,
          fromEmail: true,
          fromName: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          error: true,
          createdAt: true,
          processedAt: true,
          sentAt: true,
          priority: true,
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      db.emailQueue.count({ where }),
      // Per-status counts so the filter pills can show numbers without
      // needing a second client-side fetch.
      db.emailQueue.groupBy({
        by: ["status"],
        where: { isCreatorEmail: true },
        _count: { _all: true },
      }),
    ]);

    const countByStatus: Record<string, number> = { all: 0, PENDING: 0, PROCESSING: 0, SENT: 0, FAILED: 0 };
    for (const c of counts) {
      countByStatus[c.status] = c._count._all;
      countByStatus.all += c._count._all;
    }

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      countByStatus,
    });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, "creator-sent list error");
    return NextResponse.json({ error: "Failed to load creator-sent emails" }, { status: 500 });
  }
}
