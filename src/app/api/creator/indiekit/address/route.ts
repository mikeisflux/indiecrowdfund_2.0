import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitAddressLogger = logger.child({ module: "creator-indiekit-address" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, pledgeId, address } = body;

    if (!projectId || !pledgeId) {
      return NextResponse.json({ error: "Project ID and Pledge ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Verify the pledge belongs to this project
    const pledge = await db.pledge.findFirst({ where: { id: pledgeId, projectId, deletedAt: null },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (!address || typeof address !== "object") {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    // MERGE into the stored address. Survey addresses also carry the
    // recipient's name and phone (used on labels and exports); a
    // wholesale replace from the edit form — which only holds street
    // fields — was silently wiping both.
    const surveyResponse = await db.surveyResponse.findFirst({
      where: { pledgeId },
    });

    if (!surveyResponse) {
      // Previously returned success without saving anything.
      return NextResponse.json(
        { error: "This backer hasn't submitted a survey yet, so there is no address to edit." },
        { status: 404 }
      );
    }

    const existing =
      surveyResponse.shippingAddress && typeof surveyResponse.shippingAddress === "object"
        ? (surveyResponse.shippingAddress as Record<string, unknown>)
        : {};
    await db.surveyResponse.update({
      where: { id: surveyResponse.id },
      data: {
        shippingAddress: { ...existing, ...address },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitAddressLogger.error({ err: formatError(error) }, "Address API error:");
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}
