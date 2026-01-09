import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get survey response for a specific pledge (creator view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge with project info
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            creatorId: true,
            collaborators: {
              where: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        },
        reward: {
          select: { id: true, title: true },
        },
        addons: {
          include: {
            addon: {
              select: { id: true, title: true },
            },
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify creator/collaborator access
    const isOwner = pledge.project.creatorId === session.user.id;
    const isCollaborator = pledge.project.collaborators.length > 0;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get survey for this project
    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: {
        itemQuestions: {
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            customQuestions: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        },
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({
        survey: null,
        response: null,
        questions: { itemQuestions: [], backerQuestions: [] },
      });
    }

    // Get survey response for this pledge
    const response = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    // For creator view, return ALL survey questions (not filtered by reward)
    // This allows creators to see the complete survey configuration
    return NextResponse.json({
      survey: {
        id: survey.id,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
        collectAddresses: survey.collectAddresses,
        status: survey.status,
        addressesLocked: survey.addressesLocked,
      },
      pledge: {
        id: pledge.id,
        rewardTitle: pledge.reward?.title || "No Reward",
        backerName: pledge.user?.name,
        backerEmail: pledge.user?.email,
        addons: pledge.addons.map((a: { addon: { id: string; title: string } }) => ({
          id: a.addon.id,
          title: a.addon.title,
        })),
      },
      questions: {
        // Return all item questions from the survey
        itemQuestions: survey.itemQuestions,
        // Return all backer questions from the survey
        backerQuestions: survey.backerQuestions,
      },
      response: response
        ? {
            itemResponses: response.itemResponses,
            backerResponses: response.backerResponses,
            shippingAddress: response.shippingAddress,
            isComplete: response.isComplete,
            completedAt: response.completedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching pledge survey response:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey response" },
      { status: 500 }
    );
  }
}
