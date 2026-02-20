import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Lock survey (prevent further changes)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: {
            userId: session.user.id,
            status: "ACCEPTED",
            canCoordinateFulfillment: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const hasPermission = project.collaborators.length > 0;

    if (!isOwner && !hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status !== "SENT") {
      return NextResponse.json(
        { error: "Survey must be sent before locking addresses" },
        { status: 400 }
      );
    }

    // Lock survey and all responses
    await db.$transaction(async (tx) => {
      // Update survey status to LOCKED
      await tx.survey.update({
        where: { id: survey.id },
        data: {
          status: "LOCKED",
          lockedAt: new Date(),
          addressesLocked: true,
        },
      });

      // Lock all response addresses
      await tx.surveyResponse.updateMany({
        where: { surveyId: survey.id },
        data: { addressLocked: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Survey and addresses have been locked",
    });
  } catch (error) {
    console.error("Error locking survey:", error);
    return NextResponse.json(
      { error: "Failed to lock survey" },
      { status: 500 }
    );
  }
}
