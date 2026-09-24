import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSegmentsBackersLogger = logger.child({ module: "creator-indiekit-segments-backers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveSegmentPledges } from "@/lib/segments";

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

    // Shared resolution (also used by segment emailing) so criteria
    // semantics can't drift between listing and sending.
    const resolved = await resolveSegmentPledges(segmentId, projectId);
    if (!resolved) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }
    const { pledges } = resolved;

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
    creatorIndiekitSegmentsBackersLogger.error({ err: formatError(error) }, "Segments backers fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch segment backers" },
      { status: 500 }
    );
  }
}
