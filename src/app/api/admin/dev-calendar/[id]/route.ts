import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";

const devCalendarItemLogger = logger.child({ module: "admin-dev-calendar-item" });

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  type: z.enum(["NOTE", "REMINDER", "JOB_SCHEDULE"]).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20000).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
  cronExpression: z.string().max(120).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduledFor !== undefined) {
      updateData.scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null;
    }
    if (data.cronExpression !== undefined) updateData.cronExpression = data.cronExpression;
    if (data.link !== undefined) updateData.link = data.link;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Stamp completedAt when transitioning to DONE; clear if
      // moved back to a non-terminal state.
      if (data.status === "DONE") {
        updateData.completedAt = new Date();
      } else if (data.status === "PENDING" || data.status === "IN_PROGRESS") {
        updateData.completedAt = null;
      }
    }

    const entry = await db.devCalendarEntry.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }
    devCalendarItemLogger.error({ err: formatError(error) }, "Update entry failed");
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await db.devCalendarEntry.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    devCalendarItemLogger.error({ err: formatError(error) }, "Delete entry failed");
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
