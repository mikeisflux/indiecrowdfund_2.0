import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsSurveyLockLogger = logger.child({ module: "projects-survey-lock" });
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
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
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

    // Lock survey and all responses — CAS on status: SENT → LOCKED
    // so a concurrent second lock request doesn't overwrite lockedAt
    // and doesn't needlessly re-run the bulk address update.
    const lockCas = await db.survey.updateMany({
      where: { id: survey.id, status: "SENT" },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        addressesLocked: true,
      },
    });

    if (lockCas.count === 0) {
      return NextResponse.json(
        { error: "Survey has already been locked" },
        { status: 400 }
      );
    }

    // Lock all response addresses (only runs if we won the CAS)
    await db.surveyResponse.updateMany({
      where: { surveyId: survey.id },
      data: { addressLocked: true },
    });

    return NextResponse.json({
      success: true,
      message: "Survey and addresses have been locked",
    });
  } catch (error) {
    projectsSurveyLockLogger.error({ err: formatError(error) }, "Error locking survey:");
    return NextResponse.json(
      { error: "Failed to lock survey" },
      { status: 500 }
    );
  }
}
