import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/error-logs — List error groups with filtering
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "UNRESOLVED";
  const level = searchParams.get("level");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const sortBy = searchParams.get("sortBy") || "lastSeen";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status && status !== "ALL") {
    where.status = status;
  }
  if (level) {
    where.level = level;
  }
  if (source) {
    where.source = source;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { latestMessage: { contains: search, mode: "insensitive" } },
      { endpoint: { contains: search, mode: "insensitive" } },
    ];
  }

  const [groups, total, stats] = await Promise.all([
    db.errorGroup.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.errorGroup.count({ where }),
    // Stats for the sidebar badges and header cards
    Promise.all([
      db.errorGroup.count({ where: { status: "UNRESOLVED" } }),
      db.errorGroup.count({ where: { status: "IN_PROGRESS" } }),
      db.errorGroup.count({ where: { status: "RESOLVED" } }),
      db.errorGroup.count({ where: { status: "IGNORED" } }),
      db.errorGroup.count({
        where: {
          status: "UNRESOLVED",
          level: "FATAL",
        },
      }),
      db.errorGroup.aggregate({
        _sum: { eventCount: true },
        where: {
          lastSeen: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]),
  ]);

  return NextResponse.json({
    groups,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: {
      unresolved: stats[0],
      inProgress: stats[1],
      resolved: stats[2],
      ignored: stats[3],
      fatal: stats[4],
      last24hEvents: stats[5]._sum.eventCount || 0,
    },
  });
}

// DELETE /api/admin/error-logs — Bulk delete error groups
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { ids, deleteAll } = body;

  if (deleteAll) {
    const { count } = await db.errorGroup.deleteMany({
      where: { status: { in: ["RESOLVED", "IGNORED"] } },
    });
    return NextResponse.json({ deleted: count });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Cascade delete occurrences via relation
  const { count } = await db.errorGroup.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ deleted: count });
}

// PATCH /api/admin/error-logs — Bulk update status
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { ids, status } = body;

  if (!ids || !Array.isArray(ids) || !status) {
    return NextResponse.json({ error: "Missing ids or status" }, { status: 400 });
  }

  const validStatuses = ["UNRESOLVED", "IN_PROGRESS", "RESOLVED", "IGNORED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { count } = await db.errorGroup.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return NextResponse.json({ updated: count });
}
