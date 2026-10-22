import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { windDownProject, retryWindDownRefunds } from "@/lib/projects/wind-down";

const log = logger.child({ module: "admin-project-wind-down" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST { reason, notifyCreator?, retry? }
// Close a campaign that isn't worth processing: refund every charged
// pledge, release every uncharged one, email the backers, and send the
// creator a courteous note. Refuses a campaign that has been paid out.
// `retry: true` re-runs only the refunds that failed at the processor.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true, role: true },
  });
  if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));

    if (body.retry === true) {
      const r = await retryWindDownRefunds(projectId);
      return NextResponse.json({ ok: true, retried: r });
    }

    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!reason) return NextResponse.json({ error: "A reason is required — the creator is told why" }, { status: 400 });

    const result = await windDownProject({
      projectId,
      cause: "admin",
      outcome: "CANCELLED",
      note: reason,
      actorId: admin.id,
      notifyCreator: body.notifyCreator !== false,
    });
    if (result.outcome === "skipped") {
      return NextResponse.json({ error: result.skippedReason || "Nothing to do" }, { status: 400 });
    }
    log.info({ ...result, adminId: admin.id }, "Admin wound down campaign");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error({ err: formatError(error) }, "wind-down failed");
    return NextResponse.json({ error: "Wind-down failed — check server logs" }, { status: 500 });
  }
}
