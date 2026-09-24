import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSegmentsLogger = logger.child({ module: "creator-indiekit-segments" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Segment schema
const segmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(["PLEDGE_LEVEL", "ADDON", "SURVEY_STATUS", "SHIPPING_REGION", "PAYMENT_STATUS", "CUSTOM"]),
  criteria: z.any().optional(),
  isDynamic: z.boolean().default(true),
  staticBackerIds: z.array(z.string()).optional(),
});

// Shared owner-or-collaborator check used by every method below.
async function verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId, status: "ACCEPTED" } } },
      ],
    },
    select: { id: true },
  });
  return !!project;
}

// GET - List segments for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
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

    const segments = await db.backerSegment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    // Map to frontend format
    type SegmentType = { id: string; name: string; description: string | null; type: string; criteria: unknown; backerCount: number; createdAt: Date };
    const formattedSegments = segments.map((segment: SegmentType) => ({
      id: segment.id,
      name: segment.name,
      // Included so the edit dialog can round-trip it — omitting it
      // meant every rename overwrote the description with "".
      description: segment.description || "",
      type: segment.type.toLowerCase(),
      criteria: segment.criteria ? JSON.stringify(segment.criteria) : "",
      backerCount: segment.backerCount,
      createdAt: segment.createdAt.toLocaleDateString(),
    }));

    return NextResponse.json({ segments: formattedSegments });
  } catch (error) {
    creatorIndiekitSegmentsLogger.error({ err: formatError(error) }, "IndieKit segments fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 }
    );
  }
}

// POST - Create a new segment
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, ...segmentData } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Duplicate an existing segment. The tab has offered this since it
    // shipped; the request used to fall into the create schema and 400.
    if (body.action === "duplicate" && typeof body.segmentId === "string") {
      if (!(await verifyProjectAccess(session.user.id, projectId))) {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
      }
      const source = await db.backerSegment.findFirst({
        where: { id: body.segmentId, projectId },
      });
      if (!source) {
        return NextResponse.json({ error: "Segment not found" }, { status: 404 });
      }
      const copy = await db.backerSegment.create({
        data: {
          projectId,
          name: `${source.name} (Copy)`.slice(0, 100),
          description: source.description,
          type: source.type,
          criteria: source.criteria ?? undefined,
          isDynamic: source.isDynamic,
          staticBackerIds: source.staticBackerIds,
          backerCount: source.backerCount,
        },
      });
      return NextResponse.json({ segment: copy }, { status: 201 });
    }

    const validatedData = segmentSchema.parse(segmentData);

    // Verify access
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

    // Calculate initial backer count based on criteria
    let backerCount = 0;
    if (validatedData.isDynamic && validatedData.criteria) {
      // For dynamic segments, calculate count based on criteria
      // This is a simplified version - in production you'd have more complex filtering
      backerCount = await db.pledge.count({
        where: {
          projectId,
          deletedAt: null,
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
          ],
        },
      });
    } else if (validatedData.staticBackerIds) {
      backerCount = validatedData.staticBackerIds.length;
    }

    const segment = await db.backerSegment.create({
      data: {
        projectId,
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        criteria: validatedData.criteria,
        isDynamic: validatedData.isDynamic,
        staticBackerIds: validatedData.staticBackerIds || [],
        backerCount,
      },
    });

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    creatorIndiekitSegmentsLogger.error({ err: formatError(error) }, "IndieKit segment create error:");
    return NextResponse.json(
      { error: "Failed to create segment" },
      { status: 500 }
    );
  }
}

// PATCH - Rename / re-describe a segment. The segments tab has offered
// Edit since it shipped; this is the server side it never had.
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, segmentId } = body as { projectId?: string; segmentId?: string };
    if (!projectId || !segmentId) {
      return NextResponse.json({ error: "Project ID and segment ID required" }, { status: 400 });
    }
    if (!(await verifyProjectAccess(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const patchSchema = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      })
      .strict();
    const parsed = patchSchema.safeParse({ name: body.name, description: body.description });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid segment fields" }, { status: 400 });
    }

    const updated = await db.backerSegment.updateMany({
      where: { id: segmentId, projectId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitSegmentsLogger.error({ err: formatError(error) }, "IndieKit segment update error:");
    return NextResponse.json({ error: "Failed to update segment" }, { status: 500 });
  }
}

// DELETE - Remove a segment (?segmentId=&projectId=). Deleting a
// segment never touches pledges — it's just the saved grouping.
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const segmentId = searchParams.get("segmentId");
    if (!projectId || !segmentId) {
      return NextResponse.json({ error: "Project ID and segment ID required" }, { status: 400 });
    }
    if (!(await verifyProjectAccess(session.user.id, projectId))) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const deleted = await db.backerSegment.deleteMany({
      where: { id: segmentId, projectId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitSegmentsLogger.error({ err: formatError(error) }, "IndieKit segment delete error:");
    return NextResponse.json({ error: "Failed to delete segment" }, { status: 500 });
  }
}
