import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const refundRequestsLogger = logger.child({ module: "creator-refund-requests" });

export const dynamic = "force-dynamic";

// GET /api/creator/refund-requests?projectId=xxx
// Returns all refund requests for projects owned by (or collaborated on by) the creator
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status"); // PENDING | APPROVED | DENIED | all

    // Find projects the user owns or collaborates on
    const ownedProjectIds = (
      await db.project.findMany({
        where: { creatorId: session.user.id, deletedAt: null },
        select: { id: true },
      })
    ).map((p) => p.id);

    const collaboratedProjectIds = (
      await db.projectCollaborator.findMany({
        where: { userId: session.user.id, status: "ACCEPTED" },
        select: { projectId: true },
      })
    ).map((c: { projectId: string }) => c.projectId);

    const authorizedProjectIds = [...new Set([...ownedProjectIds, ...collaboratedProjectIds])];

    if (authorizedProjectIds.length === 0) {
      return NextResponse.json({ refundRequests: [] });
    }

    const where: Record<string, unknown> = {
      projectId: projectId
        ? authorizedProjectIds.includes(projectId)
          ? projectId
          : { in: [] }
        : { in: authorizedProjectIds },
    };

    if (status && status !== "all") {
      const validStatuses = ["PENDING", "APPROVED", "DENIED"];
      const normalizedStatus = status.toUpperCase();
      if (!validStatuses.includes(normalizedStatus)) {
        return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
      }
      where.status = normalizedStatus;
    }

    const refundRequests = await db.refundRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        pledge: {
          select: {
            id: true,
            amount: true,
            paymentProcessor: true,
            status: true,
          },
        },
        project: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      refundRequests: refundRequests.map((rr: typeof refundRequests[number]) => ({
        ...rr,
        pledge: rr.pledge ? { ...rr.pledge, amount: Number(rr.pledge.amount) } : null,
      })),
    });
  } catch (error) {
    refundRequestsLogger.error({ err: formatError(error) }, "Error fetching refund requests");
    return NextResponse.json({ error: "Failed to fetch refund requests" }, { status: 500 });
  }
}
