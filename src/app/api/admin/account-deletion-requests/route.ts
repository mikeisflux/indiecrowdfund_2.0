import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDeletionEligibility } from "@/lib/account-deletion/eligibility";

const log = logger.child({ module: "admin-account-deletion-requests" });

export const dynamic = "force-dynamic";

// GET /api/admin/account-deletion-requests?status=PENDING
//
// Queue of creators asking to delete their account. Only creators who have
// taken a campaign live land here; backers delete themselves without review.
//
// Alongside the snapshot taken when the request was filed, each row carries
// a freshly recomputed `current` eligibility. Fulfillment moves after a
// request is submitted, so the reviewer needs today's numbers — approving
// against a stale snapshot could release a creator who has since taken on
// new obligations.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const statusParam = request.nextUrl.searchParams.get("status") || "PENDING";
    const validStatuses = ["PENDING", "APPROVED", "DENIED", "CANCELLED"];
    const where =
      statusParam === "ALL"
        ? {}
        : validStatuses.includes(statusParam)
          ? { status: statusParam }
          : { status: "PENDING" };

    const requests = await db.accountDeletionRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            createdAt: true,
            accountDeletedAt: true,
          },
        },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Recompute live numbers for anything still awaiting a decision.
    const enriched = await Promise.all(
      requests.map(async (r: { id: string; status: string; userId: string }) => {
        if (r.status !== "PENDING") return { ...r, current: null };
        try {
          const current = await getDeletionEligibility(r.userId);
          return { ...r, current };
        } catch (err) {
          log.error(
            { err: formatError(err), requestId: r.id },
            "Failed to recompute eligibility for deletion request"
          );
          return { ...r, current: null };
        }
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to list account deletion requests");
    return NextResponse.json(
      { error: "Failed to load deletion requests" },
      { status: 500 }
    );
  }
}
