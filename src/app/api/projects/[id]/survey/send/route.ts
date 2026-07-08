import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsSurveySendLogger = logger.child({ module: "projects-survey-send" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifySurveySent } from "@/lib/notifications";

// POST - Send survey to all backers
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;

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
      include: {
        itemQuestions: true,
        backerQuestions: true,
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Check if survey has been sent already
    if (survey.status === "SENT" || survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Survey has already been sent" },
        { status: 400 }
      );
    }

    // Validate survey has some content
    const hasContent =
      survey.itemQuestions.length > 0 ||
      survey.backerQuestions.length > 0 ||
      survey.collectAddresses;

    if (!hasContent) {
      return NextResponse.json(
        { error: "Survey must have at least one question or collect addresses" },
        { status: 400 }
      );
    }

    // Get all completed pledges for this project
    const pledges = await db.pledge.findMany({
      where: {
        projectId,
        status: "COMPLETED",
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json(
        { error: "No backers to send survey to" },
        { status: 400 }
      );
    }

    // CAS on survey status so two concurrent "Send Survey" clicks
    // don't both create SurveyResponse rows and both fire duplicate
    // notifications to every backer. The status check above is
    // TOCTOU without this.
    const sendCas = await db.survey.updateMany({
      where: { id: survey.id, status: { notIn: ["SENT", "LOCKED"] } },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    if (sendCas.count === 0) {
      return NextResponse.json(
        { error: "Survey has already been sent" },
        { status: 400 }
      );
    }

    // Create empty responses and reset pledge survey flags — only
    // runs if we won the CAS above.
    await db.$transaction(async (tx) => {
      for (const pledge of pledges) {
        const existingResponse = await tx.surveyResponse.findUnique({
          where: { pledgeId: pledge.id },
        });

        if (!existingResponse) {
          await tx.surveyResponse.create({
            data: {
              surveyId: survey.id,
              pledgeId: pledge.id,
              isComplete: false,
            },
          });
        }

        await tx.pledge.update({
          where: { id: pledge.id },
          data: { surveyCompleted: false },
        });
      }
    });

    // Send notifications to all backers
    await notifySurveySent(projectId, project.title);

    return NextResponse.json({
      success: true,
      backerCount: pledges.length,
      message: `Survey sent to ${pledges.length} backer${pledges.length !== 1 ? "s" : ""}`,
    });
  } catch (error) {
    projectsSurveySendLogger.error({ err: formatError(error) }, "Error sending survey:");
    return NextResponse.json(
      { error: "Failed to send survey" },
      { status: 500 }
    );
  }
}
