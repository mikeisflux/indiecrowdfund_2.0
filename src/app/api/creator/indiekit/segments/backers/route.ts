import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitSegmentsBackersLogger = logger.child({ module: "creator-indiekit-segments-backers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get backers belonging to a segment
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const segmentId = searchParams.get("segmentId");
    const projectId = searchParams.get("projectId");

    if (!segmentId || !projectId) {
      return NextResponse.json({ error: "Segment ID and Project ID are required" }, { status: 400 });
    }

    // Verify project access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get the segment
    const segment = await db.backerSegment.findFirst({
      where: {
        id: segmentId,
        projectId,
      },
    });

    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Get backers based on segment type
    // For static segments, use the stored pledge IDs
    // For dynamic segments, apply criteria-based filtering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      projectId,
      status: "COMPLETED",
      deletedAt: null,
    };

    if (!segment.isDynamic && segment.staticBackerIds.length > 0) {
      whereClause.id = { in: segment.staticBackerIds };
    } else if (segment.isDynamic && segment.criteria) {
      // Apply dynamic criteria filtering
      const criteria = segment.criteria as { field?: string; operator?: string; value?: unknown };

      if (criteria.field === "pledgeAmount" && criteria.operator && criteria.value != null) {
        const amount = Number(criteria.value);
        switch (criteria.operator) {
          case ">=": whereClause.amount = { gte: amount }; break;
          case "<=": whereClause.amount = { lte: amount }; break;
          case ">": whereClause.amount = { gt: amount }; break;
          case "<": whereClause.amount = { lt: amount }; break;
          case "=": whereClause.amount = amount; break;
        }
      }

      if (criteria.field === "rewardId" && criteria.value) {
        whereClause.rewardId = criteria.value;
      }

      if (criteria.field === "surveyCompleted") {
        whereClause.surveyCompleted = criteria.value === true || criteria.value === "true";
      }

      if (criteria.field === "country" && criteria.value) {
        whereClause.shippingAddress = {
          path: ["country"],
          equals: criteria.value,
        };
      }
    }

    const pledges = await db.pledge.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        reward: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const backers = pledges.map(pledge => ({
      id: pledge.id,
      name: pledge.user?.name || "Anonymous",
      email: pledge.user?.email || "",
      pledgeAmount: Number(pledge.amount),
      reward: pledge.reward?.title || "No Reward",
      surveyCompleted: pledge.surveyCompleted || false,
    }));

    return NextResponse.json({ backers, total: backers.length });
  } catch (error) {
    creatorIndiekitSegmentsBackersLogger.error({ err: String(error) }, "Segments backers fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch segment backers" },
      { status: 500 }
    );
  }
}
