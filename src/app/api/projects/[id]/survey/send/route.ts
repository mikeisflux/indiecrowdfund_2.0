import { NextRequest, NextResponse } from "next/server";
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

    // Update survey status and create empty responses for each backer
    await db.$transaction(async (tx) => {
      // Update survey status
      await tx.survey.update({
        where: { id: survey.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      // Create survey responses for each pledge (if not exists)
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

        // Update pledge to show survey is pending
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
    console.error("Error sending survey:", error);
    return NextResponse.json(
      { error: "Failed to send survey" },
      { status: 500 }
    );
  }
}
