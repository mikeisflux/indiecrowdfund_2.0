import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "admin-rolling-reserve-release" });

// Release a held rolling reserve. Admin can release early if needed
// (e.g. fully completed campaign with no chargebacks at 90 days), but
// the normal flow waits for the 180-day window. Sets
// `rollingReserveReleased=true` + `rollingReserveReleasedAt=now`. The
// payout calculator then re-includes the held amount in amountOwed
// for the next settlement.
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

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        rollingReserveSubject: true,
        rollingReserveAuto: true,
        rollingReserveAmount: true,
        rollingReserveHeldAt: true,
        rollingReserveReleased: true,
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.rollingReserveReleased) {
      return NextResponse.json(
        { error: "Reserve has already been released" },
        { status: 400 }
      );
    }
    if (!project.rollingReserveHeldAt) {
      return NextResponse.json(
        { error: "No reserve has been placed on this project" },
        { status: 400 }
      );
    }

    const cas = await db.project.updateMany({
      where: { id: projectId, rollingReserveReleased: false, deletedAt: null },
      data: {
        rollingReserveReleased: true,
        rollingReserveReleasedAt: new Date(),
      },
    });
    if (cas.count === 0) {
      return NextResponse.json(
        { error: "Reserve was released by another admin" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      releasedAmount: Number(project.rollingReserveAmount),
    });
  } catch (err) {
    log.error({ err: String(err) }, "release error");
    return NextResponse.json(
      { error: "Failed to release reserve" },
      { status: 500 }
    );
  }
}
