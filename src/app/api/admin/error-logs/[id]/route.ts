import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/error-logs/[id] — Get error group with occurrences
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const occurrencePage = parseInt(searchParams.get("occurrencePage") || "1");
  const occurrenceLimit = 20;

  const group = await db.errorGroup.findUnique({
    where: { id },
    include: {
      occurrences: {
        orderBy: { timestamp: "desc" },
        skip: (occurrencePage - 1) * occurrenceLimit,
        take: occurrenceLimit,
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Error group not found" }, { status: 404 });
  }

  const totalOccurrences = await db.errorOccurrence.count({
    where: { groupId: id },
  });

  // Build a frequency chart (occurrences per hour for last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentOccurrences = await db.errorOccurrence.findMany({
    where: {
      groupId: id,
      timestamp: { gte: twentyFourHoursAgo },
    },
    select: { timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  // Build hourly buckets
  const frequencyChart: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const count = recentOccurrences.filter(
      (o: { timestamp: Date }) => o.timestamp >= hourStart && o.timestamp < hourEnd
    ).length;
    frequencyChart.push({
      hour: hourStart.toISOString(),
      count,
    });
  }

  return NextResponse.json({
    group,
    totalOccurrences,
    occurrencePage,
    occurrencePages: Math.ceil(totalOccurrences / occurrenceLimit),
    frequencyChart,
  });
}

// PATCH /api/admin/error-logs/[id] — Update error group status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, assignedTo } = body;

  const validStatuses = ["UNRESOLVED", "IN_PROGRESS", "RESOLVED", "IGNORED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (status) data.status = status;
  if (assignedTo !== undefined) data.assignedTo = assignedTo;

  const updated = await db.errorGroup.update({
    where: { id },
    data,
  });

  return NextResponse.json({ group: updated });
}

// DELETE /api/admin/error-logs/[id] — Delete error group and all occurrences
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  await db.errorGroup.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
