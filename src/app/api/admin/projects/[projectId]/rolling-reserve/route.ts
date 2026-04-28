import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  computeRollingReserveAmount,
  computeRollingReserveReleaseDate,
} from "@/lib/payments/rolling-reserve";

const log = logger.child({ module: "admin-rolling-reserve" });

const bodySchema = z.object({
  rollingReserveSubject: z.boolean(),
});

// Toggle the manual `rollingReserveSubject` flag on a project. The
// auto-trigger flag (`rollingReserveAuto`) is owned by the funding
// flow and isn't editable here. If a project is already past funding
// completion, flipping the flag now seeds heldAt/releaseAt off the
// current revenue snapshot — admins typically want to mark new
// projects before they fund, but this still does the right thing if
// they flag a project after the fact.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
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

    const { projectId } = await params;
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { rollingReserveSubject } = parsed.data;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        currentAmount: true,
        rollingReserveSubject: true,
        rollingReserveAuto: true,
        rollingReserveHeldAt: true,
        rollingReserveReleaseAt: true,
        rollingReserveReleased: true,
        paymentProcessor: true,
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.paymentProcessor !== "NMI") {
      return NextResponse.json(
        { error: "Rolling reserve only applies to PaymentCloud (NMI) projects" },
        { status: 400 }
      );
    }
    if (project.rollingReserveReleased) {
      return NextResponse.json(
        { error: "Reserve has already been released; cannot re-flag" },
        { status: 400 }
      );
    }

    const subjectAfter = rollingReserveSubject || project.rollingReserveAuto;
    const now = new Date();

    // If we're enabling and the project already has revenue, seed the
    // held-at + release-at windows from the current snapshot. If
    // disabling, leave the windows alone — the held amount goes to 0
    // but if a hold is currently in place, the release schedule
    // continues so we don't accidentally lose the reserve.
    let updates: Record<string, unknown> = {
      rollingReserveSubject,
    };
    if (subjectAfter && !project.rollingReserveHeldAt) {
      const gross = Number(project.currentAmount);
      updates = {
        ...updates,
        rollingReserveAmount: computeRollingReserveAmount(gross, true),
        rollingReserveHeldAt: now,
        rollingReserveReleaseAt: computeRollingReserveReleaseDate(now),
      };
    } else if (!subjectAfter && !project.rollingReserveAuto) {
      // Manual un-flag and the auto trigger isn't active — clear the
      // reserve. (If auto is active the reserve still applies.)
      updates = {
        ...updates,
        rollingReserveAmount: 0,
        rollingReserveHeldAt: null,
        rollingReserveReleaseAt: null,
      };
    }

    await db.project.update({
      where: { id: projectId },
      data: updates,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err: String(err) }, "rolling reserve toggle error");
    return NextResponse.json(
      { error: "Failed to update rolling reserve" },
      { status: 500 }
    );
  }
}
