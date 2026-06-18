import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";

const devCalendarLogger = logger.child({ module: "admin-dev-calendar" });

export const dynamic = "force-dynamic";

const createSchema = z.object({
  type: z.enum(["NOTE", "REMINDER", "JOB_SCHEDULE"]).default("NOTE"),
  title: z.string().min(1).max(200),
  description: z.string().max(20000).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
  cronExpression: z.string().max(120).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]).default("PENDING"),
});

// GET /api/admin/dev-calendar
//   Optional query params:
//     ?type=NOTE|REMINDER|JOB_SCHEDULE
//     ?status=PENDING|IN_PROGRESS|DONE|SKIPPED
//     ?tag=<tag-name>
//     ?from=<iso>
//     ?to=<iso>
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (tag) where.tags = { has: tag };
    if (from || to) {
      where.scheduledFor = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const entries = await db.devCalendarEntry.findMany({
      where,
      orderBy: [
        // Pending / in-progress first, then done, with scheduledFor
        // ascending inside each bucket so today's items lead.
        { status: "asc" },
        { scheduledFor: "asc" },
      ],
      take: 500,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    devCalendarLogger.error({ err: formatError(error) }, "List entries failed");
    return NextResponse.json({ error: "Failed to list entries" }, { status: 500 });
  }
}

// POST /api/admin/dev-calendar
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const entry = await db.devCalendarEntry.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        cronExpression: data.cronExpression ?? null,
        link: data.link ?? null,
        tags: data.tags,
        status: data.status,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }
    devCalendarLogger.error({ err: formatError(error) }, "Create entry failed");
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
