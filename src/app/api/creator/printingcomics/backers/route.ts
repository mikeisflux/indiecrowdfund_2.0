import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "printingcomics-backers" });

// Returns the list of fulfillable pledges for a project — completed
// (charged) backers with a usable shipping address. Used by the
// PrintingComics tab to drive its per-row submit table.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Authorize against the project: creator OR accepted collaborator.
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const pledges = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: "COMPLETED",
      },
      select: {
        id: true,
        shippingAddress: true,
        printingComicsStatus: true,
        printingComicsOrderNumber: true,
        printingComicsTrackingNumber: true,
        printingComicsLastSyncedAt: true,
        user: { select: { name: true, email: true } },
        reward: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const backers = pledges.map((p) => {
      const ship = p.shippingAddress as Record<string, string> | null;
      const hasShippingAddress = !!(ship && ship.line1 && ship.city && ship.country);
      return {
        id: p.id,
        name: p.user.name || "Backer",
        email: p.user.email || "",
        rewardTitle: p.reward?.title || null,
        hasShippingAddress,
        printingComicsStatus: p.printingComicsStatus,
        printingComicsOrderNumber: p.printingComicsOrderNumber,
        printingComicsTrackingNumber: p.printingComicsTrackingNumber,
        printingComicsLastSyncedAt: p.printingComicsLastSyncedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({ backers });
  } catch (err) {
    log.error({ err: String(err) }, "list backers failed");
    return NextResponse.json({ error: "Failed to load backers" }, { status: 500 });
  }
}
